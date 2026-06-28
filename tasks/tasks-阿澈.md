# 阿澈 · Phase 1 模块化开发任务

**日期**：2026-06-28
**分支**：main（9c503f0）
**状态**：⚠️ 4项全部未完成

---

## 背景

`merchant-mobile/src/views/` 下有 20 个视图文件已写好，但 `router.ts` 中一个都没注册。需要全部注册路由 + 联调验证 + 首页重构。

---

## 模块1：采购模块接入 · ❌ 未开始

**涉及文件**（7个）：
- `CreatePurchaseOrderView.vue`、`PurchaseOrderDetailView.vue`、`PurchaseOrdersView.vue`
- `PurchaseReturnsView.vue`、`CreatePurchaseReturnView.vue`
- `PurchaseStockView.vue`、`PurchaseWarehousingView.vue`

**要求**：在 `router.ts` 注册全部 7 个路由，首页增加「采购管理」入口。

---

## 模块2：销售退货 + 对账收款 · ❌ 未开始

**涉及文件**（8个）：
- 退货：`CreateSaleReturnView.vue`、`SaleReturnDetailView.vue`、`SaleReturnsView.vue`
- 对账：`CreateStatementView.vue`、`StatementDetailView.vue`、`StatementPaymentView.vue`、`StatementsView.vue`

**注意**：`SaleReturnView.vue`（单数）文件不存在，无需注册。

**要求**：在 `router.ts` 注册全部 7 个路由，首页增加「退货管理」「对账收款」入口。

---

## 模块3：客户详情 + 库存调整 · ❌ 未开始

**涉及文件**（3个）：
- `CustomerDetailView.vue`、`CustomerLedView.vue`、`InventoryAdjustView.vue`

**要求**：在 `router.ts` 注册全部 3 个路由。客户列表页点击跳转详情，库存页增加调整入口。

---

## 模块4：功能中心 + 首页重构 · ❌ 未开始

**涉及文件**：
- `FunctionCenterView.vue` — 注册路由
- `HomeView.vue` — 按模块分组重构（销售/采购/库存/退货/对账/客户）

**要求**：首页改为模块化入口，每个模块一个卡片，点击进入对应功能列表。

---

## 汇总

| 模块 | 路由数 | 状态 |
|------|--------|------|
| 采购模块 | 7 | ❌ |
| 退货+对账 | 7 | ❌ |
| 客户+库存 | 3 | ❌ |
| 功能中心+首页 | 1路由+重构 | ❌ |

**0/4 完成。视图文件已存在，主要是路由注册+联调+首页重构。**