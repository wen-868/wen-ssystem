import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as shiftController from "../controllers/store/shift.controller";

export const storeShiftRouter = Router();
export const storeShiftsRouter = Router();

// 班结
storeShiftRouter.get("/current", shiftController.getCurrentShift);
storeShiftRouter.post("/settle", shiftController.settleShift);
storeShiftRouter.get("/history", shiftController.getShiftHistory);

// R100-04 交接班（创建/详情/统计/盘点）
storeShiftsRouter.post("/", shiftController.createShift);
// S3-145：交接班列表（读 t_shift，与详情/统计/盘点同源；唯一新增的只读列表端点）
storeShiftsRouter.get("/", shiftController.getShiftList);
storeShiftsRouter.get("/:shiftNo", shiftController.getShiftDetail);
storeShiftsRouter.get("/:shiftNo/sales", shiftController.getShiftSalesStats);
storeShiftsRouter.get("/:shiftNo/check", shiftController.getShiftStockCheck);
storeShiftsRouter.post("/:shiftNo/check", shiftController.submitShiftStockCheck);
// S3-146：完成交接 —— 唯一写端点，把该租户该门店的 t_shift 由 OPEN 置 CLOSED 并落 end_time（服务端时间）
storeShiftsRouter.post("/:shiftNo/close", shiftController.closeShift);

// ========== 路由自动发现配置 ==========
// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**` 先套认证 + CSRF。现按「只声明自己
//   拥有的路径段」拆成 `/api/store/shift`（单数三条）与 `/api/store/shifts`（交接班），对外 URL 逐字不变。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/shift", router: storeShiftRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/shifts", router: storeShiftsRouter, auth: "requireAuthWithTenant" },
];
