# 墨 — 智享全链管理系统 v7.0 任务清单 (P17→P22)

> 总工作量：8天 | P0: 4天 | P1: 2天 | P2: 1天  
> **状态：✅ 全部完成（2026-07-02 已合并到main）**  
> 开始前请先阅读：`docs/task-plan-v7.md`（总体规划）、`docs/task-breakdown-v7.md`（完整字段定义）

| 任务 | 状态 |
|------|:---:|
| P17-D 产品规格同步 | ✅ |
| P18-B 订阅管理+平台面板 | ✅（main中已存在） |
| P19-B 即时零售P1后端 | ✅ |
| P20-B 即时零售P1前端 | ✅ |
| P21-B 报表权限P2 | ✅ |
| P22 测试+文档 | ✅（main中已存在） |

> 额外完成：支付配置(PaymentConfigView) + 小程序配置(MiniappConfigView) + 支付核销弹窗(PaymentCheckModal)

---

## Phase 17-D: 产品规格文档同步 [P0] — 0.5天

**文件**：`docs/product-spec-v6-adapted.md`

### 操作清单（精确到行）

| 序号 | 操作 | 位置 | 具体内容 |
|:---:|------|------|------|
| 1 | 更新完成度 | 第十八部分（约第4095行） | `admin-web 完成度：55%` → `admin-web 完成度：100%` |
| 2 | 删除过时清单 | 第十八部分 | 删除"占位视图清单"（21个占位 + 3个新增）的整个列表 |
| 3 | 更新表计数 | 文档开头状态表 | `init_database.sql 表数：62` → `init_database.sql + 迁移后表数：95` |
| 4 | 补充 sale_bill 字段 | 第1177-1206行 | 确认 `store_name/store_address/store_contact` 三个字段已存在 |
| 5 | 补充 sale_bill_item 字段 | 第1208-1223行 | 确认 `unit/barcode/spec` 三个字段已存在 |
| 6 | 补充 collection_link 字段 | 第1285-1310行 | 确认 `display_config/document_title` 两个字段已存在 |
| 7 | 新增14表到对应Section | 各Section | 将Task 17-A的14张表字段定义插入对应Section（见下方） |

### 需要插入的14张表及其目标Section

| 表名 | 插入到Section | 字段定义文件 |
|------|------|------|
| `miniapp_order_sync_log` | Section 6: 订单管理 | `task-breakdown-v7.md` 17-A-1 |
| `platform_reconciliation` | Section 6: 订单管理 | `task-breakdown-v7.md` 17-A-2 |
| `platform_review` | Section 6: 订单管理 | `task-breakdown-v7.md` 17-A-3 |
| `retail_announcement` | Section 7: 即时零售 | `task-breakdown-v7.md` 17-A-4 |
| `retail_cart` | Section 7: 即时零售 | `task-breakdown-v7.md` 17-A-5 |
| `retail_consumer_address` | Section 7: 即时零售 | `task-breakdown-v7.md` 17-A-6 |
| `points_mall_item` | Section 9: 营销中心 | `task-breakdown-v7.md` 17-A-7 |
| `points_mall_order` | Section 9: 营销中心 | `task-breakdown-v7.md` 17-A-8 |
| `marketing_asset` | Section 9: 营销中心 | `task-breakdown-v7.md` 17-A-9 |
| `sys_department` | Section 12: 系统设置 | `task-breakdown-v7.md` 17-A-10 |
| `user_session` | Section 12: 系统设置 | `task-breakdown-v7.md` 17-A-11 |
| `custom_report_template` | Section 11: 数据报表 | `task-breakdown-v7.md` 17-A-12 |
| `custom_report_schedule` | Section 11: 数据报表 | `task-breakdown-v7.md` 17-A-13 |
| `report_permission_matrix` | Section 12: 系统设置 | `task-breakdown-v7.md` 17-A-14 |

---

## Phase 18-B: 订阅管理 + 平台数据面板 [P0] — 1.5天

### 18-B-1: 订阅套餐管理 (0.5天)

