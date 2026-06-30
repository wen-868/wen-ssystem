# 阿坚 · 采购管理模块 · 后端

**日期**：2026-06-30
**状态**：✅ 4/4 全部完成

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 供应商对账 — API | P0 | ✅ |
| 2 | 采购报表 — 排名/趋势 API | P1 | ✅ |
| 3 | 采购计划 — 智能补货建议 | P1 | ✅ |
| 4 | 采购合同 — DDL + CRUD | P1 | ✅ |

---

## 交付物清单

| 文件 | 行数 | 说明 |
|------|:---:|------|
| supplier-statement.service.ts | 204 | 对账生成(汇总purchase_order/payment/return)+CRUD+确认/争议 |
| supplier-statement.controller.ts | 40 | 对账控制器 |
| supplier-statement.routes.ts | 11 | 对账路由 |
| purchase-plan.service.ts | 178 | 智能补货建议(安全库存+月均销量+在途量)+采购计划CRUD+转采购订单 |
| purchase-plan.controller.ts | 35 | 采购计划控制器 |
| purchase-plan.routes.ts | 10 | 采购计划路由 |
| purchase-contract.service.ts | 112 | 合同CRUD+文件上传 |
| purchase-contract.controller.ts | 43 | 合同控制器 |
| purchase-contract.routes.ts | 11 | 合同路由 |
| add_purchase_plan.sql | 33 | purchase_plan + purchase_plan_item 表 DDL |
| add_purchase_contract.sql | 23 | purchase_contract 表 DDL |
| report.service.ts | +73 | 新增 getPurchaseSummary/getPurchaseTrend/getSupplierRanking |
| report.controller.ts | +30 | 新增对应 handler |
| admin.routes.ts | +5 | 新增3条采购报表路由 |
| server.ts | +6 | 注册3个新路由 |

**阿坚 Phase 5 全部4项交付。**