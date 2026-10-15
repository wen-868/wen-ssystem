import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-223（财务域接线 · B2 批 5）：本文件 6 个写端点全部挂既有码 `finance:create`。
// 使用者 = `views/system/PaymentConfigView.vue`（页面门禁 `router/index.ts:249` `system/payment` [SUPER_ADMIN]；
// 保存渠道配置 :491/:510、测试连接 :548），全仓**无 app-mobile 调用点** ⇒ 零回归。
// ⚠️ 该页「银行账户」区块打的是 `/admin/payment/bank-accounts`（`api/finance.ts:212-216`），
// 与本文件 `/api/payment-config/bank-accounts` **不是同一路径**（前者后端不存在）⇒ 本文件 4 条 bank-accounts
// 端点当前无有效调用方；路径漂移只登记不动手（见回执「卡外观察」）。
import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/admin/payment-config.controller";

export const paymentConfigRouter = Router();

paymentConfigRouter.get("/configs/:provider", ctrl.getChannelConfig);
paymentConfigRouter.put("/configs/:provider", requirePermission("finance:create"), ctrl.saveChannelConfig);
paymentConfigRouter.post("/configs/:provider/test", requirePermission("finance:create"), ctrl.testConnection);
paymentConfigRouter.get("/status", ctrl.getStatus);
paymentConfigRouter.get("/bank-accounts", ctrl.listBankAccounts);
paymentConfigRouter.post("/bank-accounts", requirePermission("finance:create"), ctrl.createBankAccount);
paymentConfigRouter.put("/bank-accounts/:id", requirePermission("finance:create"), ctrl.updateBankAccount);
paymentConfigRouter.delete("/bank-accounts/:id", requirePermission("finance:create"), ctrl.deleteBankAccount);
paymentConfigRouter.post("/bank-accounts/:id/default", requirePermission("finance:create"), ctrl.setDefaultBankAccount);

export const routeConfig: RouteConfig = {
  prefix: "/api/payment-config",
  router: paymentConfigRouter,
  auth: "requireAuthWithTenant",
};
