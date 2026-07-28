import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { storageGuard } from "../middleware/storage-guard";
import * as purchaseContractController from "../controllers/admin/purchase-contract.controller";

export const purchaseContractRouter = Router();

purchaseContractRouter.get("/", purchaseContractController.listPurchaseContracts);
purchaseContractRouter.post("/", purchaseContractController.createPurchaseContract);
purchaseContractRouter.put("/:contractNo", purchaseContractController.updatePurchaseContract);
purchaseContractRouter.delete("/:contractNo", purchaseContractController.deletePurchaseContract);
purchaseContractRouter.post("/:contractNo/upload", storageGuard(), purchaseContractController.uploadContractFile);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-contracts",
  router: purchaseContractRouter,
  auth: "requireAuthWithTenant",
};
