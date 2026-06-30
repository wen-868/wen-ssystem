# 阿坚 · 财务往来模块 · 后端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | DDL：收款单/付款单/应收应付表 | P0 | ❌ |
| 2 | DDL：银行账户/费用/票据表 | P1 | ❌ |
| 3 | 收款管理 API（收款单/核销应收） | P0 | ❌ |
| 4 | 付款管理 API（付款单/核销应付） | P0 | ❌ |
| 5 | 应收应付汇总 API | P0 | ❌ |
| 6 | 费用管理 API | P0 | ❌ |
| 7 | 对账中心 API（客户对账/供应商对账） | P0 | ❌ |
| 8 | 老板财务驾驶舱 API（资金日报/月报） | P0 | ❌ |

---

## 详细说明

### 1. DDL：收款单/付款单/应收应付表
- **receipt**：`id, receipt_no, customer_id, customer_name, receipt_type(SALE/OTHER), amount, payment_method, bank_account_id, received_date, status, remark, operator_id, tenant_id, created_at, updated_at`
- **receipt_writeoff**：`id, receipt_id, receivable_id, writeoff_amount, tenant_id, created_at`
- **payment**：`id, payment_no, supplier_id, supplier_name, payment_type(PURCHASE/EXPENSE/OTHER), amount, payment_method, bank_account_id, paid_date, status, remark, operator_id, tenant_id, created_at, updated_at`
- **payment_writeoff**：`id, payment_id, payable_id, writeoff_amount, tenant_id, created_at`
- **receivable**：`id, customer_id, customer_name, source_type, source_no, receivable_amount, received_amount, balance, due_date, status, tenant_id, created_at, updated_at`
- **payable**：`id, supplier_id, supplier_name, source_type, source_no, payable_amount, paid_amount, balance, due_date, status, tenant_id, created_at, updated_at`
- **文件**：`docs/migrations/add_receipt_payment.sql`

### 2. DDL：银行账户/费用/票据表
- **bank_account**：`id, account_name, bank_name, account_no, account_type, balance, status, tenant_id, created_at, updated_at`
- **expense**：`id, expense_no, expense_type, category, amount, payee, payment_method, bank_account_id, invoice_no, expense_date, status, remark, operator_id, tenant_id, created_at, updated_at`
- **invoice**：`id, invoice_no, invoice_type(IN/OUT), related_type, related_no, amount, tax_rate, tax_amount, issue_date, issuer, status, tenant_id, created_at`
- **文件**：`docs/migrations/add_bank_expense_invoice.sql`

### 3. 收款管理 API
- `POST /api/admin/receipts` — 创建收款单
- `GET /api/admin/receipts` — 收款单列表
- `GET /api/admin/receipts/:receiptNo` — 收款单详情
- `POST /api/admin/receipts/:receiptNo/writeoff` — 核销应收（关联应收记录）
- `POST /api/admin/receipts/:receiptNo/void` — 作废收款单
- 自动生成应收：销售单创建时自动生成应收记录
- **文件**：`backend/src/services/admin/receipt.service.ts`、`backend/src/routes/receipt.routes.ts`

### 4. 付款管理 API
- `POST /api/admin/payments` — 创建付款单
- `GET /api/admin/payments` — 付款单列表（区分类型：采购付款/费用付款/其他）
- `GET /api/admin/payments/:paymentNo` — 付款单详情
- `POST /api/admin/payments/:paymentNo/writeoff` — 核销应付
- `POST /api/admin/payments/:paymentNo/void` — 作废付款单
- 自动生成应付：采购单入库时自动生成应付记录
- **文件**：`backend/src/services/admin/payment-new.service.ts`（注意与现有 payment.service.ts 区分）、`backend/src/routes/payment-new.routes.ts`

### 5. 应收应付汇总 API
- `GET /api/admin/receivables` — 应收汇总（按客户/按门店/按时间）
- `GET /api/admin/payables` — 应付汇总（按供应商/按时间）
- `GET /api/admin/receivables/aging` — 应收账款账龄分析（0-30天/30-60天/60-90天/90天+）
- `GET /api/admin/payables/aging` — 应付账款账龄分析
- `GET /api/admin/receivables/:id/detail` — 应收明细
- `GET /api/admin/payables/:id/detail` — 应付明细
- **文件**：`backend/src/services/admin/receivable.service.ts`、合并到 `backend/src/routes/admin.routes.ts`（或新建 receivable.routes.ts）

### 6. 费用管理 API
- `POST /api/admin/expenses` — 登记费用
- `GET /api/admin/expenses` — 费用列表
- `GET /api/admin/expenses/:expenseNo` — 费用详情
- `PUT /api/admin/expenses/:expenseNo` — 编辑费用
- `POST /api/admin/expenses/:expenseNo/approve` — 审批费用
- `POST /api/admin/expenses/:expenseNo/void` — 作废费用
- `GET /api/admin/expenses/summary` — 费用汇总（按分类/按时间）
- **文件**：`backend/src/services/admin/expense.service.ts`、`backend/src/routes/expense.routes.ts`

### 7. 对账中心 API
- `GET /api/admin/reconciliation/customer` — 客户对账列表（含期初/本期应收/本期收款/期末余额）
- `GET /api/admin/reconciliation/customer/:customerId` — 客户对账详情（含明细行）
- `POST /api/admin/reconciliation/customer/:customerId/confirm` — 确认对账
- `GET /api/admin/reconciliation/supplier` — 供应商对账列表
- `GET /api/admin/reconciliation/supplier/:supplierId` — 供应商对账详情
- `POST /api/admin/reconciliation/supplier/:supplierId/confirm` — 确认对账
- **文件**：`backend/src/services/admin/reconciliation.service.ts`、`backend/src/routes/reconciliation.routes.ts`

### 8. 老板财务驾驶舱 API
- `GET /api/admin/finance/dashboard` — 财务概览（本月收入/支出/应收/应付/利润）
- `GET /api/admin/finance/daily-report` — 资金日报（按日期汇总收支）
- `GET /api/admin/finance/monthly-report` — 资金月报（按月汇总收支）
- `GET /api/admin/finance/cash-flow` — 现金流趋势（近12月）
- `GET /api/admin/finance/profit-trend` — 利润趋势（近12月）
- `GET /api/admin/finance/top-customers-ar` — 应收TOP客户
- `GET /api/admin/finance/top-suppliers-ap` — 应付TOP供应商
- **文件**：`backend/src/services/admin/finance-dashboard.service.ts`、合并到 `backend/src/routes/admin.routes.ts`