import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant, getUserAccessInfo, signToken } from "../shared/auth.js";
import { query, queryOne } from "../shared/db.js";
import { ok } from "../shared/response.js";
import * as authController from "../controllers/store/auth.controller.js";
import * as productController from "../controllers/store/product.controller.js";
import * as orderController from "../controllers/store/order.controller.js";
import * as saleBillController from "../controllers/store/sale-bill.controller.js";
import * as inventoryController from "../controllers/store/inventory.controller.js";
import * as otherController from "../controllers/store/other.controller.js";
import * as receivableController from "../controllers/store/receivable.controller.js";
import * as tagController from "../controllers/admin/tag.controller.js";
import * as batchController from "../controllers/inventory-batch.controller.js";
import * as shiftController from "../controllers/store/shift.controller.js";

export const storeRouter = Router();

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

// 需要认证
storeRouter.use(requireAuthWithTenant);

// 门店当前用户信息
storeRouter.get("/me", authController.getMe);

// 门店信息
storeRouter.get("/info", authController.getStoreInfo);

// 产品
storeRouter.get("/products", productController.listProducts);
storeRouter.get("/product-categories", productController.getCategories);
storeRouter.get("/products/:spuId/tags", tagController.getProductTags);
storeRouter.get("/products/:spuId/batches", batchController.listBatchesBySpu);
storeRouter.get("/products/:spuId", productController.getProductDetail);
storeRouter.get("/members", productController.listMembers);

// 订单
storeRouter.get("/orders", orderController.listOrders);
storeRouter.get("/orders/:orderNo", orderController.getOrderDetail);
storeRouter.post("/orders/:orderNo/accept", orderController.acceptOrder);
storeRouter.post("/orders/:orderNo/start-delivery", orderController.startDelivery);
storeRouter.post("/orders/:orderNo/complete-delivery", orderController.completeDelivery);
storeRouter.post("/orders/:orderNo/reject", orderController.rejectOrder);
storeRouter.post("/orders/:orderNo/cancel", orderController.cancelOrder);

// 销售单
storeRouter.get("/sale-bills", saleBillController.listSaleBills);
storeRouter.post("/sale-bills", saleBillController.createSaleBill);
storeRouter.get("/sale-bills/overdue", saleBillController.listOverdueBills);
storeRouter.get("/sale-bills/overdue/check", saleBillController.checkOverdueBills);
storeRouter.get("/sale-bills/:billNo", saleBillController.getSaleBillDetail);
storeRouter.post("/sale-bills/:billNo/collection-link", saleBillController.createCollectionLink);
storeRouter.post("/sale-bills/:billNo/offline-payment", saleBillController.offlinePayment);
storeRouter.post("/sale-bills/:billNo/payment", saleBillController.paymentOnSaleBill);

// 库存
storeRouter.get("/inventory", inventoryController.listInventory);
storeRouter.post("/inventory/adjust", inventoryController.adjustInventory);
storeRouter.get("/inventory/logs", inventoryController.listInventoryLogs);
storeRouter.get("/inventory/alerts", inventoryController.listInventoryAlerts);

// 挂单
storeRouter.post("/hold-orders", otherController.createHoldOrder);
storeRouter.get("/hold-orders", otherController.listHoldOrders);
storeRouter.post("/hold-orders/:holdNo/restore", otherController.restoreHoldOrder);
storeRouter.delete("/hold-orders/:holdNo", otherController.deleteHoldOrder);

// 收款链接 / 支付 / 退款
storeRouter.get("/collection-links", otherController.listCollectionLinks);
storeRouter.get("/payment-orders", otherController.listPaymentOrders);
storeRouter.get("/refund-orders", otherController.listRefundOrders);

// 应收
storeRouter.get("/receivables", receivableController.listReceivables);
storeRouter.post("/receivables/:receivableNo/payment", receivableController.paymentOnReceivable);

// 仪表盘
storeRouter.get("/dashboard", receivableController.getDashboard);
storeRouter.get("/daily-sales", receivableController.getDailySales);

// 班结
storeRouter.get("/shift/current", shiftController.getCurrentShift);
storeRouter.post("/shift/settle", shiftController.settleShift);
storeRouter.get("/shift/history", shiftController.getShiftHistory);

// 标签与批次（共用）
storeRouter.get("/tags", tagController.listTags);
storeRouter.get("/tag-groups", tagController.listGroups);
storeRouter.get("/batches/:id", batchController.getBatchDetail);
storeRouter.get("/batches/:id/trace", batchController.getTraceChain);