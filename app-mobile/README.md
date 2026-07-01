# 智享全链 · 移动端 APP（uni-app 混合方案）

基于 uni-app 框架，将现有 `merchant-mobile` 的 Vue 3 页面迁移到 App 端，一套代码同时产出 Android / iOS / 微信小程序 / H5 四端。

## 架构

```
merchant-mobile (Vue 3 + Vant + Vite)
       │
       │  页面迁移 + API 适配
       ▼
app-mobile (uni-app + Vue 3 + Pinia)
       │
       │  HBuilderX 云打包
       ▼
  ┌─────────┬─────────┬──────────┬─────┐
  │ Android │   iOS   │ 微信小程序 │ H5  │
  └─────────┴─────────┴──────────┴─────┘
```

## 关键适配

| 原 merchant-mobile | uni-app 适配 |
|-------------------|-------------|
| `axios` 请求 | `uni.request`（`src/api/request.ts`） |
| `localStorage` | `uni.setStorageSync/getStorageSync`（`src/api/storage.ts`） |
| `vue-router` 路由 | `pages.json` 声明式路由 |
| `<component :is>` 动态组件 + `van-tabbar` | `pages.json` tabBar 配置 |
| 全局 `auth:logout` 事件 | Pinia `useUserStore.logout()` |
| CSS 变量 `tokens.css` | `uni.scss` SCSS 变量 |

## 目录结构

```
app-mobile/
├── pages.json              # 路由 + tabBar + 全局样式配置
├── manifest.json           # 应用清单（Android/iOS/小程序/H5）
├── App.vue                 # 应用入口
├── main.js                 # Vue 实例创建
├── uni.scss                # 全局 SCSS 变量
├── pages/                  # 30 个页面
│   ├── login/              # 登录
│   ├── home/               # 首页（工作台）
│   ├── orders/             # 订单（列表 + 详情）
│   ├── products/           # 商品（列表 + 详情）
│   ├── inventory/          # 库存管理
│   ├── customers/          # 客户管理
│   ├── sales/              # 开单 + 销售单
│   ├── reports/            # 报表
│   ├── marketing/          # 营销中心
│   ├── purchase/           # 采购
│   ├── suppliers/          # 供应商
│   ├── statements/         # 对账
│   ├── instant-retail/     # 即时零售
│   ├── order-center/       # 订单中心
│   ├── order-exception/    # 异常订单
│   ├── order-aftersale/    # 售后
│   ├── profile/            # 个人中心
│   ├── notifications/      # 消息通知
│   ├── todos/              # 待办事项
│   ├── admin/              # 管理后台
│   ├── receipts/           # 财务往来
│   └── transfer/           # 库存调拨
├── src/
│   ├── api/                # API 适配层
│   │   ├── request.ts      # uni.request 封装
│   │   ├── storage.ts      # 存储适配器
│   │   └── modules/        # 业务 API 模块（auth/orders/products/...）
│   └── stores/             # Pinia 状态管理
│       └── user.ts         # 用户状态
└── static/                 # 静态资源
    ├── logo.svg
    └── tabbar/             # TabBar 图标（10 个 SVG）
```

## 开发

```bash
# 安装依赖
npm install

# H5 开发
npm run dev:h5

# 微信小程序开发
npm run dev:mp-weixin

# App 开发（需要 HBuilderX）
npm run dev:app
```

## 打包

| 命令 | 目标 |
|------|------|
| `npm run build:h5` | H5 网页 |
| `npm run build:mp-weixin` | 微信小程序 |
| `npm run build:app` | App（需 HBuilderX 云打包） |

## 页面完成度

| 状态 | 数量 | 说明 |
|:---:|:---:|------|
| ✅ 已实现 | 12 | 登录、首页、订单、商品、库存、客户、开单、个人中心、消息、待办、订单详情 |
| ⏳ 占位 | 18 | 其余页面使用占位模板，待后续迁移 |

## 注意事项

1. **TabBar 图标**：当前使用 SVG 占位图标，发布前需替换为 81x81 PNG
2. **manifest.json 中的 appid**：`wx_appid_placeholder` 需替换为真实微信 AppID
3. **API 域名**：生产环境使用 `https://api.onepan.cn/api`，开发环境通过 HBuilderX 配置代理
4. **推送/支付**：manifest.json 中已声明模块，需在 HBuilderX 中配置原生 SDK