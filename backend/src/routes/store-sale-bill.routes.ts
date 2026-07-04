import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as saleBillController from "../controllers/store/sale-bill.controller.js";

export const storeSaleBillRouter = Router();

// 导出 Schema 供 Controller 使用（保持向后兼容）
export const storeSaleBillItemSchema = z.object({
  skuId: z.number(),
  boxQty: z.number().optional(),
  bottleQty: z.number().optional(),
  quantity: z.number().optional(),
  totalBottleQty: z.number().optional(),
  unitPrice: z.number().optional(),
  priceType: z.enum(["RETAIL", "WHOLESALE", "STORE"]).optional()
}).transform((item: any, ctx: any) => {
  const totalBottleQty = item.totalBottleQty ?? item.quantity;
  if (totalBottleQty == null || totalBottleQty <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "totalBottleQty 或 quantity 必须大于 0" });
    return z.NEVER;
  }
  return { skuId: item.skuId, boxQty: item.boxQty ?? 0, bottleQty: item.bottleQty ?? item.quantity ?? totalBottleQty, totalBottleQty, unitPrice: item.unitPrice, priceType: item.priceType };
});

export function normalizeStoreSaleBillItem(input: unknown) {
  return storeSaleBillItemSchema.parse(input);
}

storeSaleBillRouter.use(requireAuthWithTenant);

// 销售单
storeSaleBillRouter.get("/sale-bills", saleBillController.listSaleBills);
storeSaleBillRouter.post("/sale-bills", saleBillController.createSaleBill);
storeSaleBillRouter.get("/sale-bills/overdue", saleBillController.listOverdueBills);
storeSaleBillRouter.get("/sale-bills/overdue/check", saleBillController.checkOverdueBills);
storeSaleBillRouter.get("/sale-bills/:billNo", saleBillController.getSaleBillDetail);
storeSaleBillRouter.post("/sale-bills/:billNo/collection-link", saleBillController.createCollectionLink);
storeSaleBillRouter.post("/sale-bills/:billNo/offline-payment", saleBillController.offlinePayment);
storeSaleBillRouter.post("/sale-bills/:billNo/payment", saleBillController.paymentOnSaleBill);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeSaleBillRouter,
  auth: "none",
};