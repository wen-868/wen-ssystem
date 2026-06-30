# 阿澈 · 数据报表模块 · 商户移动端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 商户端报表完善 | P0 | ❌ |
| 2 | 商户端收款分析 | P0 | ❌ |
| 3 | 商户端库存分析 | P0 | ❌ |
| 4 | 商户端客户分析 | P0 | ❌ |

---

## 详细说明

### 1. 商户端报表完善
- **文件**：完善 `merchant-mobile/src/views/ReportsView.vue`（当前仅2个tab页）
- **功能**：
  - 顶部日期切换：今日/昨日/本周/本月，默认今日
  - 底部Tab导航增加：经营概览/销售/库存/客户/财务/收款，共6个tab
  - **经营概览Tab**（已有基础，完善）：
    - 4个卡片：今日销售额/订单数/毛利/客单价，含环比箭头
    - 近7日销售趋势迷你折线图（v-charts或ECharts精简版）
    - 最近订单列表（5条）：单号/客户/金额/状态
  - **销售Tab**（新增）：
    - 日/周/月销售趋势折线图
    - 商品销售排行TOP10列表（商品名/销量/销售额）
    - 客户消费排行TOP10列表（客户名/消费金额）
    - 下拉刷新加载更多
  - **库存Tab**（新增）：跳转逻辑转到库存分析页，展示概览数据
  - **客户Tab**（新增）：跳转逻辑转到客户分析页，展示概览数据
  - **财务Tab**（新增）：
    - 本月收入/支出/利润3个卡片
    - 收支趋势折线图（近6月）
    - 费用分类饼图
  - **收款Tab**（新增）：跳转逻辑转到收款分析页，展示概览数据
  - 适配移动端：卡片式布局，触摸滑动切换Tab，下拉刷新
- **API**：`fetchBusinessOverview`、`fetchSalesTrend`、`fetchRecentOrders`、`fetchProductRanking`、`fetchCustomerRanking`、`fetchFinanceOverview`、`fetchFinanceTrend`、`fetchExpenseCategory`
- **路由**：`/reports`（现有路由保持不变）

### 2. 商户端收款分析
- **文件**：新建 `merchant-mobile/src/views/CollectionAnalysisView.vue`
- **功能**：
  - 日期筛选：本月/近30天/自定义
  - 收款总览卡片：累计收款/本月收款/待收金额/退款率，4个卡片横向排列
  - 收款趋势图：近30日收款金额折线图（移动端适配，小尺寸）
  - 渠道分布饼图：微信/支付宝/银行卡/现金/其他渠道收款占比
  - 待收列表：客户名/金额/到期日/状态（正常/逾期），逾期红色标记，支持按客户筛选
  - 收款记录列表：日期/客户/金额/渠道/状态，支持上拉加载更多（分页）
  - 收款记录详情：点击展开，显示收款单号/客户/金额/渠道/核销明细/备注
  - 下拉刷新
- **API**：`fetchCollectionSummary`、`fetchCollectionTrend`、`fetchChannelDistribution`、`fetchPendingReceivables`、`fetchReceiptList`
- **路由**：`/reports/collection`

### 3. 商户端库存分析
- **文件**：新建 `merchant-mobile/src/views/InventoryAnalysisView.vue`
- **功能**：
  - 库存概览卡片：库存总额/库存SKU数/呆滞品数量/周转天数，4个卡片
  - 库存预警列表：预警商品列表（商品名/库存量/库龄/预警等级），红/橙/黄标签分级，点击查看详情
  - 呆滞品列表：按库龄排序的呆滞品（商品名/品类/库存量/库龄），支持筛选预警等级
  - 库存价值排行TOP10：按库存金额排序的商品列表（商品名/库存金额/库存量）
  - 出入库记录：最近出库/入库记录列表（日期/商品名/数量/类型），支持分页
  - 安全库存预警：库存低于安全库存的商品列表（商品名/库存量/安全库存/缺口）
  - 下拉刷新
- **API**：`fetchInventoryOverview`、`fetchInventoryAlerts`、`fetchSlowMovingList`、`fetchInventoryValueRanking`、`fetchInventoryLogs`、`fetchSafetyStockAlerts`
- **路由**：`/reports/inventory`

### 4. 商户端客户分析
- **文件**：新建 `merchant-mobile/src/views/CustomerAnalysisView.vue`
- **功能**：
  - 客户概览卡片：客户总数/本月新增/活跃客户/流失客户，4个卡片
  - 客户贡献排行TOP20：客户名/消费金额/订单数/最近消费，支持按金额/订单数排序
  - 客户采购排行：按采购商品数量/金额排序的客户列表
  - 新客/老客分布：饼图展示新客（首次消费本月）/老客/流失客（超过90天未消费）占比
  - 客户详情：点击客户进入详情页，展示客户基本信息/消费记录列表/消费趋势迷你图
  - 客户搜索：支持按客户名/手机号搜索
  - 下拉刷新
- **API**：`fetchCustomerOverview`、`fetchCustomerContribution`、`fetchCustomerPurchaseRanking`、`fetchCustomerTypeDistribution`、`fetchCustomerDetail`、`fetchCustomerOrders`
- **路由**：`/reports/customers`、`/reports/customers/:customerId`