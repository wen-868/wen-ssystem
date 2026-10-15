import { Router } from "express";
import multer from "multer";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";
import { PERM_GOODS_CREATE } from "../shared/goods-permission-codes";

import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/admin/product.controller";
import { uploadProductImage } from "../controllers/admin/product-image.controller";
import * as stockWarningController from "../controllers/admin/stock-warning.controller";
import * as categoryController from "../controllers/admin/category.controller";

export const adminProductRouter = Router();

adminProductRouter.use(priceResponseFilter());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname || "")) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error("请上传 jpg/png/gif/webp 图片"), { statusCode: 400 }));
    }
  },
});

// ============ 商品管理 ============
// 注意：/products/categories 必须在 /products/:spuId 之前注册，否则 "categories" 会被当作 spuId 参数
adminProductRouter.get("/products/categories", categoryController.listCategories);
adminProductRouter.get("/products", productController.listProducts);
adminProductRouter.post("/products/upload-image", upload.single("image"), uploadProductImage);
adminProductRouter.get("/products/:spuId(\\d+)", productController.getProductDetail);
// S3-142：手工建品补挂权限点（既有码 goods:create，079 权限矩阵 :201），未登录仍是 401、无权限 403
adminProductRouter.post("/products", requirePermission(PERM_GOODS_CREATE), productController.createProduct);
// S3-220（商品域接线 · B2 批 3）：以下 3 行按派单卡 §二 接线，挂**既有**码 `goods:edit`
// （`docs/migrations/079_权限矩阵.sql:202`）。逐条「真实使用者 ⊇ 码持有者」核对与
// 「其余 42 行为何不接」见 `docs/tasks/cards/R101-S3-220-阿坚-回传.md` 与缺口清单 §十二。
adminProductRouter.put("/products/:id/status", requirePermission("goods:edit"), productController.updateProductStatus);
adminProductRouter.put("/products/:id", productController.updateProduct);
adminProductRouter.put("/products/:id/disable", requirePermission("goods:edit"), productController.disableProduct);
adminProductRouter.get("/products/:skuId/price-history", productController.getProductPriceHistory);
adminProductRouter.put("/products/:skuId/price", productController.updateProductPrice);
adminProductRouter.put("/products/skus/:skuId/barcode", productController.updateSkuBarcode);
adminProductRouter.put("/products/skus/:skuId", productController.updateSku);
adminProductRouter.post("/products/skus/:skuId/units", productController.addSkuUnit);
adminProductRouter.put("/products/skus/:skuId/units/:unitId", productController.updateSkuUnit);
adminProductRouter.delete("/products/skus/:skuId/units/:unitId", productController.deleteSkuUnit);
adminProductRouter.post("/products/import", productController.importProducts);
adminProductRouter.put("/products/:spuId/marketing-tags", productController.setMarketingTags);
adminProductRouter.put("/products/:id/warning-threshold", requirePermission("goods:edit"), stockWarningController.updateWarningThreshold);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminProductRouter,
  auth: "requireAuthWithTenant",
};
