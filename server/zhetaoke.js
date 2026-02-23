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

/**
 * 淘口令创建：根据「带 PID 的推广链接」生成淘口令，便于复制到淘宝 App 打开
 * 需先有高佣转链得到的链接；淘口令与 .env 中的 ZHETAOKE_TAOBAO_PID 绑定
 */
async function createTaoKouLing(appkey, promotionUrl, text = '') {
  if (!promotionUrl || typeof promotionUrl !== 'string') return '';
  try {
    const encoded = encodeURIComponent(promotionUrl);
    const raw = await request('/user/open/open_tkl_create.aspx', {
      appkey: appkey ?? process.env.ZHETAOKE_APPKEY,
      url: encoded,
      content: encoded,
      ...(text ? { text: String(text).slice(0, 100) } : {}),
    }, BASE_LINGQUAN);
    if (raw?.__html) return '';
    const tkl = raw?.model ?? raw?.content ?? raw?.data ?? raw?.tao_kou_ling ?? raw?.tkl ?? '';
    return typeof tkl === 'string' ? tkl : (tkl?.content ?? tkl?.model ?? '');
  } catch (_) {
    return '';
  }
}

/**
 * 从原始接口响应中解析商品列表（兼容多种结构）
 */
function parseItemList(raw) {
  let list = [];
  if (raw.tbk_dg_material_optional_response?.result_list?.map_data) {
    list = raw.tbk_dg_material_optional_response.result_list.map_data;
  } else if (raw.jd_union_open_goods_jingfen_query_response?.queryResult?.data?.jfGoodsResp) {
    const jf = raw.jd_union_open_goods_jingfen_query_response.queryResult.data.jfGoodsResp;
    list = Array.isArray(jf) ? jf : [jf];
  } else if (raw.jd_union_open_goods_query_response?.queryResult?.data?.goodsResp) {
    const gr = raw.jd_union_open_goods_query_response.queryResult.data.goodsResp;
    list = Array.isArray(gr) ? gr : [gr];
  }   else if (Array.isArray(raw.result_list)) list = raw.result_list;
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

function normalizeItem(item) {
  const id = item.tao_id ?? item.skuId ?? item.item_id ?? item.goods_id ?? item.num_iid ?? item.id;
  const price = parseFloat(
    item.quanhou_jiage ?? item.zk_final_price ?? item.price ?? item.size ?? item.coupon_price ?? item.final_price ?? item.quan_price
    ?? item.priceInfo?.price ?? item.wlUnitPrice ?? 0
  ) || 0;
  const title = item.title ?? item.tao_title ?? item.skuName ?? item.goods_name ?? item.item_title ?? item.goods_title ?? '';
  const pic = item.pict_url ?? item.goods_thumb_url ?? item.pic_url ?? item.image ?? item.goods_pic
    ?? item.imageInfo?.whiteImage ?? item.imageInfo?.imageList?.urlInfo?.url ?? (Array.isArray(item.imageInfo?.imageList?.urlInfo) ? item.imageInfo.imageList.urlInfo[0]?.url : null) ?? '';
  const link = item.item_url ?? item.url ?? item.coupon_click_url ?? item.click_url ?? item.link ?? item.goods_link
    ?? (item.materialUrl ? (item.materialUrl.startsWith('http') ? item.materialUrl : 'https://' + item.materialUrl.replace(/^https?:\/\//, '')) : '') ?? '';
  const coupon = item.coupon_info ?? item.coupon_amount ?? item.coupon ?? '';
  const linkPic = ((link || '') + ' ' + (item.pict_url ?? item.pic_url ?? item.image ?? '')).toLowerCase();
  const source = linkPic.includes('jd.com') || linkPic.includes('360buyimg') ? '京东' : '淘宝';
  return { itemId: id, title, price, pic, link, coupon, source, raw: item };
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
  if (raw.status === 301) throw new Error('折淘客 api_all 参数错误或未授权');
  return raw;
}

/** 从商品原始对象拼接所有可检索文本（标题、描述、类目、京东 skuName 等），避免关键词过滤误杀 */
function getSearchableText(item) {
  const parts = [
    item.title,
    item.tao_title,
    item.skuName,
    item.short_name,
    item.goods_name,
    item.goods_title,
    item.item_title,
    item.jianjie,
    item.goods_content,
    item.desc,
    item.category_name,
    item.level_one_category_name,
    item.cid1Name,
    item.cid2Name,
    item.cid3Name,
  ].filter(Boolean);
  return parts.join(' ').toLowerCase();
}

/**
 * 关键词匹配：标题/简介/类目/京东 skuName 等包含「完整关键词」或「任一连词段」即保留
 */
function itemMatchesKeyword(item, lowerKw) {
  if (!lowerKw || lowerKw === '商品') return true;
  const text = getSearchableText(item);
  if (text.includes(lowerKw)) return true;
  for (let i = 0; i <= lowerKw.length - 2; i++) {
    const seg = lowerKw.slice(i, i + 2);
    if (text.includes(seg)) return true;
  }
  return false;
}

/** 手机配件相关词：搜 手机/智能手机/华为手机 时排除标题或类目含以下词的商品（避免只出壳膜线等） */
const PHONE_ACCESSORY_WORDS = [
  '配件', '手机壳', '保护壳', '手机套', '保护套', '贴膜', '钢化膜', '数据线', '充电器', '充电线',
  '充电头', '适配器', '支架', '挂绳', '指环', '手机绳', '耳机', '耳塞', '保护膜', '背膜', '镜头膜', '车载支架',
  '手机支架', '壳膜', '壳套', '充电宝', '移动电源',
  '挂件', '防尘塞', '软壳', '透明壳', '气囊', '指环扣', '懒人支架', '磁吸', '硅胶套', '防摔壳',
  '挂带', '贴纸', '小挂件', '收纳', '镜头盖', '背夹', '腕带', '钥匙扣', '吊坠', '挂链',
  '纳米膜', '水凝膜', '防窥膜', '镜头贴', '取卡针', '卡针', '转接头', '手机扣', '吸盘', '夹子',
  '挂扣', '绕线', '理线', '绑带', '卡托', '防丢绳', '挂脖', '出风口', '背贴', '全包壳', '半包壳',
  '软边', '硬壳', '液态硅胶', '彩绘壳', '卡通壳', '毛绒', '玩偶挂件', '接口塞', '充电塞',
  '收纳包', '收纳袋', '擦屏', '清洁布', '触控笔', '扩展坞', 'case', 'cover', 'film', 'protector',
];

function isPhoneAccessory(item) {
  const text = getSearchableText(item);
  if (PHONE_ACCESSORY_WORDS.some((w) => text.includes(w))) return true;
  if (!/手机|智能机|电话/i.test(text)) return false;
  return /壳|膜|套|线|支架|扣|贴|绳|挂件|挂链|指环|吸盘|夹子|塞|盖|贴纸|腕带|绑带|收纳|防尘|磁吸|硅胶|气囊|软边|硬壳|彩绘|卡通|毛绒|玩偶|绕线|理线|卡托|转接头|取卡|接口|充电塞|耳机孔/i.test(text);
}

function isPhoneSearch(keyword) {
  const k = (keyword || '').trim();
  return /手机|智能机|电话|iphone|安卓机/i.test(k);
}

/** 搜「手机」时只保留「像手机」的商品：标题须含 手机/智能机 且含品牌或全网通/5G/内存/屏幕 等，避免只出壳膜线 */
const PHONE_PRODUCT_INDICATORS = [
  '华为', '苹果', '小米', 'vivo', 'oppo', '三星', '荣耀', '真我', '一加', '魅族', '中兴', '联想', '红米', '诺基亚', '索尼', '摩托',
  '全网通', '5g', '4g', '智能手机', '智能机', '新款', '官方', '正品', '旗舰', '大屏', '双卡', '安卓', '苹果手机', '华为手机', '小米手机',
  'iphone', 'galaxy', 'mate', 'p系列', 'nova', '畅享', '麦芒', 'redmi', 'realme', 'iqoo', '一加手机',
  '内存', '屏幕', '英寸', 'gb', '大内存', '运行内存', '存储', '正品手机', '全新',
];
/** 品牌+型号/规格词：标题无「手机」但含这些词时，在「品牌+手机」搜索下也视为整机（如 华为 Mate 60 Pro） */
const PHONE_MODEL_SPEC_WORDS = [
  'mate', 'p系列', 'p40', 'p50', 'p60', 'nova', '畅享', '麦芒', 'redmi', 'realme', 'iqoo', 'galaxy', 'iphone',
  '内存', '屏幕', '英寸', 'gb', '大内存', '运行内存', '存储', '旗舰', '5g', '4g', '全网通', '智能手机', '智能机', '双卡', '大屏',
];

function itemLooksLikePhone(item, keyword) {
  const text = getSearchableText(item);
  // 路径1：标题含「手机/智能机/电话/iphone」且含品牌或规格词 → 保留
  if (/手机|智能机|电话|iphone|安卓机/i.test(text) && PHONE_PRODUCT_INDICATORS.some((w) => text.includes(w)))
    return true;
  // 路径2：搜索词为「品牌+手机」（如 华为手机）时，标题含该品牌 + 型号/规格词即视为整机（如 华为 Mate 60 Pro）
  const brandPhoneMatch = (keyword || '').trim().match(/^(.+?)手机$/);
  if (brandPhoneMatch) {
    const brand = brandPhoneMatch[1].trim().toLowerCase();
    if (!brand) return false;
    const lower = text.toLowerCase();
    if (!lower.includes(brand)) return false;
    if (PHONE_MODEL_SPEC_WORDS.some((w) => lower.includes(w))) return true;
  }
  return false;
}

/**
 * 聚合搜索：优先使用 20000 端口「超高佣金商品API」拉取列表（带关键词 q、多页），再按关键词与价格筛选
 */
async function searchProducts(appkey, { keyword, minPrice, maxPrice }) {
  const cid = getCidForApiAll(keyword);
  const lowerKw = (keyword || '').trim().toLowerCase();
  const hasKeyword = lowerKw && lowerKw !== '商品';
  const needMorePages = isPhoneSearch(keyword);
  const debug = process.env.DEBUG_SEARCH === '1' || process.env.DEBUG_SEARCH === 'true';
  let list = [];

  if (hasKeyword) {
    const promotionParams = getPromotionParams();
    const searchResultPages = 6;
    for (const base of [BASE_LINGQUAN, BASE_20000]) {
      for (let page = 1; page <= searchResultPages; page++) {
        try {
          const raw = await request('/api/search_result.ashx', {
            appkey, q: keyword, page, page_size: 50, ...promotionParams,
          }, base);
          if (!raw?.__html && raw?.status !== 301) {
            const chunk = parseItemList(raw);
            if (chunk.length) list = list.concat(chunk);
            if (chunk.length < 50) break;
          } else break;
        } catch (_) { break; }
      }
    }
    if (debug) console.log('[search] after search_result: %d', list.length);
  }

  try {
    const pagesToFetch = needMorePages ? 8 : hasKeyword ? 6 : 1;
    for (let p = 1; p <= pagesToFetch; p++) {
      let raw = await apiAll(appkey, {
        page: p,
        page_size: 50,
        sort: 'price_asc',
        cid: cid || undefined,
        q: hasKeyword ? keyword : undefined,
      });
      if (raw && raw.__html && p === 1 && hasKeyword) {
        try {
          const fallback = await request('/api/api_all.ashx', {
            appkey, page: 1, page_size: 50, sort: 'price_asc',
            ...(cid ? { cid } : {}), q: keyword, ...getPromotionParams(),
          }, BASE_LINGQUAN);
          if (!fallback?.__html && fallback?.status !== 301) raw = fallback;
        } catch (_) {}
      }
      if (raw && raw.__html) {
        if (debug) console.log('[search] api_all 第%d页返回 HTML，已 break', p);
        break;
      }
      const chunk = parseItemList(raw);
      if (!chunk.length) {
        if (debug) console.log('[search] api_all 第%d页 parseItemList 解析到 0 条', p);
        break;
      }
      list = list.concat(chunk);
      if (chunk.length < 50) break;
    }
    if (debug) console.log('[search] after api_all: %d', list.length);
  } catch (e) {
    if (e.htmlContent) throw e;
    if (debug) console.log('[search] api_all 异常:', e?.message?.slice(0, 60));
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
        const chunk = parseItemList(raw);
        if (!chunk.length) break;
        list = list.concat(chunk);
        if (chunk.length < DEFAULT_PAGE_SIZE) break;
      }
    } catch (e2) {
      if (e2.htmlContent) throw e2;
      throw e;
    }
    if (debug) console.log('[search] after 领券 fallback: %d', list.length);
  }

  if (list.length === 0 && isPhoneSearch(keyword)) {
    try {
      const jdRaw = await callApi('jd_jingfen', { appkey, eliteId: '24', pageIndex: '1', pageSize: '50' });
      if (!jdRaw?.__html) {
        const code = jdRaw?.jd_union_open_goods_jingfen_query_response?.queryResult?.code;
        if (code === '200' || code === 200) {
          const jdList = parseItemList(jdRaw);
          if (jdList.length) list = jdList;
        }
      }
    } catch (_) {}
    if (debug) console.log('[search] after jd_jingfen(if): %d', list.length);
  }

  if (hasKeyword && list.length === 0) {
    try {
      for (let jdPage = 1; jdPage <= 5; jdPage++) {
        const jdListRaw = await callApi('jd_goods_list', {
          appkey, keyword, pageIndex: String(jdPage), pageSize: '50', sort: 'price_asc',
        });
        if (!jdListRaw?.__html && (jdListRaw?.status === 200 || jdListRaw?.content?.length)) {
          const jdList = parseItemList(jdListRaw);
          if (jdList.length) list = list.concat(jdList);
          if (!jdList?.length || jdList.length < 50) break;
        } else break;
      }
    } catch (_) {}
    if (debug) console.log('[search] after jd_goods_list: %d', list.length);
  }

  const dedupById = (arr) => {
    const seen = new Set();
    return arr.filter((item) => {
      const id = item.tao_id ?? item.skuId ?? item.item_id ?? item.goods_id ?? item.num_iid ?? item.id;
      if (id == null || id === '') return true;
      const sid = String(id);
      if (seen.has(sid)) return false;
      seen.add(sid);
      return true;
    });
  };
  list = dedupById(list);
  if (debug) console.log('[search] after dedup: %d', list.length);

  const isRawJd = (r) => {
    const link = (r.item_url ?? r.url ?? r.materialUrl ?? '').toLowerCase();
    const pic = (r.pict_url ?? r.pic_url ?? r.image ?? '').toLowerCase();
    return link.includes('jd.com') || pic.includes('360buyimg');
  };
  const taobaoCount = list.filter((r) => !isRawJd(r)).length;
  if (list.length > 0 && taobaoCount === 0 && hasKeyword) {
    const params = {
      appkey, page: 1, page_size: 50, sort: 'price_asc', q: keyword,
      ...(cid ? { cid } : {}), ...getPromotionParams(),
    };
    for (const base of [BASE_LINGQUAN, BASE_20000]) {
      try {
        const taoRaw = await request('/api/api_all.ashx', params, base);
        if (!taoRaw?.__html && taoRaw?.status !== 301) {
          const chunk = parseItemList(taoRaw);
          if (chunk.length) {
            list = list.concat(chunk);
            break;
          }
        }
      } catch (_) {}
    }
    try {
      const type = getCategoryType(keyword);
      for (let p = 1; p <= 2; p++) {
        const raw = await apiCategorySearch(appkey, type, p);
        if (!raw?.__html && raw?.status !== 301) {
          const chunk = parseItemList(raw);
          if (chunk.length) list = list.concat(chunk);
          if (chunk.length < DEFAULT_PAGE_SIZE) break;
        } else break;
      }
    } catch (_) {}
    list = dedupById(list);
    if (debug) console.log('[search] after 补淘宝: %d', list.length);
  }

  if (hasKeyword) {
    const before = list.length;
    list = list.filter((item) => itemMatchesKeyword(item, lowerKw));
    if (debug) console.log('[search] after keyword filter: %d (was %d)', list.length, before);
  }
  if (isPhoneSearch(keyword)) {
    const before = list.length;
    list = list.filter((item) => !isPhoneAccessory(item));
    const afterAccessory = list.length;
    list = list.filter((item) => itemLooksLikePhone(item, keyword));
    if (debug) console.log('[search] after phone filter (去配件+只留手机): %d (去配件后 %d, 原 %d)', list.length, afterAccessory, before);
  }

  let items = list.map(normalizeItem);
  if (minPrice != null && minPrice > 0) items = items.filter((i) => i.price >= minPrice);
  if (maxPrice != null && maxPrice < 999999) items = items.filter((i) => i.price <= maxPrice);
  if (debug) console.log('[search] after price filter: %d', items.length);
  items.sort((a, b) => a.price - b.price);

  const taoInResult = items.filter((i) => i.source === '淘宝').length;
  if (items.length > 0 && taoInResult === 0 && !searchProducts._noTaobaoWarned) {
    searchProducts._noTaobaoWarned = true;
    console.warn(
      '[搜索] 当前结果中无淘宝商品，可能原因：1) 折淘客 20000/领券站 返回登录页或未授权；2) 需在折淘客后台开通「全网超高佣」「领券站」并完成授权。设置 DEBUG_SEARCH=1 可查看各阶段条数。'
    );
  }

  return items;
}

/** 判断是否为京东商品（链接或来源含 jd） */
function isJdItem(item) {
  const link = (item.link || item.raw?.item_url || item.raw?.url || '').toLowerCase();
  const pic = (item.pic || item.raw?.pict_url || '').toLowerCase();
  return link.includes('jd.com') || link.includes('360buyimg') || pic.includes('360buyimg');
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
  ZHETAOKE_APIS,
  callApi,
  apiDetail,
  apiCategorySearch,
  apiAll,
  apiConvertToAffiliate,
  searchProducts,
  ensurePromotionLinks,
  getCategoryType,
  getCidForApiAll,
};
