import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as shiftController from "../controllers/store/shift.controller";

export const storeShiftRouter = Router();

// 班结
storeShiftRouter.get("/shift/current", shiftController.getCurrentShift);
storeShiftRouter.post("/shift/settle", shiftController.settleShift);
storeShiftRouter.get("/shift/history", shiftController.getShiftHistory);

// R100-04 交接班（创建/详情/统计/盘点）
storeShiftRouter.post("/shifts", shiftController.createShift);
storeShiftRouter.get("/shifts/:shiftNo", shiftController.getShiftDetail);
storeShiftRouter.get("/shifts/:shiftNo/sales", shiftController.getShiftSalesStats);
storeShiftRouter.get("/shifts/:shiftNo/check", shiftController.getShiftStockCheck);
storeShiftRouter.post("/shifts/:shiftNo/check", shiftController.submitShiftStockCheck);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeShiftRouter,
  auth: "requireAuthWithTenant",
};
