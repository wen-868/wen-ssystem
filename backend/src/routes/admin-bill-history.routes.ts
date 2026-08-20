import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { handleListHistoryBills } from "../controllers/admin/history-bill.controller";

export const adminBillHistoryRouter = Router();

// GET /api/admin/bills/history - 历史单据统一查询（单据管理）
adminBillHistoryRouter.get("/bills/history", asyncHandler(handleListHistoryBills));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminBillHistoryRouter,
  auth: "requireAuthWithTenant",
};
