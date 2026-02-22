# 搜索逻辑说明（searchProducts）

入口：`POST /api/search` → `parseSearchIntentSmart(query)` → `searchProducts(appkey, { keyword, keywords, minPrice, maxPrice })`。

**原则**：只拉「带关键词 q 的接口」，严格按关键词过滤，**不再用分类/精选等无关数据掺入**，避免「华为手机」搜出 1～6 元小玩意。

---

## 一、输入

| 变量 | 含义 |
|------|------|
| `q` / `primaryKw` | 实际请求关键词（来自 `keywords[0]` 或 `keyword`） |
| `hasKeyword` | 是否有有效关键词（非空且不是「商品」） |
| `cid` | api_all 分类（由 `getCidForApiAll(primaryKw)` 得到，如 罗技/手机→8 数码） |
| `fromIdSearch` | 是否由「纯数字 ID」查到的（跳过关键词过滤） |

---

## 二、数据拉取（按顺序）

### 1. 按 ID 查详情（仅当 `q` 为 6～12 位数字）

- 依次尝试 BASE_20000、BASE_LINGQUAN、BASE_API_10002。
- 每个 base 下尝试：`api_detail.ashx`（tao_id / item_id / id）、`open_item_info.aspx`（同上）。
- 任一成功即得到 `list` 并设 `fromIdSearch = true`，**不再执行下面的关键词数据源**。

### 2. 关键词搜索（仅当 `hasKeyword`）

只使用「带 q 的接口」，**不用**领券分类、京粉精选等无关接口。

- **2.1 search_result**  
  BASE_LINGQUAN、BASE_20000 各最多 2 页，`q`、`page`、`page_size: 50`，结果合并到 `list`。

- **2.2 api_all**  
  最多 3 页，带 `q`、`cid`、分页。若第 1 页 20000 返回 `__html`，再试一次 BASE_LINGQUAN 的 `api_all.ashx`。每页解析后合并到 `list`。

- **2.3 仍无结果时：jd_goods_list**  
  带 `keyword: q`，最多 2 页，合并到 `list`。后续会做**严格关键词过滤**，不匹配的不会展示。

---

## 三、去重

- `dedupById(list)`：以 `tao_id / skuId / item_id / goods_id / num_iid / id` 去重。

---

## 四、过滤

- **关键词严格过滤**（`!fromIdSearch && hasKeyword`）  
  `list = list.filter(item => itemMatchesKeywordStrict(item, primaryKw))`。  
  - 规则：标题等可检索文本须包含**完整关键词**，或（当关键词 ≥4 字时）包含**所有二字片段**。  
  - 例：「华为手机」→ 须同时含「华为」和「手机」，否则剔除（避免配件、小件混入）。

- **手机相关词**  
  若 `isPhoneSearch(primaryKw)`，再排除「手机配件」类（壳、膜、线等）。

---

## 五、价格与输出

- `items = list.map(normalizeItem)`，按 `minPrice`/`maxPrice` 过滤；若无结果且原 list 非空则做放宽或标记 `_priceFilterSkipped`。
- 按 `price` 升序排序后返回。

---

## 六、流程简图

```
输入 q, keyword, keywords, minPrice, maxPrice
    ↓
纯数字 ID？ → 是：详情接口多 base/多 path → list, fromIdSearch=true
    ↓ 否 / 或 无结果
有关键词？ → 是：search_result(2 base×2 页) → api_all(3 页，必要时领券 base) → 仍空则 jd_goods_list(2 页)
    ↓
dedupById(list)
    ↓
关键词严格过滤（华为手机 = 须含 华为+手机）；手机词则排除配件
    ↓
normalizeItem → 价格区间 → 排序 → 返回 items
```

---

## 七、为何之前「华为手机」会出一堆几元小件

- 旧逻辑里用了**领券分类**（如数码 type=4）、**京粉精选**等**不带关键词**的接口，返回的是「数码类」「精选」等泛列表，包含大量低价配件。
- 过滤又偏松（任一词或二字片段即保留），所以几元数据线、壳膜等也被保留。
- 现逻辑：**只拉带 q 的接口**，且用 **itemMatchesKeywordStrict**（如「华为手机」必须同时含「华为」和「手机」），不再掺入分类/精选，基础查询以相关结果为主。
