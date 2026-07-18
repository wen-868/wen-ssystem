import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as productBundleController from "../controllers/admin/product-bundle.controller";
import * as comboProductController from "../controllers/admin/combo-product.controller";

export const productBundleRouter = Router();

// ============ 套装管理 ============
productBundleRouter.get("/product-bundles", requireAuthWithTenant, productBundleController.listProductBundles);
productBundleRouter.get("/product-bundles/stats", requireAuthWithTenant, productBundleController.getProductBundleStats);
productBundleRouter.get("/product-bundles/:id", requireAuthWithTenant, productBundleController.getProductBundleDetail);
productBundleRouter.post("/product-bundles", requireAuthWithTenant, productBundleController.createProductBundle);
productBundleRouter.put("/product-bundles/:id", requireAuthWithTenant, productBundleController.updateProductBundle);
productBundleRouter.delete("/product-bundles/:id", requireAuthWithTenant, productBundleController.deleteProductBundle);
productBundleRouter.post("/product-bundles/:id/publish", requireAuthWithTenant, productBundleController.publishProductBundle);
productBundleRouter.post("/product-bundles/:id/unpublish", requireAuthWithTenant, productBundleController.unpublishProductBundle);

// ============ 组合品管理 ============
productBundleRouter.get("/combo-products", requireAuthWithTenant, comboProductController.listComboProducts);
productBundleRouter.get("/combo-products/:id", requireAuthWithTenant, comboProductController.getComboProductDetail);
productBundleRouter.post("/combo-products", requireAuthWithTenant, comboProductController.createComboProduct);
productBundleRouter.put("/combo-products/:id", requireAuthWithTenant, comboProductController.updateComboProduct);
productBundleRouter.delete("/combo-products/:id", requireAuthWithTenant, comboProductController.deleteComboProduct);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: productBundleRouter,
  auth: "requireAuthWithTenant",
};
