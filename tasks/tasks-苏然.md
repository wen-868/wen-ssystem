# 苏然 · 订单管理模块 · DAO+测试

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 订单管理7表DAO - 全部新表的数据访问层 | P0 | :x: |
| 2 | 全渠道订单聚合测试 - 多平台订单入库+查询+统计 | P0 | :x: |
| 3 | 订单分发与路由测试 - 规则匹配+分发日志+异常路由 | P0 | :x: |
| 4 | 订单状态同步测试 - 双向同步+定时任务+冲突处理 | P0 | :x: |
| 5 | 订单异常处理测试 - 异常检测+处理流程+统计 | P0 | :x: |
| 6 | 前端页面测试 - 管理后台6页+商户端4页 | P0 | :x: |

---

## 详细说明

### 1. 订单管理7表DAO
- **文件**：`backend/src/services/admin/dao/`（新建目录，包含 `channel-order.dao.ts`、`channel-order-item.dao.ts`、`order-routing-rule.dao.ts`、`order-dispatch-log.dao.ts`、`order-sync-log.dao.ts`、`order-exception.dao.ts`、`order-product-map.dao.ts`、`order-aftersale.dao.ts`）
- **关键字段**：每表DAO需包含的方法 - `findById`、`findAll`（分页+筛选）、`create`、`update`、`delete`、`findByTenant`（租户隔离）
- **说明**：为全部7+1张订单管理新表创建标准化的数据访问层（DAO），每个DAO文件需包含：
  - `channel_order` DAO：findByChannelOrderId/findAll（分页+渠道筛选+状态筛选+支付状态筛选+日期范围+搜索）/create/updateStatus/updatePaymentStatus/batchInsert/getStatsByChannel（按渠道统计）
  - `channel_order_item` DAO：findByChannelOrderId/batchCreate/deleteByChannelOrderId
  - `order_routing_rule` DAO：findAll（分页+渠道筛选+启用状态筛选）/create/update/delete/updateStatus/findMatchingRules（根据条件匹配规则）
  - `order_dispatch_log` DAO：findAll（分页+状态筛选+日期范围）/create/findByChannelOrderId
  - `order_sync_log` DAO：findAll（分页+渠道筛选+类型筛选+结果筛选+日期范围）/create/batchCreate/getSyncStats（同步统计）
  - `order_exception` DAO：findAll（分页+类型筛选+级别筛选+状态筛选+渠道筛选+日期范围）/create/updateStatus/updateHandler/getExceptionStats（异常统计：按类型/渠道/时间）
  - `order_product_map` DAO：findByChannelSkuId/findByLocalSkuId/findAll（分页+渠道筛选+同步状态筛选+搜索）/create/update/updateSyncStatus/batchUpsert/delete/findUnmapped（未映射列表）
  - `order_aftersale` DAO：findAll（分页+渠道筛选+类型筛选+状态筛选+日期范围+搜索）/create/updateStatus/updateHandler/getAftersaleStats（售后统计）
  - 所有DAO方法必须使用 `queryWithTenant`/`queryOneWithTenant` 确保租户隔离
  - 所有DAO方法返回 `Promise<T>` 类型，使用 TypeScript 泛型

### 2. 全渠道订单聚合测试
- **文件**：`backend/tests/order-management/`（新建 `order-aggregation.test.ts`）
- **关键字段**：渠道订单入库（channel_order + channel_order_item）、聚合查询（渠道筛选+状态筛选+日期范围+搜索）、聚合统计（按渠道统计订单数/金额）、渠道原始数据JSON存储解析
- **说明**：编写全渠道订单聚合测试，覆盖以下场景：
  - 订单入库：模拟6个渠道（微信/抖音/美团/饿了么/京东/线下）订单写入 channel_order 表，验证 channel_raw_data JSON字段正确存储各平台特有数据
  - 聚合查询：按渠道筛选（单渠道+多渠道）、按状态筛选（待处理/已确认/已完成/已取消）、按支付状态筛选（未支付/已支付/已退款）、按日期范围（今天/本周/本月）、按关键词搜索（订单号/客户名/手机号）
  - 分页查询：验证分页参数（page/pageSize）正确返回
  - 订单详情：查询单个订单详情，验证 channel_order_item 关联数据正确返回
  - 聚合统计：getStatsByChannel 验证各渠道订单数/金额/占比正确
  - 手动拉取：POST /admin/order-center/channel-orders/pull 模拟拉取渠道订单
  - 批量导入：批量插入100条订单，验证性能和数据完整性
  - 错误处理：重复channel_order_id插入、无效渠道参数、空数据查询
  - 使用 vitest 框架

### 3. 订单分发与路由测试
- **文件**：`backend/tests/order-management/`（新建 `order-routing.test.ts`）
- **关键字段**：路由规则CRUD、条件匹配（区域/金额/商品类别/时间段）、分发日志、手动分发、优先级排序
- **说明**：编写订单分发路由测试，覆盖以下场景：
  - 规则CRUD：创建路由规则（含条件JSON）、查询规则列表、更新规则、删除规则、启用/禁用规则
  - 条件匹配：区域匹配（北京/上海/广州）、金额范围匹配（100-500、500-1000、1000+）、商品类别匹配（白酒/啤酒/红酒）、时间段匹配（仅工作时间/全天）
  - 优先级排序：多个规则同时匹配时，验证按priority升序选择第一个匹配的规则
  - 分发执行：模拟订单到达，验证自动匹配规则并分配到目标门店/仓库，dispatch_log正确记录
  - 分发日志：查询分发日志，按状态筛选（已分配/失败），验证日志记录完整
  - 手动分发：POST /admin/order-routing/dispatch 手动触发分发，验证可覆盖自动规则
  - 规则冲突：多个规则条件重叠时，验证优先级高的规则优先生效
  - 无匹配规则：订单无法匹配任何规则时，验证分发失败并记录原因
  - 错误处理：无效规则条件JSON、目标门店不存在、并发分发
  - 使用 vitest 框架

