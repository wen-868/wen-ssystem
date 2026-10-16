import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as materialController from "../controllers/admin/marketing-material.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const marketingMaterialRouter = Router();

// ==================== 营销素材库 (Admin) ====================
// S3-226（第 43 项 B2 批 8 · 营销域接线）：营销素材库 8 条写端点挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `marketing/MarketingMaterial.vue:456/472/488`（页面 `router/index.ts:226` 角色 = SUPER_ADMIN）；
// 其余 5 条（改/删素材、发布/归档、删分类）全仓无页面调用点（`api/marketing.ts` 有封装但 `.vue` 零引用）；
// 生产持有 `marketing:create` ⊇ {SUPER_ADMIN} ⇒ 零回归（app-mobile / miniapp 零命中）。
marketingMaterialRouter.post("/", requirePermission("marketing:create"), materialController.createMaterial);
marketingMaterialRouter.get("/", materialController.listMaterials);
marketingMaterialRouter.get("/:id", materialController.getMaterialDetail);
marketingMaterialRouter.put("/:id", requirePermission("marketing:create"), materialController.updateMaterial);
marketingMaterialRouter.delete("/:id", requirePermission("marketing:create"), materialController.deleteMaterial);
marketingMaterialRouter.post("/:id/publish", requirePermission("marketing:create"), materialController.publishMaterial);
marketingMaterialRouter.post("/:id/archive", requirePermission("marketing:create"), materialController.archiveMaterial);
marketingMaterialRouter.get("/categories", materialController.getMaterialCategories);
marketingMaterialRouter.post("/categories", requirePermission("marketing:create"), materialController.createMaterialCategory);
marketingMaterialRouter.put("/categories/:id", requirePermission("marketing:create"), materialController.updateMaterialCategory);
marketingMaterialRouter.delete("/categories/:id", requirePermission("marketing:create"), materialController.deleteMaterialCategory);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/materials",
  router: marketingMaterialRouter,
  auth: "requireAuthWithTenant",
};
