import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as traceController from "../controllers/store/trace.controller";

export const storeTraceRouter = Router();

// 收银台追溯码验证（扫追溯码自动带出商品）
storeTraceRouter.post("/trace/verify", traceController.verifyStoreTraceCode);

export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeTraceRouter,
  auth: "requireAuthWithTenant",
};
