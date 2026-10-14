import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as authController from "../controllers/store/auth.controller";
import * as receivableController from "../controllers/store/receivable.controller";
import { circuitBreaker } from "../middleware/circuit-breaker";

export const storeMeRouter = Router();
export const storeInfoRouter = Router();
export const storeDashboardRouter = Router();
export const storeDailySalesRouter = Router();

// Auth（认证由 auto-routes 统一添加）
storeMeRouter.get("/", authController.getMe);

// 门店信息
storeInfoRouter.get("/", authController.getStoreInfo);

// 仪表盘
storeDashboardRouter.get("/", circuitBreaker({ key: "store-dashboard" }), receivableController.getDashboard);
storeDailySalesRouter.get("/", circuitBreaker({ key: "store-daily-sales" }), receivableController.getDailySales);

// ========== 路由自动发现配置 ==========
// S3-195：本文件的 4 条端点**位于根前缀正下方**（/me、/info、/dashboard、/daily-sales），原先只能以根前缀
//   `"/api/store"` 注册 ⇒ 整段 `/api/store/**` 被前置套上认证 + CSRF。现每条端点各以自己的完整路径为前缀
//   （prefix 即路径、router 内只留 "/"），对外 URL 逐字不变，且不再覆盖本文件不拥有的任何路径。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/me", router: storeMeRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/info", router: storeInfoRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/dashboard", router: storeDashboardRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/daily-sales", router: storeDailySalesRouter, auth: "requireAuthWithTenant" },
];
