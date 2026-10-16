import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as inventoryLossGainController from "../controllers/admin/inventory-loss-gain.controller";

export const inventoryLossGainRouter = Router();

// S3-233（B 类收编第一批 · 库存/追溯域）：报损报益 = 库存数量调整 ⇒ 挂 `inventory:adjust`。
// 依据门 = permission-gates.ts 的 `fx-loss-gain`（功能中心「报损报益」入口）。
// 使用者：店长（`inventory:*`）不受影响；店员（`inventory:view`）看不到该入口。
inventoryLossGainRouter.post("/report-loss-gain", requirePermission("inventory:adjust"), inventoryLossGainController.reportLossGain);
inventoryLossGainRouter.get("/loss-gains", inventoryLossGainController.listLossGains);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory",
  router: inventoryLossGainRouter,
  auth: "requireAuthWithTenant",
};
