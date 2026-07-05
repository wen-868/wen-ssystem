# 阿坚 — 智享全链管理系统 v7.0 任务清单 (P17→P22)

> 总工作量：9天 | P0: 5.5天 | P1: 2天 | P2: 1.5天  
> **状态：✅ 全部完成（2026-07-02 已合并到main）**  
> 开始前请先阅读：`docs/task-plan-v7.md`（总体规划）、`docs/task-breakdown-v7.md`（完整字段定义）

| 任务 | 状态 |
|------|:---:|
| P17-C 路由服务层重构 | ✅ |
| P18-A saas-admin平台总后台 | ✅ |
| P19-A 订单管理P1后端 | ✅ |
| P20-A 订单管理P1前端 | ✅ |
| P21-A 数据报表P2 | ✅ |
| P22 集成测试 | ✅ |

---

## Phase 17-C: 8个路由服务层重构 [P0] — 1.5天

### 17-C-1: 新建 `services/admin/sys-user.service.ts`

从 `routes/sys-user.routes.ts` (~240行SQL) 提取。

| 方法 | 功能 | 涉及SQL |
|------|------|---------|
| `listUsers(params)` | 分页查询用户列表 | `SELECT` with JOIN sys_user_role, 筛选 role_id/keyword |
| `createUser(data)` | 创建用户 + 分配角色 | 事务: `INSERT INTO sys_user` + `INSERT INTO sys_user_role` |
| `updateUser(id, data)` | 更新用户 + 更新角色 | 事务: `UPDATE sys_user` + `DELETE`/`INSERT sys_user_role` |
| `deleteUser(id)` | 软删除用户 | `UPDATE sys_user SET status=0` |
| `resetPassword(id, newPwd)` | 重置密码 | `UPDATE sys_user SET password_hash=?` |

**路由精简后**：`sys-user.routes.ts` 仅保留参数校验 + 调用service + 响应包装。

### 17-C-2: 新建 `services/admin/operation-log.service.ts`

从 `routes/operation-log.routes.ts` (~75行SQL) 提取。

| 方法 | 功能 | 涉及SQL |
|------|------|---------|
| `listLogs(params)` | 分页 + 筛选查询 | `SELECT` with WHERE module/action/user_id/date_range |
| `getLogStats()` | 按模块+操作类型统计 | `SELECT COUNT(*) GROUP BY module, action` |

### 17-C-3: 新建 `services/admin/system.service.ts`

从 `routes/system.routes.ts` (~36行SQL) 提取。

| 方法 | 功能 | 涉及SQL |
|------|------|---------|
| `getSystemInfo()` | 返回3个COUNT | `SELECT COUNT(*) FROM sys_user`, `FROM store`, `FROM tenant` |

### 17-C-4: 重构 `share.routes.ts` → 接入 `share.service.ts`

**现状**：`share.routes.ts` 有内联SQL（224行），`share.service.ts` 已存在但未使用。

**操作**：
- 将 `GET /collections/:token` 的内联SQL移到 `share.service.ts` 的 `getCollectionLink()`（已更新）
- 将 `GET /collections/:token/page` 的SQL逻辑移到 `share.service.ts` 新方法 `getCollectionPage(token)`
- 将 `POST /collections/:token/pay` 的SQL逻辑移到 `share.service.ts` 的 `payCollection()`（已存在）
- 将 `POST /collections/:token/wx-notify` 的回调处理逻辑移到 `share.service.ts` 新方法 `handleWxNotify(token, body, headers)`
- 路由文件仅保留：参数提取、HTTP状态码处理、响应包装

### 17-C-5: 重构 `platform.routes.ts` → 接入已有service

**现状**：`platform.routes.ts` (~42行SQL) 有内联SELECT，而 `services/platform/platform-overview.service.ts` 已存在。

**操作**：
- 将平台总览的SQL查询移到 `platform-overview.service.ts` 的 `getOverview()`
- 将租户列表查询移到 `tenant-admin.service.ts` 的 `listTenants()`
- 路由文件仅保留调用

### 17-C-6: 重构 `order-timeout.routes.ts` → 扫描器迁移

**现状**：路由处理器使用controller（正常），但 `processTimeoutConfig()` 和 `startOrderTimeoutScanner()` 扫描器含内联SQL。

**操作**：
- 将 `processTimeoutConfig()` 函数移入 `services/admin/order-timeout.service.ts` 新方法 `processConfig(config)`
- 将 `startOrderTimeoutScanner()` 函数移入 `services/admin/order-timeout.service.ts` 新方法 `startScanner()`
- 路由文件 import 后调用

### 17-C-7: 重构 `store-control.routes.ts` → 调度器迁移

