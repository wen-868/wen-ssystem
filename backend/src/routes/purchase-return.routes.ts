import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/purchase-return.controller";

export const purchaseReturnRouter = Router();
purchaseReturnRouter.get("/", ctrl.list);
purchaseReturnRouter.get("/:returnNo", ctrl.getDetail);
// S3-233（B 类收编第一批 · 采购域）：创建采购退货单挂 `sale:return`（同文件 approve / void 同码，:13-14）。
// 依据门 = permission-gates.ts 的 `purchase-sub-return`（开单页「采购 → 采购退货」子段，入口已按该码显隐）。
// S3-214-B2 的「无权限门」前提已由 S3-230 修复，故本行据此收编。
purchaseReturnRouter.post("/", requirePermission("sale:return"), ctrl.create);
purchaseReturnRouter.post("/:returnNo/approve", requirePermission("sale:return"), ctrl.approve);
purchaseReturnRouter.post("/:returnNo/void", requirePermission("sale:return"), ctrl.voidReturn);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-returns",
  router: purchaseReturnRouter,
  auth: "requireAuthWithTenant",
};
