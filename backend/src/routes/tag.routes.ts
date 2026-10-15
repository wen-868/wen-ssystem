import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：本文件 7 条写端点落地码 = 台账 §三.2 建议码（customer:create / customer:edit）。
// 口径说明：本文件虽为「标签」模块（商品标签组/标签/商品标签关联），但台账把它归入客户域；
// 页面 `products/tag-groups`（:171）与 `products/tag-relation`（:172）/`products`（:165）的 `meta.roles`
// 均含 STORE_MANAGER，而生产店长**不持** `goods:create|edit`（只持 `goods:price`）⇒ 挂 `goods:*` 会 403 店长；
// `customer:create|edit` 是唯一同时满足「页面角色 ⊆ 持有人」的既有码，语义细化建议另立单（回执 §卡外观察 5）。
import { requirePermission } from "../middleware/rbac-auth";

import * as tagController from "../controllers/admin/tag.controller";

export const tagRouter = Router();

// ==================== 标签组管理 ====================

tagRouter.get("/tags/groups", tagController.listGroups);
tagRouter.post("/tags/groups", requirePermission("customer:create"), tagController.createGroup);
tagRouter.put("/tags/groups/:id", requirePermission("customer:edit"), tagController.updateGroup);
tagRouter.delete("/tags/groups/:id", requirePermission("customer:edit"), tagController.deleteGroup);

// ==================== 标签值管理 ====================

tagRouter.get("/tags", tagController.listTags);
tagRouter.post("/tags", requirePermission("customer:create"), tagController.createTag);
tagRouter.put("/tags/:id", requirePermission("customer:edit"), tagController.updateTag);
tagRouter.delete("/tags/:id", requirePermission("customer:edit"), tagController.deleteTag);

// ==================== 商品标签关联 ====================

tagRouter.get("/products/:spuId/tags", tagController.getProductTags);
tagRouter.put("/products/:spuId/tags", requirePermission("customer:edit"), tagController.setProductTags);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: tagRouter,
  auth: "requireAuthWithTenant",
};
