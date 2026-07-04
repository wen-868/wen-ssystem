import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { submitFeedback, getFeedbacks, updateFeedback } from "../controllers/admin/feedback.controller.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";

export const feedbackRouter = Router();

// 提交反馈（所有登录用户都可以）
feedbackRouter.post("/feedback", requireAuthWithTenant, asyncHandler(submitFeedback));

// 查询反馈列表（管理员）
feedbackRouter.get("/feedbacks", requireAuthWithTenant, asyncHandler(getFeedbacks));

// 更新反馈状态（管理员）
feedbackRouter.put("/feedback/:id", requireAuthWithTenant, asyncHandler(updateFeedback));
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: feedbackRouter,
  auth: "none",
};
