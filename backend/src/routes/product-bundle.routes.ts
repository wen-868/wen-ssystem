import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";
import * as productBundleController from "../controllers/admin/product-bundle.controller";
import * as comboProductController from "../controllers/admin/combo-product.controller";

export const productBundleRouter = Router();

// S3-220（商品域接线 · B2 批 3）：以下 8 行挂**既有**码 goods:create|edit|delete
// （`docs/migrations/079_权限矩阵.sql:201-203`）。全仓无页面调用点（`api/product.ts` 仅有封装、
// 无页面使用），故接线零回归；判定与证据见缺口清单 §十二与回传卡。

// ============ 套装管理 ============
productBundleRouter.get("/product-bundles", productBundleController.listProductBundles);
productBundleRouter.get("/product-bundles/stats", productBundleController.getProductBundleStats);
productBundleRouter.get("/product-bundles/:id", productBundleController.getProductBundleDetail);
productBundleRouter.post("/product-bundles", requirePermission("goods:create"), productBundleController.createProductBundle);
productBundleRouter.put("/product-bundles/:id", requirePermission("goods:edit"), productBundleController.updateProductBundle);
productBundleRouter.delete("/product-bundles/:id", requirePermission("goods:delete"), productBundleController.deleteProductBundle);
productBundleRouter.post("/product-bundles/:id/publish", requirePermission("goods:edit"), productBundleController.publishProductBundle);
productBundleRouter.post("/product-bundles/:id/unpublish", requirePermission("goods:edit"), productBundleController.unpublishProductBundle);

// ============ 组合品管理 ============
productBundleRouter.get("/combo-products", comboProductController.listComboProducts);
productBundleRouter.get("/combo-products/:id", comboProductController.getComboProductDetail);
productBundleRouter.post("/combo-products", requirePermission("goods:create"), comboProductController.createComboProduct);
productBundleRouter.put("/combo-products/:id", requirePermission("goods:edit"), comboProductController.updateComboProduct);
productBundleRouter.delete("/combo-products/:id", requirePermission("goods:delete"), comboProductController.deleteComboProduct);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: productBundleRouter,
  auth: "requireAuthWithTenant",
};
