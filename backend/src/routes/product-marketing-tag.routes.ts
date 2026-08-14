import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as productTagController from "../controllers/admin/product-marketing-tag.controller";

export const productMarketingTagRouter = Router();

// ========== 商品营销标签管理 ==========
// GET /api/admin/product-tags - 标签列表
productMarketingTagRouter.get("/", productTagController.listTags);

// POST /api/admin/product-tags - 创建标签
productMarketingTagRouter.post("/", productTagController.createTag);

// PUT /api/admin/product-tags/:id - 更新标签
productMarketingTagRouter.put("/:id", productTagController.updateTag);

// DELETE /api/admin/product-tags/:id - 删除标签
productMarketingTagRouter.delete("/:id", productTagController.deleteTag);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/product-tags",
  router: productMarketingTagRouter,
  auth: "requireAuthWithTenant",
};