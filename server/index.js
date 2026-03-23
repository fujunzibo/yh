import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { parseSearchIntent } from './parseQuery.js';
import {
  searchTaobaoAffiliate,
  searchJdAffiliate,
  ensurePromotionLinks,
  stableItemIdFromRow,
} from './zhetaoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const APPKEY = process.env.ZHETAOKE_APPKEY || '';

const PAGE_SIZE_DEFAULT = 20;
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000; // 2 分钟
const searchCache = new Map();

function getSearchMaxWaves() {
  const n = parseInt(process.env.SEARCH_MAX_WAVES || '5', 10);
  if (!Number.isFinite(n) || n < 1) return 5;
  // 至少 2 波（0 与 1），否则「下一页」永远无法触发追加拉取
  return Math.min(Math.max(n, 2), 20);
}

function dedupeKeyNormalized(i) {
  const v = String(i.itemId ?? '').trim();
  if (v) return v;
  return stableItemIdFromRow(i.raw || {});
}

function sortNormalizedItems(items) {
  return [...items].sort((a, b) => {
    const pa = Number(a.price) || 0;
    const pb = Number(b.price) || 0;
    if (pa !== pb) return pa - pb;
    return dedupeKeyNormalized(a).localeCompare(dedupeKeyNormalized(b));
  });
}

/** 合并新拉取的商品（按 itemId 去重），返回合并后列表与新增条数 */
function mergeNormalizedDedup(existing, incoming) {
  const seen = new Set(existing.map(dedupeKeyNormalized));
  const added = [];
  for (const x of incoming) {
    const id = dedupeKeyNormalized(x);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    added.push(x);
  }
  return { merged: existing.concat(added), newCount: added.length };
}

/** 两列共用同一页码时的总页数（与 sliceChannel 一致） */
function dualMaxPages(taoLen, jdLen, pageSize) {
  const tp = Math.max(1, Math.ceil(taoLen / pageSize) || 1);
  const jp = Math.max(1, Math.ceil(jdLen / pageSize) || 1);
  return Math.max(tp, jp);
}

/** 请求的页码超出当前合并列表能提供的页数时的说明 */
function pageShortfallHint(page, tLen, jLen, pageSize, fetchWaveMax, maxW) {
  const maxP = dualMaxPages(tLen, jLen, pageSize);
  if (page <= maxP) return null;
  const f = Number.isFinite(Number(fetchWaveMax)) ? Number(fetchWaveMax) : 0;
  const hitWaveCap = f + 1 >= maxW;
  if (hitWaveCap) {
    return `您请求的是第 ${page} 页，但去重后的结果只够展示 ${maxP} 页，且已达到 SEARCH_MAX_WAVES（${maxW} 波）上限。可在 .env 中增大 SEARCH_MAX_WAVES，或更换关键词 / 放宽价格区间后再搜。`;
  }
  return `您请求的是第 ${page} 页，但去重后仍只够 ${maxP} 页（后续分页与已有列表重复较多）。界面将显示第 ${maxP} 页内容。`;
}

/**
 * 再拉一波联盟分页并合并进 hit（不使用 pagedPull，单波数据量大，供本地多页切片）。
 */
async function extendSearchCacheOneWave(hit, APPKEY, keyword, minPrice, maxPrice) {
  const nextWave = (hit.fetchWaveMax ?? 0) + 1;
  const waveOpts = { keyword, minPrice, maxPrice, fetchWave: nextWave };
  let newTao = [];
  let newJd = [];
  try {
    newTao = await searchTaobaoAffiliate(APPKEY, waveOpts);
  } catch (e) {
    if (e.htmlContent) return { hit, newTaobaoCount: 0, newJdCount: 0, htmlError: e };
    console.warn('淘宝追加波次异常:', e.message);
  }
  try {
    newJd = await searchJdAffiliate(APPKEY, waveOpts);
  } catch (e) {
    console.warn('京东追加波次异常:', e.message);
  }
  try {
    newTao = await ensurePromotionLinks(APPKEY, newTao);
  } catch (e) {
    console.warn('淘宝追加转链异常:', e.message);
  }
  try {
    newJd = await ensurePromotionLinks(APPKEY, newJd);
  } catch (e) {
    console.warn('京东追加转链异常:', e.message);
  }
  const tMerge = mergeNormalizedDedup(hit.taobaoItems ?? [], newTao);
  const jMerge = mergeNormalizedDedup(hit.jdItems ?? [], newJd);
  const mergedTao = sortNormalizedItems(tMerge.merged);
  const mergedJd = sortNormalizedItems(jMerge.merged);
  return {
    hit: {
      ...hit,
      taobaoItems: mergedTao,
      jdItems: mergedJd,
      fetchWaveMax: nextWave,
      ts: Date.now(),
    },
    newTaobaoCount: tMerge.newCount,
    newJdCount: jMerge.newCount,
  };
}

