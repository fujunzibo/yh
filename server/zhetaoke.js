/**
 * 折淘客 API 客户端
 * 文档参考：https://www.zhetaoke.com/one/api3.aspx
 * 请根据折淘客开放平台实际接口名称调整 apiSearch 中的路径与参数
 */

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// 折淘客多端口：20000 全网/超高佣；10001 开放平台（京东/美团/唯品会/考拉/饿了么/拼多多/抖音等）
const BASE_20000 = 'http://api.zhetaoke.com:20000';
const BASE_LINGQUAN = 'https://www.zhetaoke.com';
const BASE_API_10001 = 'https://api.zhetaoke.com:10001';
const BASE_API_10003 = 'https://api.zhetaoke.com:10003';
const DEFAULT_PAGE_SIZE = 20;
/** 折淘客 jd_goods_list 文档：单页最大 20，超出易返回失败 */
const JD_GOODS_LIST_PAGE_SIZE = '20';

/**
 * 折淘客接口注册表：几十个 API 按「名称 -> path + base」登记，统一用 callApi(name, params) 调用
 * 文档：http://www.zhetaoke.com/one/api3.aspx 与 20000 端口说明
 */
const ZHETAOKE_APIS = {
  // ----- 端口 20000 全网 -----
  api_all: { path: '/api/api_all.ashx', base: BASE_20000, desc: '超高佣金商品列表' },
  api_detail: { path: '/api/api_detail.ashx', base: BASE_20000, desc: '全网商品详情(含券)' },

  // ----- 领券站 淘口令 -----
  tkl_create: { path: '/user/open/open_tkl_create.aspx', base: BASE_LINGQUAN, desc: '淘口令创建(需带PID的推广链接)' },

  // ----- 端口 10001 京东 -----
  jd_promotion_new: { path: '/api/open_jing_union_open_promotion_byunionid_get.ashx', base: BASE_API_10001, desc: '京东转链-新' },
  jd_zhuanlian: { path: '/api/open_jing_zhuanlian.ashx', base: BASE_API_10001, desc: '京东转链' },
  jd_goods_detail: { path: '/api/open_jing_goods_detail_get.ashx', base: BASE_API_10001, desc: '京东商品详情-简' },
  jd_goods_query: { path: '/api/open_jing_union_open_goods_query.ashx', base: BASE_API_10001, desc: '京东商品详情-详' },
  jd_jingfen: { path: '/api/open_jing_union_open_goods_jingfen_query.ashx', base: BASE_API_10001, desc: '京粉精选' },
  jd_goods_list: { path: '/api/open_jing_goods_list.ashx', base: BASE_API_10001, desc: '京东朋友圈火爆' },
  jd_order_row: { path: '/api/open_jing_union_openz_order_row_query.ashx', base: BASE_API_10001, desc: '京东订单查询' },
  jd_lijin_list: { path: '/api/open_jing_goods_lijin_list.ashx', base: BASE_API_10001, desc: '京享礼金商品' },
  jd_bigfield: { path: '/api/open_jd_union_open_goods_bigfield_query.ashx', base: BASE_API_10001, desc: '京东商品详情图' },

  // ----- 端口 10001 美团 -----
  meituan_generate: { path: '/api/open_meituan_generateLink.ashx', base: BASE_API_10001, desc: '美团转链' },
  meituan_order: { path: '/api/open_meituan_orderList2.ashx', base: BASE_API_10001, desc: '美团订单查询' },

  // ----- 端口 10001 唯品会 -----
  vip_gen: { path: '/api/open_vip_genByVIPUrlWithOauth.ashx', base: BASE_API_10001, desc: '唯品会转链' },
  vip_shouquan: { path: '/api/vip_shouquan.ashx', base: BASE_API_10001, desc: '唯品会账号授权' },
  vip_shouquaninfo: { path: '/api/vip_shouquaninfo.ashx', base: BASE_API_10001, desc: '唯品会授权列表' },
  vip_order: { path: '/api/open_vip_orderListWithOauth.ashx', base: BASE_API_10001, desc: '唯品会订单' },
  vip_goods: { path: '/api/open_vip_getByGoodsIdsWithOauth.ashx', base: BASE_API_10001, desc: '唯品会商品详情' },
  vip_goods_v2: { path: '/api/open_vip_getByGoodsIdsV2WithOauth.ashx', base: BASE_API_10001, desc: '唯品会商品详情V2' },
  vip_xianbao: { path: '/api/api_xianbao.ashx', base: BASE_API_10001, desc: '唯品会线报' },
  vip_wenan: { path: '/api/open_vip_wenan_list.ashx', base: BASE_API_10001, desc: '唯品会精编文案' },
  vip_query: { path: '/api/open_vip_queryWithOauth.ashx', base: BASE_API_10001, desc: '唯品会关键词查询' },

  // ----- 端口 10001 考拉 -----
  kaola_zhuanlian: { path: '/api/open_kaola_zhuanke_api_zhuanlian.ashx', base: BASE_API_10001, desc: '考拉转链' },
  kaola_selected: { path: '/api/open_kaola_zhuanke_api_querySelectedGoods.ashx', base: BASE_API_10001, desc: '考拉精选' },
  kaola_search: { path: '/api/open_kaola_zhuanke_api_searchGoods.ashx', base: BASE_API_10001, desc: '考拉关键词' },
  kaola_goods_info: { path: '/api/open_kaola_zhuanke_api_queryGoodsInfo.ashx', base: BASE_API_10001, desc: '考拉商品详情' },
  lianmeng_order: { path: '/api/open_lianmeng_orderList.ashx', base: BASE_API_10001, desc: '折淘客联盟订单(考拉/美团/饿了么/抖音等)' },

  // ----- 端口 10001 饿了么 -----
  eleme_generate: { path: '/api/open_eleme_generateLink.ashx', base: BASE_API_10001, desc: '饿了么转链' },

  // ----- 端口 10001 拼多多 -----
  pdd_zhuanlian: { path: '/api/open_pdd_zhuanlian_new.ashx', base: BASE_API_10001, desc: '拼多多转链' },
  pdd_goods_detail: { path: '/api/open_pdd_goods_detail_get_new.ashx', base: BASE_API_10001, desc: '拼多多商品详情-简' },
  pdd_goods_search: { path: '/api/open_pdd_goods_detail_search_new.ashx', base: BASE_API_10001, desc: '拼多多商品详情-详' },
  pdd_shouquan: { path: '/api/open_pdd_shouquan_new.ashx', base: BASE_API_10001, desc: '拼多多授权备案' },
  pdd_shouquan_query: { path: '/api/open_pdd_shouquan_query_new.ashx', base: BASE_API_10001, desc: '拼多多备案查询' },
  pdd_order: { path: '/api/open_pdd_dingdan_new.ashx', base: BASE_API_10001, desc: '拼多多订单' },
  pdd_cats: { path: '/api/open_pdd_goods_cats_new.ashx', base: BASE_API_10001, desc: '拼多多商品类目' },

  // ----- 端口 10001 抖音 -----
  douyin_zhuanlian: { path: '/api/open_douyin_zhuanlian.ashx', base: BASE_API_10001, desc: '抖音商品转链' },
  douyin_product_detail: { path: '/api/open_douyin_product_detail.ashx', base: BASE_API_10001, desc: '抖音商品详情' },
  douyin_product_search: { path: '/api/open_douyin_product_search.ashx', base: BASE_API_10001, desc: '抖音商品搜索' },
  douyin_kouling: { path: '/api/open_douyin_kouling_jiexi.ashx', base: BASE_API_10001, desc: '抖音口令解析' },
  douyin_order: { path: '/api/open_lianmeng_orderList.ashx', base: BASE_API_10001, desc: '抖音订单(同联盟订单)' },
  douyin_live_zhuanlian: { path: '/api/open_douyin_zhuanlian_zhibojian.ashx', base: BASE_API_10001, desc: '抖音直播间转链' },
  douyin_activity_zhuanlian: { path: '/api/open_douyin_zhuanlian_activity.ashx', base: BASE_API_10001, desc: '抖音活动转链' },
  douyin_activity_list: { path: '/api/open_douyin_activity_list.ashx', base: BASE_API_10001, desc: '抖音活动列表' },
  douyin_live_daren: { path: '/api/open_douyin_zhibojian_dare_list.ashx', base: BASE_API_10001, desc: '抖音直播间达人列表' },
  douyin_live_products: { path: '/api/open_douyin_distributionLive_productlist.ashx', base: BASE_API_10001, desc: '抖音直播间商品列表' },
};

