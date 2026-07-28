import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/admin/product.controller";
import * as stockWarningController from "../controllers/admin/stock-warning.controller";

export const adminProductRouter = Router();

adminProductRouter.use(priceResponseFilter());

// ============ 商品管理 ============
adminProductRouter.get("/products", productController.listProducts);
adminProductRouter.get("/products/:spuId", productController.getProductDetail);
adminProductRouter.post("/products", productController.createProduct);
adminProductRouter.put("/products/:id/status", productController.updateProductStatus);
adminProductRouter.put("/products/:id", productController.updateProduct);
adminProductRouter.put("/products/:id/disable", productController.disableProduct);
adminProductRouter.get("/products/:skuId/price-history", productController.getProductPriceHistory);
adminProductRouter.put("/products/:skuId/price", productController.updateProductPrice);
adminProductRouter.post("/products/import", productController.importProducts);
adminProductRouter.put("/products/:spuId/marketing-tags", productController.setMarketingTags);
adminProductRouter.put("/products/:id/warning-threshold", stockWarningController.updateWarningThreshold);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminProductRouter,
  auth: "requireAuthWithTenant",
};