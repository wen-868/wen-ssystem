# 阿澈 · 订单管理模块 · 商户移动端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 商户端订单列表 - 全渠道订单聚合展示 | P0 | :x: |
| 2 | 商户端订单详情 - 订单信息+商品明细+操作 | P0 | :x: |
| 3 | 商户端异常处理 - 异常订单识别+申诉 | P0 | :x: |
| 4 | 商户端售后管理 - 售后申请+进度查询 | P1 | :x: |

---

## 详细说明

### 1. 商户端订单列表 - 全渠道订单聚合展示
- **文件**：`merchant-mobile/src/views/OrderCenterView.vue`（新建）
- **关键字段**：渠道筛选（全部/微信/抖音/美团/饿了么/京东/线下）、状态筛选（全部/待处理/已确认/配送中/已完成/已取消）、订单卡片（channelOrderNo/channel/渠道标签+颜色区分/customerName/customerPhone/totalAmount/orderStatus/paymentStatus/商品摘要/createdAt）、数据概览（今日订单数/今日金额/待处理数/异常数）
- **说明**：实现商户移动端全渠道订单列表页面。页面顶部数据概览区（4个van-grid卡片：今日订单数/今日金额/待处理订单数/异常订单数，点击可跳转对应筛选），渠道筛选栏（van-tabs横向滚动：全部+6个渠道Tab，每个Tab带渠道icon和颜色标识），状态筛选（van-dropdown-menu下拉：全部/待处理/已确认/配送中/已完成/已取消），订单卡片列表（van-list支持下拉刷新+上拉加载更多，每个van-cell卡片：顶部渠道标签van-tag颜色区分+订单号，中部客户姓名+电话+商品摘要，底部金额+状态标签van-tag+时间，点击进入详情），搜索功能（顶部搜索框van-search：搜索订单号/客户名/手机号）。异常订单标记：卡片右上角红色感叹号图标+异常原因简述。调用 `/api/admin/order-center/channel-orders` 接口（需适配移动端分页参数）。将 `OrdersView.vue` 中的现有逻辑迁移整合到本页面。

### 2. 商户端订单详情 - 订单信息+商品明细+操作
- **文件**：`merchant-mobile/src/views/OrderCenterDetailView.vue`（新建）
- **关键字段**：订单基本信息（渠道/订单号/状态/时间）、商品明细（channelSkuName/localSkuName/price/quantity/subtotal）、金额明细（totalAmount/discountAmount/deliveryFee/payAmount）、配送信息（收货人/电话/地址/配送方式）、操作按钮（确认接单/拒单/开始配送/完成配送/取消订单）、状态流转时间线
- **说明**：实现商户移动端订单详情页面。订单基本信息区（van-cell-group：渠道来源van-tag+订单号+订单状态van-tag+创建时间+支付时间），商品明细列表（van-card列表：商品名+规格+单价+数量+小计，底部合计金额），金额明细（van-cell-group：商品总额+优惠金额+配送费+实付金额，实付金额加粗），配送信息（van-cell-group：收货人+联系电话+收货地址+配送方式标签+备注），状态流转时间线（van-steps：下单->支付->确认->配送->完成，当前步骤高亮），操作按钮区（van-action-bar：根据订单状态显示不同按钮组合：待处理显示确认接单+拒单+拒单原因picker，已确认显示开始配送+取消订单，配送中显示完成配送，已完成显示查看售后）。操作确认弹窗（van-dialog：确认接单/确认拒单/确认完成等二次确认）。调用 `/api/admin/order-center/channel-orders/:id` 和 `/api/admin/order-routing/dispatch` 接口。扩展 `OrdersView.vue` 中的订单详情逻辑。

### 3. 商户端异常处理 - 异常订单识别+申诉
- **文件**：`merchant-mobile/src/views/OrderExceptionView.vue`（新建）、`merchant-mobile/src/views/OrderExceptionDetailView.vue`（新建）
- **关键字段**：异常列表（exceptionType/exceptionLevel/exceptionDetail/handleStatus/createdAt）、异常详情（异常类型+级别+详情+关联订单）、申诉入口（申诉原因+申诉说明+图片上传）、处理状态（待处理/处理中/已解决/已关闭）
- **说明**：实现商户移动端异常订单处理页面，入口在订单列表页顶部异常提醒横幅（van-notice-bar：显示异常订单数，点击进入异常列表）。异常列表页（van-list下拉刷新+上拉加载更多，每个van-cell卡片：异常级别图标+颜色标签：WARNING黄色/ERROR橙色/CRITICAL红色、订单号、渠道van-tag、异常类型van-tag：缺货/取消/退款/超时/配送失败/支付失败、异常详情摘要、处理状态van-tag、创建时间），筛选（van-dropdown-menu：异常类型/异常级别/处理状态），点击进入异常详情。异常详情页（异常基本信息van-cell-group：异常类型+级别+渠道+订单号+创建时间，异常详情van-cell：完整异常描述，关联订单信息van-cell-group：订单基本信息+商品明细+金额，处理记录van-steps时间线：待处理->处理中->已解决/已关闭），申诉入口（页面底部van-action-bar：申诉按钮，点击弹出申诉表单van-dialog：申诉原因van-field+申诉说明van-field type=textarea+图片上传van-uploader，提交申诉）。调用 `/api/admin/order-exception/list` 和 `/api/admin/order-exception/:id` 接口。

### 4. 商户端售后管理 - 售后申请+进度查询
- **文件**：`merchant-mobile/src/views/OrderAftersaleView.vue`（新建）、`merchant-mobile/src/views/OrderAftersaleDetailView.vue`（新建）
- **关键字段**：售后列表（aftersaleNo/channelOrderId/aftersaleType/reason/refundAmount/aftersaleStatus/createdAt）、售后详情（售后类型+原因+退款金额+商品信息+处理进度）、售后申请（订单选择+售后类型+原因+说明+图片上传）、物流信息（退货运单号+物流公司+物流状态）
- **说明**：实现商户移动端售后管理页面，入口在订单详情页底部售后按钮（仅已完成/已确认状态订单显示）。售后列表页（van-tabs：全部/待审核/已通过/已拒绝/已完成，van-list下拉刷新+上拉加载更多，每个van-cell卡片：售后单号+渠道van-tag+关联订单号+售后类型van-tag+原因摘要+退款金额+状态van-tag+创建时间），点击进入详情。售后详情页（售后基本信息van-cell-group：售后单号+类型+状态+渠道+创建时间，售后原因van-cell：原因+详细说明+图片展示van-image，退款信息van-cell-group：退款金额+退款方式+退款时间，商品信息van-card：商品名+规格+单价+数量+小计，物流信息van-cell-group：退货运单号+物流公司+物流状态，处理进度van-steps时间线）。售后申请页（从订单详情进入，表单：售后类型van-radio：仅退款/退货退款/换货/维修，售后原因van-field+详细说明van-field type=textarea+图片上传van-uploader+退款金额自动填充订单实付金额，提交申请van-button）。调用 `/api/admin/order-aftersale/list` 和 `/api/miniapp/aftersales` 接口（复用现有售后API，扩展全渠道支持）。整合现有售后相关逻辑到新页面。