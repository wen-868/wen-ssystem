# 苏然 · 即时零售模块 · DAO+测试

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 即时零售9表DAO - 全部9张新表的数据访问层 | P0 | :x: |
| 2 | 平台对接集成测试 - 京东/美团/饿了么三平台适配器 | P0 | :x: |
| 3 | 60秒接单工作台测试 - 倒计时+超时自动拒单+音效 | P0 | :x: |
| 4 | 库存原子扣减测试 - 并发下单防超卖 | P0 | :x: |
| 5 | 履约调度端到端测试 - 从外卖下单到履约完成 | P0 | :x: |
| 6 | 前端页面测试 - 管理后台8页+商户端+小程序 | P0 | :x: |

---

## 详细说明

### 1. 即时零售9表DAO
- **文件**：`backend/src/services/instant-retail/`（新增 `dao/` 目录，包含 `platform-config.dao.ts`、`platform-order.dao.ts`、`platform-product-map.dao.ts`、`retail-shop-config.dao.ts`、`retail-category.dao.ts`、`retail-product.dao.ts`、`retail-order.dao.ts`、`retail-order-item.dao.ts`、`retail-banner.dao.ts`）
- **关键字段**：每表DAO需包含的方法 - `findById`、`findAll`（分页+筛选）、`create`、`update`、`delete`、`findByTenant`（租户隔离）
- **说明**：为全部9张即时零售新表创建标准化的数据访问层（DAO），每个DAO文件需包含：
  - `platform_config` DAO：findByPlatform/findByTenant/upsert/deleteByPlatform/updateToken
  - `platform_order` DAO：findByPlatformOrderId/findAll（分页+平台筛选+状态筛选+storeId筛选+时间范围）/create/updateStatus/batchInsert
  - `platform_product_map` DAO：findByPlatformSkuId/findByLocalSkuId/findAll（分页+平台筛选+同步状态筛选）/create/updateSyncStatus/batchUpsert/delete
  - `retail_shop_config` DAO：findByTenant（单条）/upsert/updateStatus
  - `retail_category` DAO：findAll（树形结构，支持parentId筛选）/create/update/delete/updateSortOrder/batchUpdateSortOrder
  - `retail_product` DAO：findAll（分页+分类筛选+状态筛选+推荐/热销/新品筛选+搜索）/findByProductId/create/update/updateStatus/batchUpdateStatus/batchUpdatePrice/updateStock
  - `retail_order` DAO：findAll（分页+状态筛选+支付状态筛选+日期范围+搜索）/findByOrderNo/create/updateStatus/updatePaymentStatus/batchUpdateStatus
  - `retail_order_item` DAO：findByOrderId/batchCreate/deleteByOrderId
  - `retail_banner` DAO：findAll（排序+状态筛选）/create/update/delete/updateSortOrder/batchUpdateSortOrder
  - 所有DAO方法必须使用 `queryWithTenant`/`queryOneWithTenant` 确保租户隔离
  - 所有DAO方法返回 `Promise<T>` 类型，使用 TypeScript 泛型

### 2. 平台对接集成测试
- **文件**：`backend/tests/instant-retail/`（新建 `platform-integration.test.ts`、`jd-adapter.test.ts`、`meituan-adapter.test.ts`、`eleme-adapter.test.ts`）
- **关键字段**：适配器接口方法测试（authenticate/syncOrders/getOrderDetail/confirmOrder/rejectOrder/startDelivery/completeDelivery/cancelOrder/syncProducts/updateInventory/verifyWebhook）、Mock平台响应、错误处理
- **说明**：编写平台对接集成测试，覆盖以下场景：
  - JD适配器测试：Mock京东API响应，测试 authenticate（获取token）、syncOrders（订单同步+解析）、confirmOrder（确认接单）、rejectOrder（拒单带原因）、startDelivery（开始配送）、completeDelivery（完成配送）、syncProducts（商品同步）、updateInventory（库存更新）、verifyWebhook（验签成功/失败）
  - 美团适配器测试：同JD测试场景，适配美团API响应格式
  - 饿了么适配器测试：同JD测试场景，适配饿了么API响应格式
  - platform-integration测试：测试 getPlatforms（三平台状态）、getConfigs（配置列表+脱敏）、upsertConfig（新增/更新）、testConnection（连接成功/失败）、syncOrders（同步写入platform_order表）、syncProducts（同步写入platform_product_map表）、deleteConfig（删除配置）
  - webhook端到端测试：模拟平台推送订单->验签->写入数据库->创建miniapp_order
  - 错误处理测试：网络超时、Token过期自动刷新、平台返回错误码、验签失败
  - 使用 vitest 框架，配置 `backend/vitest.config.ts`

### 3. 60秒接单工作台测试
- **文件**：`backend/tests/instant-retail/`（新建 `order-board.test.ts`）
- **关键字段**：倒计时逻辑（60秒递减/超时触发）、自动拒单（超时自动调用rejectOrder）、音效触发（WebSocket通知）、订单状态流转（PENDING->ACCEPTED/CANCELLED）
- **说明**：编写60秒接单工作台测试，覆盖以下场景：
  - 倒计时逻辑：模拟新订单到达，验证倒计时从60秒开始递减，0秒时触发超时事件
  - 超时自动拒单：倒计时归零后自动调用平台 rejectOrder，验证订单状态变为 CANCELLED，验证 cancelReason 为"超时未接单"
  - 接单操作：在倒计时内调用 confirmOrder，验证订单状态变为 ACCEPTED，倒计时停止
  - 拒单操作：在倒计时内调用 rejectOrder（带原因），验证订单状态变为 CANCELLED
  - 批量操作：批量接单（多个订单同时确认）、批量拒单（多个订单同时拒绝）
  - 音效通知：验证新订单到达时 WebSocket 推送通知，超时告警时推送通知
  - 订单列表查询：验证按状态筛选、按平台筛选、分页查询
  - 并发场景：多个订单同时到达，验证倒计时各自独立运行
  - 使用 vitest 框架 + sinon fake timers 模拟时间

