import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { priceResponseFilter } from "../middleware/price-guard";
import * as authController from "../controllers/store/auth.controller";
import * as productController from "../controllers/store/product.controller";
import * as orderController from "../controllers/store/order.controller";
import * as saleBillController from "../controllers/store/sale-bill.controller";
import * as inventoryController from "../controllers/store/inventory.controller";
import * as otherController from "../controllers/store/other.controller";
import * as receivableController from "../controllers/store/receivable.controller";
import * as tagController from "../controllers/admin/tag.controller";
import * as batchController from "../controllers/inventory-batch.controller";
import * as shiftController from "../controllers/store/shift.controller";
export { storeSaleBillItemSchema, normalizeStoreSaleBillItem } from "../schemas/store-sale-bill";

export const storeRouter = Router();

storeRouter.use(priceResponseFilter());
storeRouter.use(requireAuthWithTenant);

storeRouter.get("/me", authController.getMe);
storeRouter.get("/info", authController.getStoreInfo);

storeRouter.get("/products", productController.listProducts);
storeRouter.get("/product-categories", productController.getCategories);
storeRouter.get("/products/:spuId/tags", tagController.getProductTags);
storeRouter.get("/products/:spuId/batches", batchController.listBatchesBySpu);
storeRouter.get("/products/:spuId", productController.getProductDetail);
storeRouter.get("/members", productController.listMembers);

storeRouter.get("/orders", orderController.listOrders);
storeRouter.get("/orders/:orderNo", orderController.getOrderDetail);
storeRouter.post("/orders/:orderNo/accept", orderController.acceptOrder);
storeRouter.post("/orders/:orderNo/start-delivery", orderController.startDelivery);
storeRouter.post("/orders/:orderNo/complete-delivery", orderController.completeDelivery);
storeRouter.post("/orders/:orderNo/reject", orderController.rejectOrder);
storeRouter.post("/orders/:orderNo/cancel", orderController.cancelOrder);

storeRouter.get("/sale-bills", saleBillController.listSaleBills);
storeRouter.post("/sale-bills", saleBillController.createSaleBill);
storeRouter.get("/sale-bills/overdue", saleBillController.listOverdueBills);
storeRouter.get("/sale-bills/overdue/check", saleBillController.checkOverdueBills);
storeRouter.get("/sale-bills/:billNo", saleBillController.getSaleBillDetail);
storeRouter.post("/sale-bills/:billNo/collection-link", saleBillController.createCollectionLink);
storeRouter.post("/sale-bills/:billNo/offline-payment", saleBillController.offlinePayment);
storeRouter.post("/sale-bills/:billNo/payment", saleBillController.paymentOnSaleBill);

storeRouter.get("/inventory", inventoryController.listInventory);
storeRouter.post("/inventory/adjust", inventoryController.adjustInventory);
storeRouter.get("/inventory/logs", inventoryController.listInventoryLogs);
storeRouter.get("/inventory/alerts", inventoryController.listInventoryAlerts);

storeRouter.post("/hold-orders", otherController.createHoldOrder);
storeRouter.get("/hold-orders", otherController.listHoldOrders);
storeRouter.post("/hold-orders/:holdNo/restore", otherController.restoreHoldOrder);
storeRouter.delete("/hold-orders/:holdNo", otherController.deleteHoldOrder);

storeRouter.get("/collection-links", otherController.listCollectionLinks);
storeRouter.get("/payment-orders", otherController.listPaymentOrders);
storeRouter.get("/refund-orders", otherController.listRefundOrders);

storeRouter.get("/receivables", receivableController.listReceivables);
storeRouter.post("/receivables/:receivableNo/payment", receivableController.paymentOnReceivable);

storeRouter.get("/dashboard", receivableController.getDashboard);
storeRouter.get("/daily-sales", receivableController.getDailySales);

storeRouter.get("/shift/current", shiftController.getCurrentShift);
storeRouter.post("/shift/settle", shiftController.settleShift);
storeRouter.get("/shift/history", shiftController.getShiftHistory);

storeRouter.get("/tags", tagController.listTags);
storeRouter.get("/tag-groups", tagController.listGroups);
storeRouter.get("/batches/:id", batchController.getBatchDetail);
storeRouter.get("/batches/:id/trace", batchController.getTraceChain);
