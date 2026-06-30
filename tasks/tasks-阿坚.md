# 阿坚 · 订单管理模块 · 后端核心

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 全渠道订单聚合 - DDL迁移 + 聚合API | P0 | :x: |
| 2 | 订单分发与路由 - 路由规则 + 分发API | P0 | :x: |
| 3 | 订单状态同步 - 双向同步引擎 + 同步API | P0 | :x: |
| 4 | 订单异常处理 - 异常检测 + 处理API | P0 | :x: |
| 5 | 全渠道商品映射 - 映射表DDL + CRUD API | P0 | :x: |
| 6 | 订单售后聚合 - 统一售后DDL + API | P1 | :x: |

---

## 详细说明

### 1. 全渠道订单聚合 - DDL迁移 + 聚合API
- **文件**：`docs/migrations/add_order_management.sql`（新建）、`backend/src/routes/order-center.routes.ts`（新建）、`backend/src/controllers/admin/order-center.controller.ts`（新建）、`backend/src/services/admin/order-center.service.ts`（新建）
- **关键字段**：
  - `channel_order` 表：channel_order_id、channel（WECHAT/DOUYIN/MEITUAN/JD/ELEME/OFFLINE）、channel_order_no、channel_status、tenant_id、store_id、customer_id、customer_name、customer_phone、total_amount、discount_amount、delivery_fee、pay_amount、order_status（PENDING/CONFIRMED/PROCESSING/SHIPPED/COMPLETED/CANCELLED）、payment_status（UNPAID/PAID/REFUNDED）、channel_raw_data（JSON）、pulled_at、synced_at、created_at、updated_at
  - `channel_order_item` 表：channel_order_id、channel_sku_id、channel_sku_name、local_sku_id、local_sku_name、price、quantity、subtotal
  - 聚合API：GET /admin/order-center/channel-orders（分页+渠道筛选+状态筛选+日期范围+搜索）、GET /admin/order-center/channel-orders/:id（详情含商品明细）、POST /admin/order-center/channel-orders/pull（手动拉取渠道订单）、GET /admin/order-center/channel-orders/stats（各渠道订单统计）
- **说明**：创建全渠道订单聚合表，将所有渠道（微信小程序、抖音、美团、饿了么、京东、线下）的订单统一入库到 `channel_order` 表。实现聚合API支持多维度筛选（渠道、状态、日期、关键词）。渠道订单原始数据以JSON格式存储在 `channel_raw_data` 字段中，保留各平台特有字段。整合现有 `order.controller.ts` 的 `listOrders` 逻辑，复用 `order.service.ts` 中的查询方法。路由注册到 `server.ts`：`app.use("/api/admin/order-center", requireAuthWithTenant, orderCenterRouter)`。

### 2. 订单分发与路由 - 路由规则 + 分发API
- **文件**：`backend/src/services/admin/order-routing.service.ts`（新建）、`backend/src/controllers/admin/order-routing.controller.ts`（新建）、`backend/src/routes/order-routing.routes.ts`（新建）
- **关键字段**：
  - `order_routing_rule` 表：rule_name、channel、store_id、warehouse_id、priority、condition_json（JSON：区域/金额/商品类别/时间段等条件）、action_type（ASSIGN_STORE/ASSIGN_WAREHOUSE/SPLIT）、is_enabled、created_at、updated_at
  - `order_dispatch_log` 表：channel_order_id、rule_id、from_store_id、to_store_id、from_warehouse_id、to_warehouse_id、dispatch_status（PENDING/ASSIGNED/FAILED）、dispatch_reason、created_at
  - 路由API：GET /admin/order-routing/rules（规则列表）、POST /admin/order-routing/rules（创建规则）、PUT /admin/order-routing/rules/:id（更新规则）、DELETE /admin/order-routing/rules/:id（删除规则）、POST /admin/order-routing/dispatch（手动触发分发）、GET /admin/order-routing/dispatch-logs（分发日志）
- **说明**：实现订单智能分发路由引擎。核心逻辑：订单到达后根据路由规则（区域、商品类别、仓库库存、门店接单能力）自动分配到对应门店/仓库。支持条件匹配（condition_json 存储匹配条件：region/amount_range/category_ids/time_range），支持优先级排序（priority越小越优先）。分发日志记录每次路由决策的原因和结果。路由注册：`app.use("/api/admin/order-routing", requireAuthWithTenant, orderRoutingRouter)`。

### 3. 订单状态同步 - 双向同步引擎 + 同步API
- **文件**：`backend/src/services/admin/order-sync.service.ts`（新建）、`backend/src/controllers/admin/order-sync.controller.ts`（新建）、`backend/src/routes/order-sync.routes.ts`（新建）
- **关键字段**：
  - `order_sync_log` 表：channel_order_id、sync_type（PULL_STATUS/PUSH_STATUS）、from_status、to_status、channel、sync_result（SUCCESS/FAILED）、error_message、synced_at、created_at
  - 同步API：GET /admin/order-sync/logs（同步日志分页）、POST /admin/order-sync/pull-status（手动拉取渠道订单状态）、POST /admin/order-sync/push-status（推送系统状态到渠道）、POST /admin/order-sync/batch-sync（批量同步）、GET /admin/order-sync/stats（同步统计）
- **说明**：实现订单状态双向同步引擎。PULL：定时从各渠道（微信/抖音/美团/饿了么/京东）拉取订单最新状态，更新 `channel_order.order_status`；PUSH：当系统内订单状态变更时（如发货、完成），推送状态到对应渠道。同步日志记录每次同步的详细信息（来源状态、目标状态、结果、错误信息）。定时任务每5分钟执行一次状态拉取。复用现有 `instant-retail` 的平台适配器（JD/美团/饿了么）进行状态同步。路由注册：`app.use("/api/admin/order-sync", requireAuthWithTenant, orderSyncRouter)`。