**现状**：路由处理器使用controller（正常），但 `runStoreControlCheck()` 调度器含内联SQL。

**操作**：
- 将 `runStoreControlCheck()` 函数移入 `services/admin/store-control.service.ts` 新方法 `runCheck()`
- 路由文件 import 后调用

### 17-C-8: 重构 `notification.routes.ts` → 工具函数迁移

**现状**：路由处理器使用controller（正常），但 `sendNotification()` 工具函数含一个INSERT。

**操作**：
- 将 `sendNotification()` 函数移入 `services/admin/notification.service.ts` 新方法 `send(data)`
- 路由文件删除函数定义，改为 import 调用

### 17-C-9: 清理 `store.routes.ts`

**操作**：删除第5行未使用的导入 `query, queryOne`（死代码）

---

## Phase 18-A: 平台总后台项目初始化 + 租户管理 [P0] — 2天

### 18-A-1: 项目脚手架 (0.5天)

**创建目录**：`saas-admin/`

**文件清单**：

| 文件 | 内容 |
|------|------|
| `saas-admin/package.json` | `vue@3`, `vue-router@4`, `pinia`, `element-plus`, `axios`, `typescript`, `vite` |
| `saas-admin/vite.config.ts` | Vite配置 + 代理 `/api` → `http://localhost:3000` |
| `saas-admin/tsconfig.json` | TypeScript严格模式 |
| `saas-admin/index.html` | 入口HTML |
| `saas-admin/src/main.ts` | `createApp` + `useRouter` + `usePinia` + `useElementPlus` |
| `saas-admin/src/App.vue` | `<router-view />` 壳 |
| `saas-admin/src/api.ts` | `axios.create({ baseURL: '/api/admin' })` + 请求拦截器（JWT） |
| `saas-admin/src/stores/auth.ts` | Pinia: `token`, `user`, `login()`, `logout()` |
| `saas-admin/src/router/index.ts` | 路由表：`/login`, `/`, `/tenants`, `/tenants/:id`, `/subscriptions`, `/plans`, `/dashboard`, `/monitor` |

### 18-A-2: 布局框架 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/layouts/MainLayout.vue` | 侧边栏（`el-menu`：仪表盘/租户管理/订阅管理/套餐管理/监控告警）+ 顶栏（用户信息/退出）+ 主内容区 `<router-view>` |

### 18-A-3: 登录/退出 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/LoginView.vue` | 平台管理员登录表单：username + password → `POST /api/admin/login` → 存token → 跳转 `/` |
| `saas-admin/src/views/LoginView.vue` | 登录失败提示：`el-message` 红色错误信息 |

**后端新增**：`saas-admin` 需独立认证路由（或复用 `admin.routes.ts` 的 `/login` 端点）

### 18-A-4: 租户管理 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/TenantList.vue` | `el-table`：租户ID/名称/联系人/手机/状态/创建时间 + `el-pagination` |
| `saas-admin/src/views/TenantList.vue` | 操作栏：搜索（名称/手机）、新建、启用/停用切换 |
| `saas-admin/src/views/TenantCreate.vue` | `el-dialog`：名称/联系人/手机/邮箱/初始密码 → 创建租户 |
| `saas-admin/src/views/TenantDetail.vue` | 租户详情页：基本信息 + 模块权限（`tenant_module_access` 表）+ 管理员列表（`tenant_admin` 表） |

**后端新增API**：
- `GET /api/admin/tenants` — 分页列表
- `POST /api/admin/tenants` — 创建
- `PUT /api/admin/tenants/:id` — 更新
- `PUT /api/admin/tenants/:id/status` — 启停
- `GET /api/admin/tenants/:id/modules` — 模块权限
- `PUT /api/admin/tenants/:id/modules` — 更新模块权限
- `GET /api/admin/tenants/:id/admins` — 管理员列表
- `POST /api/admin/tenants/:id/admins` — 添加管理员

---

## Phase 19-A: 订单管理P1后端 [P1] — 1天

### 19-A-1: 小程序订单同步日志

**新建文件**：

| 文件 | 路径 |
|------|------|
| `miniapp-order-sync.service.ts` | `backend/src/services/admin/miniapp-order-sync.service.ts` |
| `miniapp-order-sync.routes.ts` | `backend/src/routes/miniapp-order-sync.routes.ts` |

**Service方法**：
- `listSyncLogs(params: { page, pageSize, orderNo?, platform?, status? })` → `SELECT * FROM miniapp_order_sync_log WHERE ... ORDER BY created_at DESC LIMIT ? OFFSET ?`
- `retrySync(orderNo: string)` → `UPDATE miniapp_order_sync_log SET status='PENDING' WHERE order_no=?`

