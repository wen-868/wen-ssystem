import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as receiptController from "../controllers/admin/receipt.controller.js";

export const receiptRouter = Router();
receiptRouter.post("/", requireAuthWithTenant, receiptController.createReceipt);
receiptRouter.get("/", requireAuthWithTenant, receiptController.listReceipts);
receiptRouter.get("/:receiptNo", requireAuthWithTenant, receiptController.getReceiptDetail);
receiptRouter.post("/:receiptNo/writeoff", requireAuthWithTenant, receiptController.writeoffReceipt);
receiptRouter.post("/:receiptNo/void", requireAuthWithTenant, receiptController.voidReceipt);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/receipts",
  router: receiptRouter,
  auth: "requireAuthWithTenant",
};
