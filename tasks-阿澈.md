# 阿澈 · 模块化开发任务

**日期**：2026-06-28
**分支**：main（c3ff2de）
**阶段**：模块化开发 — Phase 1

---

## 背景

`merchant-mobile/src/views/` 下有 20 个视图文件已写好但未在 `router.ts` 中注册路由，用户无法访问。需要在注册路由的同时完成联调验证。

---

## 模块1：采购模块接入 · 3天

**涉及文件**（7个）：
- `CreatePurchaseOrderView.vue` — 创建采购单
- `PurchaseOrderDetailView.vue` — 采购单详情
- `PurchaseOrdersView.vue` — 采购单列表
- `PurchaseReturnsView.vue` — 采购退货列表
- `CreatePurchaseReturnView.vue` — 创建采购退货
- `PurchaseStockView.vue` — 采购入库
- `PurchaseWarehousingView.vue` — 入库操作

**要求**：
- 在 `merchant-mobile/src/router.ts` 注册全部 7 个路由
- 验证每个页面的 API 调用通路正常（后端 `purchase.routes.ts` 已完备）
- 导航入口：首页增加「采购管理」卡片

---

## 模块2：销售退货 + 对账收款接入 · 3天

**涉及文件**（8个）：
- 退货：`CreateSaleReturnView.vue`、`SaleReturnDetailView.vue`、`SaleReturnView.vue`、`SaleReturnsView.vue`
- 对账：`CreateStatementView.vue`、`StatementDetailView.vue`、`StatementPaymentView.vue`、`StatementsView.vue`

**要求**：
- 在 `merchant-mobile/src/router.ts` 注册全部 8 个路由
- 验证 API 通路（后端 `sale-return.routes.ts`、`customer-statement.routes.ts`、`customer-payment.routes.ts` 已完备）
- 导航入口：首页增加「退货管理」「对账收款」卡片

---

## 模块3：客户详情 + 库存调整接入 · 2天

**涉及文件**（3个）：
- `CustomerDetailView.vue` — 客户详情
- `CustomerLedView.vue` — 客户台账
- `InventoryAdjustView.vue` — 库存调整

**要求**：
- 在 `merchant-mobile/src/router.ts` 注册全部 3 个路由
- 验证 API 通路
- 客户列表页点击跳转客户详情
- 库存页增加「库存调整」入口

---

## 模块4：功能中心 + 首页重构 · 2天

**涉及文件**（2个）：
- `FunctionCenterView.vue` — 功能中心
- `ProductsView.vue` — 商品浏览（已有扫码占位，改用 `wxScanQRCode`）

**要求**：
- 注册 `FunctionCenterView` 路由
- `ProductsView` 的扫码功能替换为 `wxScanQRCode`（参考 `CreateSaleView.vue` 已实现的方式）
- 首页布局优化：按模块分组（销售/采购/库存/退货/对账/客户），每个模块一个入口卡片

---

## 汇总

| 模块 | 内容 | 工期 |
|------|------|------|
| 采购模块 | 7个视图路由注册+联调 | 3天 |
| 退货+对账 | 8个视图路由注册+联调 | 3天 |
| 客户+库存 | 3个视图路由注册+联调 | 2天 |
| 功能中心+首页 | 2个视图+首页重构 | 2天 |

**总计：10天。20个视图已写，主要是路由注册+联调+首页重构。**