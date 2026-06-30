# 阿坚 · 即时零售模块 · 后端核心

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 即时零售数据库DDL - 9张缺失表迁移脚本 | P0 | :x: |
| 2 | 路由修复+控制器挂载 - instant-retail-new.routes.ts | P0 | :x: |
| 3 | 平台对接完善 - platform_config CRUD + OAuth + 连接测试 | P0 | :x: |
| 4 | 商品上架同步 + 库存原子扣减 | P0 | :x: |
| 5 | 履约调度 + 缺货异常处理 | P0 | :x: |
| 6 | 平台对账 + 评价 + 零售经营分析API | P1 | :x: |

---

## 详细说明

### 1. 即时零售数据库DDL
- **文件**：`docs/migrations/add_instant_retail_tables.sql`
- **关键字段**：
  - `platform_config` - 平台+store_id+app_key+app_secret+merchant_id+access_token+refresh_token+token_expire_at+enabled+config_json
  - `platform_order` - platform_order_id+platform+store_id+status+order_data_json+created_at+updated_at
  - `platform_product_map` - platform+store_id+local_sku_id+platform_sku_id+platform_spu_id+sync_status
  - `retail_shop_config` - shop_name+shop_logo+shop_description+contact_phone+business_hours+delivery_enabled+pickup_enabled+min_order_amount+delivery_fee+delivery_radius+estimated_delivery_time+announcement+status
  - `retail_category` - category_name+category_icon+parent_id+sort_order+status
  - `retail_product` - product_id+category_id+retail_price+original_price+stock+sales_count+is_recommended+is_hot+is_new+sort_order+status
  - `retail_order` - order_no+user_id+total_amount+discount_amount+delivery_fee+pay_amount+delivery_type+delivery_address+receiver_name+receiver_phone+receiver_latitude+receiver_longitude+remark+payment_status+payment_method+payment_time+transaction_no+order_status+cancel_reason
  - `retail_order_item` - order_id+product_id+product_name+product_image+price+quantity+subtotal
  - `retail_banner` - banner_title+banner_image+link_type+link_value+sort_order+status+start_time+end_time
- **说明**：创建全部9张即时零售核心表的DDL迁移脚本，需包含完整字段定义、索引（tenant_id、status、platform等）、外键约束（retail_order_item->retail_order）、ENGINE=InnoDB、CHARSET=utf8mb4。参考现有 `docs/phase10_instant_retail.sql` 进行扩展，确保与现有 service 层代码中查询的字段名称一致。

### 2. 路由修复+控制器挂载
- **文件**：`backend/src/routes/instant-retail-new.routes.ts`
- **关键字段**：11个控制器方法 + 3个Webhook端点 + 管理后台CRUD端点 + 门店操作端点
- **说明**：当前 `server.ts` 第16行导入 `./routes/instant-retail-new.routes.js`，但该文件不存在，系统启动会报错。需创建此文件，整合以下控制器：
  - `controllers/admin/instant-retail.controller.ts` - 17个方法（getShopConfig/saveShopConfig/listCategories/createCategory/listRetailProducts/addRetailProduct/listRetailOrders/getRetailOrderDetail/updateRetailOrderStatus/listBanners/createBanner + 已挂载的11个方法）
  - `controllers/instant-retail/fulfillment.controller.ts` - startDelivery/completeDelivery
  - `controllers/instant-retail/order-receiving.controller.ts` - listOrders/getOrderDetail/confirmOrder/cancelOrder
  - `controllers/instant-retail/platform-integration.controller.ts` - 3个Webhook + getPlatforms/getConfigs/getConfigByPlatform/upsertConfig/testConnection/syncOrders/syncProducts/deleteConfig
  - 路由分组：`/webhook/*`（无需认证）、`/admin/*`（requireAuthWithTenant）、`/store/*`（storeAuth）
  - 同时修复 `server.ts` 路径（如需要改为 `.ts` 扩展名或保持 `.js` 编译后引用）

