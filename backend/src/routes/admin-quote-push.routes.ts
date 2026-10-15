import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as quotePushController from "../controllers/admin/quote-push.controller";

export const adminQuotePushRouter = Router();

// 报价预览/生成
adminQuotePushRouter.post("/preview", quotePushController.previewQuote);
adminQuotePushRouter.post("/", quotePushController.createQuote);
adminQuotePushRouter.get("/", quotePushController.listQuotes);
adminQuotePushRouter.get("/:id", quotePushController.getQuoteDetail);
// S3-224（第 43 项 B2 批 6 · 销售域接线）：推送报价单挂 `sale:create`，取消报价单挂 `sale:void`。
// 两条**全仓无页面调用点**（`rg quote-push` 在 admin-web 零命中；app-mobile 仅孤岛页
// `pages-sub/product/price-push/price-push.vue:163/185` 打 `POST /admin/quote-push` 与不存在的 `/resend`，
// 且**该页无任何导航入口** ⇒ 使用者集合不可枚举）。本批按「无调用点 ⇒ 取语义最贴近的既有码、不误伤现有页」处理。
// ⚠️ 同文件 `POST /preview`（报价预览，不改数据）按卡面 §二.3「查询型 POST 不按写端点接」⇒ 不接；
//     `POST /`（创建报价单）有 app-mobile 孤岛页写调用点 ⇒ B 类不接。2026-10-16
adminQuotePushRouter.post("/:id/push", requirePermission("sale:create"), quotePushController.pushQuote);
adminQuotePushRouter.post("/:id/cancel", requirePermission("sale:void"), quotePushController.cancelQuote);

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
