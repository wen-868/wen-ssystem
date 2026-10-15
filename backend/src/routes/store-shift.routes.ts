import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as shiftController from "../controllers/store/shift.controller";

export const storeShiftRouter = Router();
export const storeShiftsRouter = Router();

// 班结
storeShiftRouter.get("/current", shiftController.getCurrentShift);
// S3-224（第 43 项 B2 批 6 · 销售域接线）：班结/交接班 4 条挂 `finance:daily-settle`。
// 依据：使用者 = admin-web `pos/ShiftView.vue:258/296` 与 `pos/ShiftDetailView.vue:345`
//（页面 `router/index.ts:268/269` 角色 = SUPER_ADMIN / STORE_MANAGER / **STORE_OPERATOR**）⇒ 必须覆盖收银员；
// 生产持有 `finance:daily-settle` = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / **STORE_OPERATOR** / FINANCE_STAFF
// ⇒ 覆盖且**语义精确**（班结=门店收银日结，与 `pos/daily-settle` 已接线的 `POST /api/admin/daily-settlements` 同族同码）。
// `POST /shift/settle`（班结）全仓无页面调用点，同族同码处理。
// 2026-10-16
storeShiftRouter.post("/settle", requirePermission("finance:daily-settle"), shiftController.settleShift);
storeShiftRouter.get("/history", shiftController.getShiftHistory);

// R100-04 交接班（创建/详情/统计/盘点）
storeShiftsRouter.post("/", requirePermission("finance:daily-settle"), shiftController.createShift);
// S3-145：交接班列表（读 t_shift，与详情/统计/盘点同源；唯一新增的只读列表端点）
storeShiftsRouter.get("/", shiftController.getShiftList);
storeShiftsRouter.get("/:shiftNo", shiftController.getShiftDetail);
storeShiftsRouter.get("/:shiftNo/sales", shiftController.getShiftSalesStats);
storeShiftsRouter.get("/:shiftNo/check", shiftController.getShiftStockCheck);
storeShiftsRouter.post("/:shiftNo/check", requirePermission("finance:daily-settle"), shiftController.submitShiftStockCheck);
// S3-146：完成交接 —— 唯一写端点，把该租户该门店的 t_shift 由 OPEN 置 CLOSED 并落 end_time（服务端时间）
storeShiftsRouter.post("/:shiftNo/close", requirePermission("finance:daily-settle"), shiftController.closeShift);

// ========== 路由自动发现配置 ==========
// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**` 先套认证 + CSRF。现按「只声明自己
//   拥有的路径段」拆成 `/api/store/shift`（单数三条）与 `/api/store/shifts`（交接班），对外 URL 逐字不变。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/shift", router: storeShiftRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/shifts", router: storeShiftsRouter, auth: "requireAuthWithTenant" },
];
