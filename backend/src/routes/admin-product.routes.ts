import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/admin/product.controller";
import * as stockWarningController from "../controllers/admin/stock-warning.controller";
import * as categoryController from "../controllers/admin/category.controller";

export const adminProductRouter = Router();

adminProductRouter.use(priceResponseFilter());

// ============ 商品管理 ============
// 注意：/products/categories 必须在 /products/:spuId 之前注册，否则 "categories" 会被当作 spuId 参数
adminProductRouter.get("/products/categories", categoryController.listCategories);
adminProductRouter.get("/products", productController.listProducts);
adminProductRouter.get("/products/:spuId(\\d+)", productController.getProductDetail);
adminProductRouter.post("/products", productController.createProduct);
adminProductRouter.put("/products/:id/status", productController.updateProductStatus);
adminProductRouter.put("/products/:id", productController.updateProduct);
adminProductRouter.put("/products/:id/disable", productController.disableProduct);
adminProductRouter.get("/products/:skuId/price-history", productController.getProductPriceHistory);
adminProductRouter.put("/products/:skuId/price", productController.updateProductPrice);
adminProductRouter.put("/products/skus/:skuId/barcode", productController.updateSkuBarcode);
adminProductRouter.put("/products/skus/:skuId", productController.updateSku);
adminProductRouter.post("/products/skus/:skuId/units", productController.addSkuUnit);
adminProductRouter.put("/products/skus/:skuId/units/:unitId", productController.updateSkuUnit);
adminProductRouter.delete("/products/skus/:skuId/units/:unitId", productController.deleteSkuUnit);
adminProductRouter.post("/products/import", productController.importProducts);
adminProductRouter.put("/products/:spuId/marketing-tags", productController.setMarketingTags);
adminProductRouter.put("/products/:id/warning-threshold", stockWarningController.updateWarningThreshold);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminProductRouter,
  auth: "requireAuthWithTenant",
};
