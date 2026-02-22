import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { parseSearchIntent } from './parseQuery.js';
import { searchProducts, ensurePromotionLinks } from './zhetaoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const APPKEY = process.env.ZHETAOKE_APPKEY || '';

const PAGE_SIZE_DEFAULT = 20;
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000; // 2 分钟
const searchCache = new Map(); // key = cacheKey, value = { items, parsed, fallbackLinks, zhetaokeSearchUrl, ts }

function getSearchCacheKey(parsed) {
  return JSON.stringify({ keyword: parsed.keyword, minPrice: parsed.minPrice, maxPrice: parsed.maxPrice });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

/**
 * POST /api/search
 * Body: { "query": "价格1000元左右的手机", "page": 1, "pageSize": 20 }
 * 返回：解析后的关键词与价格区间、当前页商品列表及分页信息（total, page, pageSize, totalPages）
 * 相同 query 在 TTL 内翻页直接走缓存，不重复请求折淘客，加快翻页
 */
app.post('/api/search', async (req, res) => {
  const query = (req.body?.query || req.query?.query || '').trim();
  if (!query) {
    return res.status(400).json({ ok: false, error: '请输入搜索需求，例如：价格1000元左右的手机' });
  }

  const page = Math.max(1, parseInt(req.body?.page || req.query?.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(req.body?.pageSize || req.query?.pageSize || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));

  const { keyword, minPrice, maxPrice } = parseSearchIntent(query);
  const parsed = { keyword, minPrice, maxPrice };
  const cacheKey = getSearchCacheKey(parsed);

  const enc = encodeURIComponent;
  const fallbackLinks = [
    { name: '淘宝搜索', url: `https://s.taobao.com/search?q=${enc(keyword)}` },
    { name: '京东搜索', url: `https://search.jd.com/Search?keyword=${enc(keyword)}&enc=utf-8` },
    { name: '拼多多搜索', url: `https://mobile.yangkeduo.com/search_result.html?search_key=${enc(keyword)}` },
  ];
  const zhetaokeSearchUrl = `https://www.zhetaoke.com/list/index.html?q=${enc(keyword)}`;

  if (!APPKEY) {
    return res.json({
      ok: false,
      error: '未配置 ZHETAOKE_APPKEY，请在 .env 中设置。下方已展示折淘客搜索页，可像手动搜索一样使用。',
      parsed,
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
      fallbackLinks,
      zhetaokeSearchUrl,
    });
  }

  const now = Date.now();
  let cached = searchCache.get(cacheKey);
  if (cached && now - cached.ts < SEARCH_CACHE_TTL_MS) {
    const total = cached.items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.min(page, totalPages);
    const start = (p - 1) * pageSize;
    const items = cached.items.slice(start, start + pageSize);
    return res.json({
      ok: true,
      parsed: cached.parsed,
      items,
      total,
      page: p,
      pageSize,
      totalPages,
      fallbackLinks: cached.fallbackLinks,
      zhetaokeSearchUrl: cached.zhetaokeSearchUrl,
    });
  }

  try {
    let items = await searchProducts(APPKEY, { keyword, minPrice, maxPrice });
    items = await ensurePromotionLinks(APPKEY, items);
    searchCache.set(cacheKey, {
      items,
      parsed,
      fallbackLinks,
      zhetaokeSearchUrl,
      ts: Date.now(),
    });
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.min(page, totalPages);
    const start = (p - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    res.json({
      ok: true,
      parsed,
      items: pageItems,
      total,
      page: p,
      pageSize,
      totalPages,
      fallbackLinks,
      zhetaokeSearchUrl,
    });
  } catch (err) {
    // 折淘客返回网页（登录/授权页）时视为无接口数据，直接走选品库，不向用户报错
    const isHtmlFallback = !!err.htmlContent;
    if (isHtmlFallback) {
      console.warn('Zhetaoke 返回网页，已使用选品库展示:', err.message);
      return res.json({
        ok: true,
        parsed,
        items: [],
        total: 0,
        page: 1,
        pageSize,
        totalPages: 0,
        fallbackLinks,
        zhetaokeSearchUrl,
      });
    }
    console.error('Zhetaoke search error:', err.message);
    res.json({
      ok: false,
      error: err.message || '折淘客接口调用失败，请检查 appkey 与接口地址',
      parsed,
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
      fallbackLinks,
      zhetaokeSearchUrl,
    });
  }
});

// SPA 前端
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`优惠购物服务已启动: http://localhost:${PORT}`);
  if (!APPKEY) console.warn('警告: 未设置 ZHETAOKE_APPKEY，搜索将不可用');
});
