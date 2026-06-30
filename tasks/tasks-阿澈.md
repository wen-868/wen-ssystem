# 阿澈 · 财务往来模块 · 商户移动端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 收款记录页 | P0 | ❌ |
| 2 | 客户应收明细页 | P0 | ❌ |
| 3 | 费用登记页 | P1 | ❌ |
| 4 | 对账单页 | P0 | ❌ |

---

## 详细说明

### 1. 收款记录页
- **文件**：新建 `merchant-mobile/src/views/ReceiptListView.vue`
- **功能**：
  - 收款单列表（客户名称/金额/方式/日期/状态）
  - 筛选：客户/日期范围
  - 收款单详情（客户信息/金额/核销明细/备注）
  - 快速收款入口（选择客户→输入金额→选择方式→确认）
- **API**：`fetchReceipts`、`createReceipt`、`getReceiptDetail`
- **路由**：`/receipts`

### 2. 客户应收明细页
- **文件**：新建 `merchant-mobile/src/views/CustomerReceivableView.vue`
- **功能**：
  - 客户应收汇总卡片（总额/已收/未收/逾期）
  - 应收明细列表（单据号/日期/金额/已收/余额/逾期天数）
  - 逾期标记（红色标签）
  - 快速收款按钮（跳转收款页并预填客户）
- **API**：`fetchCustomerReceivables(customerId)`、`fetchReceivablesSummary(customerId)`
- **路由**：`/customer-receivables/:customerId`

### 3. 费用登记页
- **文件**：新建 `merchant-mobile/src/views/ExpenseCreateView.vue`
- **功能**：
  - 费用登记表单（类型/分类/金额/收款方/支付方式/备注/拍照上传发票）
  - 费用类型快捷选择（日常/差旅/办公/运输）
  - 拍照上传发票（调用手机相机）
  - 费用列表查看（最近30条）
- **API**：`createExpense`、`fetchExpenses`
- **路由**：`/expense-create`、`/expenses`

### 4. 对账单页
- **文件**：新建 `merchant-mobile/src/views/ReconciliationMobileView.vue`
- **功能**：
  - 对账单列表（客户/供应商/期初/本期/余额/状态）
  - 对账详情（日期/单据号/摘要/应收/收款/余额）
  - 确认对账按钮（确认后签名确认）
  - 日期范围选择
- **API**：`fetchCustomerReconciliation`、`fetchCustomerReconciliationDetail`、`confirmCustomerReconciliation`
- **路由**：`/reconciliation`、`/reconciliation/:customerId`