**路由端点**：
- `GET /api/admin/order-sync-logs` → `listSyncLogs()`
- `POST /api/admin/order-sync-logs/:orderNo/retry` → `retrySync()`

**注册**：在 `server.ts` 添加：
```typescript
app.use('/api/admin/order-sync-logs', requireAuthWithTenant, orderSyncLogRouter);
```

### 19-A-2: 平台对账管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `platform-reconciliation.service.ts` | `backend/src/services/admin/platform-reconciliation.service.ts` |
| `platform-reconciliation.routes.ts` | `backend/src/routes/platform-reconciliation.routes.ts` |

**Service方法**：
- `listReconciliations(params)` → `SELECT * FROM platform_reconciliation WHERE ... ORDER BY reconciliation_date DESC`
- `createReconciliation(data)` → `INSERT INTO platform_reconciliation`
- `updateReconciliation(id, data)` → `UPDATE platform_reconciliation SET status=?, adjusted_at=NOW()`
- `getDetail(id)` → `SELECT * FROM platform_reconciliation WHERE id=?`

**路由端点**：
- `GET /api/admin/platform-reconciliations` → `listReconciliations()`
- `POST /api/admin/platform-reconciliations` → `createReconciliation()`
- `PUT /api/admin/platform-reconciliations/:id` → `updateReconciliation()`
- `GET /api/admin/platform-reconciliations/:id` → `getDetail()`

**注册**：
```typescript
app.use('/api/admin/platform-reconciliations', requireAuthWithTenant, platformReconciliationRouter);
```

### 19-A-3: 平台审核管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `platform-review.service.ts` | `backend/src/services/admin/platform-review.service.ts` |
| `platform-review.routes.ts` | `backend/src/routes/platform-review.routes.ts` |

**Service方法**：
- `listReviews(params)` → `SELECT * FROM platform_review WHERE ... ORDER BY created_at DESC`
- `replyReview(id, replyContent)` → `UPDATE platform_review SET reply_content=?, replied_at=NOW()`
- `getStats()` → `SELECT platform, AVG(rating), COUNT(*) FROM platform_review GROUP BY platform`

**路由端点**：
- `GET /api/admin/platform-reviews` → `listReviews()`
- `POST /api/admin/platform-reviews/:id/reply` → `replyReview()`
- `GET /api/admin/platform-reviews/stats` → `getStats()`

**注册**：
```typescript
app.use('/api/admin/platform-reviews', requireAuthWithTenant, platformReviewRouter);
```

---

## Phase 20-A: 订单管理P1前端 [P1] — 1天

### 20-A-1: `OrderSyncLog.vue`

**路径**：`admin-web/src/views/OrderSyncLog.vue`

**组件结构**：
- `el-table` columns: 订单号(order_no) / 平台(platform) / 同步类型(sync_type) / 方向(sync_direction) / 状态(status) / 错误信息(error_msg) / 创建时间(created_at)
- `el-form` 筛选栏: 订单号输入框 + 平台下拉(京东/美团/饿了么) + 状态下拉(SUCCESS/FAILED) + 查询按钮
- 操作列: 重试按钮 → `POST /api/admin/order-sync-logs/:orderNo/retry`

**路由注册**：
```typescript
{ path: 'order-sync-logs', name: 'OrderSyncLogs', component: () => import('@/views/OrderSyncLog.vue') }
```

### 20-A-2: `PlatformReconciliation.vue`

**路径**：`admin-web/src/views/PlatformReconciliation.vue`

**组件结构**：
- `el-table` columns: 对账日期 / 平台 / 平台订单数 / 平台金额 / 系统订单数 / 系统金额 / 差异单数 / 差异金额 / 佣金金额 / 状态(status) / 对账人 / 调整时间
- 差异行高亮（红色背景）
- `el-dialog` 新建对账: 平台下拉 + 日期选择 + 平台数据录入 + 系统数据自动计算
- 操作列: 查看详情 / 确认对账 / 标记差异 / 调整

**路由注册**：
```typescript
{ path: 'platform-reconciliation', name: 'PlatformReconciliation', component: () => import('@/views/PlatformReconciliation.vue') }
```

### 20-A-3: `PlatformReview.vue`

**路径**：`admin-web/src/views/PlatformReview.vue`

**组件结构**：
- `el-table` columns: 平台 / 订单号 / 评分(rating，星级展示) / 评价内容 / 回复内容 / 回复时间 / 同步时间
- `el-dialog` 回复评价: `el-input type="textarea"` + 提交按钮
- 顶部统计卡片: 各平台平均评分 + 总评价数

