# 小程序平台 & 支付配置 — 任务分配

> 总方案：docs/design/miniapp-platform-plan.md
> 日期：2026-07-01

---

## 整体节奏

```
Phase A (支付配置) ──→ Phase B (小程序配置) ──→ Phase C (模板系统) ──→ Phase D (发布+同步) ──→ Phase E (联调收尾)
```

Phase A 和 Phase B 可以并行开发。Phase C 依赖 Phase B 的页面框架，Phase D 依赖 Phase C 的模板系统。

---

## 阿坚 — DB 建表 + 数据迁移

执行 SQL 迁移脚本：`docs/sql/migrate_v3_payment_miniapp.sql`

**验收标准：**
- 5张新表（payment_config / bank_account / miniapp_config / miniapp_template / miniapp_publish_log / price_change_log）全部创建成功
- 初始数据（微信支付配置项、支付宝配置项、3套模板）插入成功
- 无 SQL 语法错误

---

## 后端任务分配

### 中国白（后端）— Phase A：支付配置

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `backend/src/services/admin/payment-config.service.ts` | 新建。实现 PaymentConfigService：getChannelConfig / saveChannelConfig / isProviderReady / testConnection，以及银行账号 CRUD。敏感字段（api_v3_key/private_key/app_secret）使用 AES-256-GCM 加密存储 |
| 2 | `backend/src/routes/payment-config.routes.ts` | 新建。路由注册，所有接口需要 `requireAuthWithTenant` |
| 3 | `backend/src/shared/wechat-pay.ts` | 改造。构造函数从 `env` 读取改为接收 `config` 对象。新增 `static async fromTenant(tenantId)` 静态工厂方法 |
| 4 | `backend/src/controllers/admin/order.controller.ts` | 修改。支付触发点增加 `isProviderReady()` 检测，未配置返回 `PAYMENT_NOT_CONFIGURED`（code: 400） |
| 5 | `backend/src/controllers/admin/sales.controller.ts` | 修改。同上 |
| 6 | `backend/src/server.ts` | 修改。注册 `payment-config.routes.ts` |

**接口清单：**
```
GET    /api/admin/payment/configs/:provider     → 获取渠道配置
PUT    /api/admin/payment/configs/:provider     → 保存渠道配置
POST   /api/admin/payment/configs/:provider/test → 测试连接
GET    /api/admin/payment/status               → 各渠道配置状态
GET    /api/admin/payment/bank-accounts        → 银行账号列表
POST   /api/admin/payment/bank-accounts        → 添加银行账号
PUT    /api/admin/payment/bank-accounts/:id    → 编辑银行账号
DELETE /api/admin/payment/bank-accounts/:id    → 删除银行账号
POST   /api/admin/payment/bank-accounts/:id/default → 设为默认
```

**验收标准：**
- 所有接口返回正确数据结构
- 敏感字段存储为加密值，读取时脱敏显示（返回 `***`）
- WechatPay 通过 `fromTenant()` 可从租户配置创建实例
- 未配置支付时，支付接口返回 `{ code: 'PAYMENT_NOT_CONFIGURED', message: '请先配置微信支付', provider: 'wechat_pay' }`

---

### 中国白（后端）— Phase B：小程序配置

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `backend/src/services/admin/miniapp-config.service.ts` | 新建。实现 MiniappConfigService：listConfigs / getConfig / saveConfig / getStatus |
| 2 | `backend/src/routes/miniapp-config.routes.ts` | 新建。路由注册 |
| 3 | `backend/src/server.ts` | 修改。注册 `miniapp-config.routes.ts` |

**接口清单：**
```
GET  /api/admin/miniapp/configs              → 所有平台配置列表
GET  /api/admin/miniapp/configs/:platform    → 获取指定平台配置
PUT  /api/admin/miniapp/configs/:platform    → 保存指定平台配置
GET  /api/admin/miniapp/templates            → 模板列表
GET  /api/admin/miniapp/templates/:id        → 模板详情
```

**验收标准：**
- 配置 CRUD 正常
- app_secret 加密存储，读取脱敏
- 模板列表返回 3 套模板数据

---

