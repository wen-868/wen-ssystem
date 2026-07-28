import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as productBundleController from "../controllers/admin/product-bundle.controller";
import * as comboProductController from "../controllers/admin/combo-product.controller";

export const productBundleRouter = Router();

// ============ 套装管理 ============
productBundleRouter.get("/product-bundles", productBundleController.listProductBundles);
productBundleRouter.get("/product-bundles/stats", productBundleController.getProductBundleStats);
productBundleRouter.get("/product-bundles/:id", productBundleController.getProductBundleDetail);
productBundleRouter.post("/product-bundles", productBundleController.createProductBundle);
productBundleRouter.put("/product-bundles/:id", productBundleController.updateProductBundle);
productBundleRouter.delete("/product-bundles/:id", productBundleController.deleteProductBundle);
productBundleRouter.post("/product-bundles/:id/publish", productBundleController.publishProductBundle);
productBundleRouter.post("/product-bundles/:id/unpublish", productBundleController.unpublishProductBundle);

// ============ 组合品管理 ============
productBundleRouter.get("/combo-products", comboProductController.listComboProducts);
productBundleRouter.get("/combo-products/:id", comboProductController.getComboProductDetail);
productBundleRouter.post("/combo-products", comboProductController.createComboProduct);
productBundleRouter.put("/combo-products/:id", comboProductController.updateComboProduct);
productBundleRouter.delete("/combo-products/:id", comboProductController.deleteComboProduct);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: productBundleRouter,
  auth: "requireAuthWithTenant",
};
