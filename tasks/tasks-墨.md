# 墨 · 订单管理模块 · 管理后台

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | OrderCenterView - 全渠道订单聚合 | P0 | :x: |
| 2 | OrderRoutingView - 订单分发与路由 | P0 | :x: |
| 3 | OrderSyncView - 订单状态同步 | P0 | :x: |
| 4 | OrderExceptionView - 订单异常处理 | P0 | :x: |
| 5 | OrderProductMapView - 全渠道商品映射 | P0 | :x: |
| 6 | OrderAftersaleView - 订单售后聚合 | P1 | :x: |

---

## 详细说明

### 1. OrderCenterView - 全渠道订单聚合
- **文件**：`admin-web/src/views/OrderCenterView.vue`（新建）
- **关键字段**：渠道Tab切换（全部/微信/抖音/美团/饿了么/京东/线下）、订单统计看板（今日订单数/今日金额/待处理数/异常数）、订单表格（channelOrderNo/channel/渠道订单号/channelStatus/customerName/customerPhone/totalAmount/orderStatus/paymentStatus/createdAt）、详情抽屉（渠道原始数据JSON展示/商品明细/金额明细/支付信息/操作日志）、手动拉取按钮
- **说明**：实现全渠道订单聚合管理页面，顶部渠道Tab（使用el-tabs，每个Tab带渠道icon和今日订单数角标，通过badge显示），统计区（4个el-statistic卡片+渠道占比饼图echarts+订单趋势折线图），订单表格（el-table分页列表，列：渠道标签el-tag（不同渠道不同颜色）、渠道订单号、渠道状态、客户姓名+电话、商品摘要、订单金额、支付状态el-tag、订单状态el-tag、聚合时间，行操作：查看详情按钮+手动同步按钮），详情抽屉（el-drawer，左侧：订单基本信息表单+渠道原始数据el-descriptions+收货信息，右侧：商品明细el-table含渠道商品名/本地商品名/单价/数量/小计，底部：支付信息+操作日志el-timeline），筛选栏（渠道选择el-select+订单状态el-select+支付状态el-select+日期范围el-date-picker+搜索el-input+导出按钮el-button）。调用 `/api/admin/order-center/channel-orders` 系列接口。新增路由：`/order-center`，侧边栏菜单：订单管理 > 全渠道订单聚合。

### 2. OrderRoutingView - 订单分发与路由
- **文件**：`admin-web/src/views/OrderRoutingView.vue`（新建）
- **关键字段**：路由规则管理（ruleName/channel/storeId/priority/conditionJson/actionType/isEnabled）、规则编辑弹窗（条件构建器：区域/金额/商品类别/时间段配置）、分发日志（channelOrderId/ruleId/fromStoreId/toStoreId/dispatchStatus/dispatchReason/createdAt）、手动分发（选择订单+目标门店+确认）
- **说明**：实现订单分发路由配置页面，包含两个Tab：路由规则管理（el-table列表含规则名称/适用渠道el-tag/适用门店/优先级/条件摘要/启用状态el-switch，操作列：编辑/删除按钮，新增/编辑弹窗el-dialog：规则名称el-input+渠道el-select多选+适用门店el-select+优先级el-input-number+条件构建器：区域选择el-cascader+金额范围el-slider+商品类别el-tree-select多选+时间段el-time-picker，动作选择：分配门店el-select/分配仓库el-select/拆分规则配置，启用开关el-switch），分发日志（el-table含订单号/渠道/触发规则/来源门店/目标门店/分发状态el-tag/分发时间/分发原因，筛选：状态el-select+日期范围+搜索），手动分发入口（在订单详情中增加"手动分发"按钮，弹出分发对话框el-dialog：选择目标门店el-select+目标仓库el-select+确认分发el-button）。分发看板（el-row 3列：各门店当前订单量+接单能力状态，使用el-progress展示负载率）。调用 `/api/admin/order-routing/rules` 和 `/api/admin/order-routing/dispatch-logs` 接口。新增路由：`/order-routing`，侧边栏菜单：订单管理 > 订单分发与路由。

### 3. OrderSyncView - 订单状态同步
- **文件**：`admin-web/src/views/OrderSyncView.vue`（新建）
- **关键字段**：同步统计（各渠道同步成功率/失败率/待同步数/今日同步总数）、同步日志（channelOrderId/channel/syncType/fromStatus/toStatus/syncResult/errorMessage/syncedAt）、手动同步操作（单订单同步+批量同步+全量同步）、定时任务配置（同步频率/同步范围/通知设置）
- **说明**：实现订单状态同步管理页面，顶部同步统计区（4个el-statistic卡片：今日同步总数/成功数/失败数/待同步数，各渠道同步成功率echarts柱状图），同步日志（el-table含订单号+渠道el-tag、同步类型el-tag：PULL蓝色/PUSH绿色、来源状态->目标状态箭头动画、同步结果el-tag：成功/失败、错误信息el-tooltip+el-popover展示完整错误、同步时间，筛选：渠道el-select+类型el-select+结果el-select+日期范围），操作区（el-button组：单订单同步+批量同步选中+全量同步全部渠道，同步进度el-progress），定时任务配置区（el-descriptions：同步频率el-select每5分钟/每10分钟/每30分钟/每小时，同步范围el-select全部/指定渠道，同步开关el-switch，通知设置：失败告警el-switch+告警方式）。调用 `/api/admin/order-sync/logs` 和 `/api/admin/order-sync/stats` 接口。新增路由：`/order-sync`，侧边栏菜单：订单管理 > 订单状态同步。

