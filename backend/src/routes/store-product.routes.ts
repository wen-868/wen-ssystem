import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as productController from "../controllers/store/product.controller";
import * as tagController from "../controllers/admin/tag.controller";
import * as batchController from "../controllers/inventory-batch.controller";

export const storeProductRouter = Router();

storeProductRouter.use(requireAuthWithTenant);

// 产品
storeProductRouter.get("/products", productController.listProducts);
storeProductRouter.get("/product-categories", productController.getCategories);
storeProductRouter.get("/products/:spuId/tags", tagController.getProductTags);
storeProductRouter.get("/products/:spuId/batches", batchController.listBatchesBySpu);
storeProductRouter.get("/products/:spuId", productController.getProductDetail);

// 标签与批次（共用）
storeProductRouter.get("/tags", tagController.listTags);
storeProductRouter.get("/tag-groups", tagController.listGroups);
storeProductRouter.get("/batches/:id", batchController.getBatchDetail);
storeProductRouter.get("/batches/:id/trace", batchController.getTraceChain);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeProductRouter,
  auth: "none",
};