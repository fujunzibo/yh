import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { parseSearchIntent } from './parseQuery.js';
import {
  searchTaobaoAffiliate,
  searchJdAffiliate,
  searchDouyinAffiliate,
  searchVipAffiliate,
  searchPddAffiliate,
  ensurePromotionLinks,
  stableItemIdFromRow,
  request,
  callApi,
  parseItemList,
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
  return `您请求的是第 ${page} 页，但当前合并列表只够 ${maxP} 页。请使用界面「下一页」逐页续拉联盟数据；直接跳转到较大页码不会自动多波拉取。`;
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

/** 关键词搜索且已有结果时，认为仍可能受联盟「单次/单波」条数限制，可通过「下一页」续拉 */
function initialMayNeedMoreWaves(taoLen, jdLen, keyword) {
  const kw = String(keyword || '').trim();
  return kw.length > 0 && taoLen + jdLen > 0;
}

function computeMoreWavesAvailable(hit) {
  if (!hit || hit.mayNeedMoreWaves === false) return false;
  const maxW = getSearchMaxWaves();
  return (hit.fetchWaveMax ?? 0) + 1 < maxW;
}

/**
 * 仅在客户端声明「下一页」意图时，若当前合并列表不足以显示目标页，且仍可能还有联盟分页，则续拉「一波」并合并（每次请求最多一波）。
 */
async function maybeExtendOneWaveOnNextPage(
  cacheKey,
  page,
  pageSize,
  APPKEY,
  keyword,
  minPrice,
  maxPrice,
  nextPageIntent
) {
  if (!nextPageIntent) return { newTaobaoCount: 0, newJdCount: 0 };
  let cur = searchCache.get(cacheKey);
  if (!cur) return { newTaobaoCount: 0, newJdCount: 0 };
  if (cur.mayNeedMoreWaves === false) return { newTaobaoCount: 0, newJdCount: 0 };
  const tLen = (cur.taobaoItems ?? []).length;
  const jLen = (cur.jdItems ?? []).length;
  const maxP = dualMaxPages(tLen, jLen, pageSize);
  if (page <= maxP) return { newTaobaoCount: 0, newJdCount: 0 };
  const maxW = getSearchMaxWaves();
  if ((cur.fetchWaveMax ?? 0) + 1 >= maxW) return { newTaobaoCount: 0, newJdCount: 0 };
  const r = await extendSearchCacheOneWave(cur, APPKEY, keyword, minPrice, maxPrice);
  if (r.htmlError) {
    console.warn('点击下一页续拉时折淘客返回网页，已停止本波');
    return { newTaobaoCount: 0, newJdCount: 0 };
  }
  cur = r.hit;
  if (r.newTaobaoCount + r.newJdCount === 0) {
    cur.mayNeedMoreWaves = false;
  }
  cur.ts = Date.now();
  searchCache.set(cacheKey, cur);
  return { newTaobaoCount: r.newTaobaoCount, newJdCount: r.newJdCount };
}

function getSearchCacheKey(parsed) {
  return JSON.stringify({ keyword: parsed.keyword, minPrice: parsed.minPrice, maxPrice: parsed.maxPrice });
}

function buildChannelHints() {
  const hints = [];
  if (!process.env.ZHETAOKE_TAOBAO_PID) {
    hints.push('淘宝：未配置 ZHETAOKE_TAOBAO_PID，可能只能看到原链或转链失败。');
  }
  if (!process.env.ZHETAOKE_JD_UNION_ID && !process.env.ZHETAOKE_JD_PID) {
    hints.push('京东：缺少 ZHETAOKE_JD_UNION_ID / ZHETAOKE_JD_PID，京东联盟接口常返回空。');
  }
  if (!process.env.ZHETAOKE_JD_APP_KEY || !process.env.ZHETAOKE_JD_APP_SECRET) {
    hints.push('京东：未配置 ZHETAOKE_JD_APP_KEY / ZHETAOKE_JD_APP_SECRET，部分接口可能不可用。');
  }
  hints.push('抖音/唯品会/拼多多：通常需在折淘客后台分别开通并授权对应联盟能力，否则会返回空列表。');
  return hints;
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
  '说明：无法在服务端合法抓取各电商官网搜索页 HTML。本应用通过折淘客对接的淘宝客、京东联盟、抖音、唯品会、拼多多接口按关键词返回可推广商品，并对可转链渠道生成推广链接。分页规则：主增量续拉仍优先淘宝/京东；其余渠道按已返回结果切片展示。下方平台搜索链接用于官网对照。';

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

function jsonSearchOk(parsed, taobaoItems, jdItems, douyinItems, vipItems, pddItems, page, pageSize, extras = {}) {
  const t = sliceChannel(taobaoItems, page, pageSize);
  const j = sliceChannel(jdItems, page, pageSize);
  const d = sliceChannel(douyinItems, page, pageSize);
  const v = sliceChannel(vipItems, page, pageSize);
  const p = sliceChannel(pddItems, page, pageSize);
  const maxPages = Math.max(t.totalPages, j.totalPages, d.totalPages, v.totalPages, p.totalPages);
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
    douyinItems: d.slice,
    vipItems: v.slice,
    pddItems: p.slice,
    taobaoTotal: t.total,
    jdTotal: j.total,
    douyinTotal: d.total,
    vipTotal: v.total,
    pddTotal: p.total,
    taobaoTotalPages: t.totalPages,
    jdTotalPages: j.totalPages,
    douyinTotalPages: d.totalPages,
    vipTotalPages: v.totalPages,
    pddTotalPages: p.totalPages,
    page: Math.min(page, maxPages),
    pageSize,
    totalPages: maxPages,
    items: [...t.slice, ...j.slice, ...d.slice, ...v.slice, ...p.slice],
    total: t.total + j.total + d.total + v.total + p.total,
    moreWavesAvailable: moreWaves,
    wavesLoaded: fMax + 1,
    ...clientExtras,
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

function missingEnvList() {
  return {
    appkey: !process.env.ZHETAOKE_APPKEY,
    taobaoPid: !process.env.ZHETAOKE_TAOBAO_PID,
    jdUnionId: !process.env.ZHETAOKE_JD_UNION_ID,
    jdPid: !process.env.ZHETAOKE_JD_PID,
    jdAppKey: !process.env.ZHETAOKE_JD_APP_KEY,
    jdAppSecret: !process.env.ZHETAOKE_JD_APP_SECRET,
  };
}

function summarizeRaw(raw) {
  if (!raw) return { kind: 'empty', status: null, count: 0 };
  if (raw.__html) return { kind: 'html', status: raw.status ?? null, count: 0 };
  const count = Array.isArray(raw) ? raw.length : parseItemList(raw).length;
  return { kind: 'json', status: raw.status ?? null, count };
}

async function runProbe(name, fn) {
  try {
    const raw = await fn();
    return { channel: name, ok: true, ...summarizeRaw(raw), error: '' };
  } catch (e) {
    return {
      channel: name,
      ok: false,
      kind: 'error',
      status: null,
      count: 0,
      error: e?.message || 'unknown error',
    };
  }
}

app.get('/api/health/channels', async (req, res) => {
  const keyword = String(req.query?.keyword || '手机').trim() || '手机';
  const appkey = APPKEY;
  const envMissing = missingEnvList();

  if (!appkey) {
    return res.json({
      ok: false,
      keyword,
      envMissing,
      error: '未配置 ZHETAOKE_APPKEY',
      probes: [],
    });
  }

  const probes = await Promise.all([
    runProbe('taobao_search_result_lingquan', () =>
      request(`https://www.zhetaoke.com/api/search_result.ashx`, {
        appkey,
        q: keyword,
        page: 1,
        page_size: 20,
      }, '')
    ),
    runProbe('taobao_search_result_20000', () =>
      request(`http://api.zhetaoke.com:20000/api/search_result.ashx`, {
        appkey,
        q: keyword,
        page: 1,
        page_size: 20,
      }, '')
    ),
    runProbe('jd_goods_list', () =>
      callApi('jd_goods_list', { appkey, keyword, pageIndex: '1', pageSize: '20', sort: 'price_asc' })
    ),
    // 京粉精选：搜索侧无「火爆列表」数据时常靠此兜底；与 jd_goods_list 返回结构不同
    runProbe('jd_jingfen_elite24', () =>
      callApi('jd_jingfen', { appkey, eliteId: '24', pageIndex: '1', pageSize: '20' })
    ),
    runProbe('douyin_product_search', () =>
      callApi('douyin_product_search', { appkey, keyword, page: '1', page_size: '20' })
    ),
    runProbe('vip_query', () =>
      callApi('vip_query', { appkey, keyword, page: '1', pageSize: '20' })
    ),
    runProbe('pdd_goods_search', () =>
      callApi('pdd_goods_search', { appkey, keyword, page: '1', page_size: '20' })
    ),
  ]);

  res.json({
    ok: true,
    keyword,
    envMissing,
    probes,
    hint:
      'kind=html 多为未授权/登录态问题；kind=json 且 count=0 多为权限未开通、参数不匹配或该关键词无佣金商品；kind=error 多为接口不可用或网络问题。京东：jd_goods_list 为 301 时若 jd_jingfen_elite24 有 count，搜索仍可能通过京粉兜底出结果。',
  });
});

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
  const douyinRetailSearchUrl = `https://www.douyin.com/search/${enc(keyword)}`;
  const vipRetailSearchUrl = `https://category.vip.com/suggest.php?keyword=${enc(keyword)}`;
  const pddRetailSearchUrl = `https://mobile.yangkeduo.com/search_result.html?search_key=${enc(keyword)}`;
  const fallbackLinks = [
    { name: '去淘宝搜', url: taobaoRetailSearchUrl },
    { name: '去京东搜', url: jdRetailSearchUrl },
    { name: '去抖音搜', url: douyinRetailSearchUrl },
    { name: '去唯品会搜', url: vipRetailSearchUrl },
    { name: '去拼多多搜', url: pddRetailSearchUrl },
  ];
  const zhetaokeSearchUrl = `https://www.zhetaoke.com/list/index.html?q=${enc(keyword)}`;
  const dataSource = '折淘客（淘宝客 + 京东 + 抖音 + 唯品会 + 拼多多）';
  const quoteNote = '价格为参考价，以下单页为准；佣金以联盟后台结算为准';

  const baseExtras = {
    fallbackLinks,
    zhetaokeSearchUrl,
    dataSource,
    quoteNote,
    flowNote: FLOW_NOTE,
    taobaoRetailSearchUrl,
    jdRetailSearchUrl,
    douyinRetailSearchUrl,
    vipRetailSearchUrl,
    pddRetailSearchUrl,
    channelHints: buildChannelHints(),
  };

  if (!APPKEY) {
    return res.json({
      ok: false,
      error: '未配置 ZHETAOKE_APPKEY，请在 .env 中设置。',
      parsed,
      taobaoItems: [],
      jdItems: [],
      douyinItems: [],
      vipItems: [],
      pddItems: [],
      items: [],
      taobaoTotal: 0,
      jdTotal: 0,
      douyinTotal: 0,
      vipTotal: 0,
      pddTotal: 0,
      taobaoTotalPages: 1,
      jdTotalPages: 1,
      douyinTotalPages: 1,
      vipTotalPages: 1,
      pddTotalPages: 1,
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
  const nextPageIntent = body.nextPageIntent === true;

  if (cacheHit) {
    let freshPre = searchCache.get(cacheKey) ?? cached;
    if (freshPre.mayNeedMoreWaves === undefined) {
      freshPre.mayNeedMoreWaves = initialMayNeedMoreWaves(
        (freshPre.taobaoItems ?? []).length,
        (freshPre.jdItems ?? []).length,
        keyword
      );
      searchCache.set(cacheKey, freshPre);
    }
    const extra = await maybeExtendOneWaveOnNextPage(
      cacheKey,
      page,
      pageSize,
      APPKEY,
      keyword,
      minPrice,
      maxPrice,
      nextPageIntent
    );
    const fresh = searchCache.get(cacheKey) ?? cached;
    const taobaoItems = fresh.taobaoItems ?? fresh.items?.filter((i) => i.source === '淘宝') ?? [];
    const jdItems = fresh.jdItems ?? fresh.items?.filter((i) => i.source === '京东') ?? [];
    const douyinItems = fresh.douyinItems ?? fresh.items?.filter((i) => i.source === '抖音') ?? [];
    const vipItems = fresh.vipItems ?? fresh.items?.filter((i) => i.source === '唯品会') ?? [];
    const pddItems = fresh.pddItems ?? fresh.items?.filter((i) => i.source === '拼多多') ?? [];
    const shortHint = pageShortfallHint(
      page,
      taobaoItems.length,
      jdItems.length,
      pageSize,
      fresh.fetchWaveMax ?? 0,
      maxW
    );
    return res.json(
      jsonSearchOk(parsed, taobaoItems, jdItems, douyinItems, vipItems, pddItems, page, pageSize, {
        ...baseExtras,
        fetchedAt: fresh.ts,
        fetchWaveMax: fresh.fetchWaveMax ?? 0,
        moreWavesAvailable: computeMoreWavesAvailable(fresh),
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
  let douyinItems = [];
  let vipItems = [];
  let pddItems = [];
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
  try {
    douyinItems = await searchDouyinAffiliate(APPKEY, opts);
  } catch (e) {
    console.warn('抖音渠道搜索异常:', e.message);
  }
  try {
    vipItems = await searchVipAffiliate(APPKEY, opts);
  } catch (e) {
    console.warn('唯品会渠道搜索异常:', e.message);
  }
  try {
    pddItems = await searchPddAffiliate(APPKEY, opts);
  } catch (e) {
    console.warn('拼多多渠道搜索异常:', e.message);
  }

  if (htmlError && taobaoItems.length === 0 && jdItems.length === 0 && douyinItems.length === 0 && vipItems.length === 0 && pddItems.length === 0) {
    console.warn('Zhetaoke 返回网页:', htmlError.message);
    return res.json({
      ok: true,
      parsed,
      taobaoItems: [],
      jdItems: [],
      douyinItems: [],
      vipItems: [],
      pddItems: [],
      items: [],
      taobaoTotal: 0,
      jdTotal: 0,
      douyinTotal: 0,
      vipTotal: 0,
      pddTotal: 0,
      taobaoTotalPages: 1,
      jdTotalPages: 1,
      douyinTotalPages: 1,
      vipTotalPages: 1,
      pddTotalPages: 1,
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      apiHint:
        '折淘客接口返回了网页（多为未授权/appkey 问题），多平台列表均为空。请检查后台授权与 .env 中的 ZHETAOKE_APPKEY 及各平台联盟参数。',
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
  try {
    douyinItems = await ensurePromotionLinks(APPKEY, douyinItems);
  } catch (e) {
    console.warn('抖音转链批量异常:', e.message);
  }
  try {
    vipItems = await ensurePromotionLinks(APPKEY, vipItems);
  } catch (e) {
    console.warn('唯品会转链批量异常:', e.message);
  }
  try {
    pddItems = await ensurePromotionLinks(APPKEY, pddItems);
  } catch (e) {
    console.warn('拼多多转链批量异常:', e.message);
  }

  const fetchedAt = Date.now();
  const tLen = taobaoItems.length;
  const jLen = jdItems.length;
  searchCache.set(cacheKey, {
    taobaoItems,
    jdItems,
    douyinItems,
    vipItems,
    pddItems,
    parsed,
    ts: fetchedAt,
    fetchWaveMax: 0,
    mayNeedMoreWaves: initialMayNeedMoreWaves(tLen, jLen, keyword),
  });

  const extra = await maybeExtendOneWaveOnNextPage(
    cacheKey,
    page,
    pageSize,
    APPKEY,
    keyword,
    minPrice,
    maxPrice,
    nextPageIntent
  );
  const out = searchCache.get(cacheKey);
  const tOut = out.taobaoItems ?? [];
  const jOut = out.jdItems ?? [];
  const dOut = out.douyinItems ?? [];
  const vOut = out.vipItems ?? [];
  const pOut = out.pddItems ?? [];

  const shortHint = pageShortfallHint(
    page,
    tOut.length,
    jOut.length,
    pageSize,
    out.fetchWaveMax ?? 0,
    maxW
  );

  return res.json(
    jsonSearchOk(parsed, tOut, jOut, dOut, vOut, pOut, page, pageSize, {
      ...baseExtras,
      fetchedAt: out.ts,
      fetchWaveMax: out.fetchWaveMax ?? 0,
      moreWavesAvailable: computeMoreWavesAvailable(out),
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