**路由注册**：
```typescript
{ path: 'platform-reviews', name: 'PlatformReviews', component: () => import('@/views/PlatformReview.vue') }
```

---

## Phase 21-A: 数据报表P2 [P2] — 1.5天

### 21-A-1: 后端 — 报表引擎

**新建文件**：

| 文件 | 路径 |
|------|------|
| `custom-report.service.ts` | `backend/src/services/admin/custom-report.service.ts` |
| `custom-report.routes.ts` | `backend/src/routes/custom-report.routes.ts` |

**custom_report_template CRUD**：
- `listTemplates(params)` → `SELECT * FROM custom_report_template ORDER BY created_at DESC`
- `createTemplate(data)` → `INSERT INTO custom_report_template`
- `updateTemplate(id, data)` → `UPDATE custom_report_template SET ...`
- `deleteTemplate(id)` → `DELETE FROM custom_report_template`
- `executeTemplate(id, params)` → 根据 `config` JSON 动态生成SQL并执行

**custom_report_schedule CRUD**：
- `listSchedules(params)` → `SELECT * FROM custom_report_schedule ORDER BY created_at DESC`
- `createSchedule(data)` → `INSERT INTO custom_report_schedule`
- `updateSchedule(id, data)` → `UPDATE custom_report_schedule SET ...`
- `deleteSchedule(id)` → `DELETE FROM custom_report_schedule`
- `toggleSchedule(id, status)` → `UPDATE custom_report_schedule SET status=?`
- `runSchedule(id)` → 立即执行一次定时任务

**路由端点**：
- `GET /api/admin/reports/templates` → `listTemplates()`
- `POST /api/admin/reports/templates` → `createTemplate()`
- `PUT /api/admin/reports/templates/:id` → `updateTemplate()`
- `DELETE /api/admin/reports/templates/:id` → `deleteTemplate()`
- `POST /api/admin/reports/templates/:id/execute` → `executeTemplate()`
- `GET /api/admin/reports/schedules` → `listSchedules()`
- `POST /api/admin/reports/schedules` → `createSchedule()`
- `PUT /api/admin/reports/schedules/:id` → `updateSchedule()`
- `DELETE /api/admin/reports/schedules/:id` → `deleteSchedule()`
- `PUT /api/admin/reports/schedules/:id/toggle` → `toggleSchedule()`
- `POST /api/admin/reports/schedules/:id/run` → `runSchedule()`

**注册**：
```typescript
app.use('/api/admin/reports', requireAuthWithTenant, customReportRouter);
```

### 21-A-2: 前端 — `CustomReport.vue`

**路径**：`admin-web/src/views/CustomReport.vue`

**组件结构**：
- 两个 `el-tab-pane`：报表模板 / 定时任务
- 报表模板Tab:
  - `el-table`：模板名称 / 类型 / 创建人 / 状态 / 操作
  - `el-dialog` 报表设计器：指标多选（销售额/利润/数量等）+ 维度多选（按日期/门店/商品/客户等）+ 筛选条件 + 预览
- 定时任务Tab:
  - `el-table`：任务名称 / 模板 / cron表达式 / 导出格式 / 上次执行 / 状态
  - `el-dialog`：模板下拉 + 任务名称 + cron输入 + 格式下拉 + 接收人输入

**路由注册**：
```typescript
{ path: 'custom-reports', name: 'CustomReports', component: () => import('@/views/CustomReport.vue') }
```

---

## Phase 22: 集成测试 [P0] — 2天

**全员参与**。

### 测试清单

| 序号 | 测试场景 | 验证点 |
|:---:|------|------|
| 1 | 开单→分享→支付→库存扣减 | sale_bill创建 → collection_link生成 → 微信支付回调 → inventory_balance减少 |
| 2 | 小程序下单→同步→对账 | miniapp_order → sync_log → platform_reconciliation |
| 3 | 租户注册→订阅→模块授权 | tenant创建 → subscription → tenant_module_access |
| 4 | 优惠券→促销→叠加 | coupon_template → user_coupon → promotion_stack_rule |
| 5 | 秒杀→库存扣减→超卖防护 | seckill_product库存原子操作 |
| 6 | 拼团→成团→失败退款 | group_buy_record状态流转 |
| 7 | 积分兑换→库存扣减 | points_mall_order → points_mall_item.stock |
| 8 | 客户拜访→跟进→关联订单 | customer_visit → follow_up |
| 9 | 平台评价→回复→同步 | platform_review → reply |
| 10 | 部门管理→权限继承 | sys_department + sys_user_role |

---