### 4. 库存原子扣减测试
- **文件**：`backend/tests/instant-retail/`（新建 `inventory-deduction.test.ts`）
- **关键字段**：Redis DECR原子操作、数据库行级锁（SELECT ... FOR UPDATE）、并发扣减、库存不足拒单、库存回退
- **说明**：编写库存原子扣减测试，覆盖以下场景：
  - 正常扣减：单用户下单，验证Redis DECR和数据库库存同步减少
  - 并发扣减（10线程）：10个并发请求对同一商品（库存=5）下单，验证只有5个成功、5个失败（库存不足），最终库存=0
  - 并发扣减（50线程）：50个并发请求对同一商品（库存=10）下单，验证只有10个成功、40个失败，最终库存=0，无超卖
  - 库存不足：库存=0时下单，验证返回库存不足错误，不创建订单
  - 库存回退：订单取消后，验证Redis和数据库库存同步恢复
  - 部分扣减：订单含多个商品，其中一个库存不足时，验证整个订单回滚，已扣减商品库存恢复
  - Redis-数据库一致性：Redis扣减成功后异步写入数据库，验证最终一致性
  - 边界条件：库存=1时2个并发下单、库存=9999时大量并发
  - 使用 vitest 框架，通过 Promise.all 模拟并发场景

### 5. 履约调度端到端测试
- **文件**：`backend/tests/instant-retail/`（新建 `fulfillment-e2e.test.ts`）
- **关键字段**：完整流程（下单->接单->配送->完成）、配送路由（自配/平台/第三方）、缺货处理、异常场景
- **说明**：编写履约调度端到端测试，覆盖以下场景：
  - 完整履约流程：模拟平台下单（webhook）-> 接单（confirmOrder）-> 开始配送（startDelivery）-> 完成配送（completeDelivery），验证每个环节状态正确流转
  - 自配送路由：订单金额>=免配送费门槛时，验证配送费=0；订单金额<门槛，验证配送费=设置值
  - 平台配送路由：验证使用平台配送时，调用平台 startDelivery 接口
  - 第三方配送路由：验证使用第三方配送时，分配骑手信息
  - 缺货拒单：下单商品库存不足时，验证自动拒单，拒单原因包含"库存不足"
  - 部分缺货：订单含多个商品，部分缺货时，验证整个订单拒单（不拆单）
  - 配送超时：模拟配送超过预计时间，验证触发告警
  - 异常场景：平台接口超时重试、平台接口返回错误、数据库连接失败回滚
  - 订单取消恢复：取消配送中的订单，验证库存回退+平台通知
  - 使用 vitest 框架，Mock 平台适配器接口

### 6. 前端页面测试
- **文件**：`admin-web/src/__tests__/instant-retail/`（新建 `InstantRetailConfig.test.ts`、`InstantRetailShelf.test.ts`、`InstantRetailOrders.test.ts`、`InstantRetailPlatform.test.ts`、`InstantRetailOrderBoard.test.ts`、`InstantRetailReport.test.ts`）+ `merchant-mobile/src/__tests__/`（新建 `instant-retail-order.test.ts`、`instant-retail-inventory.test.ts`）+ `miniapp/__tests__/`（新建 `wholesale.test.ts`、`member.test.ts`）
- **关键字段**：页面渲染、组件交互、API调用Mock、表单验证、状态管理、错误处理
- **说明**：编写前端页面测试，覆盖以下场景：
  - 管理后台8页测试：
    - InstantRetailConfig：店铺配置表单渲染+提交+验证、轮播图CRUD、分类CRUD
    - InstantRetailShelf：商品列表渲染+分页+筛选、添加商品+编辑、批量上下架+批量改价
    - InstantRetailOrders：订单列表渲染+筛选+分页、详情抽屉打开+数据展示、状态流转操作（确认/取消/完成）
    - InstantRetailPlatform：3Tab切换+表单渲染、保存配置+测试连接、同步操作
    - InstantRetailOrderBoard：订单卡片渲染+倒计时显示、接单/拒单操作、批量操作、三列看板布局
    - InstantRetailReport：概览卡片渲染+数据展示、趋势图渲染、平台对比图表、导出功能
  - 商户端测试：
    - 即时零售订单：订单列表渲染+筛选、接单提醒弹窗、履约操作
    - 库存同步：商品列表渲染+同步状态显示、一键同步+单商品同步
  - 小程序测试：
    - 批发专区：商品列表+批发价展示、采购下单流程、对账+付款
    - 会员中心：积分/储值/等级/优惠券/地址管理各页面渲染+交互
  - Mock API调用（使用 vi.mock），验证请求参数和响应处理
  - 表单验证测试（必填字段、格式校验、边界值）
  - 错误处理测试（API错误、网络错误、空数据）
  - 使用 vitest + @vue/test-utils + jsdom 环境