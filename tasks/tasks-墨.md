# 墨 · 财务往来模块 · 管理后台

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 收款管理页面 | P0 | ❌ |
| 2 | 付款管理页面 | P0 | ❌ |
| 3 | 应收应付汇总页面 | P0 | ❌ |
| 4 | 费用管理页面 | P0 | ❌ |
| 5 | 对账中心页面 | P0 | ❌ |
| 6 | 老板财务驾驶舱页面 | P0 | ❌ |

---

## 详细说明

### 1. 收款管理页面
- **文件**：新建 `admin-web/src/views/ReceiptsView.vue`
- **功能**：
  - 收款单列表（单号/客户/金额/收款方式/日期/状态）
  - 筛选：客户/日期范围/状态/收款方式
  - 新建收款单弹窗（选择客户→自动加载应收列表→输入收款金额→选择支付方式+银行账户）
  - 核销应收弹窗（勾选应收记录+输入核销金额）
  - 收款单详情（含核销明细列表）
  - 作废操作
- **API**：`fetchReceipts`、`createReceipt`、`getReceiptDetail`、`writeoffReceipt`、`voidReceipt`
- **路由**：`/finance/receipts`

### 2. 付款管理页面
- **文件**：新建 `admin-web/src/views/PaymentsNewView.vue`
- **功能**：
  - 付款单列表（单号/供应商/金额/类型/付款方式/日期/状态）
  - 筛选：供应商/类型(采购/费用/其他)/日期范围/状态
  - 新建付款单弹窗（选择供应商→自动加载应付列表→输入付款金额→选择支付方式+银行账户）
  - 核销应付弹窗
  - 付款单详情（含核销明细）
  - 作废操作
- **API**：`fetchPaymentsNew`、`createPaymentNew`、`getPaymentDetail`、`writeoffPayment`、`voidPayment`
- **路由**：`/finance/payments`

### 3. 应收应付汇总页面
- **文件**：新建 `admin-web/src/views/ReceivablesPayables.vue`
- **功能**：
  - Tab切换应收/应付
  - 应收汇总：顶部卡片（总额/已收/未收/逾期金额）、客户排行柱状图（ECharts）、账龄分析饼图（ECharts，0-30/30-60/60-90/90+天）、应收明细表（客户/单据/金额/已收/余额/逾期天数）
  - 应付汇总：对称设计，供应商维度
  - 日期范围筛选
  - 点击客户/供应商跳转对账详情
- **API**：`fetchReceivablesSummary`、`fetchPayablesSummary`、`fetchReceivablesAging`、`fetchPayablesAging`
- **路由**：`/finance/receivables-payables`

### 4. 费用管理页面
- **文件**：新建 `admin-web/src/views/ExpensesView.vue`
- **功能**：
  - 费用列表（单号/类型/分类/金额/收款方/日期/状态）
  - 筛选：类型/分类/日期范围/状态
  - 新建费用弹窗（类型：日常/差旅/办公/运输/其他，分类，金额，收款方，支付方式，银行账户，发票号，日期，备注）
  - 审批流程按钮（待审批→审批通过/驳回）
  - 作废操作
  - 费用汇总统计（按月/按分类，ECharts柱状图+饼图）
- **API**：`fetchExpenses`、`createExpense`、`getExpenseDetail`、`updateExpense`、`approveExpense`、`voidExpense`、`fetchExpenseSummary`
- **路由**：`/finance/expenses`

### 5. 对账中心页面
- **文件**：新建 `admin-web/src/views/ReconciliationView.vue`
- **功能**：
  - Tab切换客户对账/供应商对账
  - 客户对账列表（客户/期初余额/本期应收/本期收款/期末余额/状态）
  - 对账详情弹窗（表头：日期/单据号/摘要/应收/收款/余额，底部合计行，确认对账按钮）
  - 确认对账后状态变为"已确认"并锁定
  - 供应商对账对称设计
  - 日期范围筛选（默认本月）
  - 导出对账单
- **API**：`fetchCustomerReconciliation`、`fetchCustomerReconciliationDetail`、`confirmCustomerReconciliation`、`fetchSupplierReconciliation`、`fetchSupplierReconciliationDetail`、`confirmSupplierReconciliation`
- **路由**：`/finance/reconciliation`

### 6. 老板财务驾驶舱页面
- **文件**：新建 `admin-web/src/views/FinanceDashboard.vue`
- **功能**：
  - 顶部4个概要卡片（本月收入/本月支出/应收余额/应付余额，含环比箭头）
  - 现金流趋势图（ECharts双折线：收入/支出，近12月）
  - 利润趋势图（ECharts三线：收入/支出/利润，近12月）
  - 应收TOP5客户横向柱状图
  - 应付TOP5供应商横向柱状图
  - 费用分类占比饼图
  - 本月资金日报表（日期/收入/支出/余额）
  - 日期范围切换（本月/本季/本年）
- **API**：`fetchFinanceDashboard`、`fetchCashFlow`、`fetchProfitTrend`、`fetchTopCustomersAR`、`fetchTopSuppliersAP`、`fetchDailyReport`
- **路由**：`/finance/dashboard`，设置为首选首页入口