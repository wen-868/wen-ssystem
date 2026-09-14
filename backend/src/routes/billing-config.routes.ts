import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as billingConfigController from "../controllers/admin/billing-config.controller";

// R101-S2-02 组2：账单类配置路由，独立前缀 /api/platform/billing
// 由 auto-routes 自动发现挂载，无需改 server.ts
export const billingConfigRouter = Router();

billingConfigRouter.use(requirePlatformAuth);

// GET /api/platform/billing/arrears-policy - 欠费处理策略（全局）
billingConfigRouter.get("/arrears-policy", billingConfigController.getArrearsPolicy);

// PUT /api/platform/billing/arrears-policy - 保存欠费处理策略
billingConfigRouter.put("/arrears-policy", billingConfigController.updateArrearsPolicy);

// GET /api/platform/billing/addon-price - 增值服务单价
billingConfigRouter.get("/addon-price", billingConfigController.getAddonPrice);

// PUT /api/platform/billing/addon-price - 保存增值服务单价
billingConfigRouter.put("/addon-price", billingConfigController.updateAddonPrice);

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/billing",
  router: billingConfigRouter,
  auth: "requirePlatformAuth",
};
