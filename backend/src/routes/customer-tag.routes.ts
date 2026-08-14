import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as tagController from "../controllers/admin/customer-tag.controller";

export const customerTagRouter = Router();
customerTagRouter.get("/", tagController.listTags);
customerTagRouter.post("/", tagController.createTag);
customerTagRouter.put("/:id", tagController.updateTag);
customerTagRouter.delete("/:id", tagController.deleteTag);
customerTagRouter.post("/:id/tags", tagController.addCustomerTag);
customerTagRouter.delete("/:id/tags/:tagId", tagController.removeCustomerTag);
customerTagRouter.get("/:id/profile", tagController.getCustomerProfile);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/tags",
  router: customerTagRouter,
  auth: "requireAuthWithTenant",
};
