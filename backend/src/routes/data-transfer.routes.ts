import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import {
  exportProductsHandler,
  exportCustomersHandler,
  importCustomersHandler,
  importProductsHandler,
  productTemplateHandler,
  customerTemplateHandler,
} from "../controllers/admin/data-transfer.controller";

export const dataTransferRouter = Router();

// 数据导出（商品/客户，返回数组由前端转 CSV 下载）
dataTransferRouter.get("/export/products", asyncHandler(exportProductsHandler));
dataTransferRouter.get("/export/customers", asyncHandler(exportCustomersHandler));

// 数据导入（客户 CSV）
// S3-198 批B2-2（库存/追溯域）：CSV 导入是管理面写动作，按台账 §三.12 登记的建议码补 store:transfer。
// 持有者（仓库种子）= STORE_MANAGER（store:*）/ SUPER_ADMIN（*）/ OPERATION_ADMIN（*）；
// 调用页 = 系统配置 SystemConfigView.vue（router/index.ts:241，roles [SUPER_ADMIN]）
// + 商品导入 ProductImport.vue（router/index.ts:169，roles [SUPER_ADMIN, STORE_MANAGER]）⇒ 页面角色 ⊆ 持有者。
// ⚠️ 语义保留意见：store:transfer 本义为「门店调拨」，用于 CSV 导入偏宽（见回执 §风险）。
dataTransferRouter.post("/import/customers", requirePermission("store:transfer"), asyncHandler(importCustomersHandler));

// 数据导入（商品 CSV，行业通用模板）
dataTransferRouter.post("/import/products", requirePermission("store:transfer"), asyncHandler(importProductsHandler));

// 模板下载
dataTransferRouter.get("/templates/products", asyncHandler(productTemplateHandler));
dataTransferRouter.get("/templates/customers", asyncHandler(customerTemplateHandler));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/data-transfer",
  router: dataTransferRouter,
  auth: "requireAuthWithTenant",
};
