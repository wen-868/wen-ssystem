# 墨 · 销售管理模块 · 管理后台

**日期**：2026-06-29
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 分享链接管理页面 | P0⭐⭐ | ❌ |
| 2 | 销售单生命状态可视化 | P0 | ❌ |
| 3 | 价格策略页面 | P1 | ❌ |
| 4 | 提成管理页面 | P1 | ❌ |
| 5 | 销售报表页面 | P1 | ❌ |

---

## 详细说明

### 1. 分享链接管理页面
- **文件**：新建 `admin-web/src/views/CollectionLinks.vue`
- **功能**：
  - 收款链接列表（单号/关联销售单/客户/金额/状态/渠道/创建时间/过期时间/浏览次数）
  - 批量生成：选择多张销售单，一键批量生成分享链接
  - 撤销链接：PENDING状态的链接可撤销
  - 复制链接：一键复制分享URL
  - 统计卡片：总链接数/已支付/待支付/已过期/已撤销
- **API**：`fetchCollectionLinks`、`batchCreateCollectionLinks`、`revokeCollectionLink`、`fetchCollectionStats`
- **路由**：`/sales/collection-links`

### 2. 销售单生命状态可视化
- **文件**：修改 `admin-web/src/views/SaleBills.vue`
- **功能**：
  - 状态标签增强：SHARED（已分享待支付）蓝色、OVERDUE（逾期）红色、PARTIAL（部分支付）橙色
  - 新增筛选：按收款状态筛选（SHARED/OVERDUE）
  - 详情抽屉新增"分享记录"区域：展示分享次数、分享时间、分享渠道
  - 详情抽屉新增"状态流转"时间线：创建→分享→支付→逾期→完成
- **API**：复用现有 `fetchSaleBills` + `fetchCollectionLinks`

### 3. 价格策略页面
- **文件**：新建 `admin-web/src/views/CustomerPrices.vue`
- **功能**：
  - 客户专属价格列表（客户/商品/标准价/专属价/有效期/状态）
  - 新增弹窗：客户选择器 + 商品搜索 + 专属价格输入 + 有效期
  - 批量设置：选择客户 + 选择多个商品 + 批量设置折扣率
  - 到期自动失效展示
- **API**：`fetchCustomerPrices`、`createCustomerPrice`、`updateCustomerPrice`、`deleteCustomerPrice`、`batchSetCustomerPrices`
- **路由**：`/sales/customer-prices`

### 4. 提成管理页面
- **文件**：新建 `admin-web/src/views/CommissionRules.vue` + `admin-web/src/views/CommissionRecords.vue`
- **功能**：
  - **规则管理**（CommissionRules.vue）：
    - 规则列表（名称/类型/配置/有效期/状态）
    - 规则表单：固定金额（每单X元）、固定比例（销售额X%）、阶梯提成（0-1万3%/1-5万5%/5万+8%）
  - **提成记录**（CommissionRecords.vue）：
    - 记录列表（员工/销售单号/金额/提成金额/规则/状态/结算时间）
    - 手动计算：选择日期范围，触发计算
    - 结算按钮：批量结算选中记录
    - 统计卡片：本月提成总额/已结算/未结算/人均
- **API**：`fetchCommissionRules`、`createCommissionRule`、`updateCommissionRule`、`deleteCommissionRule`、`fetchCommissionRecords`、`calculateCommission`、`settleCommission`
- **路由**：`/sales/commission-rules`、`/sales/commission-records`

### 5. 销售报表页面
- **文件**：新建 `admin-web/src/views/SalesReports.vue`
- **功能**：
  - 3个Tab：销售人员排名 / 商品销售排行 / 销售趋势
  - 销售人员排名：柱状图（销售额/毛利/订单数），可切换维度
  - 商品销售排行：表格（商品名称/销量/销售额/毛利/毛利率）+ 饼图（品类占比）
  - 销售趋势：折线图（按日/周/月切换），支持多门店对比
  - 筛选条件：日期范围、门店、人员
  - 使用 ECharts 图表
- **API**：`fetchSalesRanking`、`fetchProductRanking`、`fetchSalesTrend`
- **路由**：`/reports/sales`