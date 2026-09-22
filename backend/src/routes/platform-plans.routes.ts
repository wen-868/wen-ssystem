import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as planController from "../controllers/admin/subscription-plan.controller";
import * as flowController from "../controllers/platform/plan-upgrade-flow.controller";
import * as copyController from "../controllers/platform/plan-copy.controller";

export const platformPlansRouter = Router();

platformPlansRouter.use(requirePlatformAuth);

// ========== 平台套餐管理 ==========
// GET /api/platform/plans - 套餐列表
platformPlansRouter.get("/", planController.listPlans);

// POST /api/platform/plans - 创建套餐
platformPlansRouter.post("/", planController.createPlan);

// C1-2 B1：升降级流向报表（必须注册在 /:planId 之前，否则会被当作 planId 捕获）
platformPlansRouter.get("/upgrade-flow-report", flowController.getUpgradeFlowReportCtrl);

// GET /api/platform/plans/:planId - 套餐详情
platformPlansRouter.get("/:planId", planController.getPlan);

// PUT /api/platform/plans/:planId - 更新套餐
platformPlansRouter.put("/:planId", planController.updatePlan);

// DELETE /api/platform/plans/:planId - 删除套餐
platformPlansRouter.delete("/:planId", planController.deletePlan);

// PUT /api/platform/plans/:planId/features - 套餐功能配置
platformPlansRouter.put("/:planId/features", planController.updatePlanFeatures);

// R101-S2-02 组1：GET /api/platform/plans/:planId/policy - 套餐策略配置（升降级/续费/额度/活动）
platformPlansRouter.get("/:planId/policy", planController.getPlanPolicy);

// R101-S2-02 组1：PUT /api/platform/plans/:planId/policy - 保存套餐策略配置
platformPlansRouter.put("/:planId/policy", planController.updatePlanPolicy);

// C1-2 B2：POST /api/platform/plans/:planId/copy - 复制套餐（含 features 与策略包）
platformPlansRouter.post("/:planId/copy", copyController.copyPlanCtrl);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/plans",
  router: platformPlansRouter,
  auth: "requirePlatformAuth",
};
