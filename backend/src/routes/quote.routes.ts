import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as quotePushController from "../controllers/admin/quote-push.controller.js";

export const quoteRouter = Router();

quoteRouter.post("/preview", requireAuthWithTenant, quotePushController.previewQuote);
quoteRouter.post("/", requireAuthWithTenant, quotePushController.createQuote);
quoteRouter.get("/", requireAuthWithTenant, quotePushController.listQuotes);
quoteRouter.get("/:id", requireAuthWithTenant, quotePushController.getQuoteDetail);
quoteRouter.post("/:id/push", requireAuthWithTenant, quotePushController.pushQuote);
quoteRouter.post("/:id/cancel", requireAuthWithTenant, quotePushController.cancelQuote);

// 公开访问 - 通过分享令牌查看（无需登录）
export const quoteShareRouter = Router();
quoteShareRouter.get("/:token", quotePushController.viewQuoteByToken);