### 中国白（后端）— Phase C：模板系统

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `backend/src/services/admin/miniapp-template.service.ts` | 新建。实现 listTemplates / getTemplate |
| 2 | `backend/src/routes/miniapp-config.routes.ts` | 修改。注册模板路由 |

**验收标准：**
- 模板接口返回完整 styleConfig 和 pageConfig JSON

---

### 中国白（后端）— Phase D：一键发布 + 实时同步

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `backend/src/services/admin/miniapp-publish.service.ts` | 新建。实现发布流程：读取配置 → 配置注入 → 编译 → miniprogram-ci 上传 → 记录日志 |
| 2 | `backend/src/services/sync/price-sync.service.ts` | 新建。价格变更事件广播 + price_change_log 写入 |
| 3 | `backend/src/services/sync/product-sync.service.ts` | 新建。商品上下架事件广播 |
| 4 | `backend/src/routes/sync.routes.ts` | 新建。同步轮询接口 |
| 5 | `backend/src/server.ts` | 修改。注册路由 |

**接口清单：**
```
POST /api/admin/miniapp/publish              → 一键发布
GET  /api/admin/miniapp/publish-logs         → 发布历史
GET  /api/miniapp/sync/check?since=timestamp  → 价格变更列表
GET  /api/miniapp/sync/prices?ids=1,2,3       → 最新价格
```

**验收标准：**
- 发布流程可执行（配置注入 + 编译 + 上传）
- 价格变更日志写入 price_change_log 表
- 轮询接口返回正确

---

## 前端任务分配

### 阿文（前端）— Phase A：支付配置页面

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `admin-web/src/views/PaymentConfigView.vue` | 新建。独立页面，3个Tab：微信支付 / 支付宝 / 银行账号。每个渠道卡片含启用开关、凭证输入（敏感字段脱敏+👁切换）、测试连接按钮、保存按钮。银行账号Tab含列表+添加/编辑/删除/设为默认 |
| 2 | `admin-web/src/router/index.ts` | 修改。新增 `/system/payment` 路由 |
| 3 | `admin-web/src/layouts/MainLayout.vue` | 修改。设置菜单下增加"支付配置" |
| 4 | `admin-web/src/api.ts` | 修改。新增支付配置相关 API 调用 |

**重要提醒：**
- 微信支付 AppID 处有明显提示："注意：此处填写的是微信「支付」AppID，来自 pay.weixin.qq.com（商户平台），不是小程序 AppID"
- 敏感字段默认显示 `••••••••`，点击 👁 可切换显示/隐藏
- 银行账号列表支持展开/收起

**验收标准：**
- 3个Tab切换正常
- 凭证保存成功后刷新显示脱敏值
- 测试连接按钮可触发后端接口
- 未配置时支付触发弹窗："请先配置微信支付" → [去配置] 跳转

---

### 阿文（前端）— Phase B：小程序配置页面

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `admin-web/src/views/MiniappConfigView.vue` | 新建。独立页面，顶部平台Tab（微信/支付宝/抖音/快手），下方凭证表单 + 模板选择区 + 一键发布按钮 + 发布历史列表 |
| 2 | `admin-web/src/router/index.ts` | 修改。新增 `/system/miniapp` 路由 |
| 3 | `admin-web/src/layouts/MainLayout.vue` | 修改。设置菜单下增加"小程序配置" |
| 4 | `admin-web/src/api.ts` | 修改。新增小程序配置相关 API 调用 |

**重要提醒：**
- 小程序 AppID 处有明显提示："注意：此处填写的是微信「小程序」AppID，来自 mp.weixin.qq.com（公众平台），不是支付 AppID"
- 模板选择区：3张卡片网格排列，点击选中态高亮

**验收标准：**
- 平台Tab切换正常
- 凭证保存后刷新
- 模板卡片可选中

---

### 阿文（前端）— Phase C：模板选择 + 一键发布

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `admin-web/src/views/MiniappConfigView.vue` | 修改。模板选择区增加卡片大图预览、选中态。一键发布按钮 + 发布中loading + 结果弹窗（成功/失败） |
| 2 | `admin-web/src/views/MiniappConfigView.vue` | 修改。底部增加发布历史列表（时间/版本/操作/结果） |
| 3 | `admin-web/src/api.ts` | 修改。新增发布相关 API |

