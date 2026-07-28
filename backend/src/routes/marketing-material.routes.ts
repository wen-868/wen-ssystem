import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as materialController from "../controllers/admin/marketing-material.controller";

export const marketingMaterialRouter = Router();

// ==================== 营销素材库 (Admin) ====================
marketingMaterialRouter.post("/", materialController.createMaterial);
marketingMaterialRouter.get("/", materialController.listMaterials);
marketingMaterialRouter.get("/:id", materialController.getMaterialDetail);
marketingMaterialRouter.put("/:id", materialController.updateMaterial);
marketingMaterialRouter.delete("/:id", materialController.deleteMaterial);
marketingMaterialRouter.post("/:id/publish", materialController.publishMaterial);
marketingMaterialRouter.post("/:id/archive", materialController.archiveMaterial);
marketingMaterialRouter.get("/categories", materialController.getMaterialCategories);
marketingMaterialRouter.post("/categories", materialController.createMaterialCategory);
marketingMaterialRouter.put("/categories/:id", materialController.updateMaterialCategory);
marketingMaterialRouter.delete("/categories/:id", materialController.deleteMaterialCategory);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/materials",
  router: marketingMaterialRouter,
  auth: "requireAuthWithTenant",
};
