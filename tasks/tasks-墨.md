# 墨 · 数据报表模块 · 管理后台

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 经营总览完善 | P0 | ❌ |
| 2 | 销售分析页面 | P0 | ❌ |
| 3 | 在线收款专项分析页面 | P0 | ❌ |
| 4 | 商品分析页面 | P0 | ❌ |
| 5 | 客户分析页面 | P0 | ❌ |
| 6 | 库存分析页面 | P0 | ❌ |

---

## 详细说明

### 1. 经营总览完善
- **文件**：完善 `admin-web/src/views/Reports.vue`
- **功能**：
  - 日期切换栏：今日/昨日/本周/本月/自定义日期范围，默认今日
  - 顶部4个概要卡片：今日销售额/今日订单数/今日毛利/客单价，每卡片含环比增长箭头（红色↑/绿色↓）和百分比
  - 销售趋势迷你图：近30日销售额/订单数双轴混合图（折线+柱状），使用ECharts
  - 时段销售对比：今日vs昨日按小时销售额对比柱状图（双色柱）
  - 门店排行：各门店销售额/订单数/毛利横向柱状图TOP10
  - 品类销售占比：饼图（ECharts）
  - 支付方式分布：饼图（ECharts）
  - 最近订单列表：最新10笔订单，显示单号/客户/金额/状态/时间
  - 自动刷新：每60秒自动刷新数据（可配置开关）
- **API**：`fetchBusinessOverview`、`fetchSalesTrend`、`fetchHourlySales`、`fetchStoreRanking`、`fetchCategoryDistribution`、`fetchPaymentDistribution`、`fetchRecentOrders`
- **路由**：`/reports`（现有路由保持不变）

### 2. 销售分析页面
- **文件**：新建 `admin-web/src/views/SalesAnalysis.vue`
- **功能**：
  - 日期筛选：预设日/周/月/自定义，门店筛选（多选）
  - 销售趋势折线图：销售额+订单数+客单价三线，支持日/周/月粒度切换，ECharts双Y轴
  - 时段热力图：横轴日期（近30天）×纵轴小时（0-23），颜色深浅表示销售额大小，ECharts heatmap
  - 商品销售排行TOP20：商品名/品类/销量/销售额/毛利/毛利率，支持按各列排序，支持导出
  - 客户消费排行TOP20：客户名/消费金额/订单数/客单价/最近消费，支持排序
  - 门店销售排行TOP10：门店名/销售额/订单数/毛利，柱状图+表格
  - 业务员销售排行TOP10：业务员名/销售额/订单数/毛利，柱状图+表格
  - 同期对比表：本期vs上期（销售额/订单数/客单价/毛利），含变化金额和百分比
  - 销售日报明细表：日期/销售额/订单数/客单价/退款金额/退款率，分页加载
- **API**：`fetchSalesTrend`、`fetchHourlyHeatmap`、`fetchProductRanking`、`fetchCustomerRanking`、`fetchStoreRanking`、`fetchStaffRanking`、`fetchYoYComparison`、`fetchDailySalesDetail`
- **路由**：`/reports/sales`

### 3. 在线收款专项分析页面
- **文件**：新建 `admin-web/src/views/CollectionAnalysis.vue`
- **功能**：
  - 日期/门店/渠道筛选
  - 收款总览卡片：累计收款总额/本月收款/今日收款/待收金额/退款率/平均收款周期，6个卡片
  - 收款漏斗图：ECharts funnel，分享数→查看数→支付数→支付成功数，每环节标注数量和转化率
  - 收款趋势图：近30日收款金额/笔数双轴折线图，支持按渠道拆分（每条渠道一条线）
  - 渠道分布饼图：微信/支付宝/银行卡/现金/其他，含金额和占比
  - 渠道转化率对比表：渠道/分享数/查看数/支付数/支付金额/转化率/占比，表格形式
  - 超时未付分析：超时订单列表（订单号/客户/金额/超时时长/创建时间），超时区间分布饼图（<30min/30-60min/1-2h/2-24h/24h+），超时率趋势折线图
  - 退款分析：退款金额/退款率趋势折线图，退款原因分类饼图