**验收标准：**
- 一键发布按钮触发后端发布流程
- 发布中显示 loading
- 成功/失败有明确反馈
- 发布历史列表正常展示

---

### 阿文（前端）— Phase D：支付检测弹窗（通用组件）

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `admin-web/src/components/PaymentCheckModal.vue` | 新建。通用弹窗组件，props: provider。收到 `PAYMENT_NOT_CONFIGURED` 错误码时弹出引导 |
| 2 | `admin-web/src/views/orders/*.vue` | 修改。订单操作触发支付时增加检测 |
| 3 | `admin-web/src/views/sales/*.vue` | 修改。销售收款触发支付时增加检测 |

**验收标准：**
- 弹窗显示未配置的支付渠道名称
- [去配置] 按钮跳转到 `/system/payment` 并自动切换到对应Tab

---

## 阿林（小程序端）— Phase D：实时同步客户端

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `app-mobile/src/utils/sync.js` | 新建。SyncManager：WebSocket 连接 + 断开轮询 + onShow 刷新 |
| 2 | `app-mobile/src/pages/products/products.vue` | 修改。集成 SyncManager，价格变更时自动刷新 |
| 3 | `app-mobile/src/pages/home/home.vue` | 修改。集成 SyncManager |

**验收标准：**
- WebSocket 连接成功
- 收到价格变更推送后商品列表价格刷新
- WebSocket 断开后自动切换到轮询（30秒间隔）
- 页面 onShow 时主动拉取最新价格

---

## 阿林（小程序端）— Phase D：配置注入模板

**任务：**

| # | 文件 | 内容 |
|---|------|------|
| 1 | `app-mobile/src/config.template.js` | 新建。占位符配置模板，含 apiBaseUrl / tenantId / theme / pageConfig |
| 2 | `app-mobile/src/App.vue` | 修改。从 config.js 读取主题配置并应用 |
| 3 | `app-mobile/src/pages/home/home.vue` | 修改。根据 pageConfig 控制布局（standard/featured/premium） |

**占位符变量：**
```
__API_BASE_URL__        → 后端 API 地址
__TENANT_ID__           → 租户ID
__APP_NAME__            → 小程序名称
__PRIMARY_COLOR__       → 主题色
__SECONDARY_COLOR__     → 辅助色
__BACKGROUND_COLOR__    → 背景色
__FONT_FAMILY__         → 字体
__BORDER_RADIUS__       → 圆角
__TAB_BAR_STYLE__       → TabBar风格
__DARK_MODE__           → 暗色模式
__HOME_LAYOUT__         → 首页布局
__PRODUCT_CARD_STYLE__  → 商品卡片风格
__ORDER_FLOW_STYLE__    → 下单流程风格
__SHOW_BANNER__         → 是否显示Banner
__SHOW_CATEGORY_NAV__   → 是否显示分类导航
__SHOW_SEARCH_BAR__     → 是否显示搜索
__SHOW_PROMOTION_BANNER__ → 是否显示促销区
__SHOW_BRAND_STORY__    → 是否显示品牌故事
```

**验收标准：**
- 编译时占位符被正确替换
- 不同模板注入不同配置后，小程序样式不同
- 主题色/字体/圆角/布局均生效

---

## 汇总

| 成员 | Phase A | Phase B | Phase C | Phase D |
|------|---------|---------|---------|---------|
| 阿坚 | DB迁移 | — | — | — |
| 中国白（后端） | 支付配置服务+路由+WechatPay改造 | 小程序配置服务+路由 | 模板服务+路由 | 发布引擎+同步服务 |
| 阿文（前端） | 支付配置页面 | 小程序配置页面 | 模板选择+一键发布UI | 支付检测弹窗 |
| 阿林（小程序） | — | — | — | 实时同步客户端+配置注入模板 |

**执行顺序：**
1. 阿坚先执行 DB 迁移（所有人依赖）
2. 中国白和阿文可并行开始 Phase A 和 Phase B
3. 中国白完成 Phase B 后进入 Phase C，阿文完成 Phase B 后进入 Phase C
4. 中国白和阿林可并行开始 Phase D
5. 全部完成后联调 Phase E