import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as platformIntegrationController from "../controllers/instant-retail/platform-integration.controller";
import * as retailAdminController from "../controllers/admin/instant-retail.controller";
import * as retailExtController from "../controllers/admin/instant-retail-ext.controller";

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

// 商品货架（shelf）
instantRetailAdminPlatformRouter.get("/shelf", retailExtController.listShelfProducts);
instantRetailAdminPlatformRouter.post("/shelf", retailExtController.addShelfProduct);
instantRetailAdminPlatformRouter.put("/shelf/:id", retailExtController.updateShelfProduct);
instantRetailAdminPlatformRouter.delete("/shelf/:id", retailExtController.removeShelfProduct);

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
