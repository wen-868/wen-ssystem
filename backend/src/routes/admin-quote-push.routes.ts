import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as quotePushController from "../controllers/admin/quote-push.controller";

export const adminQuotePushRouter = Router();

// 报价预览/生成
adminQuotePushRouter.post("/preview", quotePushController.previewQuote);
adminQuotePushRouter.post("/", quotePushController.createQuote);
adminQuotePushRouter.get("/", quotePushController.listQuotes);
adminQuotePushRouter.get("/:id", quotePushController.getQuoteDetail);
adminQuotePushRouter.post("/:id/push", quotePushController.pushQuote);
adminQuotePushRouter.post("/:id/cancel", quotePushController.cancelQuote);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/quote-push",
  router: adminQuotePushRouter,
  auth: "requireAuthWithTenant",
};

// 分享链接查看（token 公开访问，单独注册避免 requireAuth）
export const quoteShareRouter = Router();
quoteShareRouter.get("/share/:token", quotePushController.viewQuoteByToken);

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/quote-push", router: adminQuotePushRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/quote-share", router: quoteShareRouter, auth: "none" },
];
