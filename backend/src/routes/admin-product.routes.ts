import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as productController from "../controllers/admin/product.controller.js";

export const adminProductRouter = Router();

// ============ 商品管理 ============
adminProductRouter.get("/products", requireAuthWithTenant, productController.listProducts);
adminProductRouter.get("/products/:spuId", requireAuthWithTenant, productController.getProductDetail);
adminProductRouter.post("/products", requireAuthWithTenant, productController.createProduct);
adminProductRouter.put("/products/:id/status", requireAuthWithTenant, productController.updateProductStatus);
adminProductRouter.put("/products/:id", requireAuthWithTenant, productController.updateProduct);
adminProductRouter.put("/products/:id/disable", requireAuthWithTenant, productController.disableProduct);
adminProductRouter.get("/products/:skuId/price-history", requireAuthWithTenant, productController.getProductPriceHistory);
adminProductRouter.put("/products/:skuId/price", requireAuthWithTenant, productController.updateProductPrice);
adminProductRouter.post("/products/import", requireAuthWithTenant, productController.importProducts);
adminProductRouter.put("/products/:spuId/marketing-tags", requireAuthWithTenant, productController.setMarketingTags);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminProductRouter,
  auth: "none",
};