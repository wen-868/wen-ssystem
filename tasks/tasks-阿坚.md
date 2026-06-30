# 阿坚 · 采购管理模块 · 后端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 供应商对账 — API | P0 | ❌ |
| 2 | 采购报表 — 排名/趋势 API | P1 | ❌ |
| 3 | 采购计划 — 智能补货建议 | P1 | ❌ |
| 4 | 采购合同 — DDL + CRUD | P1 | ❌ |

---

## 详细说明

### 1. 供应商对账 API
- **现状**：`supplier_statement` + `supplier_statement_item` 表已建，但无任何后端接口
- **需要**：
  - `POST /api/admin/supplier-statements/generate` — 按供应商+日期范围生成对账单（从 purchase_order 汇总采购金额、purchase_payment 汇总已付金额、purchase_return 汇总退货金额，计算 balance）
  - `GET /api/admin/supplier-statements` — 对账单列表（supplier_id/status/日期筛选）
  - `GET /api/admin/supplier-statements/:statementNo` — 对账单详情（含 items 明细）
  - `POST /api/admin/supplier-statements/:statementNo/confirm` — 确认对账（GENERATED → CONFIRMED）
  - `POST /api/admin/supplier-statements/:statementNo/dispute` — 标记争议（GENERATED → DISPUTED）
- **文件**：`backend/src/services/admin/supplier-statement.service.ts`、`backend/src/controllers/admin/supplier-statement.controller.ts`、`backend/src/routes/supplier-statement.routes.ts`
- **注册**：`server.ts` 中 `/api/admin/supplier-statements` 挂载

### 2. 采购报表 API
- **现状**：无
- **需要**：
  - `GET /api/admin/reports/purchase-summary` — 采购汇总（按供应商/品类/日期）
  - `GET /api/admin/reports/purchase-trend` — 采购趋势（按日/周/月）
  - `GET /api/admin/reports/supplier-ranking` — 供应商排名（采购金额/次数）
- **文件**：在 `backend/src/services/admin/report.service.ts` 和 `backend/src/controllers/admin/report.controller.ts` 中追加方法

### 3. 采购计划 — 智能补货建议
- **现状**：无
- **需要**：
  - DDL：`purchase_plan` 表（plan_no, supplier_id, store_id, plan_status, goods_amount, created_at）+ `purchase_plan_item` 表（plan_no, sku_id, suggest_qty, current_stock, safety_stock, monthly_avg_sales, reason）
  - `GET /api/admin/purchase-plans/suggest` — 智能补货建议（基于：安全库存阈值、近30天日均销量、当前库存、在途采购量，计算建议采购量）
  - `POST /api/admin/purchase-plans` — 从建议生成采购计划
  - `GET /api/admin/purchase-plans` — 采购计划列表
  - `POST /api/admin/purchase-plans/:planNo/convert` — 采购计划转为采购订单
- **文件**：`docs/migrations/add_purchase_plan.sql`、`backend/src/services/admin/purchase-plan.service.ts`、`backend/src/controllers/admin/purchase-plan.controller.ts`、`backend/src/routes/purchase-plan.routes.ts`

### 4. 采购合同 — DDL + CRUD
- **现状**：无
- **需要**：
  - DDL：`purchase_contract` 表（contract_no, supplier_id, contract_name, contract_type, total_amount, paid_amount, sign_date, start_date, end_date, status, file_url, remark）
  - `GET/POST/PUT/DELETE /api/admin/purchase-contracts` — 合同 CRUD
  - `POST /api/admin/purchase-contracts/:contractNo/upload` — 上传合同文件
- **文件**：`docs/migrations/add_purchase_contract.sql`、`backend/src/services/admin/purchase-contract.service.ts`、`backend/src/controllers/admin/purchase-contract.controller.ts`、`backend/src/routes/purchase-contract.routes.ts`