## 🔴 苏然测试报告 v2 修复任务 (2026-07-05 凌舟分派)

> 来源：`docs/test-report-global-2026-07-04-v2.md`（苏然第二轮全局深度测试）

### 修复-1: 47个Controller中168个try-catch绕过error-handler [P0] — 预计 2天

**问题**：47 个 controller 的 168 个 try-catch 块直接 `res.status().json()` 返回错误，导致 `errorHandler`、飞书告警、错误日志持久化全部失效。

**涉及最严重的文件**：
- `aftersale.controller.ts` — 11 处
- `credit.controller.ts` — 11 处
- `stock-check.controller.ts` — 9 处
- `marketing-group-buy.controller.ts` — 7 处
- 其余 43 个 controller 各 1-6 处

**修复方向**：移除 controller 中的 try-catch，让 `asyncHandler` 自动传递错误到 `errorHandler`。在 service 层抛出带 `statusCode` 的业务错误。

### 修复-2: Store `/me` 端点无认证保护 [P0] — 预计 0.5天

**文件**：`backend/src/routes/store.routes.ts`  
**问题**：`/me` 路由在 `requireAuthWithTenant` 中间件之前注册，未认证用户访问时 `req.user!` 非空断言导致崩溃。  
**修复**：将 `/me` 移到 `requireAuthWithTenant` 之后。

### 修复-3: saas-admin MonitorView 路由未注册 [P1] — 预计 0.5天

**文件**：`saas-admin/src/router/index.ts`  
**问题**：路由文件中完全没有 MonitorView 配置。同时 MonitorView.vue 前端字段与后端 API 返回不一致（`connections`/`qps` vs `connection`/`errorCount`）。

### 修复-4: 缺少统一日志框架 [P1] — 预计 1天

**问题**：36 处 `console.log/error/warn` 分布在 21 个文件中，无结构化日志、无日志级别、无轮转。

**修复方向**：引入 winston 或 pino，替换所有 `console.*` 调用。

### 修复-5: 338处 `as any` 类型断言 [P2] — 预计 1天

**最严重的文件**：`stock-check.service.ts`(26)、`transfer-execution.service.ts`(20)、`store-control.service.ts`(19)

### 修复-6: 胖路由 admin.routes.ts 83个端点 [P2] — 预计 1天

**问题**：单文件包含 83 个端点，难以维护。  
**修复**：按业务模块拆分为独立路由文件。

---

## 🔴 凌舟后台验收 — 后端问题 (2026-07-05 凌舟分派)

> 凌舟实际验收后台时发现的数据完整性问题，后端侧修复。

### 修复-1: 客户 create API 不支持 address/remark/settlement_type [P0] — 预计 0.5天

**文件**：`backend/src/services/admin/customer.service.ts`（`createCustomer` L35-46）

**问题**：创建客户时只接受 name/mobile/customerType/staffId，不支持 address、remark、settlement_type。update API 已支持这些字段，但 create API 未同步。

**修复**：createCustomer 补充 address/remark/settlementType 参数，与 updateCustomer 字段对齐。

### 修复-2: product_spu 缺少 brand_id 外键 [P0] — 预计 0.5天

**问题**：`product_spu.brand` 是 VARCHAR(128) 存储品牌名，但存在独立的 `brand` 表（id/name/logo）。前端传 brandId 数字 ID，后端当字符串存储 → 品牌关联混乱。

**修复**：
1. 添加 `product_spu.brand_id` 字段（ALTER TABLE + 外键）
2. 迁移现有 brand 字符串到 brand_id
3. 后端 createProduct/updateProduct 改为接受 brandId

### 修复-3: 前后端 API 路径不匹配 [P1] — 预计 0.5天

**问题**：
- 费用管理：前端调 `/api/admin/finance/expenses`，后端注册 `/api/admin/expenses`
- 审批规则：前端调 `/api/admin/system/approval/...`，后端注册 `/api/admin/approval/...`
- 前端多加了 `/finance/` 和 `/system/` 段，存在路由断连风险

**修复**：确认哪个路径是正确的，统一前后端。建议以后端路径为准，前端去 `/finance/` 和 `/system/` 段。

### 修复-4: 审批规则缺少 EXPENSE 业务类型 [P1] — 预计 0.5天

**文件**：`backend/src/routes/approval.routes.ts` + 审批 service

**问题**：审批规则支持 PURCHASE/SALE/REFUND/PRICE_CHANGE/CREDIT_LIMIT，缺少 EXPENSE。费用审批目前走独立流程（ExpensesView 内置 approve/void），未集成到系统审批体系。

**确认**：费用审批是否要纳入系统审批流程？如需则补充 EXPENSE 类型。