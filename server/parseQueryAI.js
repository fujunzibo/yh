/**
 * 智能解析用户搜索意图：可选 AI 提取关键词与价格，再与规则解析结合
 * 配置 OPENAI_API_KEY 时使用 AI；否则仅用规则，并做简单关键词扩展
 */

import { parseSearchIntent, parsePriceRange, removePricePart } from './parseQuery.js';

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 999999;

/**
 * 用 OpenAI 从自然语言中提取：关键词列表（用于模糊匹配）、价格区间
 * @returns {{ keywords: string[], minPrice: number, maxPrice: number } | null } 失败返回 null
 */
async function parseWithAI(userInput) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !userInput?.trim()) {
    return null;
  }

  const system = `你是一个购物搜索解析助手。从用户的一句话需求中提取：
1. keywords：用于商品模糊匹配的关键词数组。包含核心商品词、属性词、同义/近义词，每词 2-6 字。例如 "拍照好的手机" 可输出 ["手机","拍照","相机","像素","镜头"]。
2. minPrice、maxPrice：价格区间（数字），没有提到价格则 minPrice=0, maxPrice=999999。
只输出一行合法 JSON，不要 markdown 和说明。格式：{"keywords":["词1","词2"],"minPrice":0,"maxPrice":999999}`;

  const text = userInput.trim();
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const json = content.replace(/^```\w*\n?|\n?```$/g, '').trim();
    const out = JSON.parse(json);
    const keywords = Array.isArray(out.keywords) ? out.keywords.filter((k) => k && String(k).trim()) : [];
    const minPrice = Number(out.minPrice);
    const maxPrice = Number(out.maxPrice);
    return {
      keywords: keywords.length ? keywords : [text.replace(/\d+\s*元/g, '').trim() || '商品'],
      minPrice: Number.isFinite(minPrice) && minPrice >= 0 ? minPrice : DEFAULT_MIN,
      maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : DEFAULT_MAX,
    };
  } catch (e) {
    console.warn('[解析] AI 调用失败，已回退到规则解析:', e?.message || e);
    return null;
  }
}

/**
 * 将短语关键词拆成「商品类型 + 需求属性」，用于展示与模糊匹配
 * 例如 "拍照好的手机" -> { displayKeyword: "手机、拍照功能好", keywords: ["手机", "拍照功能好", "拍照"] }
 */
function normalizeKeywordPhrase(keyword) {
  const k = (keyword || '').trim();
  if (!k || k === '商品') return { displayKeyword: '商品', keywords: ['商品'] };
  const keywords = [];
  const displayParts = [];
  if (/手机|智能机|电话|iphone|安卓机/i.test(k)) {
    displayParts.push('手机');
    keywords.push('手机');
  }
  if (/电脑|笔记本|台式机/i.test(k)) {
    displayParts.push('电脑');
    keywords.push('电脑');
  }
  if (/耳机|耳塞/i.test(k)) {
    displayParts.push('耳机');
    keywords.push('耳机');
  }
  if (/拍照好|拍照|相机|像素|镜头|摄像/i.test(k)) {
    displayParts.push('拍照功能好');
    keywords.push('拍照功能好', '拍照', '相机');
  }
  if (/续航|电池|省电/i.test(k)) {
    displayParts.push('续航好');
    keywords.push('续航');
  }
  if (/性价比/i.test(k)) {
    displayParts.push('性价比高');
    keywords.push('性价比');
  }
  if (displayParts.length === 0) {
    displayParts.push(k);
    keywords.push(k);
  }
  const displayKeyword = displayParts.join('、');
  return { displayKeyword, keywords: [...new Set(keywords)] };
}

/**
 * 规则解析 + 简单扩展：从关键词拆出可匹配的短词（2 字起）
 */
function expandKeywordToTerms(keyword) {
  const k = (keyword || '').trim().toLowerCase();
  if (!k || k === '商品') return [];
  const terms = [k];
  if (k.length > 2) {
    for (let i = 0; i <= k.length - 2; i++) terms.push(k.slice(i, i + 2));
  }
  return [...new Set(terms)];
}

/**
 * 智能解析：优先 AI，失败则用规则解析并扩展为多词
 * @returns {{ keywords: string[], keyword: string, minPrice: number, maxPrice: number }}
 */
export async function parseSearchIntentSmart(userInput) {
  if (!userInput || typeof userInput !== 'string') {
    return { keywords: ['商品'], keyword: '商品', minPrice: DEFAULT_MIN, maxPrice: DEFAULT_MAX };
  }

  const ai = await parseWithAI(userInput);
  if (ai) {
    const keyword = ai.keywords[0] || '商品';
    return {
      keywords: ai.keywords,
      keyword,
      minPrice: ai.minPrice,
      maxPrice: ai.maxPrice,
      usedAI: true,
    };
  }

  const { keyword, minPrice, maxPrice } = parseSearchIntent(userInput);
  const rawKw = keyword || '商品';
  const { displayKeyword, keywords } = normalizeKeywordPhrase(rawKw);
  const terms = keywords.length ? keywords : expandKeywordToTerms(rawKw);
  return {
    keywords: terms.length ? terms : [rawKw],
    keyword: displayKeyword,
    minPrice,
    maxPrice,
    usedAI: false,
  };
}

export { parseSearchIntent, parsePriceRange, removePricePart };
