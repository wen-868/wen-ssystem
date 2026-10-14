import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as saleBillController from "../controllers/store/sale-bill.controller";
export { storeSaleBillItemSchema, normalizeStoreSaleBillItem } from "../schemas/store-sale-bill";

export const storeSaleBillRouter = Router();
export const storePosChannelRouter = Router();

storeSaleBillRouter.get("/", saleBillController.listSaleBills);
storeSaleBillRouter.post("/", requirePermission("sale:create"), saleBillController.createSaleBill);
storeSaleBillRouter.get("/overdue", saleBillController.listOverdueBills);
storeSaleBillRouter.get("/overdue/check", saleBillController.checkOverdueBills);
storeSaleBillRouter.get("/:billNo", saleBillController.getSaleBillDetail);
storeSaleBillRouter.post("/:billNo/collection-link", saleBillController.createCollectionLink);
storeSaleBillRouter.post("/:billNo/offline-payment", saleBillController.offlinePayment);
storeSaleBillRouter.post("/:billNo/payment", saleBillController.paymentOnSaleBill);
storeSaleBillRouter.post("/:billNo/pay-by-code", saleBillController.paySaleBillByCode);
storePosChannelRouter.get("/channels", saleBillController.listPosChannels);

// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**` 先套认证 + CSRF。现按「只声明自己
//   拥有的路径段」拆成 `/api/store/sale-bills` 与 `/api/store/payment`，对外 URL 逐字不变
//   （`/overdue`、`/overdue/check` 两行仍排在 `/:billNo` 之前，顺序语义不变）。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/sale-bills", router: storeSaleBillRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/payment", router: storePosChannelRouter, auth: "requireAuthWithTenant" },
];
