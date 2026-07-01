# 阿坚 · 工作总台模块 · 后端 API

**日期**：2026-07-01
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 经营概览聚合 API | P0 | ❌ |
| 2 | 待办提醒 API | P0 | ❌ |
| 3 | 快捷入口配置 API | P0 | ❌ |
| 4 | 消息通知 API | P0 | ❌ |

---

## 审计发现

### 已有基础设施
- **路由**：`admin.routes.ts` 第77-86行有 `/dashboard`、`/daily-sales-trend`、`/store-sales-performance`、`/inventory-alerts`，均指向 `report.controller.ts`
- **控制器**：`report.controller.ts` 有 `getDashboard` 方法，返回基础指标（salesAmount/orderCount/pendingCollectionAmount/inventoryWarningCount/pendingOrderCount）
- **服务**：`report.service.ts` 有 `getDashboard` 查询今日销售、待收、订单、预警
- **通知**：`notification.routes.ts` 已有完整通知API（list/getUnreadCount/markAsRead/markAllRead/send），`notification.service.ts` 和 `notification.controller.ts` 齐全
- **通知表**：`notification` 表已存在于 `init_database.sql`（第1259行），含 recipient_id/recipient_type/title/content/type/related_id/related_type/is_read/sent_at/read_at

### 关键缺失
- **无待办表**：没有 `todo` / `remind` 表，待办提醒完全空白
- **无快捷入口表**：没有 `quick_entry` / `shortcut` 配置表
- **经营概览过于简单**：仅4个指标，缺少今日订单数/今日客户数/毛利/环比/同比/趋势等
- **通知未覆盖商户端**：当前 `listMyNotifications` 仅查询 `recipient_type = 'CONSUMER'`，需支持 `MERCHANT`

---

## 详细说明

### 1. 经营概览聚合 API
- **接口**：`GET /api/admin/dashboard/overview`（增强现有）、`GET /api/admin/dashboard/sales-trend`（增强）、`GET /api/admin/dashboard/category-pie`（新增）、`GET /api/admin/dashboard/top-products`（新增）、`GET /api/admin/dashboard/top-customers`（新增）、`GET /api/admin/dashboard/recent-alerts`（增强）
- **文件**：`backend/src/routes/admin.routes.ts`（扩展）、`backend/src/controllers/admin/dashboard.controller.ts`（新建独立控制器）、`backend/src/services/admin/dashboard.service.ts`（新建独立服务）
- **关键字段**（~40字段）：
  - 核心指标：今日销售额/今日订单数/今日客户数/今日毛利/环比增长率/同比增长率/客单价/毛利率
  - 销售趋势：近7天/近30天 日销售额/订单量/毛利趋势
  - 品类分布：品类销售额/占比/环比
  - Top排行：Top10商品销售额/销量/毛利率、Top10客户销售额/订单数/客单价
  - 预警汇总：低库存SKU数/临期商品数/待收款金额/待处理订单数
- **说明**：将现有 `report.controller.ts` 中的 dashboard 相关方法独立为新文件，按~40字段定义完整聚合。经营概览从销售/采购/库存/客户/财务5个维度做聚合查询。注意使用 `tenant_id` 隔离。

### 2. 待办提醒 API
- **接口**：`GET /api/admin/todos`、`POST /api/admin/todos`、`PUT /api/admin/todos/:id`、`DELETE /api/admin/todos/:id`、`GET /api/admin/todos/stats`（按类型统计数量）
- **DDL**：`docs/migrations/add_todo_table.sql`（新建）
- **文件**：`backend/src/controllers/admin/todo.controller.ts`（新建）、`backend/src/services/admin/todo.service.ts`（新建）、`backend/src/routes/todo.routes.ts`（新建）
- **关键字段**（~30字段）：
  - 待办表 `todo`：id/title/content/type(`INVENTORY_ALERT`/`ORDER_PENDING`/`PAYMENT_OVERDUE`/`PURCHASE_APPROVAL`/`RETURN_PENDING`/`CUSTOMER_FOLLOW`)/priority(`HIGH`/`MEDIUM`/`LOW`)/status(`PENDING`/`DONE`)/source_type/source_id/assignee_id/assignee_name/due_date/created_at/updated_at/tenant_id
  - 自动生成规则：库存预警→低库存SKU/订单待处理→待支付订单/支付逾期→超期应收款/采购审批→待审批采购单/退货待处理→待审核退货单/客户跟进→长期未下单客户
- **说明**：设计 `todo` 表存储待办条目。实现自动生成逻辑：每次查询时从各业务表聚合生成待办（或通过定时任务/触发器）。支持手动创建/完成/删除。stats 接口返回各类型待办数量供前端红点/角标展示。

### 3. 快捷入口配置 API
- **接口**：`GET /api/admin/quick-entries`、`POST /api/admin/quick-entries`、`PUT /api/admin/quick-entries/:id`、`DELETE /api/admin/quick-entries/:id`、`PUT /api/admin/quick-entries/sort`（拖拽排序）
- **DDL**：`docs/migrations/add_quick_entry_table.sql`（新建）
- **文件**：`backend/src/controllers/admin/quick-entry.controller.ts`（新建）、`backend/src/services/admin/quick-entry.service.ts`（新建）、`backend/src/routes/quick-entry.routes.ts`（新建）
- **关键字段**（~20字段）：
  - 快捷入口表 `quick_entry`：id/name/icon/route/type(`ADMIN`/`MERCHANT`)/sort_order/is_enabled/group_name/role_filter(JSON，限制可见角色)/created_at/updated_at/tenant_id
  - 默认预设：管理后台8个（销售开单/采购入库/库存查询/客户管理/商品管理/对账中心/数据报表/系统设置），商户端6个（开单收款/采购订单/库存管理/客户管理/对账单/销售报表）
- **说明**：快捷入口需支持配置化，管理后台可自定义排序和显示/隐藏。支持分组（group_name）。role_filter 控制不同角色看到不同入口。默认预置常用入口，商户可自行调整。

### 4. 消息通知 API
- **接口**：增强现有 `GET /api/admin/notifications`（支持按时间范围筛选）、`GET /api/admin/notifications/unread-count`（已有）、`POST /api/admin/notifications/send`（已有）、新增 `GET /api/admin/notifications/type-stats`（各类型未读统计）
- **文件**：`backend/src/routes/notification.routes.ts`（扩展）、`backend/src/controllers/notification.controller.ts`（扩展）、`backend/src/services/admin/notification.service.ts`（扩展）
- **关键字段**（~20字段）：
  - 通知表 `notification`（已有）：id/recipient_id/recipient_type/title/content/type/summary/related_id/related_type/is_read/sent_at/read_at/created_at/tenant_id
  - 需补充：summary 字段（摘要，用于列表展示，避免加载全部 content）
  - 通知类型：SYSTEM/ORDER/PAYMENT/ALERT/CREDIT/RECALL（已有）
  - 自动触发场景：库存预警（库存低于阈值时自动发送）、订单状态变更（新订单/取消/退款）、支付提醒（逾期未付）、系统公告
- **说明**：现有通知系统基础扎实，主要是增强：1) 补充 `summary` 字段到表中；2) 新增 `type-stats` 接口；3) 完善商户端通知支持（当前 `listMyNotifications` 只查 `CONSUMER`，需改为支持 `MERCHANT`）；4) 在 `server.ts` 中确认路由注册正确。