/** 当前缓存条数不足以翻到 page 时，自动续拉下一波直至够页或达上限 */
async function ensureCacheCoversPage(cacheKey, page, pageSize, APPKEY, keyword, minPrice, maxPrice) {
  let cur = searchCache.get(cacheKey);
  if (!cur) return { newTaobaoCount: 0, newJdCount: 0 };
  const maxW = getSearchMaxWaves();
  let sumNT = 0;
  let sumNJ = 0;
  const maxRounds = Math.max(24, maxW + 8);
  for (let guard = 0; guard < maxRounds; guard++) {
    const tLen = (cur.taobaoItems ?? []).length;
    const jLen = (cur.jdItems ?? []).length;
    const maxP = dualMaxPages(tLen, jLen, pageSize);
    if (page <= maxP) break;
    if ((cur.fetchWaveMax ?? 0) + 1 >= maxW) break;
    const r = await extendSearchCacheOneWave(cur, APPKEY, keyword, minPrice, maxPrice);
    if (r.htmlError) {
      console.warn('自动拉取下一页数据时折淘客返回网页，已停止继续拉取');
      break;
    }
    cur = r.hit;
    searchCache.set(cacheKey, cur);
    sumNT += r.newTaobaoCount;
    sumNJ += r.newJdCount;
  }
  return { newTaobaoCount: sumNT, newJdCount: sumNJ };
}

function getSearchCacheKey(parsed) {
  return JSON.stringify({ keyword: parsed.keyword, minPrice: parsed.minPrice, maxPrice: parsed.maxPrice });
}

const DEFAULT_PRICE_MIN = 0;
const DEFAULT_PRICE_MAX = 999999;

/** 请求体可传 keyword + minPrice/maxPrice，或仅传 query（由 parseSearchIntent 解析） */
function resolveSearchParams(body) {
  const query = (body?.query || '').trim();
  const keywordRaw = body?.keyword != null ? String(body.keyword).trim() : '';

  if (keywordRaw) {
    let minPrice = DEFAULT_PRICE_MIN;
    let maxPrice = DEFAULT_PRICE_MAX;
    const mn = body.minPrice;
    const mx = body.maxPrice;
    if (mn !== '' && mn != null && Number.isFinite(Number(mn))) {
      minPrice = Math.max(0, Number(mn));
    }
    if (mx !== '' && mx != null && Number.isFinite(Number(mx))) {
      maxPrice = Math.max(0, Number(mx));
    }
    if (minPrice > maxPrice) {
      const t = minPrice;
      minPrice = maxPrice;
      maxPrice = t;
    }
    return { keyword: keywordRaw, minPrice, maxPrice };
  }

  if (query) {
    return parseSearchIntent(query);
  }

  return null;
}

const FLOW_NOTE =
  '说明：无法在服务端合法抓取淘宝/京东搜索页 HTML。本应用通过折淘客对接的淘宝客高佣商品库（search_result、api_all）与京东联盟商品接口（jd_goods_list 等）按关键词返回可推广商品，再分别用您在 .env 中的 ZHETAOKE_TAOBAO_PID（淘宝客 PID）与 ZHETAOKE_JD_PID / unionId（京东推广位）生成推广链接。分页规则：先将多路联盟结果合并去重为两列总列表，再按页切片展示；当前列表不够翻页时自动续拉下一波并合并（SEARCH_MAX_WAVES）。下方「去淘宝搜 / 去京东搜」对应官网关键词搜索页，便于对照。';