| 文件 | 路径 | 内容 |
|------|------|------|
| `PlanList.vue` | `saas-admin/src/views/PlanList.vue` | `el-table`：套餐编码/名称/类型/价格/最大用户/最大门店/状态 + 新建/编辑/启停 |
| `PlanForm.vue` | `saas-admin/src/views/PlanForm.vue` | `el-dialog`：所有 `subscription_plan` 字段的表单 |

**subscription_plan 表字段**（参考 `phase9_tenant_subscription.sql`）：
- `plan_code` VARCHAR(32) UNIQUE — 套餐编码（BASIC/STANDARD/PROFESSIONAL）
- `plan_name` VARCHAR(64) — 套餐名称
- `plan_type` VARCHAR(32) — 类型（MONTHLY/YEARLY/PERMANENT）
- `price` DECIMAL(10,2) — 价格
- `original_price` DECIMAL(10,2) — 原价
- `duration_days` INT — 有效天数
- `max_users` INT DEFAULT 5 — 最大用户数
- `max_stores` INT DEFAULT 1 — 最大门店数
- `max_customers` INT DEFAULT 1000 — 最大客户数
- `max_products` INT DEFAULT 500 — 最大商品数
- `max_storage_mb` INT DEFAULT 1024 — 最大存储空间(MB)
- `features` JSON — 功能特性列表
- `module_access` JSON — 可访问模块
- `description` VARCHAR(500) — 套餐描述
- `sort_order` INT DEFAULT 0 — 排序
- `status` VARCHAR(16) DEFAULT 'ACTIVE' — 状态

**后端新增API**：
- `GET /api/admin/plans` — 分页列表
- `POST /api/admin/plans` — 创建
- `PUT /api/admin/plans/:id` — 更新
- `PUT /api/admin/plans/:id/status` — 启停

### 18-B-2: 订阅记录管理 (0.5天)

| 文件 | 路径 | 内容 |
|------|------|------|
| `SubscriptionList.vue` | `saas-admin/src/views/SubscriptionList.vue` | `el-table`：订阅编号/租户/套餐/起止日期/支付状态/金额/自动续费/操作 |
| `SubscriptionList.vue` | 操作列 | 新建订阅/续费/取消/查看操作日志（`subscription_operation_log`） |

**subscription 表字段**（参考 `phase9_tenant_subscription.sql`）：
- `subscription_no` VARCHAR(32) UNIQUE — 订阅编号
- `tenant_id` INT — 租户ID
- `plan_id` INT — 套餐ID
- `plan_name` VARCHAR(64) — 套餐名称（冗余）
- `plan_type` VARCHAR(32) — 套餐类型
- `start_date` DATE — 开始日期
- `end_date` DATE — 结束日期
- `duration_days` INT — 有效天数
- `price` DECIMAL(10,2) — 订阅价格
- `payment_status` VARCHAR(16) DEFAULT 'UNPAID' — 支付状态
- `payment_method` VARCHAR(32) — 支付方式
- `paid_at` DATETIME — 支付时间
- `transaction_no` VARCHAR(128) — 交易流水号
- `auto_renew` TINYINT(1) DEFAULT 0 — 是否自动续费
- `renew_price` DECIMAL(10,2) — 续费价格
- `status` VARCHAR(16) DEFAULT 'ACTIVE' — 状态
- `cancel_reason` VARCHAR(255) — 取消原因
- `expire_notify_sent` TINYINT(1) DEFAULT 0 — 是否已发送到期通知

**subscription_operation_log 表字段**：
- `subscription_id` INT — 订阅ID
- `operation_type` VARCHAR(32) — 操作类型（CREATE/RENEW/UPGRADE/DOWNGRADE/CANCEL/SUSPEND/RESUME）
- `old_plan_id` INT — 原套餐ID
- `new_plan_id` INT — 新套餐ID
- `old_end_date` DATE — 原结束日期
- `new_end_date` DATE — 新结束日期
- `amount` DECIMAL(10,2) — 涉及金额
- `operator_id` INT — 操作人ID
- `operator_name` VARCHAR(64) — 操作人姓名
- `remark` VARCHAR(500) — 备注

