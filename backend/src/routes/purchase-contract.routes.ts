import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { storageGuard } from "../middleware/storage-guard";
import * as purchaseContractController from "../controllers/admin/purchase-contract.controller";

export const purchaseContractRouter = Router();

purchaseContractRouter.get("/", requireAuthWithTenant, purchaseContractController.listPurchaseContracts);
purchaseContractRouter.post("/", requireAuthWithTenant, purchaseContractController.createPurchaseContract);
purchaseContractRouter.put("/:contractNo", requireAuthWithTenant, purchaseContractController.updatePurchaseContract);
purchaseContractRouter.delete("/:contractNo", requireAuthWithTenant, purchaseContractController.deletePurchaseContract);
purchaseContractRouter.post("/:contractNo/upload", requireAuthWithTenant, storageGuard(), purchaseContractController.uploadContractFile);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-contracts",
  router: purchaseContractRouter,
  auth: "requireAuthWithTenant",
};
