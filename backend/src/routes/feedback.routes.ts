import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { submitFeedback, getFeedbacks, updateFeedback } from "../controllers/admin/feedback.controller";

import { asyncHandler } from "../middleware/async-handler";

export const feedbackRouter = Router();

// 提交反馈（所有登录用户都可以）
feedbackRouter.post("/feedback", asyncHandler(submitFeedback));

// 查询反馈列表（管理员）
feedbackRouter.get("/feedbacks", asyncHandler(getFeedbacks));

// 更新反馈状态（管理员）
feedbackRouter.put("/feedback/:id", asyncHandler(updateFeedback));
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: feedbackRouter,
  auth: "requireAuthWithTenant",
};
