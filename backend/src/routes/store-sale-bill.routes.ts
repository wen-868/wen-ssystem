import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as saleBillController from "../controllers/store/sale-bill.controller";
export { storeSaleBillItemSchema, normalizeStoreSaleBillItem } from "../schemas/store-sale-bill";

export const storeSaleBillRouter = Router();

storeSaleBillRouter.use(requireAuthWithTenant);

storeSaleBillRouter.get("/sale-bills", saleBillController.listSaleBills);
storeSaleBillRouter.post("/sale-bills", saleBillController.createSaleBill);
storeSaleBillRouter.get("/sale-bills/overdue", saleBillController.listOverdueBills);
storeSaleBillRouter.get("/sale-bills/overdue/check", saleBillController.checkOverdueBills);
storeSaleBillRouter.get("/sale-bills/:billNo", saleBillController.getSaleBillDetail);
storeSaleBillRouter.post("/sale-bills/:billNo/collection-link", saleBillController.createCollectionLink);
storeSaleBillRouter.post("/sale-bills/:billNo/offline-payment", saleBillController.offlinePayment);
storeSaleBillRouter.post("/sale-bills/:billNo/payment", saleBillController.paymentOnSaleBill);

export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeSaleBillRouter,
  auth: "requireAuthWithTenant",
};
