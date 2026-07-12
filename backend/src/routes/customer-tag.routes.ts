import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as tagController from "../controllers/admin/customer-tag.controller";

export const customerTagRouter = Router();
customerTagRouter.get("/", requireAuthWithTenant, tagController.listTags);
customerTagRouter.post("/", requireAuthWithTenant, tagController.createTag);
customerTagRouter.put("/:id", requireAuthWithTenant, tagController.updateTag);
customerTagRouter.delete("/:id", requireAuthWithTenant, tagController.deleteTag);
customerTagRouter.post("/:id/tags", requireAuthWithTenant, tagController.addCustomerTag);
customerTagRouter.delete("/:id/tags/:tagId", requireAuthWithTenant, tagController.removeCustomerTag);
customerTagRouter.get("/:id/profile", requireAuthWithTenant, tagController.getCustomerProfile);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/tags",
  router: customerTagRouter,
  auth: "requireAuthWithTenant",
};
