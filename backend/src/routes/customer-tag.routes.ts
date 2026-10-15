import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：落地码 = 台账 §三.2 建议码；页面 `customer-tags`
//（router/index.ts:153，roles = SUPER_ADMIN）持有 `*` ⇒ 零回归。
import { requirePermission } from "../middleware/rbac-auth";

import * as tagController from "../controllers/admin/customer-tag.controller";

export const customerTagRouter = Router();
customerTagRouter.get("/", tagController.listTags);
customerTagRouter.post("/", requirePermission("customer:create"), tagController.createTag);
customerTagRouter.put("/:id", requirePermission("customer:edit"), tagController.updateTag);
customerTagRouter.delete("/:id", requirePermission("customer:edit"), tagController.deleteTag);
customerTagRouter.post("/:id/tags", requirePermission("customer:create"), tagController.addCustomerTag);
customerTagRouter.delete("/:id/tags/:tagId", requirePermission("customer:edit"), tagController.removeCustomerTag);
customerTagRouter.get("/:id/profile", tagController.getCustomerProfile);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/tags",
  router: customerTagRouter,
  auth: "requireAuthWithTenant",
};
