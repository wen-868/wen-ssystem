import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as shiftController from "../controllers/store/shift.controller";

export const storeShiftRouter = Router();

// 班结
storeShiftRouter.get("/shift/current", shiftController.getCurrentShift);
storeShiftRouter.post("/shift/settle", shiftController.settleShift);
storeShiftRouter.get("/shift/history", shiftController.getShiftHistory);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeShiftRouter,
  auth: "requireAuthWithTenant",
};