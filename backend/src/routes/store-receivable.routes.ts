import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as otherController from "../controllers/store/other.controller";
import * as receivableController from "../controllers/store/receivable.controller";

export const storeReceivableRouter = Router();
export const storeCollectionLinkRouter = Router();
export const storePaymentOrderRouter = Router();
export const storeRefundOrderRouter = Router();

// 收款链接 / 支付 / 退款
storeCollectionLinkRouter.get("/", otherController.listCollectionLinks);
storePaymentOrderRouter.get("/", otherController.listPaymentOrders);
storeRefundOrderRouter.get("/", otherController.listRefundOrders);

// 应收
storeReceivableRouter.get("/", receivableController.listReceivables);
storeReceivableRouter.post("/:receivableNo/payment", requirePermission("finance:payment"), receivableController.paymentOnReceivable);

// ========== 路由自动发现配置 ==========
// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**` 先套认证 + CSRF。现按「只声明自己
//   拥有的路径段」拆成四条（收款链接 / 支付单 / 退款单 / 应收），对外 URL 逐字不变。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/collection-links", router: storeCollectionLinkRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/payment-orders", router: storePaymentOrderRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/refund-orders", router: storeRefundOrderRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/receivables", router: storeReceivableRouter, auth: "requireAuthWithTenant" },
];
