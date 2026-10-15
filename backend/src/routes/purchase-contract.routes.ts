import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { storageGuard } from "../middleware/storage-guard";
import { requirePermission } from "../middleware/rbac-auth";
import * as purchaseContractController from "../controllers/admin/purchase-contract.controller";

export const purchaseContractRouter = Router();

purchaseContractRouter.get("/", purchaseContractController.listPurchaseContracts);
purchaseContractRouter.post("/", requirePermission("purchase:create"), purchaseContractController.createPurchaseContract);
purchaseContractRouter.put("/:contractNo", requirePermission("purchase:create"), purchaseContractController.updatePurchaseContract);
purchaseContractRouter.delete("/:contractNo", requirePermission("purchase:create"), purchaseContractController.deletePurchaseContract);
purchaseContractRouter.post("/:contractNo/upload", requirePermission("purchase:create"), storageGuard(), purchaseContractController.uploadContractFile);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-contracts",
  router: purchaseContractRouter,
  auth: "requireAuthWithTenant",
};
