# 苏然 · 财务往来模块 · 测试与DAO层

**日期**：2026-06-30
**状态**：待开始（客户管理 Phase 7 测试并行中）

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 收款单 DAO + 单元测试 | P0 | ❌ |
| 2 | 付款单 DAO + 单元测试 | P0 | ❌ |
| 3 | 应收应付 DAO + 单元测试 | P0 | ❌ |
| 4 | 费用管理 DAO + 单元测试 | P0 | ❌ |
| 5 | 对账中心 DAO + 集成测试 | P0 | ❌ |
| 6 | 财务驾驶舱 DAO + 集成测试 | P0 | ❌ |

---

## 详细说明

### 1. 收款单 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/receipt.dao.ts`
- **DAO 方法**：CRUD for receipt/receipt_writeoff，核销事务（收款+更新应收余额+核销记录原子操作），自动生成应收（销售单创建时触发）
- **测试文件**：`backend/src/__tests__/receipt.test.ts`
- **测试用例**：收款单创建/核销/作废/余额一致性验证/事务回滚

### 2. 付款单 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/payment-new.dao.ts`
- **DAO 方法**：CRUD for payment/payment_writeoff，核销事务，自动生成应付（采购入库时触发）
- **测试文件**：`backend/src/__tests__/payment-new.test.ts`
- **测试用例**：付款单创建/核销/作废/余额一致性验证/事务回滚

### 3. 应收应付 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/receivable-payable.dao.ts`
- **DAO 方法**：应收汇总查询（按客户/门店/时间/状态）、应付汇总查询、账龄分析（分段统计）、明细查询
- **测试文件**：`backend/src/__tests__/receivable-payable.test.ts`
- **测试用例**：应收汇总准确性/账龄分段正确性/应付汇总准确性/分页查询

### 4. 费用管理 DAO + 单元测试
- **DAO 文件**：`backend/src/daos/expense.dao.ts`
- **DAO 方法**：CRUD for expense，审批流程，费用汇总（按月/按分类），费用统计
- **测试文件**：`backend/src/__tests__/expense.test.ts`
- **测试用例**：费用CRUD/审批流程/费用汇总准确性/分类统计

### 5. 对账中心 DAO + 集成测试
- **DAO 文件**：`backend/src/daos/reconciliation.dao.ts`
- **DAO 方法**：客户对账查询（期初+本期应收+本期收款+期末余额计算）、供应商对账查询、对账确认（锁定对账期间）
- **测试文件**：`backend/src/__tests__/reconciliation.test.ts`
- **测试用例**：期初期末计算准确性/对账明细完整性/确认锁定逻辑/跨期间对账

### 6. 财务驾驶舱 DAO + 集成测试
- **DAO 文件**：`backend/src/daos/finance-dashboard.dao.ts`
- **DAO 方法**：财务概览汇总、资金日报/月报聚合、现金流趋势、利润趋势、应收TOP客户、应付TOP供应商
- **测试文件**：`backend/src/__tests__/finance-dashboard.test.ts`
- **测试用例**：概览数据准确性/日报聚合正确性/趋势数据连续性/排名数据正确性