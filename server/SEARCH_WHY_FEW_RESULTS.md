# 为什么查询到的记录这么少？—— 原因分析

基于当前 `searchProducts` 逻辑，记录少主要有以下几类原因。

---

## 一、当前流程简述

1. **只请求 api_all**（20000 端口，带 `q` + `cid`），最多 3 页（手机相关 5 页），每页 50 条。
2. 若 api_all **第 1 页就返回 HTML**（登录/授权页），直接 `break`，**不尝试领券站 base**，list 可能为 0。
3. 若 api_all **抛错**（如 301），进入 catch，用**领券分类**（apiCategorySearch）再拉 1～3 页，每页 **20 条**，且是**分类**不是关键词搜索。
4. 若 list 仍为空且是「手机」相关词，再请求**京粉精选**（jd_jingfen）一页 50 条。
5. 最后按**关键词**和**手机配件**过滤，再价格过滤、排序。

**当前没有**：search_result（关键词搜索接口）、jd_goods_list（京东关键词列表）、api_all 返回 HTML 时领券 base 兜底。

---

## 二、记录少的 5 个主要原因

### 1. 20000 端口经常返回 HTML，主数据源直接失效

- api_all 请求 **20000** 时，很多环境会返回登录/授权页（HTML），代码里遇到 `__html` 就 **break**，**没有**再试领券站（BASE_LINGQUAN）的 api_all。
- 后果：第一页就停，list 可能为 0，只能依赖领券或京粉，总条数很少。
- **建议**：检测到 `__html` 时，再试一次 BASE_LINGQUAN 的 api_all；或检查折淘客 20000 授权。

### 2. 数据源少且单源条数有限

- 当前只有：**api_all**、**领券分类**、手机时的 **jd_jingfen**。
- **没有**：search_result（带 `q` 的关键词搜索）、jd_goods_list（带 `keyword` 的京东列表）。
- 领券分类每页只有 **20 条**，最多 3 页共 60 条，且是**分类**不是关键词，结果往往不贴切。
- **建议**：增加 search_result（带 q）拉关键词结果；list 为空时用 jd_goods_list（带 keyword）补数。

### 3. 遇 HTML 就停，不兜底领券 base

- 第 1 页就是 HTML 时，直接 break，list 仍为 0，**没有**尝试领券站同一接口。
- **建议**：第 1 页为 `__html` 时，用 BASE_LINGQUAN 再请求一页 api_all，成功则用该结果继续。

### 4. parseItemList 与接口结构不一致

- 若接口返回的列表在 `content.list`、`data.rows` 等，parseItemList 未识别则返回 **空数组**，分页提前 break，看起来像「没数据」。
- **建议**：用 `DEBUG_SEARCH=1` 看每步 list.length；若有 raw 但 list 为 0，看 raw 的 keys，在 parseItemList 里补对应分支。

### 5. 关键词过滤字段不全，误杀京东等商品

- **itemMatchesKeyword** 只用了：title、tao_title、goods_name、goods_title、jianjie、goods_content、desc。
- **没有**用：**skuName**、**short_name**、**item_title** 等，京东商品常用 skuName 存标题，容易被过滤掉。
- **建议**：可检索文本里加上 skuName、short_name、item_title、类目字段等（与 getSearchableText 一致）。

---

## 三、如何快速确认是哪种原因

在 `.env` 里设置：

```env
DEBUG_SEARCH=1
```

重启服务后再搜索。控制台会输出各阶段条数，例如：

- `[search] after api_all: 0` → 多半是 20000 返回 HTML 或 parseItemList 未解析到；
- `[search] after api_all: 50`、`after keyword filter: 5` → 关键词过滤过严或字段不全（如缺 skuName）；
- `[search] after 领券 fallback: 20` → 主数据源失效，只靠领券 20 条/页。

---

## 四、总结表

| 原因 | 表现 | 建议 |
|------|------|------|
| 20000 返回 HTML | api_all 后条数为 0 | 试领券 base；检查 20000 授权 |
| 数据源少 | 只有 api_all + 领券 + 手机京粉 | 加 search_result、jd_goods_list |
| 不兜底领券 base | 第 1 页 HTML 即停 | __html 时再请求 BASE_LINGQUAN 的 api_all |
| parseItemList 不匹配 | raw 有数据但 list 为 0 | 看 raw 结构，补解析分支 |
| 关键词字段不全 | 过滤后条数骤减 | 扩展 title、skuName、short_name 等 |

按上述建议改完后，再配合 `DEBUG_SEARCH=1` 看各阶段条数，即可进一步精确定位。
