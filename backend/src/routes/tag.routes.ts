import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as tagController from "../controllers/admin/tag.controller.js";

export const tagRouter = Router();

// ==================== 标签组管理 ====================

tagRouter.get("/tags/groups", requireAuthWithTenant, tagController.listGroups);
tagRouter.post("/tags/groups", requireAuthWithTenant, tagController.createGroup);
tagRouter.put("/tags/groups/:id", requireAuthWithTenant, tagController.updateGroup);
tagRouter.delete("/tags/groups/:id", requireAuthWithTenant, tagController.deleteGroup);

// ==================== 标签值管理 ====================

tagRouter.get("/tags", requireAuthWithTenant, tagController.listTags);
tagRouter.post("/tags", requireAuthWithTenant, tagController.createTag);
tagRouter.put("/tags/:id", requireAuthWithTenant, tagController.updateTag);
tagRouter.delete("/tags/:id", requireAuthWithTenant, tagController.deleteTag);

// ==================== 商品标签关联 ====================

tagRouter.get("/products/:spuId/tags", requireAuthWithTenant, tagController.getProductTags);
tagRouter.put("/products/:spuId/tags", requireAuthWithTenant, tagController.setProductTags);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: tagRouter,
  auth: "requireAuthWithTenant",
};