**后端新增API**：
- `GET /api/admin/subscriptions` — 分页列表
- `POST /api/admin/subscriptions` — 新建订阅
- `POST /api/admin/subscriptions/:id/renew` — 续费
- `PUT /api/admin/subscriptions/:id/cancel` — 取消
- `GET /api/admin/subscriptions/:id/logs` — 操作日志

### 18-B-3: 平台数据面板 (0.5天)

| 文件 | 路径 | 内容 |
|------|------|------|
| `DashboardView.vue` | `saas-admin/src/views/DashboardView.vue` | 4个统计卡片：总租户数/活跃租户/本月新增/到期预警 |
| `DashboardView.vue` | 收入趋势图 | `el-chart` 折线图：月度订阅收入 |
| `DashboardView.vue` | 模块使用率 | 饼图显示各模块启用比例 |
| `DashboardView.vue` | 最近操作日志 | `operation_log` 表最近20条 |

**后端新增API**：
- `GET /api/admin/dashboard/overview` — 返回所有统计指标

---

## Phase 19-B: 即时零售P1后端 [P1] — 1天

### 19-B-1: 小程序公告管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `retail-announcement.service.ts` | `backend/src/services/instant-retail/retail-announcement.service.ts` |
| `retail-announcement.routes.ts` | `backend/src/routes/retail-announcement.routes.ts` |

**Service方法**（操作 `retail_announcement` 表）：
- `listAnnouncements(params)` → `SELECT * FROM retail_announcement WHERE store_id=? ORDER BY is_top DESC, created_at DESC`
- `createAnnouncement(data)` → `INSERT INTO retail_announcement`
- `updateAnnouncement(id, data)` → `UPDATE retail_announcement SET ...`
- `deleteAnnouncement(id)` → `DELETE FROM retail_announcement WHERE id=?`
- `getActiveAnnouncements(storeId)` → `SELECT * FROM retail_announcement WHERE store_id=? AND status=1 AND (start_time IS NULL OR start_time<=NOW()) AND (end_time IS NULL OR end_time>=NOW())`

**路由端点**：
- `GET /api/admin/retail-announcements` → `listAnnouncements()`
- `POST /api/admin/retail-announcements` → `createAnnouncement()`
- `PUT /api/admin/retail-announcements/:id` → `updateAnnouncement()`
- `DELETE /api/admin/retail-announcements/:id` → `deleteAnnouncement()`
- `GET /api/miniapp/retail-announcements` → `getActiveAnnouncements()`（无需认证，小程序端调用）

**注册**：在 `server.ts` 添加：
```typescript
app.use('/api/admin/retail-announcements', requireAuthWithTenant, retailAnnouncementRouter);
app.use('/api/miniapp/retail-announcements', retailAnnouncementRouter);
```

### 19-B-2: 购物车管理

**扩展文件**：`backend/src/services/miniapp/cart.service.ts`（已存在，需扩展）

**新增方法**（操作 `retail_cart` 表）：
- `addToCart(userId, storeId, skuId, boxQty, bottleQty)` → `INSERT INTO retail_cart ... ON DUPLICATE KEY UPDATE ...`
- `removeFromCart(userId, skuId)` → `DELETE FROM retail_cart WHERE user_id=? AND sku_id=?`
- `updateCartItem(userId, skuId, checked)` → `UPDATE retail_cart SET checked=? WHERE user_id=? AND sku_id=?`
- `getCart(userId, storeId)` → `SELECT * FROM retail_cart WHERE user_id=? AND store_id=?`

**路由端点**（在已有 `cart.routes.ts` 中扩展）：
- `POST /api/miniapp/cart/add` → `addToCart()`
- `DELETE /api/miniapp/cart/:skuId` → `removeFromCart()`
- `PUT /api/miniapp/cart/:skuId` → `updateCartItem()`
- `GET /api/miniapp/cart` → `getCart()`

### 19-B-3: 消费者地址管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `retail-consumer-address.service.ts` | `backend/src/services/miniapp/retail-consumer-address.service.ts` |
| `retail-consumer-address.routes.ts` | `backend/src/routes/retail-consumer-address.routes.ts` |

