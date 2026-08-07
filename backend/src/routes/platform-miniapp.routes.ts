import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as platformMiniappController from "../controllers/platform-miniapp.controller";

export const platformMiniappRouter = Router();

// 基础防刷：提交订阅申请每 IP 每小时 20 次；非生产环境放宽便于联调
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 20 : 500,
  message: { code: "429", msg: "提交过于频繁，请稍后再试", traceId: "", apiCost: 0 },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

// GET /api/platform-miniapp/plans — 公开套餐列表（auth: none）
platformMiniappRouter.get("/plans", asyncHandler(platformMiniappController.listPlans));

// POST /api/platform-miniapp/subscriptions — 提交订阅申请（公开 + 限流防刷）
platformMiniappRouter.post(
  "/subscriptions",
  subscribeLimiter,
  asyncHandler(platformMiniappController.submitSubscription)
);

// GET /api/platform-miniapp/subscriptions/me — 查询本人申请（公开）
platformMiniappRouter.get("/subscriptions/me", asyncHandler(platformMiniappController.listMySubscriptions));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform-miniapp",
  router: platformMiniappRouter,
  auth: "none",
};
