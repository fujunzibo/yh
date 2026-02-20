/**
 * 从用户输入文本中解析出搜索关键词和价格区间
 * 例如："价格1000元左右的手机" -> { keyword: "手机", minPrice: 800, maxPrice: 1200 }
 */

const PRICE_LEFT_RIGHT_RATIO = 0.2; // “左右” 默认 ±20%
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 999999;

/**
 * 解析包含价格的描述，支持：
 * - 1000元、1000元左右、约1000元、1000-2000元、500到1500
 */
function parsePriceRange(text) {
  let minPrice = DEFAULT_MIN;
  let maxPrice = DEFAULT_MAX;

  // 区间：500-1500、500到1500、500~1500、500至1500
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-到~至]\s*(\d+(?:\.\d+)?)\s*元?/);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]);
    const b = parseFloat(rangeMatch[2]);
    minPrice = Math.min(a, b);
    maxPrice = Math.max(a, b);
    return { minPrice, maxPrice, matched: rangeMatch[0] };
  }

  // 单点 + 左右/上下/约：1000元左右、约1000元
  const singleMatch = text.match(/(?:约|大概|大约)?\s*(\d+(?:\.\d+)?)\s*元\s*(左右|上下|附近|以内|以下|以上)?/);
  if (singleMatch) {
    const price = parseFloat(singleMatch[1]);
    const suffix = (singleMatch[2] || '').trim();
    if (suffix === '左右' || suffix === '上下' || suffix === '附近') {
      const delta = Math.max(price * PRICE_LEFT_RIGHT_RATIO, 50);
      minPrice = Math.max(0, Math.floor(price - delta));
      maxPrice = Math.ceil(price + delta);
    } else if (suffix === '以内' || suffix === '以下') {
      maxPrice = price;
      minPrice = 0;
    } else if (suffix === '以上') {
      minPrice = price;
    } else {
      const delta = Math.max(price * PRICE_LEFT_RIGHT_RATIO, 50);
      minPrice = Math.max(0, Math.floor(price - delta));
      maxPrice = Math.ceil(price + delta);
    }
    return { minPrice, maxPrice, matched: singleMatch[0] };
  }

  return { minPrice, maxPrice, matched: null };
}

/**
 * 从整段话中移除价格部分，得到“关键词”
 */
function removePricePart(text, priceMatched) {
  let keyword = text
    .replace(/\s+/g, ' ')
    .replace(/^(想要|找|买|搜|查|求|要)\s*/i, '')
    .trim();
  if (priceMatched) {
    keyword = keyword.replace(priceMatched, ' ').replace(/\s+/g, ' ').trim();
  }
  // 移除可能残留的数字+元（如「手机1000元」中的「1000元」）
  keyword = keyword.replace(/\s*\d+(?:\.\d+)?\s*元\s*/g, ' ').replace(/\s+/g, ' ').trim();
  // 移除「价格」「左右的」等前缀，避免得到「价格的手机」→ 应得「手机」
  keyword = keyword.replace(/^价格\s*(左右)?\s*的?\s*/i, '').replace(/^左右的?\s*的?\s*/i, '').trim();
  keyword = keyword.replace(/\s*(的|了|呢|啊|哈)\s*$/g, '').trim();
  return keyword || '商品';
}

/**
 * 解析用户输入，返回 { keyword, minPrice, maxPrice }
 * @param {string} userInput - 例如 "价格1000元左右的手机"
 */
function parseSearchIntent(userInput) {
  if (!userInput || typeof userInput !== 'string') {
    return { keyword: '商品', minPrice: DEFAULT_MIN, maxPrice: DEFAULT_MAX };
  }
  const text = userInput.trim();
  const { minPrice, maxPrice, matched } = parsePriceRange(text);
  const keyword = removePricePart(text, matched);
  return {
    keyword: keyword || '商品',
    minPrice,
    maxPrice,
  };
}

export { parseSearchIntent, parsePriceRange, removePricePart };