### 4. OrderExceptionView - 订单异常处理
- **文件**：`admin-web/src/views/OrderExceptionView.vue`（新建）
- **关键字段**：异常统计（待处理数/今日新增/本周解决/平均处理时长）、异常列表（channelOrderId/channel/exceptionType/exceptionLevel/exceptionDetail/handleStatus/handlerId/createdAt）、异常详情（完整异常信息+关联订单+处理记录时间线）、处理操作（分配处理人+处理方案+标记已解决+关闭）
- **说明**：实现订单异常处理中心页面，顶部异常统计区（4个el-statistic卡片：待处理异常数红色/今日新增异常数橙色/本周解决异常数绿色/平均处理时长，异常类型分布echarts饼图+渠道异常率echarts柱状图+异常趋势echarts折线图切换日/周/月），异常列表（el-table含异常级别el-tag：WARNING黄色/ERROR橙色/CRITICAL红色+图标、订单号、渠道el-tag、异常类型el-tag、异常详情摘要el-popover、处理状态el-tag、处理人、创建时间，行操作：处理/查看详情），异常详情弹窗（el-dialog：左侧：异常基本信息el-descriptions+异常详情JSON展示+关联订单信息，右侧：处理记录el-timeline含处理人/时间/方案/结果，底部：处理操作区：分配处理人el-select+处理方案el-input type=textarea+标记已解决el-button type=success+关闭异常el-button）。筛选栏：异常类型el-select多选+异常级别el-select+处理状态el-select+渠道el-select+日期范围+搜索。调用 `/api/admin/order-exception/list` 和 `/api/admin/order-exception/stats` 接口。新增路由：`/order-exception`，侧边栏菜单：订单管理 > 订单异常处理。

### 5. OrderProductMapView - 全渠道商品映射
- **文件**：`admin-web/src/views/OrderProductMapView.vue`（新建）
- **关键字段**：映射列表（channel/channelSkuId/channelProductName/channelPrice/localSkuId/localProductName/localPrice/syncStatus/lastSyncedAt）、映射编辑弹窗（渠道选择+渠道SKU+渠道商品名+渠道价格+本地SKU搜索选择）、批量导入（上传CSV/Excel+预览+确认）、未映射商品列表（快速映射入口）
- **说明**：实现全渠道商品映射管理页面，顶部渠道Tab（el-tabs，每个Tab带已映射数/未映射数角标），映射列表（el-table含渠道el-tag、渠道SKU编码、渠道商品名、渠道价格、本地SKU编码、本地商品名、本地价格、同步状态el-tag、最后同步时间，行操作：编辑/删除/同步），操作栏（新增映射el-button+批量导入el-button+批量同步el-button+搜索el-input），新增/编辑映射弹窗（el-dialog：渠道el-select+渠道SKU编码el-input+渠道商品名el-input+渠道价格el-input-number+本地SKU搜索选择器el-select：支持按商品名/SKU编码搜索，选中后自动填充本地商品名/价格），批量导入流程（el-steps：上传文件el-upload->预览表格el-table->确认导入el-button->显示结果导入成功X条/失败X条/重复X条），未映射商品列表（el-tab-pane：显示各渠道订单中未匹配的商品，el-table含渠道/渠道SKU/渠道商品名/订单数，操作：快速映射el-button弹出快速映射弹窗）。调用 `/api/admin/order-product-map/list` 和 `/api/admin/order-product-map/batch-import` 接口。新增路由：`/order-product-map`，侧边栏菜单：订单管理 > 全渠道商品映射。

### 6. OrderAftersaleView - 订单售后聚合
- **文件**：`admin-web/src/views/OrderAftersaleView.vue`（新建）
- **关键字段**：售后列表（channelOrderId/channel/aftersaleNo/aftersaleType/reason/refundAmount/aftersaleStatus/handlerId/createdAt）、售后详情（完整售后信息+关联订单+处理记录）、售后统计（售后率/退款金额趋势/类型分布）、审核操作（通过/拒绝+理由+完成售后）
- **说明**：实现订单售后聚合管理页面，顶部售后统计区（4个el-statistic卡片：售后总数/待审核数/今日新增/售后率，售后类型分布echarts饼图+渠道售后率echarts柱状图+退款金额趋势echarts折线图），售后列表（el-table含渠道el-tag、售后单号、关联订单号、售后类型el-tag：仅退款/退货退款/换货/维修、原因摘要、退款金额、售后状态el-tag：待审核/已通过/已拒绝/待收货/待质检/已完成/已关闭、处理人、创建时间，行操作：审核/查看详情），售后详情弹窗（el-dialog：左侧：售后基本信息el-descriptions+商品信息+退款金额，右侧：处理记录el-timeline+物流信息，底部：审核操作区：通过el-button type=success+拒绝el-button type=danger+拒绝原因el-input+完成售后el-button type=primary），筛选栏：渠道el-select+售后类型el-select+售后状态el-select+日期范围+搜索。审核操作需二次确认弹窗。调用 `/api/admin/order-aftersale/list` 和 `/api/admin/order-aftersale/stats` 接口。新增路由：`/order-aftersale`，侧边栏菜单：订单管理 > 订单售后聚合。复用现有 `AftersaleView.vue` 组件逻辑，扩展为全渠道版本。