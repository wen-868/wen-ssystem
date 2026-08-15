import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/store/product.controller";
import * as tagController from "../controllers/admin/tag.controller";
import * as batchController from "../controllers/inventory-batch.controller";
import * as memberController from "../controllers/store/member.controller";
import * as homeController from "../controllers/store/home.controller";

export const storeRouter = Router();

// 价格响应过滤（业务中间件，非认证中间件）
storeRouter.use(priceResponseFilter());

// 商品（独立文件未覆盖）
storeRouter.get("/products", productController.listProducts);
storeRouter.get("/product-categories", productController.getCategories);
storeRouter.get("/products/:spuId/tags", tagController.getProductTags);
storeRouter.get("/products/:spuId/batches", batchController.listBatchesBySpu);
storeRouter.get("/products/:spuId", productController.getProductDetail);
storeRouter.get("/members", productController.listMembers);
// R100-04 会员详情/积分/明细/订单（/members/:id 需在 /members 之后注册）
storeRouter.get("/members/:id(\\d+)", memberController.getMemberDetail);
storeRouter.get("/members/:id(\\d+)/points", memberController.getMemberPoints);
storeRouter.get("/members/:id(\\d+)/points/logs", memberController.getMemberPointsLogs);
storeRouter.get("/members/:id(\\d+)/orders", memberController.getMemberOrders);

// 标签 & 批次（独立文件未覆盖）
storeRouter.get("/tags", tagController.listTags);
storeRouter.get("/tag-groups", tagController.listGroups);
storeRouter.get("/batches/:id", batchController.getBatchDetail);
storeRouter.get("/batches/:id/trace", batchController.getTraceChain);

// 小程序首页（banner/分类/活动/热搜）
storeRouter.get("/banners", homeController.getHomeBanners);
storeRouter.get("/categories", homeController.getHomeCategories);
storeRouter.get("/activities", homeController.getHomeActivities);
storeRouter.get("/search/hot", homeController.getHotSearches);

export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeRouter,
  auth: "requireAuthWithTenant",
};
