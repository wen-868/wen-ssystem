# 智享全链 · 移动端 APP（uni-app 混合方案）

基于 uni-app 3.0.0（Vue 3 + Vite 6 + SCSS）框架，一套代码同时产出 Android / iOS / 微信小程序 / H5 四端。后端为 `wen-ssystem/backend`（NestJS 风格 Express 微服务，14 个端口）。

## 架构

```
merchant-mobile (Vue 3 + Vant + Vite)
       │
       │  页面迁移 + API 适配（uni.request / Pinia 状态 / pages.json 声明式路由）
       ▼
app-mobile (uni-app 3.0.0 + Vue 3 + Vite 6 + SCSS)
       │
       │  HBuilderX 云打包 / uni build
       ▼
  ┌─────────┬─────────┬──────────┬─────┐
  │ Android │   iOS   │ 微信小程序 │ H5  │
  └─────────┴─────────┴──────────┴─────┘
```

## 关键适配

| 原 merchant-mobile | uni-app 适配 |
|-------------------|-------------|
| `axios` 请求 | `uni.request`（`src/api/request.ts`，含租户头 / CSRF 防护） |
| `localStorage` | `uni.setStorageSync/getStorageSync`（`src/api/storage.ts`） |
| `vue-router` 路由 | `pages.json` 声明式路由（主包 + 分包） |
| `<component :is>` + `van-tabbar` | `pages.json` tabBar 配置（custom 模式） |
| 全局 `auth:logout` 事件 | 全局用户状态管理（登录态 / 登出） |
| CSS 变量 `tokens.css` | `uni.scss` SCSS 设计 Token（**全部样式走 Token，零硬编码颜色/字号/尺寸**） |

## 设计规范铁律

1. **禁止硬编码颜色 / 尺寸 / 字号字面量**：一律引用 `src/uni.scss` 中的 `$uni-*` / `$zx-*` 设计 Token；布局类通用结构用可复用组件，禁止逐页硬编码。
2. **不造假**：接口未聚合或未返回的字段，显示 `—` 或「对接中」，绝不编造业务数据或 MOCK 假数据。

## 目录结构

```
app-mobile/
├── index.html
├── manifest.json            # 应用清单（Android/iOS/小程序/H5）
├── vite.config.ts
├── package.json
├── src/
│   ├── pages.json           # 路由 + tabBar + 分包配置（共 113 页）
│   ├── uni.scss             # 全局 SCSS 设计 Token（零硬编码颜色）
│   ├── App.vue / main.ts    # 应用入口
│   ├── pages/               # 主包页面（16 页）
│   │   ├── login/           # 登录
│   │   ├── register/        # 注册
│   │   ├── home/            # 首页（工作台）
│   │   ├── orders/          # 订单（列表 + 详情）
│   │   ├── products/        # 商品（列表 + 详情）
│   │   ├── functions/       # 功能广场
│   │   ├── profile/         # 个人中心（含编辑资料 / 修改密码）
│   │   ├── ai-chat/         # AI 助手
│   │   ├── notifications/   # 消息通知（含详情）
│   │   └── todos/           # 待办事项
│   ├── pages-sub/           # 分包页面（93 页）
│   │   ├── order/           # 订单中心 / 异常订单 / 售后 / 销售单 / 销售单详情
│   │   ├── product/         # 商品 / 库存 / 客户 / 供应商 / 批次 / 价格 / 盘点 / 溯源
│   │   ├── marketing/       # 营销 / 会员 / 会员等级 / 积分 / 储值卡
│   │   ├── finance/         # 财务看板 / 费用 / 费用详情 / 调拨 / 调拨创建 / 采购 / 对账 / 报损溢
│   │   ├── admin/           # 工作台 / 员工 / 角色 / 门店 / 权限 / 设置 / 全部功能
│   │   └── settings/        # 系统设置（Tab：公司信息 / 基本设置 / 通知设置 / 关于）
│   ├── api/
│   │   ├── request.ts       # uni.request 封装（租户头 / CSRF）
│   │   ├── storage.ts       # 存储适配器
│   │   └── modules/         # 43 个业务 API 模块（auth/orders/products/sales/expenses/transfer/suppliers/members/...）
│   ├── components/          # 公共组件（page-header 等）
│   ├── composables/         # 组合式函数（表单校验等）
│   └── native/              # 原生插件封装（扫码 scan.ts 等）
└── static/                 # 静态资源（tabbar SVG、图标）
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
| `npm run build:h5` | H5 网页（`uni build -p h5`） |
| `npm run build:mp-weixin` | 微信小程序 |
| `npm run build:app` | App（需 HBuilderX 云打包） |

## 页面完成度

| 状态 | 数量 | 说明 |
|:---:|:---:|------|
| ✅ 已实现 | 109 | 主包 16 + 分包 93，全部为真实业务页面（数据驱动，非占位） |
| ⏳ 占位 | 0 | 无占位页面；缺字段统一显示 `—` / 「对接中」 |

> 路由死链已闭环：设置页（`pages-sub/settings/settings`）已注册；追溯查询路径已修正为 `pages-sub/product/trace/trace-query`；费用详情 / 调拨创建 / 销售单详情三页已补齐。

## 后端对接要点

- **登录**：`POST /api/store/auth/login`，mock 凭据 `admin/admin123`，返回 `data.token` 与 `data.csrfToken`。
- **CSRF 防护**：GET 无需 token；POST/PUT/DELETE 必须带 `x-csrf-token` 头，否则返回 403「CSRF token 无效或缺失」。
- **租户隔离**：请求自动携带租户头，多租户数据隔离。

## 注意事项（发布前配置）

1. **TabBar 图标**：当前使用 SVG 占位图标，发布前需替换为 81x81 PNG。
2. **微信 AppID**：`manifest.json` 中的 `wx_appid_placeholder` 需替换为真实微信 AppID。
3. **API 域名**：生产环境使用 `https://api.onepan.cn/api`，开发环境通过 HBuilderX 配置代理。
4. **推送 / 支付**：`manifest.json` 中已声明模块，需在 HBuilderX 中配置原生 SDK。
5. **真实数据库复验**：本地验收基于 mock 后端，接真实 MySQL 后需复跑关键链路。
