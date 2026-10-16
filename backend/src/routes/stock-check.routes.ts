import { Router } from "express";
import * as ctrl from "../controllers/admin/stock-check.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// S3-233（B 类收编第一批 · 库存/追溯域）：盘点族接线。依据门 = permission-gates.ts 的 `fx-stock-check`
//（功能中心「盘点调拨」入口，门码 = `inventory:create` + `inventory:adjust`，入口按"两码全持"显隐）。
// 逐条码选取口径沿用本域既有先例（缺口清单 §9.2）：**新建 / 录入明细 / 启动提交类动作 ⇒ `inventory:create`；
// 更新 / 差异处理 / 完成取消类状态变更 ⇒ `inventory:adjust`**（同 `inventory-batch` 的 POST→create、PUT/diff→adjust）。
// 使用者：店长（`inventory:*` 两码全持，不受影响）与仓管（同）；店员（`inventory:view`）看不到该入口。

// ==================== Admin 盘点路由 ====================
export const adminStockCheckRouter = Router();

adminStockCheckRouter.post("/", requirePermission("inventory:create"), ctrl.create);
adminStockCheckRouter.get("/statistics", ctrl.getStatistics);
adminStockCheckRouter.get("/", ctrl.list);
adminStockCheckRouter.get("/:id", ctrl.getDetail);
adminStockCheckRouter.put("/:id", requirePermission("inventory:adjust"), ctrl.update);
adminStockCheckRouter.post("/:id/start", requirePermission("inventory:create"), ctrl.start);
adminStockCheckRouter.post("/:id/complete", requirePermission("inventory:adjust"), ctrl.complete);
adminStockCheckRouter.post("/:id/cancel", requirePermission("inventory:adjust"), ctrl.cancel);
adminStockCheckRouter.post("/:id/handle-diff", requirePermission("inventory:adjust"), ctrl.handleDiff);
adminStockCheckRouter.post("/:id/items", requirePermission("inventory:create"), ctrl.recordItems);

// ==================== Store 盘点路由 ====================
export const storeStockCheckRouter = Router();

storeStockCheckRouter.get("/my", ctrl.getMyList);
storeStockCheckRouter.get("/:id", ctrl.getDetail);
storeStockCheckRouter.put("/:id/items/:itemId", requirePermission("inventory:adjust"), ctrl.updateItem);
storeStockCheckRouter.post("/:id/submit", requirePermission("inventory:create"), ctrl.submit);

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/stock-checks", router: storeStockCheckRouter, auth: "requireAuthWithTenant" },
];
