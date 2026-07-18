import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as planController from "../controllers/admin/subscription-plan.controller";

export const platformPlansRouter = Router();

platformPlansRouter.use(requirePlatformAuth);

// ========== 平台套餐管理 ==========
// GET /api/platform/plans - 套餐列表
platformPlansRouter.get("/", planController.listPlans);

// POST /api/platform/plans - 创建套餐
platformPlansRouter.post("/", planController.createPlan);

// GET /api/platform/plans/:planId - 套餐详情
platformPlansRouter.get("/:planId", planController.getPlan);

// PUT /api/platform/plans/:planId - 更新套餐
platformPlansRouter.put("/:planId", planController.updatePlan);

// DELETE /api/platform/plans/:planId - 删除套餐
platformPlansRouter.delete("/:planId", planController.deletePlan);

// PUT /api/platform/plans/:planId/features - 套餐功能配置
platformPlansRouter.put("/:planId/features", planController.updatePlanFeatures);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/plans",
  router: platformPlansRouter,
  auth: "requirePlatformAuth",
};
