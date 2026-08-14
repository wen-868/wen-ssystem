import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as platformIntegrationController from "../controllers/instant-retail/platform-integration.controller";

export const instantRetailWebhookRouter = Router();

/* ────────────────────────────────────────────────────────────────────────────
 * Webhook 接收端点（无需认证）
 * ──────────────────────────────────────────────────────────────────────────── */

instantRetailWebhookRouter.post("/webhook/jd", platformIntegrationController.handleJdWebhook);
instantRetailWebhookRouter.post("/webhook/meituan", platformIntegrationController.handleMeituanWebhook);
instantRetailWebhookRouter.post("/webhook/eleme", platformIntegrationController.handleElemeWebhook);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/instant-retail",
  router: instantRetailWebhookRouter,
  auth: "none",
};