function sliceChannel(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    total,
    totalPages,
    page: p,
  };
}

function jsonSearchOk(parsed, taobaoItems, jdItems, page, pageSize, extras = {}) {
  const t = sliceChannel(taobaoItems, page, pageSize);
  const j = sliceChannel(jdItems, page, pageSize);
  const maxPages = Math.max(t.totalPages, j.totalPages);
  const maxW = getSearchMaxWaves();
  const fMax = Number.isFinite(Number(extras.fetchWaveMax)) ? Number(extras.fetchWaveMax) : 0;
  const moreWaves =
    typeof extras.moreWavesAvailable === 'boolean'
      ? extras.moreWavesAvailable
      : fMax + 1 < maxW;
  const { fetchWaveMax: _fw, moreWavesAvailable: _mw, ...clientExtras } = extras;
  return {
    ok: true,
    parsed,
    taobaoItems: t.slice,
    jdItems: j.slice,
    taobaoTotal: t.total,
    jdTotal: j.total,
    taobaoTotalPages: t.totalPages,
    jdTotalPages: j.totalPages,
    page: Math.min(page, maxPages),
    pageSize,
    totalPages: maxPages,
    items: [...t.slice, ...j.slice],
    total: t.total + j.total,
    moreWavesAvailable: moreWaves,
    wavesLoaded: fMax + 1,
    ...clientExtras,
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

/**
 * POST /api/search
 * 返回 taobaoItems / jdItems 分列；items 为两列当前页合并（兼容旧前端）
 */
app.post('/api/search', async (req, res) => {
  const body = req.body || {};
  const fromQueryString = (req.query?.query || '').trim();
  const mergedBody = { ...body, query: (body.query || fromQueryString || '').trim() };

  const resolved = resolveSearchParams(mergedBody);
  if (!resolved || !String(resolved.keyword).trim()) {
    return res.status(400).json({
      ok: false,
      error: '请输入品名，或一行搜索需求（例如：价格1000元左右的手机）。',
    });
  }

  const { keyword, minPrice, maxPrice } = resolved;
  const parsed = { keyword, minPrice, maxPrice };

  const page = Math.max(1, parseInt(body.page || req.query?.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(body.pageSize || req.query?.pageSize || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));
  const cacheKey = getSearchCacheKey(parsed);

  const enc = encodeURIComponent;
  const taobaoRetailSearchUrl = `https://s.taobao.com/search?q=${enc(keyword)}`;
  const jdRetailSearchUrl = `https://search.jd.com/Search?keyword=${enc(keyword)}&enc=utf-8`;
  const fallbackLinks = [
    { name: '去淘宝搜', url: taobaoRetailSearchUrl },
    { name: '去京东搜', url: jdRetailSearchUrl },
    { name: '拼多多搜索', url: `https://mobile.yangkeduo.com/search_result.html?search_key=${enc(keyword)}` },
  ];
  const zhetaokeSearchUrl = `https://www.zhetaoke.com/list/index.html?q=${enc(keyword)}`;
  const dataSource = '折淘客（淘宝客 + 京东联盟）';
  const quoteNote = '价格为参考价，以下单页为准；佣金以联盟后台结算为准';

  const baseExtras = {
    fallbackLinks,
    zhetaokeSearchUrl,
    dataSource,
    quoteNote,
    flowNote: FLOW_NOTE,
    taobaoRetailSearchUrl,
    jdRetailSearchUrl,
  };

  if (!APPKEY) {
    return res.json({
      ok: false,
      error: '未配置 ZHETAOKE_APPKEY，请在 .env 中设置。',
      parsed,
      taobaoItems: [],
      jdItems: [],
      items: [],
      taobaoTotal: 0,
      jdTotal: 0,
      taobaoTotalPages: 1,
      jdTotalPages: 1,
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      ...baseExtras,
    });
  }

  const now = Date.now();
  const resetSession = body.resetSession === true;
  const cached = searchCache.get(cacheKey);
  const cacheHit = cached && now - cached.ts < SEARCH_CACHE_TTL_MS && !resetSession;

  const maxW = getSearchMaxWaves();

  if (cacheHit) {
    const extra = await ensureCacheCoversPage(cacheKey, page, pageSize, APPKEY, keyword, minPrice, maxPrice);
    const fresh = searchCache.get(cacheKey) ?? cached;
    const taobaoItems = fresh.taobaoItems ?? fresh.items?.filter((i) => i.source === '淘宝') ?? [];
    const jdItems = fresh.jdItems ?? fresh.items?.filter((i) => i.source === '京东') ?? [];
    const shortHint = pageShortfallHint(
      page,
      taobaoItems.length,
      jdItems.length,
      pageSize,
      fresh.fetchWaveMax ?? 0,
      maxW
    );
    return res.json(
      jsonSearchOk(parsed, taobaoItems, jdItems, page, pageSize, {
        ...baseExtras,
        fetchedAt: fresh.ts,
        fetchWaveMax: fresh.fetchWaveMax ?? 0,
        ...(extra.newTaobaoCount || extra.newJdCount
          ? { newTaobaoCount: extra.newTaobaoCount, newJdCount: extra.newJdCount }
          : {}),
        ...(shortHint ? { apiHint: shortHint } : {}),
      })
    );
  }

  const opts = { keyword, minPrice, maxPrice };
  let taobaoItems = [];
  let jdItems = [];
  let htmlError = null;

  try {
    taobaoItems = await searchTaobaoAffiliate(APPKEY, opts);
  } catch (e) {
    if (e.htmlContent) htmlError = e;
    else console.warn('淘宝渠道搜索异常:', e.message);
  }

  try {
    jdItems = await searchJdAffiliate(APPKEY, opts);
  } catch (e) {
    console.warn('京东渠道搜索异常:', e.message);
  }

  if (htmlError && taobaoItems.length === 0 && jdItems.length === 0) {
    console.warn('Zhetaoke 返回网页:', htmlError.message);
    return res.json({
      ok: true,
      parsed,
      taobaoItems: [],
      jdItems: [],
      items: [],
      taobaoTotal: 0,
      jdTotal: 0,
      taobaoTotalPages: 1,
      jdTotalPages: 1,
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      apiHint:
        '折淘客接口返回了网页（多为未授权/appkey 问题），淘宝与京东列表均为空。请检查后台授权与 .env 中的 ZHETAOKE_APPKEY、京东 unionId/PID。',
      ...baseExtras,
      fetchedAt: Date.now(),
    });
  }

  try {
    taobaoItems = await ensurePromotionLinks(APPKEY, taobaoItems);
  } catch (e) {
    console.warn('淘宝转链批量异常:', e.message);
  }
  try {
    jdItems = await ensurePromotionLinks(APPKEY, jdItems);
  } catch (e) {
    console.warn('京东转链批量异常:', e.message);
  }

  const fetchedAt = Date.now();
  searchCache.set(cacheKey, {
    taobaoItems,
    jdItems,
    parsed,
    ts: fetchedAt,
    fetchWaveMax: 0,
  });

  const extra = await ensureCacheCoversPage(cacheKey, page, pageSize, APPKEY, keyword, minPrice, maxPrice);
  const out = searchCache.get(cacheKey);
  const tOut = out.taobaoItems ?? [];
  const jOut = out.jdItems ?? [];

  const shortHint = pageShortfallHint(
    page,
    tOut.length,
    jOut.length,
    pageSize,
    out.fetchWaveMax ?? 0,
    maxW
  );

  return res.json(
    jsonSearchOk(parsed, tOut, jOut, page, pageSize, {
      ...baseExtras,
      fetchedAt: out.ts,
      fetchWaveMax: out.fetchWaveMax ?? 0,
      ...(extra.newTaobaoCount || extra.newJdCount
        ? { newTaobaoCount: extra.newTaobaoCount, newJdCount: extra.newJdCount }
        : {}),
      ...(shortHint ? { apiHint: shortHint } : {}),
    })
  );
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`优惠购物服务已启动: http://localhost:${PORT}`);
  if (!APPKEY) console.warn('警告: 未设置 ZHETAOKE_APPKEY，搜索将不可用');
});
