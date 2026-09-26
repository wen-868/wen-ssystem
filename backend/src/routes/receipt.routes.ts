import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as receiptController from "../controllers/admin/receipt.controller";

export const receiptRouter = Router();
receiptRouter.post("/", receiptController.createReceipt);
receiptRouter.get("/", receiptController.listReceipts);
receiptRouter.get("/:receiptNo", receiptController.getReceiptDetail);
receiptRouter.post("/:receiptNo/writeoff", requirePermission("finance:payment"), receiptController.writeoffReceipt);
receiptRouter.post("/:receiptNo/void", receiptController.voidReceipt);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/receipts",
  router: receiptRouter,
  auth: "requireAuthWithTenant",
};
