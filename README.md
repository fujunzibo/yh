# 优惠购 - 折淘客优惠购物 App

通过折淘客 API 获取淘宝、京东、拼多多等平台的优惠信息。在输入框输入自然语言需求（如「价格1000元左右的手机」），应用会解析关键词与价格区间，调用接口搜索并**按价格从低到高**展示带推广链接的结果，用户通过链接下单你可获得佣金。

## 功能

- **自然语言输入**：例如「价格1000元左右的手机」「500到1500的耳机」
- **自动解析**：提取关键词（手机、耳机等）和价格区间
- **折淘客 API**：使用你的 appkey 拉取商品并生成你的推广链接
- **按价格排序**：结果按价格从小到大排列
- **佣金**：用户点击链接并成交后，你在折淘客账户可获得佣金

## 环境准备

1. **Node.js** 18+
2. **折淘客账号**：在 [折淘客开放平台](https://www.zhetaoke.com/) 获取对接秘钥（appkey）

## 配置

- 复制 `.env.example` 为 `.env`（如尚未存在）
- 在 `.env` 中填写你的折淘客 appkey：

```env
ZHETAOKE_APPKEY=你的appkey
```

**重要**：不要将 `.env` 提交到 git；`.gitignore` 已忽略 `.env`。

## 运行

### 开发

需要同时起前端和后端：

```bash
# 终端 1：后端 API
npm run server

# 终端 2：前端（Vite 会代理 /api 到后端）
npm run dev
```

浏览器访问：http://localhost:5173

### 生产

```bash
npm run build
npm run server
```

后端会托管 `dist` 静态资源，访问：http://localhost:3000

## 折淘客接口说明

当前实现假设折淘客提供「关键词 + 价格区间」的搜索接口。若你使用的接口名称或参数不同，请修改：

- **搜索接口**：`server/zhetaoke.js` 中的 `apiSearch()`  
  - 当前示例路径：`/api/open_tbk_dg_material_optional`  
  - 请以折淘客开放平台文档为准，修改路径与参数（如 `q`、`start_price`、`end_price` 等）

- **备用逻辑**：当搜索接口不可用时，会尝试按分类（如数码）拉取再按关键词和价格筛选，可在同一文件中调整。

你的折淘客**登录账号与密码**仅用于在折淘客网站管理后台使用，本应用只需在 `.env` 中配置 **appkey** 即可完成 API 调用与佣金归属。

## 项目结构

```
├── index.html
├── src/
│   ├── main.js      # 前端入口与界面
│   └── main.css     # 样式
├── server/
│   ├── index.js     # Express 服务与 /api/search
│   ├── parseQuery.js # 自然语言解析（关键词、价格）
│   └── zhetaoke.js  # 折淘客 API 封装
├── .env             # 本地配置（勿提交）
└── package.json
```

## 安全提示

- 不要在前端或公开仓库中暴露 appkey 或密码。
- 生产环境请使用 HTTPS 与合适的环境变量管理方式。
