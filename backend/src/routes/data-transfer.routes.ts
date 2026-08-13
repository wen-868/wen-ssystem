import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import {
  exportProductsHandler,
  exportCustomersHandler,
  importCustomersHandler,
} from "../controllers/admin/data-transfer.controller";

export const dataTransferRouter = Router();

// 数据导出（商品/客户，返回数组由前端转 CSV 下载）
dataTransferRouter.get("/export/products", asyncHandler(exportProductsHandler));
dataTransferRouter.get("/export/customers", asyncHandler(exportCustomersHandler));

// 数据导入（客户 CSV）
dataTransferRouter.post("/import/customers", asyncHandler(importCustomersHandler));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/data-transfer",
  router: dataTransferRouter,
  auth: "requireAuthWithTenant",
};