- **API**：`fetchCollectionSummary`、`fetchCollectionFunnel`、`fetchCollectionTrend`、`fetchChannelDistribution`、`fetchChannelConversion`、`fetchTimeoutAnalysis`、`fetchRefundAnalysis`
- **路由**：`/reports/collection`

### 4. 商品分析页面
- **文件**：完善 `admin-web/src/views/ReportsProducts.vue`（当前为占位页）
- **功能**：
  - 日期/品类/门店筛选
  - 商品概览卡片：SKU总数/动销SKU数/动销率/库存总额/库存周转天数
  - 畅销TOP20排行榜：商品名/品类/销量/销售额/毛利/毛利率，表格+柱状图可视化，支持排序切换（按销量/销售额/毛利）
  - 滞销预警列表：商品名/品类/库存量/最近30天销量/滞销天数/预警等级，预警等级用红（>90天）/橙（60-90天）/黄（30-60天）标签，支持筛选预警等级
  - 毛利排行：商品名/品类/销售额/成本/毛利/毛利率，支持正序/倒序切换，TOP20柱状图
  - 品类销售分析：各品类销售额/销量/毛利/占比，饼图+柱状图
  - 商品ABC分析：A类（前70%销售额）/B类（70-90%）/C类（90-100%），饼图展示三类SKU数和销售额占比
  - 新品表现：近30天上架新品销售额排行TOP10
- **API**：`fetchProductOverview`、`fetchProductRanking`、`fetchSlowMoving`、`fetchProfitRanking`、`fetchCategoryAnalysis`、`fetchABCAnalysis`、`fetchNewProductPerformance`
- **路由**：`/reports/products`

### 5. 客户分析页面
- **文件**：新建 `admin-web/src/views/CustomerAnalysis.vue`
- **功能**：
  - 日期/门店筛选
  - 客户概览卡片：客户总数/本月新增/活跃客户数/流失客户数/复购率
  - 客户贡献排行TOP20：客户名/累计消费金额/订单数/客单价/最近消费日期，表格+柱状图
  - 复购率趋势：按月统计复购率折线图（ECharts），近12月
  - 客单价分布：区间柱状图（<100/100-300/300-500/500-1000/1000-3000/3000+），展示各区间客户数和订单数
  - RFM分析：RFM分群结果表格（客户群体/客户数/消费金额/占比），散点图可视化（R-F、F-M两个维度可切换），支持点击分群查看客户明细
  - 新增客户趋势：按月新增客户数折线图，近12月
  - 流失客户预警：超过N天（可配置，默认90天）未消费客户列表，含流失趋势折线图
- **API**：`fetchCustomerOverview`、`fetchCustomerContribution`、`fetchRepurchaseTrend`、`fetchAvgOrderValueDistribution`、`fetchRFMAnalysis`、`fetchNewCustomerTrend`、`fetchLostCustomerAnalysis`
- **路由**：`/reports/customers`

### 6. 库存分析页面
- **文件**：完善 `admin-web/src/views/InventoryReports.vue`（当前为占位页）
- **功能**：
  - 日期/品类/门店/仓库筛选
  - 库存概览卡片：库存总额/库存总量（箱/瓶）/库存SKU数/呆滞品数量/平均周转天数
  - 库存周转天数趋势：近12月周转天数折线图（ECharts），含行业参考线
  - 库龄分布：按入库时间分段（<30天/30-60天/60-90天/90-180天/180天+）的库存金额/占比，堆叠柱状图+饼图
  - 呆滞品预警列表：商品名/品类/库存量/库龄/最近出库日期/预警等级（红>180天/橙90-180天/黄60-90天），支持筛选和导出
  - 库存价值排行TOP20：按库存金额排序，表格+柱状图
  - 出入库趋势：近30日入库/出库数量/金额双轴折线图
  - 安全库存预警：库存低于安全库存的商品列表，含库存量/安全库存量/缺口量
- **API**：`fetchInventoryOverview`、`fetchTurnoverTrend`、`fetchInventoryAging`、`fetchSlowMovingInventory`、`fetchInventoryValueRanking`、`fetchInOutTrend`、`fetchSafetyStockAlert`
- **路由**：`/reports/inventory`