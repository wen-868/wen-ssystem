import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as platformIntegrationController from "../controllers/instant-retail/platform-integration.controller";
import * as retailAdminController from "../controllers/admin/instant-retail.controller";

export const instantRetailAdminPlatformRouter = Router();

/* ────────────────────────────────────────────────────────────────────────────
 * 工作台 - 平台对接、门店配置、商品、分类、Banner
 * ──────────────────────────────────────────────────────────────────────────── */

// 平台对接
instantRetailAdminPlatformRouter.get("/platforms", platformIntegrationController.getPlatforms);
instantRetailAdminPlatformRouter.get("/configs", platformIntegrationController.getConfigs);
instantRetailAdminPlatformRouter.get("/configs/:platform", platformIntegrationController.getConfigByPlatform);
instantRetailAdminPlatformRouter.post("/configs", platformIntegrationController.upsertConfig);
instantRetailAdminPlatformRouter.post("/configs/:platform/test", platformIntegrationController.testConnection);
instantRetailAdminPlatformRouter.post("/configs/:platform/sync-orders", platformIntegrationController.syncOrders);
instantRetailAdminPlatformRouter.post("/configs/:platform/sync-products", platformIntegrationController.syncProducts);
instantRetailAdminPlatformRouter.delete("/configs/:platform", platformIntegrationController.deleteConfig);

// 门店配置
instantRetailAdminPlatformRouter.get("/shop-config", retailAdminController.getShopConfig);
instantRetailAdminPlatformRouter.post("/shop-config", retailAdminController.saveShopConfig);

// 零售分类
instantRetailAdminPlatformRouter.get("/categories", retailAdminController.listCategories);
instantRetailAdminPlatformRouter.post("/categories", retailAdminController.createCategory);
instantRetailAdminPlatformRouter.put("/categories/:id", retailAdminController.updateCategory);
instantRetailAdminPlatformRouter.delete("/categories/:id", retailAdminController.deleteCategory);

// 零售商品
instantRetailAdminPlatformRouter.get("/products", retailAdminController.listRetailProducts);
instantRetailAdminPlatformRouter.post("/products", retailAdminController.addRetailProduct);
instantRetailAdminPlatformRouter.put("/products/:id", retailAdminController.updateRetailProduct);
instantRetailAdminPlatformRouter.delete("/products/:id", retailAdminController.deleteRetailProduct);

// 商品货架（shelf）：S3-179 删除死代码。
// 本文件与 instant-retail-admin-ops.routes.ts 共用同一 prefix "/api/admin/instant-retail"，
// auto-routes 按文件名排序注册（"…-ops…" < "…-platform…"），Express 对同一「方法 + 完整路径」
// 只命中先注册者 ⇒ 本文件这 4 条 /shelf 永远不会被调用（08-10 ce157807「上架接真实数据、
// 后端补 shelf 接口」已在 ops 文件里以 instant-retail-fix.controller 唯一提供）。
// 删除不丢功能；若再次在本文件新增 /shelf，auto-routes 的"真重复端点"阻断会直接拒绝启动。

// Banner
instantRetailAdminPlatformRouter.get("/banners", retailAdminController.listBanners);
instantRetailAdminPlatformRouter.post("/banners", retailAdminController.createBanner);
instantRetailAdminPlatformRouter.put("/banners/:id", retailAdminController.updateBanner);
instantRetailAdminPlatformRouter.delete("/banners/:id", retailAdminController.deleteBanner);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/instant-retail",
  router: instantRetailAdminPlatformRouter,
  auth: "requireAuthWithTenant",
};
