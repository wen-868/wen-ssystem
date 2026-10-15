import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as controller from "../controllers/admin/sale-return.controller";

export const saleReturnRouter = Router();

saleReturnRouter.get("/", asyncHandler(controller.listSaleReturns));
saleReturnRouter.get("/:returnNo", asyncHandler(controller.getSaleReturnDetail));
saleReturnRouter.post("/", asyncHandler(controller.createSaleReturn));
// S3-224（第 43 项 B2 批 6 · 销售域接线）：退货审核 / 驳回挂 `sale:return`（同文件 `/:returnNo/refund` 的既有码）。
// 使用者：admin-web 与 app-mobile 均**无页面调用点**（app-mobile `store.ts:829/834` 仅有封装）；
// 生产持有 `sale:return` = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / STORE_OPERATOR ⇒ 零回归。
// ⚠️ 本 Router 有**两个挂载点**（`/api/admin/sale-returns` 与 `/api/store/sale-returns`）⇒ 本 2 条会同时作用于两个前缀；
// 同文件 `POST /`（创建退货单）被 G0/G1/G2 三处锁定（`NOT_IN_G0` 范围控制 + C 类 + R 类双挂载）
// ⇒ 本批**不接**（接线会把 admin-web `pos/SaleReturnView.vue:216` 与 app-mobile 退货链路的
// STORE_OPERATOR 打成 403）。2026-10-16
saleReturnRouter.post("/:returnNo/approve", requirePermission("sale:return"), asyncHandler(controller.approveSaleReturn));
saleReturnRouter.post("/:returnNo/reject", requirePermission("sale:return"), asyncHandler(controller.rejectSaleReturn));
saleReturnRouter.post("/:returnNo/refund", requirePermission("sale:return"), asyncHandler(controller.refundSaleReturn));
saleReturnRouter.get("/sale-bills/:billNo", asyncHandler(controller.getSaleBillForReturn));

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/admin/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
];
