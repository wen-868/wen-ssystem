import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/store/product.controller";
import * as tagController from "../controllers/admin/tag.controller";
import * as batchController from "../controllers/inventory-batch.controller";

export const storeRouter = Router();

storeRouter.use(priceResponseFilter());
storeRouter.use(requireAuthWithTenant);

// 商品（独立文件未覆盖）
storeRouter.get("/products", productController.listProducts);
storeRouter.get("/product-categories", productController.getCategories);
storeRouter.get("/products/:spuId/tags", tagController.getProductTags);
storeRouter.get("/products/:spuId/batches", batchController.listBatchesBySpu);
storeRouter.get("/products/:spuId", productController.getProductDetail);
storeRouter.get("/members", productController.listMembers);

// 标签 & 批次（独立文件未覆盖）
storeRouter.get("/tags", tagController.listTags);
storeRouter.get("/tag-groups", tagController.listGroups);
storeRouter.get("/batches/:id", batchController.getBatchDetail);
storeRouter.get("/batches/:id/trace", batchController.getTraceChain);

export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeRouter,
  auth: "none",
};
