import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/admin/product.controller";
import * as stockWarningController from "../controllers/admin/stock-warning.controller";

export const adminProductRouter = Router();

adminProductRouter.use(priceResponseFilter());

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
adminProductRouter.put("/products/:id/warning-threshold", requireAuthWithTenant, stockWarningController.updateWarningThreshold);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminProductRouter,
  auth: "requireAuthWithTenant",
};