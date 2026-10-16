import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as inventoryController from "../controllers/store/inventory.controller";

export const storeInventoryRouter = Router();

// 库存
storeInventoryRouter.get("/", inventoryController.listInventory);
storeInventoryRouter.post("/adjust", requirePermission("inventory:adjust"), inventoryController.adjustInventory);
storeInventoryRouter.get("/logs", inventoryController.listInventoryLogs);
storeInventoryRouter.get("/alerts", inventoryController.listInventoryAlerts);
// S3-233（B 类收编第一批 · 库存/追溯域）：门店预警阈值挂 `inventory:adjust`（与 :10 的库存调整同码、同域）。
// 依据门 = permission-gates.ts 的 `fx-stock-warning`（库存预警入口，写调用面含本条）。
storeInventoryRouter.put("/alerts/:skuId/threshold", requirePermission("inventory:adjust"), inventoryController.updateAlertThreshold);

// ========== 路由自动发现配置 ==========
// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ `app.use("/api/store", 认证+CSRF, router)` 会把整段
//   `/api/store/**`（含本文件不拥有的路径、以及不存在的子路径）先套上认证 + CSRF（实测
//   `POST /api/store/no-such-path` 返回 401 而非 404）。现收窄到本文件唯一拥有的路径段 `/api/store/inventory`，
//   对外 URL 逐字不变。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/inventory", router: storeInventoryRouter, auth: "requireAuthWithTenant" },
];