**Service方法**（操作 `retail_consumer_address` 表）：
- `listAddresses(userId)` → `SELECT * FROM retail_consumer_address WHERE user_id=? ORDER BY is_default DESC`
- `createAddress(userId, data)` → `INSERT INTO retail_consumer_address`
- `updateAddress(id, userId, data)` → `UPDATE retail_consumer_address SET ... WHERE id=? AND user_id=?`
- `deleteAddress(id, userId)` → `DELETE FROM retail_consumer_address WHERE id=? AND user_id=?`
- `setDefault(id, userId)` → `UPDATE retail_consumer_address SET is_default=0 WHERE user_id=?; UPDATE retail_consumer_address SET is_default=1 WHERE id=?`

**路由端点**：
- `GET /api/miniapp/addresses` → `listAddresses()`
- `POST /api/miniapp/addresses` → `createAddress()`
- `PUT /api/miniapp/addresses/:id` → `updateAddress()`
- `DELETE /api/miniapp/addresses/:id` → `deleteAddress()`
- `PUT /api/miniapp/addresses/:id/default` → `setDefault()`

**注册**：
```typescript
app.use('/api/miniapp/addresses', requireMiniappAuth, retailConsumerAddressRouter);
```

---

## Phase 20-B: 即时零售P1前端 [P1] — 1天

### 20-B-1: `RetailAnnouncement.vue`

**路径**：`admin-web/src/views/RetailAnnouncement.vue`

**组件结构**：
- `el-table` columns: 标题 / 门店 / 是否置顶 / 展示时间(start_time~end_time) / 状态 / 创建时间
- `el-dialog` 新建/编辑: 门店下拉 + 标题输入 + 内容富文本 + 置顶开关 + 时间范围选择器
- 操作列: 编辑 / 删除 / 启停切换

**路由注册**：
```typescript
{ path: 'retail-announcements', name: 'RetailAnnouncements', component: () => import('@/views/RetailAnnouncement.vue') }
```

### 20-B-2: 扩展 `InstantRetailShelf.vue`

**路径**：`admin-web/src/views/InstantRetailShelf.vue`（已存在，1015行）

**扩展内容**：在商品货架页面添加"购物车数据"子Tab：
- `el-tab-pane` 新增"购物车分析"页签
- 统计卡片: 当前购物车商品数 / 加购用户数 / 热门加购商品Top10
- `el-table`: 用户ID / SKU名称 / 数量 / 加入时间

### 20-B-3: `ConsumerAddress.vue`

**路径**：`admin-web/src/views/ConsumerAddress.vue`（管理后台查看消费者地址）

**组件结构**：
- `el-table` columns: 用户ID / 收货人 / 手机 / 省市区 / 详细地址 / 是否默认
- 筛选栏: 用户ID搜索

**路由注册**：
```typescript
{ path: 'consumer-addresses', name: 'ConsumerAddresses', component: () => import('@/views/ConsumerAddress.vue') }
```

---

## Phase 21-B: 系统设置P2 [P2] — 1天

### 21-B-1: 后端 — 报表权限

**新建文件**：

| 文件 | 路径 |
|------|------|
| `report-permission.service.ts` | `backend/src/services/admin/report-permission.service.ts` |
| `report-permission.routes.ts` | `backend/src/routes/report-permission.routes.ts` |

**Service方法**（操作 `report_permission_matrix` 表）：
- `getMatrix()` → `SELECT * FROM report_permission_matrix ORDER BY role_id, report_code`
- `saveMatrix(data: Array<{role_id, report_code, store_scope}>)` → 事务: DELETE all → INSERT batch

**路由端点**：
- `GET /api/admin/report-permissions/matrix` → `getMatrix()`
- `PUT /api/admin/report-permissions/matrix` → `saveMatrix()`

**注册**：
```typescript
app.use('/api/admin/report-permissions', requireAuthWithTenant, reportPermissionRouter);
```

### 21-B-2: 前端 — `ReportPermission.vue`

**路径**：`admin-web/src/views/ReportPermission.vue`

**组件结构**：
- 矩阵式表格：行=角色名称，列=报表编码，单元格=下拉选择(SELF/CHILDREN/ALL)
- 未配置的单元格显示 --（灰色）
- 底部保存按钮

