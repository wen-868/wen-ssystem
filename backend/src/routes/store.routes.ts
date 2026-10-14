import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/store/product.controller";
import * as tagController from "../controllers/admin/tag.controller";
import * as batchController from "../controllers/inventory-batch.controller";
import * as memberController from "../controllers/store/member.controller";
import * as homeController from "../controllers/store/home.controller";

/**
 * 价格响应过滤（业务中间件，非认证中间件）：原先挂在文件内唯一的 router 上（对所有子路径生效），
 * S3-195 拆分后**逐个子路由照旧挂上**，行为不变。
 */
function withPriceFilter(router: Router): Router {
  router.use(priceResponseFilter());
  return router;
}

// 商品
export const storeProductRouter = withPriceFilter(Router());
export const storeProductCategoryRouter = withPriceFilter(Router());
// 会员
export const storeMemberRouter = withPriceFilter(Router());
// 标签 & 批次
export const storeTagRouter = withPriceFilter(Router());
export const storeTagGroupRouter = withPriceFilter(Router());
export const storeBatchRouter = withPriceFilter(Router());
// 小程序首页（banner/分类/活动/热搜）
export const storeBannerRouter = withPriceFilter(Router());
export const storeCategoryRouter = withPriceFilter(Router());
export const storeActivityRouter = withPriceFilter(Router());
export const storeSearchRouter = withPriceFilter(Router());

// 商品（独立文件未覆盖）
storeProductRouter.get("/", productController.listProducts);
storeProductRouter.get("/:spuId/tags", tagController.getProductTags);
storeProductRouter.get("/:spuId/batches", batchController.listBatchesBySpu);
storeProductRouter.get("/:spuId", productController.getProductDetail);
storeProductCategoryRouter.get("/", productController.getCategories);
storeMemberRouter.get("/", productController.listMembers);
// 会员管理列表（统计 + 分页，设计稿 UI v1.2 会员管理页）
storeMemberRouter.get("/manage", memberController.listMemberManage);
// 会员维护（新增 / 编辑，会员管理页）
storeMemberRouter.post("/manage", memberController.createMemberManage);
storeMemberRouter.put("/:id(\\d+)", memberController.updateMemberManage);
// R100-04 会员详情/积分/明细/订单（/members/:id 需在 /members 之后注册）
storeMemberRouter.get("/:id(\\d+)", memberController.getMemberDetail);
storeMemberRouter.get("/:id(\\d+)/points", memberController.getMemberPoints);
storeMemberRouter.get("/:id(\\d+)/points/logs", memberController.getMemberPointsLogs);
storeMemberRouter.get("/:id(\\d+)/orders", memberController.getMemberOrders);

// 标签 & 批次（独立文件未覆盖）
storeTagRouter.get("/", tagController.listTags);
storeTagGroupRouter.get("/", tagController.listGroups);
storeBatchRouter.get("/:id", batchController.getBatchDetail);
storeBatchRouter.get("/:id/trace", batchController.getTraceChain);

// 小程序首页（banner/分类/活动/热搜）
storeBannerRouter.get("/", homeController.getHomeBanners);
storeCategoryRouter.get("/", homeController.getHomeCategories);
storeActivityRouter.get("/", homeController.getHomeActivities);
storeSearchRouter.get("/hot", homeController.getHotSearches);

// ========== 路由自动发现配置 ==========
// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ `app.use("/api/store", 认证+CSRF, router)` 会把整段
//   `/api/store/**`（含本文件不拥有的路径、以及根本不存在的子路径）先套上认证 + CSRF（实测
//   `POST /api/store/no-such-path` ⇒ 401 而非 404；`/api/store/members/register`、`/api/store/hardware/callbacks/*`
//   两条「不鉴权声明」（routeConfig 的 auth 取值为 none）的公开端点是否被拦，
//   原先取决于 auto-routes 的文件名挂载顺序）。
//   现按「只声明自己拥有的路径段」逐段收窄，对外 URL 逐字不变。
//   ⚠️ `/api/store/members` 与 member-register.routes.ts 共用（它拥有 /register、/sms-code 两条公开端点）：
//      该文件按文件名排序先挂载（member-register < store），两条公开端点先被它接走；本条已登记进
//      DUPLICATE_PREFIX_ALLOWLIST，并由 src/__tests__/routes/store-prefix-narrowing-s3-195.test.ts 锁死。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/products", router: storeProductRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/product-categories", router: storeProductCategoryRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/members", router: storeMemberRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/tags", router: storeTagRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/tag-groups", router: storeTagGroupRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/batches", router: storeBatchRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/banners", router: storeBannerRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/categories", router: storeCategoryRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/activities", router: storeActivityRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/search", router: storeSearchRouter, auth: "requireAuthWithTenant" },
];