/**
 * 按名称调用折淘客接口（所有在 ZHETAOKE_APIS 里登记的接口）
 * 京东相关接口（jd_*）未传 unionId/jd_app_key/jd_app_secret 时，自动从环境变量注入
 * @param apiName - ZHETAOKE_APIS 的 key，如 'api_detail'、'jd_promotion_new'
 * @param params - 查询参数（一般需含 appkey，可来自 process.env.ZHETAOKE_APPKEY）
 * @returns 接口返回的 JSON（或 __html）
 */
async function callApi(apiName, params = {}) {
  const api = ZHETAOKE_APIS[apiName];
  if (!api) throw new Error(`未知接口: ${apiName}，可选: ${Object.keys(ZHETAOKE_APIS).join(', ')}`);
  const appkey = params.appkey ?? process.env.ZHETAOKE_APPKEY;
  let merged = { ...params, ...(appkey ? { appkey } : {}) };
  if (apiName.startsWith('jd_')) {
    if (merged.unionId == null && process.env.ZHETAOKE_JD_UNION_ID) merged.unionId = process.env.ZHETAOKE_JD_UNION_ID;
    if (merged.jd_app_key == null && process.env.ZHETAOKE_JD_APP_KEY) merged.jd_app_key = process.env.ZHETAOKE_JD_APP_KEY;
    if (merged.jd_app_secret == null && process.env.ZHETAOKE_JD_APP_SECRET) merged.jd_app_secret = process.env.ZHETAOKE_JD_APP_SECRET;
    if (merged.jd_lianmeng_id == null && process.env.ZHETAOKE_JD_UNION_ID) merged.jd_lianmeng_id = process.env.ZHETAOKE_JD_UNION_ID;
    const jdPid = process.env.ZHETAOKE_JD_PID;
    if (jdPid) {
      if (merged.pid == null) merged.pid = jdPid;
      if (merged.positionId == null) {
        const parts = jdPid.split('_');
        if (parts.length >= 3) merged.positionId = parts[2];
      }
    }
  }
  return request(api.path, merged, api.base);
}

/** api_detail：全网商品详情，单商品可能返回两条(S券/G券) */
async function apiDetail(appkey, taoId) {
  const raw = await callApi('api_detail', { appkey: appkey ?? process.env.ZHETAOKE_APPKEY, tao_id: taoId });
  if (raw && raw.__html) return raw;
  if (raw.status === 301) throw new Error('折淘客 api_detail 参数错误');
  return raw;
}

/** api_all.ashx 分类 cid：1女装 2母婴 3美妆 4居家日用 5鞋品 6美食 7文娱车品 8数码家电 9男装 10内衣 11箱包 12配饰 13户外运动 14家装家纺 */
const CID_MAP = {
  女装: 1, 母婴: 2, 美妆: 3, 居家: 4, 日用: 4, 鞋品: 5, 美食: 6, 文娱: 7, 车品: 7,
  数码: 8, 家电: 8, 手机: 8, 电脑: 8, 耳机: 8, 手表: 8, 男装: 9, 内衣: 10, 箱包: 11,
  配饰: 12, 户外: 13, 运动: 13, 家装: 14, 家纺: 14,
  洗发: 3, 护发: 3, 沐浴: 3, 护肤: 3, 洗护: 3,
};

/**
 * 调用折淘客 API（GET），返回 JSON；若返回 HTML 则抛出可读错误
 * @param path - 路径或完整 URL
 * @param params - 查询参数（path 为完整 URL 时仍会追加，便于自定义 URL 只写基地址）
 */
async function request(path, params = {}, base = BASE_LINGQUAN) {
  const isFullUrl = path.startsWith('http');
  const url = new URL(isFullUrl ? path : `${base}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), { method: 'GET' });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zhetaoke API error: ${res.status} ${text.slice(0, 300)}`);
  const trimmed = text.trim();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    return { __html: true, content: text };
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`折淘客返回格式异常，无法解析为 JSON。请检查接口地址与参数。`);
  }
}

/**
 * 按分类查询商品（折淘客文档：超级分类商品API）
 * 参数：appkey（对接秘钥）, type（分类）, page
 * 若设置环境变量 ZHETAOKE_LINGQUAN_URL，则只请求该地址（完整 URL 或 path，例如带 ? 的查询串可放在 path）
 */
