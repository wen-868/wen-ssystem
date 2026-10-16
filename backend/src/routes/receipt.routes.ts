import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as receiptController from "../controllers/admin/receipt.controller";

export const receiptRouter = Router();
// S3-233（B 类收编第一批 · 销售域）：创建收款单挂 `sale:create`。
// 依据门 = permission-gates.ts 的 `sale-receipt-sub`（开单页「收款单」子段的「确认收款」动作，
// `pages/sales/create-sale.vue:2202` → `api/modules/receipts.ts:54`）。收款动作按批 6 规则③取"覆盖收银员的码"：
// 生产在用持有 `sale:create` = 店长(`sale:*`)/操作员/销售员/超管/运营；财务（`finance:*`）不含收银员，故不取 finance 码。
// （B 类待裁前提——入口无条件可达——已由 S3-230 的入口权限门修复，本行据此收编。）
receiptRouter.post("/", requirePermission("sale:create"), receiptController.createReceipt);
receiptRouter.get("/", receiptController.listReceipts);
receiptRouter.get("/:receiptNo", receiptController.getReceiptDetail);
receiptRouter.post("/:receiptNo/writeoff", requirePermission("finance:payment"), receiptController.writeoffReceipt);
// S3-223（财务域接线 · B2 批 5）：作废收款单挂 079 既有按钮码 `finance:receipt:create`
//（`docs/migrations/079_权限矩阵.sql:213`，父菜单 50 `finance:receipt`）——台账建议码，语义为「收款动作」。
// 持有者（`--holders` 复算，生产实测同源）= 超管/运营（`*`）+ 财务（`finance:*`）；
// 使用者 = 桌面 `views/finance/ReceiptsView.vue:379`（页面 `router/index.ts:197` [SUPER_ADMIN]）
// + app-mobile 收款管理页 `pages-sub/finance/receipts/receipts.vue:121`（模块前缀 `finance`，
// `function-menu.ts:91` 菜单码 `finance:receipt`）⇒ 页面角色 ⊆ 持有人，零回归。
receiptRouter.post("/:receiptNo/void", requirePermission("finance:receipt:create"), receiptController.voidReceipt);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/receipts",
  router: receiptRouter,
  auth: "requireAuthWithTenant",
};