### 3. 平台对接完善
- **文件**：`backend/src/services/instant-retail/`
- **关键字段**：platform_config 完整CRUD、OAuth令牌刷新、连接测试
- **说明**：
  - 完善 `platform-integration.service.ts` 中的 `upsertConfig` 方法，增加 access_token/refresh_token/token_expire_at 字段的持久化
  - 实现 OAuth Token 自动刷新：在 `testConnection` 和 `authenticate` 中检测 token 过期状态，自动调用 refresh_token 续期
  - 完善 `getPlatforms` 返回每个平台的完整状态（enabled/configured/storeId/merchantId/tokenExpireAt）
  - 实现 `common.service.ts` 中 `getPlatformConfigWithTenant` 的完整逻辑，支持按 storeId 查询
  - 确保 JD/美团/饿了么三个适配器的 `authenticate()` 方法返回正确的 `PlatformCredentials` 结构

### 4. 商品上架同步 + 库存原子扣减
- **文件**：`backend/src/services/instant-retail/`（新增 `product-sync.service.ts`、`inventory-deduction.service.ts`）
- **关键字段**：
  - 商品同步：platform_product_map（local_sku_id/platform_sku_id/platform_spu_id/sync_status）、批量同步状态流转（UNSYNCED->PENDING->SYNCED/FAILED）
  - 库存扣减：Redis DECR原子操作、数据库行级锁（SELECT ... FOR UPDATE）、库存不足拒单
- **说明**：
  - 实现 `platform_product_map` 的CRUD服务，支持平台商品映射关系的增删改查
  - 批量商品同步：从 `retail_product` 表读取商品，通过平台适配器 `syncProducts()` 推送到各平台，更新 `sync_status`
  - 库存原子扣减：下单时使用 Redis DECR 原子扣减库存，失败则回滚并拒绝订单；定时将 Redis 库存回写数据库
  - 处理并发场景：同一商品多用户同时下单时，确保库存扣减的原子性和一致性

### 5. 履约调度 + 缺货异常处理
- **文件**：`backend/src/services/instant-retail/fulfillment.service.ts`（扩展）、新增 `shortage-handler.service.ts`
- **关键字段**：
  - 履约调度：delivery_type（SELF/PLATFORM/THIRD_PARTY）、配送路由规则、骑手分配
  - 缺货处理：缺货检测（stock < quantity）、自动拒单（rejectOrder）、平台通知、库存预警
- **说明**：
  - 扩展 `fulfillment.service.ts`：实现自配送（SELF）和第三方配送（THIRD_PARTY）的路由逻辑
  - 配送路由规则：根据订单金额、距离、时段自动选择配送方式
  - 缺货检测：接单时实时检测库存，库存不足自动调用平台 `rejectOrder` 并通知管理员
  - 异常处理：配送超时自动告警、骑手无响应转单、订单取消后库存回退

### 6. 平台对账 + 评价 + 零售经营分析API
- **文件**：`backend/src/services/instant-retail/`（新增 `reconciliation.service.ts`、`review.service.ts`、`retail-analytics.service.ts`）
- **关键字段**：
  - 对账：佣金费率（commission_rate）、平台实收（platform_amount）、对账差异（diff_amount）、对账状态（reconciliation_status）
  - 评价：评分（rating）、评价内容（review_content）、评价回复（reply）、评价标签（review_tags）
  - 经营分析：销售额（sales_amount）、毛利（gross_profit）、订单量（order_count）、客单价（avg_order_amount）、平台对比（platform_comparison）
- **说明**：
  - 平台对账：实现佣金计算逻辑（按平台费率），生成对账报表，标记差异项
  - 评价同步：从各平台拉取用户评价数据，存储到 `retail_review` 表，支持回复功能
  - 零售经营分析API：提供 `GET /admin/instant-retail/reports/summary`（汇总）、`GET /admin/instant-retail/reports/trend`（趋势）、`GET /admin/instant-retail/reports/platform-compare`（平台对比）三个端点
  - 数据来源：`retail_order` + `retail_order_item` + `platform_order` 联合查询