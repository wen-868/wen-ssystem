import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { seedDemo, resetSystem } from "../controllers/admin/demo.controller";

export const demoRouter = Router();

// 演示数据初始化（幂等）与系统初始化（需超级管理员，二次确认）
demoRouter.post("/seed", asyncHandler(seedDemo));
demoRouter.post("/reset", asyncHandler(resetSystem));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/demo",
  router: demoRouter,
  auth: "requireAuthWithTenant",
};
