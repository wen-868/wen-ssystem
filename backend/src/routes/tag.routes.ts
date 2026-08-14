import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as tagController from "../controllers/admin/tag.controller";

export const tagRouter = Router();

// ==================== 标签组管理 ====================

tagRouter.get("/tags/groups", tagController.listGroups);
tagRouter.post("/tags/groups", tagController.createGroup);
tagRouter.put("/tags/groups/:id", tagController.updateGroup);
tagRouter.delete("/tags/groups/:id", tagController.deleteGroup);

// ==================== 标签值管理 ====================

tagRouter.get("/tags", tagController.listTags);
tagRouter.post("/tags", tagController.createTag);
tagRouter.put("/tags/:id", tagController.updateTag);
tagRouter.delete("/tags/:id", tagController.deleteTag);

// ==================== 商品标签关联 ====================

tagRouter.get("/products/:spuId/tags", tagController.getProductTags);
tagRouter.put("/products/:spuId/tags", tagController.setProductTags);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: tagRouter,
  auth: "requireAuthWithTenant",
};