async function apiCategorySearch(appkey, type = '0', page = 1) {
  const customUrl = process.env.ZHETAOKE_LINGQUAN_URL;
  if (customUrl && customUrl.trim()) {
    const base = customUrl.trim().replace(/\s/g, '').replace(/\?.*$/, '');
    const full = base.startsWith('http') ? base : BASE_LINGQUAN + (base.startsWith('/') ? '' : '/') + base;
    return request(full, { appkey, type, page }, '');
  }
  const path = '/user/extend/extend_lingquan_type.aspx';
  const params = { appkey, type, page };
  let lastErr;
  for (const base of [BASE_LINGQUAN, BASE_API_10001, BASE_API_10003]) {
    try {
      return await request(path, params, base);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** 关键词 -> 分类 type（领券 extend 用，0 表示全部） */
const KEYWORD_TO_TYPE = {
  女装: '1', 男装: '2', 美妆: '3', 数码: '4', 家电: '4', 手机: '4', 电脑: '4', 耳机: '4', 手表: '4', 母婴: '5', 美食: '6',
  内衣: '7', 箱包: '8', 配饰: '9', 户外: '10', 运动: '10', 家装: '11', 家纺: '11', 居家: '12', 日用: '12',
};

function getCategoryType(keyword) {
  const k = (keyword || '').trim();
  for (const [kw, type] of Object.entries(KEYWORD_TO_TYPE)) {
    if (k.includes(kw)) return type;
  }
  return '0';
}

/** 关键词 -> api_all.ashx 的 cid（1-14），空表示全部 */
function getCidForApiAll(keyword) {
  const k = (keyword || '').trim();
  for (const [kw, cid] of Object.entries(CID_MAP)) {
    if (k.includes(kw)) return cid;
  }
  return ''; // 全部
}

/** 从环境变量读取推广位参数，供折淘客/折京客搜索接口「直接返回带 PID 的链接」 */
function getPromotionParams() {
  const p = {};
  if (process.env.ZHETAOKE_TAOBAO_PID) p.pid = process.env.ZHETAOKE_TAOBAO_PID;
  if (process.env.ZHETAOKE_JD_UNION_ID) {
    p.unionId = process.env.ZHETAOKE_JD_UNION_ID;
    p.jd_lianmeng_id = process.env.ZHETAOKE_JD_UNION_ID;
  }
  if (process.env.ZHETAOKE_JD_PID) {
    p.positionId = process.env.ZHETAOKE_JD_PID.split('_').pop() || process.env.ZHETAOKE_JD_PID;
  }
  return p;
}

/**
 * 高佣转链（根据商品ID生成淘宝推广链接）- 折淘客文档路径
 * 若设置环境变量 ZHETAOKE_TAOBAO_PID（如 mm_1653850119_2237850493_111209650326），将自动带入
 */
async function apiConvertToAffiliate(appkey, itemId, options = {}) {
  const pid = options.pid ?? process.env.ZHETAOKE_TAOBAO_PID;
  return request('/user/open/open_gaoyongzhuanlian.aspx', {
    appkey,
    item_id: itemId,
    ...(pid ? { pid } : {}),
  });
}

/** 从折淘客通用返回中提取淘口令字符串（兼容多种返回格式） */
function parseTaoKouLingFromRaw(raw) {
  if (!raw || raw.__html) return '';
  const keys = ['model', 'content', 'data', 'tao_kou_ling', 'tkl', 'result', 'info', 'return', 'msg'];
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') {
      const inner = v.content ?? v.model ?? v.data ?? v.tao_kou_ling ?? v.tkl ?? v.msg ?? v.info ?? '';
      if (typeof inner === 'string' && inner.trim()) return inner.trim();
    }
  }
  return '';
}

/**
 * 淘口令创建：根据「带 PID 的推广链接」生成淘口令，便于复制到淘宝 App 打开
 * 需先有高佣转链得到的链接；淘口令与 .env 中的 ZHETAOKE_TAOBAO_PID 绑定
 * 依次尝试 BASE_LINGQUAN、BASE_API_10003，兼容多种返回格式
 */
async function createTaoKouLing(appkey, promotionUrl, text = '') {
  if (!promotionUrl || typeof promotionUrl !== 'string') return '';
  const encoded = encodeURIComponent(promotionUrl);
  const params = {
    appkey: appkey ?? process.env.ZHETAOKE_APPKEY,
    url: encoded,
    content: encoded,
    ...(text ? { text: String(text).slice(0, 100) } : {}),
  };
  const bases = [BASE_LINGQUAN, BASE_API_10003];
  for (const base of bases) {
    try {
      const raw = await request('/user/open/open_tkl_create.aspx', params, base);
      const tkl = parseTaoKouLingFromRaw(raw);
      if (tkl) return tkl;
    } catch (_) {
      continue;
    }
  }
  return '';
}

/**
 * 折淘客京粉：联盟数据多在 `jd_union_open_goods_jingfen_query_response.result` 的 JSON 字符串里（内层 code=200，data 为数组），
 * 旧版才是 queryResult.data.jfGoodsResp；只认旧结构会导致永远 0 条。
 */
function parseJdJingfenFromZtkResponse(raw) {
  const top = raw?.jd_union_open_goods_jingfen_query_response;
  if (!top) return [];
  const legacy = top.queryResult?.data?.jfGoodsResp;
  if (legacy != null) return Array.isArray(legacy) ? legacy : [legacy];
  if (typeof top.result !== 'string') return [];
  try {
    const inner = JSON.parse(top.result);
    const c = inner.code;
    if (c != null && c !== 200 && c !== '200') return [];
    const d = inner.data;
    if (Array.isArray(d)) return d;
    if (d?.jfGoodsResp != null) {
      const jf = d.jfGoodsResp;
      return Array.isArray(jf) ? jf : [jf];
    }
    return [];
  } catch (_) {
    return [];
  }
}

/** 折淘客京东商品查询：同上，联盟 JSON 常在 `result` 字符串内 */
function parseJdGoodsQueryFromZtkResponse(raw) {
  const top = raw?.jd_union_open_goods_query_response;
  if (!top) return [];
  const legacy = top.queryResult?.data?.goodsResp;
  if (legacy != null) return Array.isArray(legacy) ? legacy : [legacy];
  if (typeof top.result !== 'string') return [];
  try {
    const inner = JSON.parse(top.result);
    const c = inner.code;
    if (c != null && c !== 200 && c !== '200') return [];
    const d = inner.data;
    if (Array.isArray(d)) return d;
    if (d?.goodsResp != null) {
      const gr = d.goodsResp;
      return Array.isArray(gr) ? gr : [gr];
    }
    return [];
  } catch (_) {
    return [];
  }
}

/**
 * 从原始接口响应中解析商品列表（兼容多种结构）
 */
function parseItemList(raw) {
  let list = [];
  if (raw.tbk_dg_material_optional_response?.result_list?.map_data) {
    list = raw.tbk_dg_material_optional_response.result_list.map_data;
  } else if (raw.jd_union_open_goods_jingfen_query_response) {
    list = parseJdJingfenFromZtkResponse(raw);
  } else if (raw.jd_union_open_goods_query_response) {
    list = parseJdGoodsQueryFromZtkResponse(raw);
  } else if (Array.isArray(raw.result_list)) list = raw.result_list;
  else if (Array.isArray(raw.data)) list = raw.data;
  else if (raw.data?.list && Array.isArray(raw.data.list)) list = raw.data.list;
  else if (raw.data?.data && Array.isArray(raw.data.data)) list = raw.data.data;
  else if (Array.isArray(raw.results)) list = raw.results;
  else if (raw.content?.list && Array.isArray(raw.content.list)) list = raw.content.list;
  else if (raw.content?.data && Array.isArray(raw.content.data)) list = raw.content.data;
  else if (Array.isArray(raw.content)) list = raw.content;
  else if (Array.isArray(raw.items)) list = raw.items;
  else if (Array.isArray(raw.list)) list = raw.list;
  else if (raw.result?.data && Array.isArray(raw.result.data)) list = raw.result.data;
  else if (raw.model?.list && Array.isArray(raw.model.list)) list = raw.model.list;
  else if (raw.content && typeof raw.content === 'object' && Array.isArray(raw.content)) list = raw.content;
  return list;
}

/** 联盟字段不齐时用于去重/合并的稳定键（勿留空，否则多条会塌成同一 itemId） */
export function stableItemIdFromRow(item) {
  if (!item || typeof item !== 'object') return 'x:empty';
  const raw =
    item.tao_id ?? item.skuId ?? item.item_id ?? item.goods_id ?? item.num_iid ?? item.id ?? item.skuID;
  if (raw != null && String(raw).trim() !== '') return String(raw).trim();
  let link =
    item.item_url ??
    item.url ??
    item.coupon_click_url ??
    item.click_url ??
    item.link ??
    item.goods_link ??
    '';
  if (item.materialUrl) {
    const m = String(item.materialUrl);
    link = link || (m.startsWith('http') ? m : 'https://' + m.replace(/^https?:\/\//, ''));
  }
  link = String(link || '').trim();
  if (link) return `u:${link.slice(0, 400)}`;
  const title = String(item.title ?? item.tao_title ?? item.skuName ?? item.goods_name ?? '').slice(0, 120);
  const price = String(item.quanhou_jiage ?? item.zk_final_price ?? item.price ?? item.size ?? '');
  const pic = String(item.pict_url ?? item.goods_thumb_url ?? item.pic_url ?? item.image ?? '').slice(0, 100);
  return `f:${title}\0${price}\0${pic}`;
}

/** 联盟行里的参考价（京东常用 lowestCouponPrice / lowestPrice，与淘宝字段不同） */
function extractPriceFromUnionRow(item) {
  if (!item || typeof item !== 'object') return 0;
  const candidates = [
    item.quanhou_jiage,
    item.zk_final_price,
    item.final_price,
    item.goods_price,
    item.lowestCouponPrice,
    item.lowestPrice,
    item.price,
    item.jdPrice,
    item.minNormalPrice,
    item.purchasePrice,
    item.coupon_price,
    item.quan_price,
    item.size,
    item.couponPrice,
    item.priceInfo?.lowestCouponPrice,
    item.priceInfo?.lowestPrice,
    item.priceInfo?.price,
    item.wlUnitPrice,
  ];
  for (const v of candidates) {
    if (v == null || v === '') continue;
    const n = parseFloat(String(v).replace(/,/g, ''));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}

function normalizeItem(item) {
  const id = stableItemIdFromRow(item);
  const price = extractPriceFromUnionRow(item);
  const title =
    item.short_name ??
    item.title ??
    item.tao_title ??
    item.skuName ??
    item.goods_name ??
    item.goodsName ??
    item.item_title ??
    item.goods_title ??
    '';
  const pic =
    item.goods_img ??
    item.pict_url ??
    item.goods_thumb_url ??
    item.pic_url ??
    item.image ??
    item.goods_pic ??
    item.imageInfo?.whiteImage ??
    item.imageInfo?.imageList?.urlInfo?.url ??
    (Array.isArray(item.imageInfo?.imageList?.urlInfo) ? item.imageInfo.imageList.urlInfo[0]?.url : null) ??
    '';
  const link = item.goods_link ?? item.item_url ?? item.url ?? item.coupon_click_url ?? item.click_url ?? item.link
    ?? (item.materialUrl ? (item.materialUrl.startsWith('http') ? item.materialUrl : 'https://' + item.materialUrl.replace(/^https?:\/\//, '')) : '') ?? '';
  const coupon = item.coupon_info ?? item.coupon_amount ?? item.coupon ?? '';
  const linkPic = (
    (link || '') +
    ' ' +
    (item.goods_img ?? item.pict_url ?? item.pic_url ?? item.image ?? '')
  ).toLowerCase();
  const source = linkPic.includes('jd.com') || linkPic.includes('360buyimg') ? '京东' : '淘宝';
  const retailUrl = link;
  const rateStr =
    item.tkrate3 ??
    item.commission_rate ??
    item.commissionShare ??
    item.commissionshare ??
    item.cpsFee ??
    item.tk_rate ??
    item.commissionInfo?.commissionShare;
  let commissionRate = null;
  if (rateStr != null && String(rateStr).trim() !== '') {
    const n = parseFloat(String(rateStr).replace(/%/g, ''));
    if (!Number.isNaN(n) && n > 0) commissionRate = n;
  }
  let commissionEstimate = 0;
  if (price > 0 && commissionRate != null) {
    commissionEstimate = Math.round(price * (commissionRate / 100) * 100) / 100;
  }
  const tkfee = item.tkfee ?? item.estimatedCommission ?? item.commission;
  let commissionLabel = '';
  if (tkfee != null && String(tkfee).trim() !== '' && !Number.isNaN(parseFloat(tkfee))) {
    commissionLabel = `预估佣金约 ¥${parseFloat(tkfee).toFixed(2)}`;
  } else if (commissionRate != null) {
    commissionLabel = `佣金比例约 ${commissionRate}%`;
  }
  return {
    itemId: id, title, price, pic, link, retailUrl, coupon, source,
    commissionRate, commissionEstimate, commissionLabel,
    raw: item,
  };
}

/**
 * 超高佣金商品API（api_all.ashx）- 文档：http://api.zhetaoke.com:20000/api/api_all.ashx
 * 返回商品列表 JSON；部分环境支持 q 关键词，无则忽略
 */
async function apiAll(appkey, { page = 1, page_size = 40, sort = 'price_asc', cid = '', commission_rate_start = '', q = '' }) {
  const raw = await request('/api/api_all.ashx', {
    appkey,
    page,
    page_size,
    sort,
    ...(cid ? { cid } : {}),
    ...(commission_rate_start ? { commission_rate_start } : {}),
    ...(q ? { q } : {}),
  }, BASE_20000);
  if (raw && raw.__html) return raw;
  // 301 多为「未开通超高佣/关键词分页超限/参数组合不被接受」；由搜索侧降级为空列表或改走领券站，勿抛错打断整波
  if (raw && raw.status === 301) return raw;
  return raw;
}

/** 递归收集对象中的字符串（联盟返回里「荣耀」等常落在嵌套字段或链接里） */
function appendDeepStrings(val, depth, maxDepth, out, maxStrings) {
  if (out.length >= maxStrings || depth > maxDepth || val == null) return;
  const t = typeof val;
  if (t === 'string') {
    const s = val.trim();
    if (s) out.push(s);
    return;
  }
  if (t === 'number' && Number.isFinite(val)) {
    out.push(String(val));
    return;
  }
  if (t !== 'object') return;
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length && out.length < maxStrings; i++) {
      appendDeepStrings(val[i], depth + 1, maxDepth, out, maxStrings);
    }
    return;
  }
  const keys = Object.keys(val);
  for (let i = 0; i < keys.length && out.length < maxStrings; i++) {
    appendDeepStrings(val[keys[i]], depth + 1, maxDepth, out, maxStrings);
  }
}

/** 从商品原始对象拼接所有可检索文本（标题、链接、嵌套 JSON 中的字符串等），供模糊匹配 */
function getSearchableText(item) {
  const shallow = [
    item.short_name,
    item.goods_content,
    item.goods_recommend,
    item.title,
    item.tao_title,
    item.skuName,
    item.goods_name,
    item.goodsName,
    item.goods_title,
    item.item_title,
    item.jianjie,
    item.desc,
    item.category_name,
    item.level_one_category_name,
    item.cid1Name,
    item.cid2Name,
    item.cid3Name,
    item.brandName,
    item.brand_name,
    item.shop_name,
    item.shop_title,
    item.nick,
    item.material_name,
    item.subtitle,
    item.item_subtitle,
    item.keywords,
    item.search_tag,
    item.spuName,
    item.inShopName,
    item.item_url,
    item.url,
    item.coupon_click_url,
    item.click_url,
    item.link,
    item.goods_link,
    item.materialUrl,
  ].filter((x) => x != null && String(x).trim() !== '');
  const deep = [];
  appendDeepStrings(item, 0, 4, deep, 100);
  const merged = [...shallow.map((x) => String(x)), ...deep];
  return [...new Set(merged.map((s) => s.toLowerCase()))].join(' ');
}

/**
 * 关键词匹配：可检索文本须**同时包含**拆分后的每一个词（空格、顿号、逗号等分隔）。
 * 无拆分时整段为一个词，子串包含即命中。不做手机/配件/品牌等额外规则。
 */
function itemMatchesKeyword(item, lowerKw) {
  if (!lowerKw || lowerKw === '商品') return true;
  const text = getSearchableText(item);
  const tokens = lowerKw
    .split(/[\s\u3000、，,;；|/]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return true;
  return tokens.every((tok) => text.includes(tok));
}

/** 原始行数据是否为京东商品（链接/主图） */
function isRawJdRow(r) {
  const link = (r.item_url ?? r.url ?? r.materialUrl ?? '').toLowerCase();
  const pic = (r.pict_url ?? r.pic_url ?? r.image ?? '').toLowerCase();
  return link.includes('jd.com') || pic.includes('360buyimg');
}

function dedupSearchList(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    const id = item.tao_id ?? item.skuId ?? item.item_id ?? item.goods_id ?? item.num_iid ?? item.id;
    if (id == null || id === '') return true;
    const sid = String(id);
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
}

/** 搜索拉取时的 HTTP 并发上限（环境变量 SEARCH_FETCH_CONCURRENCY，默认 6，上限 30） */
function getSearchFetchConcurrency() {
  const n = parseInt(process.env.SEARCH_FETCH_CONCURRENCY || '6', 10);
  if (!Number.isFinite(n) || n < 1) return 6;
  return Math.min(n, 30);
}

/**
 * 固定并发池：任务队列动态领取，缩短总等待时间；适合 I/O 密集请求。
 * 与 ensurePromotionLinks 的 runWithLimit（按批）独立，避免转链与搜索抢同一并发。
 */
async function runPool(tasks, concurrency, fn) {
  if (!tasks?.length) return [];
  const results = new Array(tasks.length);
  let next = 0;
  const workers = Math.min(Math.max(1, concurrency), tasks.length);
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await fn(tasks[i], i);
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * 淘宝侧：折淘客 search_result + api_all（等同联盟高佣商品库），不含京东。
 * 说明：无法合法抓取 taobao.com 搜索页；此处按关键词走官方淘客数据通道，再用您的淘宝 PID 转链。
 */
/** 每「波」search_result 各 base×排序 拉取的页数；第 w 波对应联盟页 w*本值+1 … */
const SEARCH_RESULT_PAGES_PER_WAVE = 5;

async function searchTaobaoAffiliate(appkey, { keyword, minPrice, maxPrice, fetchWave = 0, pagedPull = false }) {
  const wave = Math.max(0, parseInt(String(fetchWave), 10) || 0);
  const cid = getCidForApiAll(keyword);
  const lowerKw = (keyword || '').trim().toLowerCase();
  const hasKeyword = lowerKw && lowerKw !== '商品';
  const needMorePages = hasKeyword;
  const debug = process.env.DEBUG_SEARCH === '1' || process.env.DEBUG_SEARCH === 'true';
  let list = [];

  const fetchConc = getSearchFetchConcurrency();
  /** 服务端「每点下一页再拉一波」时用：每波只拉联盟侧下一页，避免一次吞多页再本地切片 */
  const srPagesPerWave = pagedPull ? 1 : SEARCH_RESULT_PAGES_PER_WAVE;

  if (hasKeyword) {
    const promotionParams = getPromotionParams();
    const srPageStart = wave * srPagesPerWave + 1;
    const srPageEnd = (wave + 1) * srPagesPerWave;
    const srTasks = [];
    for (const sortMode of ['price_asc', 'price_desc']) {
      for (const base of [BASE_LINGQUAN, BASE_20000]) {
        for (let page = srPageStart; page <= srPageEnd; page++) {
          srTasks.push({ sortMode, base, page });
        }
      }
    }
    const srChunks = await runPool(srTasks, fetchConc, async ({ sortMode, base, page }) => {
      try {
        const raw = await request(
          '/api/search_result.ashx',
          {
            appkey,
            q: keyword,
            page,
            page_size: 50,
            sort: sortMode,
            ...promotionParams,
          },
          base
        );
        if (!raw?.__html && raw?.status !== 301) {
          return parseItemList(raw).filter((r) => !isRawJdRow(r));
        }
      } catch (_) {}
      return [];
    });
    for (const ch of srChunks) {
      if (ch?.length) list = list.concat(ch);
    }
    if (debug) console.log('[search:tao] wave=%d after search_result: %d', wave, list.length);
  }

  try {
    // 仅按低价分页会永远停在几元配件页，高价手机进不了池子；同时拉 price_desc 把高价位商品拉进来
    const pagesPerSort = pagedPull ? 1 : needMorePages ? 6 : hasKeyword ? 5 : 1;
    const aaPageStart = wave * pagesPerSort + 1;
    const aaPageEnd = (wave + 1) * pagesPerSort;
    const aaTasks = [];
    for (const sortMode of ['price_asc', 'price_desc']) {
      for (let p = aaPageStart; p <= aaPageEnd; p++) {
        aaTasks.push({ sortMode, page: p });
      }
    }
    const aaChunks = await runPool(aaTasks, fetchConc, async ({ sortMode, page: p }) => {
      let raw = await apiAll(appkey, {
        page: p,
        page_size: 50,
        sort: sortMode,
        cid: cid || undefined,
        q: hasKeyword ? keyword : undefined,
      });
      // 20000 端口常对带 q 的翻页返回 301；领券站同路径 + pid 往往仍能拉一页
      if (hasKeyword && raw && (raw.__html || raw.status === 301)) {
        try {
          const fallback = await request(
            '/api/api_all.ashx',
            {
              appkey,
              page: p,
              page_size: 50,
              sort: sortMode,
              ...(cid ? { cid } : {}),
              q: keyword,
              ...getPromotionParams(),
            },
            BASE_LINGQUAN
          );
          if (!fallback?.__html && fallback?.status !== 301) raw = fallback;
        } catch (_) {}
      }
      if (raw && (raw.__html || raw.status === 301)) {
        if (debug) console.log('[search:tao] api_all sort=%s 第%d页 %s', sortMode, p, raw.__html ? 'HTML' : '301');
        return [];
      }
      const chunk = parseItemList(raw).filter((r) => !isRawJdRow(r));
      if (!chunk.length && debug) console.log('[search:tao] api_all sort=%s 第%d页 0 条', sortMode, p);
      return chunk;
    });
    for (const chunk of aaChunks) {
      if (chunk?.length) list = list.concat(chunk);
    }
    if (debug) console.log('[search:tao] wave=%d after api_all: %d', wave, list.length);
  } catch (e) {
    if (e.htmlContent) throw e;
    if (debug) console.log('[search:tao] api_all 异常:', e?.message?.slice(0, 60));
    if (wave > 0) throw e;
    try {
      const type = getCategoryType(keyword);
      const fallbackPages = needMorePages ? 3 : 1;
      for (let p = 1; p <= fallbackPages; p++) {
        const raw = await apiCategorySearch(appkey, type, p);
        if (raw && raw.__html) {
          const err = new Error('折淘客返回了网页，已在展示区显示。');
          err.htmlContent = raw.content;
          throw err;
        }
        const chunk = parseItemList(raw).filter((r) => !isRawJdRow(r));
        if (!chunk.length) break;
        list = list.concat(chunk);
        if (chunk.length < DEFAULT_PAGE_SIZE) break;
      }
    } catch (e2) {
      if (e2.htmlContent) throw e2;
      throw e;
    }
    if (debug) console.log('[search:tao] after 领券 fallback: %d', list.length);
  }

  list = dedupSearchList(list).filter((r) => !isRawJdRow(r));
  if (debug) console.log('[search:tao] after dedup & 去京东: %d', list.length);

  if (list.length === 0 && hasKeyword && wave === 0) {
    const recTasks = [];
    for (const sortMode of ['price_asc', 'price_desc']) {
      for (const base of [BASE_LINGQUAN, BASE_20000]) {
        recTasks.push({ sortMode, base });
      }
    }
    const recChunks = await runPool(recTasks, fetchConc, async ({ sortMode, base }) => {
      const params = {
        appkey,
        page: 1,
        page_size: 50,
        sort: sortMode,
        q: keyword,
        ...(cid ? { cid } : {}),
        ...getPromotionParams(),
      };
      try {
        const taoRaw = await request('/api/api_all.ashx', params, base);
        if (!taoRaw?.__html && taoRaw?.status !== 301) {
          return parseItemList(taoRaw).filter((r) => !isRawJdRow(r));
        }
      } catch (_) {}
      return [];
    });
    for (const ch of recChunks) {
      if (ch?.length) list = list.concat(ch);
    }
    try {
      const type = getCategoryType(keyword);
      for (let p = 1; p <= 2; p++) {
        const raw = await apiCategorySearch(appkey, type, p);
        if (!raw?.__html && raw?.status !== 301) {
          const chunk = parseItemList(raw).filter((r) => !isRawJdRow(r));
          if (chunk.length) list = list.concat(chunk);
          if (chunk.length < DEFAULT_PAGE_SIZE) break;
        } else break;
      }
    } catch (_) {}
    list = dedupSearchList(list).filter((r) => !isRawJdRow(r));
    if (debug) console.log('[search:tao] after 补淘宝: %d', list.length);
  }

  if (hasKeyword) {
    const before = list.length;
    list = list.filter((item) => itemMatchesKeyword(item, lowerKw));
    if (debug) console.log('[search:tao] after keyword filter: %d (was %d)', list.length, before);
  }

  let items = list.map(normalizeItem);
  if (minPrice != null && minPrice > 0) items = items.filter((i) => i.price >= minPrice);
  if (maxPrice != null && maxPrice < 999999) items = items.filter((i) => i.price <= maxPrice);
  if (debug) console.log('[search:tao] after price filter: %d', items.length);
  // 展示顺序固定：参考价从低到高（同时拉 price_desc 只为把高价 SKU 拉进池子，不改变排序规则）
  items.sort((a, b) => {
    const pa = Number(a.price) || 0;
    const pb = Number(b.price) || 0;
    if (pa !== pb) return pa - pb;
    return String(a.itemId ?? '').localeCompare(String(b.itemId ?? ''));
  });

  if (items.length === 0 && !searchTaobaoAffiliate._warned) {
    searchTaobaoAffiliate._warned = true;
    console.warn(
      '[搜索:淘宝] 无结果时请检查：折淘客「领券站/超高佣」授权、ZHETAOKE_APPKEY、ZHETAOKE_TAOBAO_PID。DEBUG_SEARCH=1 可看各阶段条数。'
    );
  }

  return items;
}

/**
 * 京东侧：折淘客 jd_goods_list（关键词）；再用京东联盟参数转链（折京客 PID）。
 * 说明：无法合法抓取 jd.com 搜索页；此处为京东联盟商品数据通道。
 * jd_goods_list 文档要求单页 pageSize 最大 20，原先传 50 易触发接口失败（如 status 301）。
 */
const JD_PAGES_PER_WAVE = 4;

/**
 * 京粉精选 eliteId（折淘客文档）：24=数码家电。搜「电脑」却用 1=好券商品会拉到不相关类目，关键词一过滤就全没。
 */
function jdJingfenEliteIdForKeyword(keyword) {
  const k = keyword || '';
  if (/手机|电脑|笔记本|平板|显示器|数码|家电|华为|荣耀|苹果|小米|vivo|oppo|redmi|iphone|显卡|内存|硬盘|CPU|主板|工作站|一体机/i.test(k)) return '24';
  if (/母婴|玩具|奶粉|尿裤/i.test(k)) return '26';
  if (/图书|文具/i.test(k)) return '30';
  if (/超市|食品|生鲜|粮油/i.test(k)) return '25';
  return '1';
}

/** 折淘客 jd_goods_list：一级类目 7=数码家电，缩小「电脑」等词检索范围 */
function jdGoodsListGoodsType(keyword) {
  const k = keyword || '';
  if (/电脑|笔记本|平板|显示器|一体机|工作站|显卡|内存|硬盘|主板|CPU|数码|家电/.test(k)) return '7';
  return '';
}

/** jd_goods_list 的 price 区间参数，与文档示例「0.0-9.9」同形 */
function jdGoodsListPriceParam(minPrice, maxPrice) {
  const a = Number(minPrice);
  const b = Number(maxPrice);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= 0 || b < a) return {};
  return { price: `${a}-${b}` };
}

async function searchJdGoodsQueryKeyword(appkey, keyword, minPrice, maxPrice, pageStart, pageEnd) {
  const rows = [];
  const mn = Number(minPrice);
  const mx = Number(maxPrice);
  for (let p = pageStart; p <= pageEnd; p++) {
    const params = {
      appkey,
      keyword,
      pageIndex: String(p),
      pageSize: JD_GOODS_LIST_PAGE_SIZE,
      sortName: 'price',
      sort: 'asc',
      ...(Number.isFinite(mn) && mn > 0 ? { pricefrom: String(mn) } : {}),
      ...(Number.isFinite(mx) && mx > 0 && mx < 999999 ? { priceto: String(mx) } : {}),
    };
    try {
      const raw = await callApi('jd_goods_query', params);
      if (raw?.__html) break;
      const chunk = parseItemList(raw);
      if (!chunk.length) break;
      rows.push(...chunk);
      if (chunk.length < parseInt(JD_GOODS_LIST_PAGE_SIZE, 10)) break;
    } catch (_) {
      break;
    }
  }
  return rows;
}

async function searchJdAffiliate(appkey, { keyword, minPrice, maxPrice, fetchWave = 0, pagedPull = false }) {
  const wave = Math.max(0, parseInt(String(fetchWave), 10) || 0);
  const lowerKw = (keyword || '').trim().toLowerCase();
  const hasKeyword = lowerKw && lowerKw !== '商品';
  const debug = process.env.DEBUG_SEARCH === '1' || process.env.DEBUG_SEARCH === 'true';
  const fetchConc = getSearchFetchConcurrency();
  let list = [];

  const jdPagesPerWave = pagedPull ? 1 : JD_PAGES_PER_WAVE;
  const goodsType = jdGoodsListGoodsType(keyword || '');
  const listPriceExtra = jdGoodsListPriceParam(minPrice, maxPrice);

  if (hasKeyword) {
    try {
      const jdPageStart = wave * jdPagesPerWave + 1;
      const jdPageEnd = (wave + 1) * jdPagesPerWave;
      const jdTasks = [];
      for (const sortMode of ['price_asc', 'price_desc']) {
        for (let jdPage = jdPageStart; jdPage <= jdPageEnd; jdPage++) {
          jdTasks.push({ sortMode, jdPage });
        }
      }
      const jdChunks = await runPool(jdTasks, fetchConc, async ({ sortMode, jdPage }) => {
        try {
          const extraGroups = goodsType
            ? [{ ...listPriceExtra, goods_type: goodsType }, listPriceExtra]
            : [listPriceExtra];
          for (const baseExtra of extraGroups) {
            const paramVariants = [
              { appkey, keyword, pageIndex: String(jdPage), pageSize: JD_GOODS_LIST_PAGE_SIZE, sort: sortMode, ...baseExtra },
              { appkey, keyWord: keyword, pageIndex: String(jdPage), pageSize: JD_GOODS_LIST_PAGE_SIZE, sort: sortMode, ...baseExtra },
              { appkey, q: keyword, pageIndex: String(jdPage), pageSize: JD_GOODS_LIST_PAGE_SIZE, sort: sortMode, ...baseExtra },
            ];
            for (const params of paramVariants) {
              const jdListRaw = await callApi('jd_goods_list', params);
              if (jdListRaw?.__html) continue;
              const out = parseItemList(jdListRaw);
              if (out.length) return out;
            }
          }
        } catch (_) {}
        return [];
      });
      for (const jch of jdChunks) {
        if (jch?.length) list = list.concat(jch);
      }
    } catch (_) {}
    if (debug) console.log('[search:jd] wave=%d after jd_goods_list: %d', wave, list.length);
  }

  // 联盟关键词查询（详版），与火爆列表互补；需京东开放平台 jd_app_key/secret 时常才能通
  if (hasKeyword && list.length === 0) {
    try {
      const qStart = wave * jdPagesPerWave + 1;
      const qEnd = (wave + 1) * jdPagesPerWave;
      const qRows = await searchJdGoodsQueryKeyword(appkey, keyword, minPrice, maxPrice, qStart, qEnd);
      if (qRows.length) list = list.concat(qRows);
      if (debug) console.log('[search:jd] wave=%d after jd_goods_query: %d', wave, list.length);
    } catch (_) {}
  }

  // jd_goods_list / jd_goods_query 无结果时：京粉精选兜底（须正确解析 result 字符串 + 数码类用 eliteId=24）
  if (list.length === 0) {
    try {
      const eliteId = jdJingfenEliteIdForKeyword(keyword);
      const maxJfPages = hasKeyword ? 8 : 2;
      for (let p = 1; p <= maxJfPages; p++) {
        const jdRaw = await callApi('jd_jingfen', {
          appkey,
          eliteId,
          pageIndex: String(p),
          pageSize: JD_GOODS_LIST_PAGE_SIZE,
        });
        if (jdRaw?.__html) break;
        const alt = parseItemList(jdRaw);
        if (alt.length) list = list.concat(alt);
        if (!alt.length || alt.length < parseInt(JD_GOODS_LIST_PAGE_SIZE, 10)) break;
      }
    } catch (_) {}
    if (debug) console.log('[search:jd] wave=%d after jd_jingfen fallback: %d', wave, list.length);
  }

  list = dedupSearchList(list);

  if (hasKeyword) {
    list = list.filter((item) => itemMatchesKeyword(item, lowerKw));
  }

  let items = list.map((raw) => {
    const n = normalizeItem(raw);
    return { ...n, source: '京东' };
  });
  if (minPrice != null && minPrice > 0) items = items.filter((i) => i.price >= minPrice);
  if (maxPrice != null && maxPrice < 999999) items = items.filter((i) => i.price <= maxPrice);
  items.sort((a, b) => {
    const pa = Number(a.price) || 0;
    const pb = Number(b.price) || 0;
    if (pa !== pb) return pa - pb;
    return String(a.itemId ?? '').localeCompare(String(b.itemId ?? ''));
  });
  return items;
}

async function searchDouyinAffiliate(appkey, { keyword, minPrice, maxPrice }) {
  const lowerKw = (keyword || '').trim().toLowerCase();
  const hasKeyword = lowerKw && lowerKw !== '商品';
  if (!hasKeyword) return [];
  const rows = [];
  for (let page = 1; page <= 3; page++) {
    const tries = [
      { appkey, keyword, page: String(page), page_size: '50' },
      { appkey, q: keyword, page: String(page), page_size: '50' },
      { appkey, search_key: keyword, page: String(page), page_size: '50' },
    ];
    let hit = [];
    for (const params of tries) {
      try {
        const raw = await callApi('douyin_product_search', params);
        if (!raw?.__html) {
          const chunk = parseItemList(raw);
          if (chunk.length) {
            hit = chunk;
            break;
          }
        }
      } catch (_) {}
    }
    if (!hit.length) break;
    rows.push(...hit);
    if (hit.length < 50) break;
  }
  let items = dedupSearchList(rows).filter((item) => itemMatchesKeyword(item, lowerKw)).map((raw) => {
    const n = normalizeItem(raw);
    return { ...n, source: '抖音' };
  });
  if (minPrice != null && minPrice > 0) items = items.filter((i) => i.price >= minPrice);
  if (maxPrice != null && maxPrice < 999999) items = items.filter((i) => i.price <= maxPrice);
  items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  return items;
}

async function searchVipAffiliate(appkey, { keyword, minPrice, maxPrice }) {
  const lowerKw = (keyword || '').trim().toLowerCase();
  const hasKeyword = lowerKw && lowerKw !== '商品';
  if (!hasKeyword) return [];
  const rows = [];
  for (let page = 1; page <= 3; page++) {
    const tries = [
      { appkey, keyword, page: String(page), pageSize: '50' },
      { appkey, q: keyword, page: String(page), pageSize: '50' },
      { appkey, query: keyword, page: String(page), pageSize: '50' },
    ];
    let hit = [];
    for (const params of tries) {
      try {
        const raw = await callApi('vip_query', params);
        if (!raw?.__html) {
          const chunk = parseItemList(raw);
          if (chunk.length) {
            hit = chunk;
            break;
          }
        }
      } catch (_) {}
    }
    if (!hit.length) break;
    rows.push(...hit);
    if (hit.length < 50) break;
  }
  let items = dedupSearchList(rows).filter((item) => itemMatchesKeyword(item, lowerKw)).map((raw) => {
    const n = normalizeItem(raw);
    return { ...n, source: '唯品会' };
  });
  if (minPrice != null && minPrice > 0) items = items.filter((i) => i.price >= minPrice);
  if (maxPrice != null && maxPrice < 999999) items = items.filter((i) => i.price <= maxPrice);
  items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  return items;
}

async function searchPddAffiliate(appkey, { keyword, minPrice, maxPrice }) {
  const lowerKw = (keyword || '').trim().toLowerCase();
  const hasKeyword = lowerKw && lowerKw !== '商品';
  if (!hasKeyword) return [];
  const rows = [];
  for (let page = 1; page <= 3; page++) {
    const tries = [
      { appkey, keyword, page: String(page), page_size: '50' },
      { appkey, q: keyword, page: String(page), page_size: '50' },
      { appkey, goods_name: keyword, page: String(page), page_size: '50' },
    ];
    let hit = [];
    for (const params of tries) {
      try {
        const raw = await callApi('pdd_goods_search', params);
        if (!raw?.__html) {
          const chunk = parseItemList(raw);
          if (chunk.length) {
            hit = chunk;
            break;
          }
        }
      } catch (_) {}
    }
    if (!hit.length) break;
    rows.push(...hit);
    if (hit.length < 50) break;
  }
  let items = dedupSearchList(rows).filter((item) => itemMatchesKeyword(item, lowerKw)).map((raw) => {
    const n = normalizeItem(raw);
    return { ...n, source: '拼多多' };
  });
  if (minPrice != null && minPrice > 0) items = items.filter((i) => i.price >= minPrice);
  if (maxPrice != null && maxPrice < 999999) items = items.filter((i) => i.price <= maxPrice);
  items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  return items;
}

/** 合并多渠道（兼容旧调用）；界面推荐分别用各 search*Affiliate */
async function searchProducts(appkey, opts) {
  const [t, j, d, v, p] = await Promise.all([
    searchTaobaoAffiliate(appkey, opts).catch(() => []),
    searchJdAffiliate(appkey, opts).catch(() => []),
    searchDouyinAffiliate(appkey, opts).catch(() => []),
    searchVipAffiliate(appkey, opts).catch(() => []),
    searchPddAffiliate(appkey, opts).catch(() => []),
  ]);
  return [...t, ...j, ...d, ...v, ...p].sort((a, b) => {
    const pa = Number(a.price) || 0;
    const pb = Number(b.price) || 0;
    if (pa !== pb) return pa - pb;
    return String(a.itemId ?? '').localeCompare(String(b.itemId ?? ''));
  });
}

/** 判断是否为京东商品（链接或来源含 jd） */
function isJdItem(item) {
  const link = (item.link || item.raw?.item_url || item.raw?.url || '').toLowerCase();
  const pic = (item.pic || item.raw?.pict_url || '').toLowerCase();
  return link.includes('jd.com') || link.includes('360buyimg') || pic.includes('360buyimg');
}

function isPddItem(item) {
  const text = `${item.source || ''} ${item.link || ''} ${item.raw?.goods_sign || ''}`.toLowerCase();
  return text.includes('拼多多') || text.includes('yangkeduo') || text.includes('pinduoduo') || !!item.raw?.goods_sign;
}

function isDouyinItem(item) {
  const text = `${item.source || ''} ${item.link || ''}`.toLowerCase();
  return text.includes('抖音') || text.includes('douyin') || text.includes('iesdouyin');
}

function isVipItem(item) {
  const text = `${item.source || ''} ${item.link || ''}`.toLowerCase();
  return text.includes('唯品会') || text.includes('vip.com');
}

/**
 * 为单个商品生成推广链接（淘宝用 PID，京东用 unionId/positionId），并可选生成淘口令/京口令
 * 返回 { link, taoKouLing?, jingKouLing? }；淘口令/京口令均基于 .env 中的 PID 计算
 */
async function getPromotionLink(appkey, item) {
  const fallback = { link: item.link, taoKouLing: '', jingKouLing: '' };
  try {
    if (isJdItem(item)) {
      const raw = await callApi('jd_promotion_new', {
        materialId: item.itemId || item.link,
        chainType: '2',
      });
      if (raw?.__html) return fallback;
      const res = raw?.jd_union_open_promotion_byunionid_get_response?.result;
      let url = '';
      let jingKouLing = '';
      if (typeof res === 'string') {
        try {
          const data = JSON.parse(res);
          url = data?.data?.shortURL || data?.data?.clickURL || '';
          jingKouLing = data?.data?.jCommand ?? data?.data?.command ?? data?.data?.京口令 ?? '';
        } catch (_) {}
      }
      if (!url) {
        const content = raw?.content?.[0];
        url = content?.shorturl || content?.coupon_click_url || '';
        jingKouLing = content?.jCommand ?? content?.command ?? '';
      }
      if (url) return { link: url, taoKouLing: '', jingKouLing: jingKouLing || '' };
    } else if (isPddItem(item)) {
      const raw = await callApi('pdd_zhuanlian', {
        appkey,
        goods_sign: item.raw?.goods_sign ?? item.raw?.goodsSign ?? '',
        goodsSign: item.raw?.goods_sign ?? item.raw?.goodsSign ?? '',
        custom_parameters: `cursor_${Date.now()}`,
      });
      if (raw?.__html) return fallback;
      const url =
        raw?.short_url ??
        raw?.data?.short_url ??
        raw?.goods_promotion_url_generate_response?.goods_promotion_url_list?.[0]?.short_url ??
        raw?.content?.[0]?.short_url ??
        '';
      if (url) return { link: url, taoKouLing: '', jingKouLing: '' };
    } else if (isDouyinItem(item)) {
      const raw = await callApi('douyin_zhuanlian', {
        appkey,
        product_url: item.link || item.raw?.url || item.raw?.item_url || '',
        url: item.link || item.raw?.url || item.raw?.item_url || '',
      });
      if (raw?.__html) return fallback;
      const url = raw?.url ?? raw?.data?.url ?? raw?.short_url ?? raw?.content?.[0]?.url ?? '';
      if (url) return { link: url, taoKouLing: '', jingKouLing: '' };
    } else if (isVipItem(item)) {
      const raw = await callApi('vip_gen', {
        appkey,
        url: item.link || item.raw?.url || item.raw?.item_url || '',
      });
      if (raw?.__html) return fallback;
      const url = raw?.url ?? raw?.data?.url ?? raw?.short_url ?? raw?.content?.[0]?.url ?? '';
      if (url) return { link: url, taoKouLing: '', jingKouLing: '' };
    } else {
      const raw = await apiConvertToAffiliate(appkey, item.itemId);
      if (raw?.__html) return fallback;
      const url = raw?.url ?? raw?.data?.url ?? raw?.coupon_click_url ?? raw?.click_url ?? raw?.short_url;
      if (!url) return fallback;
      let taoKouLing = '';
      if (process.env.ZHETAOKE_TAOBAO_PID) {
        taoKouLing = await createTaoKouLing(appkey, url, item.title ?? item.raw?.title ?? '');
      }
      return { link: url, taoKouLing: taoKouLing || '', jingKouLing: '' };
    }
  } catch (_) {}
  return fallback;
}

const CONCURRENCY = 3;
async function runWithLimit(tasks, fn) {
  const results = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}

/**
 * 为商品列表逐条生成推广链接（淘宝 PID / 京东 PID）及淘口令/京口令，替换 item.link；控制并发避免限流
 */
async function ensurePromotionLinks(appkey, items) {
  if (!items?.length) return items;
  const appkeyVal = appkey ?? process.env.ZHETAOKE_APPKEY;
  const results = await runWithLimit(items, (item) => getPromotionLink(appkeyVal, item));
  return items.map((item, i) => {
    const r = results[i];
    if (r && typeof r === 'object' && 'link' in r) {
      return {
        ...item,
        link: r.link ?? item.link,
        taoKouLing: r.taoKouLing ?? '',
        jingKouLing: r.jingKouLing ?? '',
      };
    }
    return { ...item, link: typeof r === 'string' ? r : item.link, taoKouLing: '', jingKouLing: '' };
  });
}

export {
  request,
  parseItemList,
  ZHETAOKE_APIS,
  callApi,
  apiDetail,
  apiCategorySearch,
  apiAll,
  apiConvertToAffiliate,
  searchProducts,
  searchTaobaoAffiliate,
  searchJdAffiliate,
  searchDouyinAffiliate,
  searchVipAffiliate,
  searchPddAffiliate,
  ensurePromotionLinks,
  getCategoryType,
  getCidForApiAll,
};
