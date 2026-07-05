import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as materialController from "../controllers/admin/marketing-material.controller.js";

export const marketingMaterialRouter = Router();

// ==================== 营销素材库 (Admin) ====================
marketingMaterialRouter.post("/", requireAuthWithTenant, materialController.createMaterial);
marketingMaterialRouter.get("/", requireAuthWithTenant, materialController.listMaterials);
marketingMaterialRouter.get("/:id", requireAuthWithTenant, materialController.getMaterialDetail);
marketingMaterialRouter.put("/:id", requireAuthWithTenant, materialController.updateMaterial);
marketingMaterialRouter.delete("/:id", requireAuthWithTenant, materialController.deleteMaterial);
marketingMaterialRouter.post("/:id/publish", requireAuthWithTenant, materialController.publishMaterial);
marketingMaterialRouter.post("/:id/archive", requireAuthWithTenant, materialController.archiveMaterial);
marketingMaterialRouter.get("/categories", requireAuthWithTenant, materialController.getMaterialCategories);
marketingMaterialRouter.post("/categories", requireAuthWithTenant, materialController.createMaterialCategory);
marketingMaterialRouter.put("/categories/:id", requireAuthWithTenant, materialController.updateMaterialCategory);
marketingMaterialRouter.delete("/categories/:id", requireAuthWithTenant, materialController.deleteMaterialCategory);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/materials",
  router: marketingMaterialRouter,
  auth: "requireAuthWithTenant",
};
