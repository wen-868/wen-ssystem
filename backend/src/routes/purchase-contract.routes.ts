import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as purchaseContractController from "../controllers/admin/purchase-contract.controller.js";

export const purchaseContractRouter = Router();

purchaseContractRouter.get("/", requireAuthWithTenant, purchaseContractController.listPurchaseContracts);
purchaseContractRouter.post("/", requireAuthWithTenant, purchaseContractController.createPurchaseContract);
purchaseContractRouter.put("/:contractNo", requireAuthWithTenant, purchaseContractController.updatePurchaseContract);
purchaseContractRouter.delete("/:contractNo", requireAuthWithTenant, purchaseContractController.deletePurchaseContract);
purchaseContractRouter.post("/:contractNo/upload", requireAuthWithTenant, purchaseContractController.uploadContractFile);