### 4. 订单状态同步测试
- **文件**：`backend/tests/order-management/`（新建 `order-sync.test.ts`）
- **关键字段**：PULL状态拉取（从渠道获取最新状态）、PUSH状态推送（推送系统状态到渠道）、同步日志、定时任务、冲突处理
- **说明**：编写订单状态同步测试，覆盖以下场景：
  - PULL状态拉取：模拟从渠道（微信/抖音/美团/饿了么/京东）拉取订单状态，验证 channel_order.order_status 正确更新，sync_log 正确记录
  - PUSH状态推送：系统内订单状态变更（确认->配送->完成），验证推送状态到渠道，sync_log 正确记录
  - 批量同步：POST /admin/order-sync/batch-sync 批量同步多个订单，验证全部成功/部分成功/全部失败
  - 同步日志：查询同步日志，按渠道/类型/结果筛选，验证日志完整
  - 同步统计：getSyncStats 验证各渠道同步成功率/失败率/待同步数正确
  - 定时任务：模拟定时触发状态拉取，验证每5分钟执行一次
  - 状态冲突：系统状态与渠道状态不一致时，验证冲突处理策略（以最后更新时间为准）
  - 同步失败重试：模拟网络超时，验证重试机制（最多3次）
  - 错误处理：渠道API不可用、Token过期、验签失败
  - 使用 vitest 框架 + sinon fake timers 模拟定时任务

### 5. 订单异常处理测试
- **文件**：`backend/tests/order-management/`（新建 `order-exception.test.ts`）
- **关键字段**：异常检测（缺货/取消/退款/超时/配送失败/支付失败）、异常处理流程（PENDING->PROCESSING->RESOLVED/CLOSED）、异常统计、关联订单查询
- **说明**：编写订单异常处理测试，覆盖以下场景：
  - 异常检测：模拟各种异常类型（缺货：库存不足时下单、取消：用户取消订单、退款：用户申请退款、超时：支付超时/配送超时、配送失败：骑手无法配送、支付失败：支付接口异常），验证自动生成 exception 记录
  - 异常级别：验证缺货/超时/支付失败->ERROR，配送失败->CRITICAL，取消/退款->WARNING
  - 处理流程：PENDING->分配处理人（PROCESSING）->填写处理方案->标记已解决（RESOLVED）/关闭（CLOSED），验证状态流转正确
  - 异常统计：getExceptionStats 按类型（各类型数量/占比）、按渠道（各渠道异常率）、按时间（日/周/月趋势）验证统计正确
  - 异常列表：分页查询+类型筛选+级别筛选+状态筛选+渠道筛选+日期范围
  - 关联订单：查询异常详情时，验证关联的 channel_order 信息正确返回
  - 批量处理：批量标记多个异常为已解决
  - 与超时模块集成：订单超时后，验证自动生成超时类型异常记录
  - 错误处理：重复异常记录、无效异常类型、无权限处理
  - 使用 vitest 框架

### 6. 前端页面测试
- **文件**：`admin-web/src/__tests__/order-management/`（新建 `OrderCenterView.test.ts`、`OrderRoutingView.test.ts`、`OrderSyncView.test.ts`、`OrderExceptionView.test.ts`、`OrderProductMapView.test.ts`、`OrderAftersaleView.test.ts`）+ `merchant-mobile/src/__tests__/`（新建 `OrderCenterView.test.ts`、`OrderCenterDetailView.test.ts`、`OrderExceptionView.test.ts`、`OrderAftersaleView.test.ts`）
- **关键字段**：页面渲染、组件交互、API调用Mock、表单验证、状态管理、错误处理
- **说明**：编写前端页面测试，覆盖以下场景：
  - 管理后台6页测试：
    - OrderCenterView：渠道Tab切换+数据渲染、订单表格渲染+分页+筛选、详情抽屉打开+数据展示、统计看板渲染、手动拉取操作
    - OrderRoutingView：规则列表渲染+CRUD、条件构建器交互、分发日志查询、手动分发操作
    - OrderSyncView：同步日志渲染+筛选、同步统计展示、手动同步操作、定时任务配置
    - OrderExceptionView：异常列表渲染+筛选、异常详情弹窗、处理操作（分配+处理方案+已解决）、统计图表渲染
    - OrderProductMapView：映射列表渲染+渠道Tab、映射CRUD弹窗、批量导入流程、未映射列表
    - OrderAftersaleView：售后列表渲染+筛选、售后详情弹窗、审核操作（通过/拒绝/完成）、统计图表渲染
  - 商户端4页测试：
    - OrderCenterView：订单卡片列表渲染+渠道筛选+状态筛选、下拉刷新+上拉加载、数据概览卡片
    - OrderCenterDetailView：订单详情渲染+商品明细+金额明细+配送信息、操作按钮交互（确认/拒单/配送/完成）、状态流转时间线
    - OrderExceptionView：异常列表渲染+筛选、异常详情+申诉表单、申诉提交
    - OrderAftersaleView：售后列表渲染+状态Tab、售后详情+处理进度、售后申请表单
  - Mock API调用（使用 vi.mock），验证请求参数和响应处理
  - 表单验证测试（必填字段、格式校验、边界值）
  - 错误处理测试（API错误、网络错误、空数据、无权限）
  - 使用 vitest + @vue/test-utils + jsdom 环境