**路由注册**：
```typescript
{ path: 'report-permissions', name: 'ReportPermissions', component: () => import('@/views/ReportPermission.vue') }
```

---

## Phase 22: 集成测试 + 文档同步 [P0] — 2天

**全员参与**。

### 测试清单（重点负责即时零售 + 系统设置相关）

| 序号 | 测试场景 | 验证点 |
|:---:|------|------|
| 1 | 开单→分享→支付→库存扣减 | sale_bill创建 → collection_link生成 → 微信支付回调 → inventory_balance减少 |
| 2 | 小程序下单→同步→对账 | miniapp_order → sync_log → platform_reconciliation |
| 3 | 租户注册→订阅→模块授权 | tenant创建 → subscription → tenant_module_access |
| 4 | 小程序公告→C端展示 | retail_announcement创建 → 小程序端拉取 |
| 5 | 购物车→加购→下单 | retail_cart ADD → 下单清空 |
| 6 | 消费者地址→CRUD→默认 | retail_consumer_address → setDefault |
| 7 | 报表权限矩阵→角色×报表 | report_permission_matrix 批量保存 → 按角色查询 |
| 8 | 套餐管理→订阅→续费 | subscription_plan → subscription → renew |
| 9 | 平台数据面板→指标正确 | DashboardView 各统计卡片与数据库一致 |
| 10 | 部门管理→权限继承 | sys_department + sys_user_role |

### 文档同步

| 序号 | 文件 | 更新内容 |
|:---:|------|------|
| 1 | `product-spec-v6-adapted.md` | 最终同步：所有Section字段完整，完成度100% |
| 2 | `README.md` | 更新项目版本号 v6.2 → v7.0 |
| 3 | Git tag | `git tag v7.0` |

---

## 🔴 苏然测试报告 v2 修复任务 (2026-07-05 凌舟分派)

> 来源：`docs/test-report-global-2026-07-04-v2.md`（苏然第二轮全局深度测试）

### 修复-1: admin-web 构建失败 — wangeditor 不兼容 Vue 3.4+ [P0] — 预计 1天

**文件**：`admin-web/package.json`  
**问题**：`@wangeditor/editor-for-vue@^1.0.2` 不兼容 Vue 3.4+ 的 ESM 导出，导致 `vite build` 失败。  
**修复**：升级到 `@wangeditor/editor-for-vue@next` 或替换为 Tiptap/Quill。

### 修复-2: admin-web api.ts 零错误处理 [P0] — 预计 1天

**文件**：`admin-web/src/api.ts`（2113 行）  
**问题**：0 处 try-catch，拦截器只处理了 401，403/404/500 全部静默失败。  
**参考**：store-terminal 的 api.ts 有 41 个 catch 块。

### 修复-3: 28 个表单无输入校验 [P1] — 预计 1.5天

**涉及文件**：AftersaleView, CommissionRules, PurchaseOrders, ApprovalRules, SystemConfigView, InventoryBatch, SalesOrderCreate, MyApprovals, TagGroups, PlatformPanel, OrderRoutingView, CollectionLinks, OrderTimeoutView, SaleReturnsView, InventoryBatchPrice, CommissionRecords, OrderProductMapView, MarketingMaterial, CustomerProfile, MarketingView, CreditView, PurchaseInStocks, InventoryAlertConfig, PurchasePlans, ProductImport, SupplierStatements, MarketingPointsMall, CustomerPrices

### 修复-4: InstantRetailPlatform.vue 硬编码假密钥 [P1] — 预计 0.5天

**文件**：`admin-web/src/views/InstantRetailPlatform.vue`  
**位置**：第 34/48/65/79/108 行，5 处假密钥如 `"jd_app_secret_xxxxxx"`。  
**修复**：改为空字符串，由后端 API 返回真实配置。

### 修复-5: 5 处 echarts 图表使用 innerHTML 清理 [P2] — 预计 0.5天

**文件**：ReportsProducts.vue, ReportsEmployees.vue, ReportsStores.vue, FinanceProfit.vue  
**修复**：改用 `while (el.firstChild) el.removeChild(el.firstChild)`。