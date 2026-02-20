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

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

/**
 * POST /api/search
 * Body: { "query": "价格1000元左右的手机" }
 * 返回：解析后的关键词与价格区间，以及按价格升序排列的带推广链接的商品列表
 */
app.post('/api/search', async (req, res) => {
  const query = (req.body?.query || req.query?.query || '').trim();
  if (!query) {
    return res.status(400).json({ ok: false, error: '请输入搜索需求，例如：价格1000元左右的手机' });
  }

  const { keyword, minPrice, maxPrice } = parseSearchIntent(query);
  const parsed = { keyword, minPrice, maxPrice };

  const enc = encodeURIComponent;
  const fallbackLinks = [
    { name: '淘宝搜索', url: `https://s.taobao.com/search?q=${enc(keyword)}` },
    { name: '京东搜索', url: `https://search.jd.com/Search?keyword=${enc(keyword)}&enc=utf-8` },
    { name: '拼多多搜索', url: `https://mobile.yangkeduo.com/search_result.html?search_key=${enc(keyword)}` },
  ];
  // 折淘客站内搜索页（与手动在折淘客搜索效果一致，用于无 API 数据时在应用内展示）
  const zhetaokeSearchUrl = `https://www.zhetaoke.com/list/index.html?q=${enc(keyword)}`;

  if (!APPKEY) {
    return res.json({
      ok: false,
      error: '未配置 ZHETAOKE_APPKEY，请在 .env 中设置。下方已展示折淘客搜索页，可像手动搜索一样使用。',
      parsed,
      items: [],
      fallbackLinks,
      zhetaokeSearchUrl,
    });
  }

  try {
    let items = await searchProducts(APPKEY, { keyword, minPrice, maxPrice });
    items = await ensurePromotionLinks(APPKEY, items);
    res.json({
      ok: true,
      parsed,
      items,
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
