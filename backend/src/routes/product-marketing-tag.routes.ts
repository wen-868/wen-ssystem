import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as productTagController from "../controllers/admin/product-marketing-tag.controller";

export const productMarketingTagRouter = Router();

// ========== 商品营销标签管理 ==========
// GET /api/admin/product-tags - 标签列表
productMarketingTagRouter.get("/", productTagController.listTags);

// POST /api/admin/product-tags - 创建标签
// S3-237（接线批 10 · 组 2「商品 A 类」）：2 行挂**既有**码 `goods:create` / `goods:edit`
// （`docs/migrations/079_权限矩阵.sql:200-201`）。两个页面（商品标签 `ProductTags.vue`、营销标签
// `MarketingTags.vue`；`router/index.ts:170` / `:221`）的 `meta.roles` 均含 **STORE_MANAGER** ⇒
// 店长经 **D1**（迁移 204 补 `goods:create|edit`）持有 ⇒ 无 403 回归。
productMarketingTagRouter.post("/", requirePermission("goods:create"), productTagController.createTag);

// PUT /api/admin/product-tags/:id - 更新标签
productMarketingTagRouter.put("/:id", requirePermission("goods:edit"), productTagController.updateTag);

// DELETE /api/admin/product-tags/:id - 删除标签
// ⚠️ S3-237 本批**不接**：删除需 `goods:delete`，D1 未授予店长（高风险）⇒ 挂码即把 `ProductTags.vue:156`
//   / `MarketingTags.vue:328` 的店长打成 403，按 D4「前端补门」处置，只登记。
productMarketingTagRouter.delete("/:id", productTagController.deleteTag);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/product-tags",
  router: productMarketingTagRouter,
  auth: "requireAuthWithTenant",
};