### 4. 订单异常处理 - 异常检测 + 处理API
- **文件**：`backend/src/services/admin/order-exception.service.ts`（新建）、`backend/src/controllers/admin/order-exception.controller.ts`（新建）、`backend/src/routes/order-exception.routes.ts`（新建）
- **关键字段**：
  - `order_exception` 表：channel_order_id、exception_type（SHORTAGE/CANCEL/REFUND/TIMEOUT/DELIVERY_FAIL/PAYMENT_FAIL/OTHER）、exception_level（WARNING/ERROR/CRITICAL）、exception_detail（JSON：异常详情）、handle_status（PENDING/PROCESSING/RESOLVED/CLOSED）、handler_id、handle_remark、handle_result、created_at、handled_at、resolved_at
  - 异常API：GET /admin/order-exception/list（异常列表分页+类型筛选+状态筛选）、GET /admin/order-exception/:id（异常详情）、POST /admin/order-exception/:id/handle（处理异常）、POST /admin/order-exception/:id/resolve（标记已解决）、GET /admin/order-exception/stats（异常统计：按类型/按渠道/按时间）
- **说明**：实现订单异常统一处理中心。异常检测：自动检测缺货、取消、退款、超时、配送失败、支付失败等异常类型，生成异常记录。处理流程：PENDING（待处理）-> PROCESSING（处理中，分配处理人+填写处理方案）-> RESOLVED（已解决）/ CLOSED（已关闭）。异常统计：按类型（缺货占比/取消率/退款率）、按渠道（各渠道异常率）、按时间（异常趋势）生成统计。与现有 `order-timeout` 模块集成，超时异常自动流转到异常处理中心。路由注册：`app.use("/api/admin/order-exception", requireAuthWithTenant, orderExceptionRouter)`。

### 5. 全渠道商品映射 - 映射表DDL + CRUD API
- **文件**：`docs/migrations/add_order_product_map.sql`（新建）、`backend/src/controllers/admin/order-product-map.controller.ts`（新建）、`backend/src/routes/order-product-map.routes.ts`（新建）、`backend/src/services/admin/order-product-map.service.ts`（新建）
- **关键字段**：
  - `order_product_map` 表：channel（WECHAT/DOUYIN/MEITUAN/JD/ELEME）、store_id、local_sku_id、channel_sku_id、channel_spu_id、channel_product_name、channel_price、sync_status（UNSYNCED/SYNCED/FAILED）、last_synced_at、created_at、updated_at
  - 映射API：GET /admin/order-product-map/list（分页+渠道筛选+状态筛选+搜索）、POST /admin/order-product-map（创建映射）、PUT /admin/order-product-map/:id（更新映射）、DELETE /admin/order-product-map/:id（删除映射）、POST /admin/order-product-map/batch-import（批量导入映射）、POST /admin/order-product-map/sync（手动触发同步）、GET /admin/order-product-map/mismatch（未映射商品列表）
- **说明**：创建全渠道商品映射表，建立各渠道商品编码与系统本地SKU的对应关系。区别于 `platform_product_map`（即时零售专用），本表覆盖所有订单渠道（微信/抖音/线下等）。支持批量导入映射（CSV/Excel），支持手动创建和编辑映射关系。未映射商品列表：列出所有渠道订单中 `channel_sku_id` 未匹配到本地SKU的商品，提示管理员完成映射。复用 `instant-retail` 中的 `platform_product_map` 同步逻辑。路由注册：`app.use("/api/admin/order-product-map", requireAuthWithTenant, orderProductMapRouter)`。

### 6. 订单售后聚合 - 统一售后DDL + API
- **文件**：`docs/migrations/add_order_aftersale.sql`（新建）、`backend/src/controllers/admin/order-aftersale.controller.ts`（新建）、`backend/src/routes/order-aftersale.routes.ts`（新建）、`backend/src/services/admin/order-aftersale.service.ts`（新建）
- **关键字段**：
  - `order_aftersale` 表：channel_order_id、channel、aftersale_no、aftersale_type（REFUND_ONLY/RETURN_REFUND/EXCHANGE/REPAIR）、reason、reason_detail、images（JSON数组）、refund_amount、aftersale_status（PENDING/APPROVED/REJECTED/WAIT_RECEIPT/WAIT_INSPECT/COMPLETED/CLOSED）、handler_id、handle_remark、return_logistics_no、return_logistics_company、channel_raw_data（JSON）、created_at、handled_at、completed_at
  - 售后API：GET /admin/order-aftersale/list（分页+渠道筛选+类型筛选+状态筛选+搜索）、GET /admin/order-aftersale/:id（详情）、POST /admin/order-aftersale/:id/approve（审核通过）、POST /admin/order-aftersale/:id/reject（审核拒绝）、POST /admin/order-aftersale/:id/complete（完成售后）、GET /admin/order-aftersale/stats（售后统计：按类型/按渠道/按时间）
- **说明**：创建全渠道售后统一聚合表，将各渠道的售后申请统一管理。整合现有 `aftersale.routes.ts` 中的售后逻辑，扩展为支持多渠道路由。售后状态流转：PENDING -> APPROVED/REJECTED -> WAIT_RECEIPT（退货收货）-> WAIT_INSPECT（质检）-> COMPLETED/CLOSED。退款金额自动关联渠道订单实付金额。售后统计：售后率（按渠道/按商品）、退款金额趋势、售后类型分布。路由注册：`app.use("/api/admin/order-aftersale", requireAuthWithTenant, orderAftersaleRouter)`。