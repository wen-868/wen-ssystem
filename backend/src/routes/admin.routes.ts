import { Router } from "express";
import { requireAuth, requireAuthWithTenant } from "../shared/auth.js";
import * as authController from "../controllers/admin/auth.controller.js";
import * as employeeController from "../controllers/admin/employee.controller.js";
import * as productController from "../controllers/admin/product.controller.js";
import * as orderController from "../controllers/admin/order.controller.js";
import * as customerController from "../controllers/admin/customer.controller.js";
import * as reportController from "../controllers/admin/report.controller.js";
import * as dailySettlementController from "../controllers/admin/daily-settlement.controller.js";

export const adminRouter = Router();

// ============ Auth ============
// 注意：login 路由已移至 server.ts 单独挂载（无需认证）
// adminRouter.get("/auth/me", requireAuthWithTenant, authController.getMe);
// adminRouter.get("/auth/settings", requireAuthWithTenant, authController.getSettings);
// adminRouter.put("/auth/settings", requireAuthWithTenant, authController.updateSettings);

// ============ 员工管理 ============
adminRouter.get("/staff", requireAuth, employeeController.listStaff);
adminRouter.post("/staff", requireAuth, employeeController.createStaff);
adminRouter.put("/staff/:id", requireAuth, employeeController.updateStaff);
adminRouter.put("/staff/:id/disable", requireAuth, employeeController.disableStaff);

// ============ 门店管理 ============
adminRouter.get("/stores", requireAuthWithTenant, employeeController.listStores);
adminRouter.post("/stores", requireAuthWithTenant, employeeController.createStore);
adminRouter.get("/stores/:id", requireAuthWithTenant, employeeController.getStore);
adminRouter.put("/stores/:id", requireAuthWithTenant, employeeController.updateStore);
adminRouter.get("/stores/:id/wechat-info", requireAuthWithTenant, employeeController.getStoreWechatInfo);

// ============ 商品管理 ============
adminRouter.get("/products", requireAuthWithTenant, productController.listProducts);
adminRouter.get("/products/:spuId", requireAuthWithTenant, productController.getProductDetail);
adminRouter.post("/products", requireAuthWithTenant, productController.createProduct);
adminRouter.put("/products/:id/status", requireAuthWithTenant, productController.updateProductStatus);
adminRouter.put("/products/:id", requireAuthWithTenant, productController.updateProduct);
adminRouter.put("/products/:id/disable", requireAuthWithTenant, productController.disableProduct);
adminRouter.get("/products/:skuId/price-history", requireAuthWithTenant, productController.getProductPriceHistory);
adminRouter.put("/products/:skuId/price", requireAuthWithTenant, productController.updateProductPrice);
adminRouter.post("/products/import", requireAuthWithTenant, productController.importProducts);
adminRouter.put("/products/:spuId/marketing-tags", requireAuthWithTenant, productController.setMarketingTags);

// ============ 订单管理 ============
adminRouter.get("/orders", requireAuthWithTenant, orderController.listOrders);
adminRouter.get("/orders/export-csv", requireAuthWithTenant, orderController.exportOrdersCsv);
adminRouter.get("/orders/stats", requireAuthWithTenant, orderController.getOrderStatusStats);
adminRouter.get("/orders/:orderNo", requireAuthWithTenant, orderController.getOrderDetail);

// ============ 销售单管理 ============
adminRouter.get("/sale-bills", requireAuthWithTenant, orderController.listSaleBills);
adminRouter.get("/sale-bills/export-csv", requireAuthWithTenant, orderController.exportSaleBillsCsv);

// ============ 客户管理 ============
adminRouter.get("/members", requireAuthWithTenant, customerController.listMembers);
adminRouter.post("/members", requireAuthWithTenant, customerController.createCustomer);
adminRouter.get("/members/stats", requireAuthWithTenant, customerController.getCustomerStats);
adminRouter.get("/members/:id/purchase-stats", requireAuthWithTenant, customerController.getCustomerPurchaseStats);
adminRouter.get("/members/:id", requireAuthWithTenant, customerController.getCustomerDetail);
adminRouter.put("/members/:id", requireAuthWithTenant, customerController.updateCustomer);
adminRouter.put("/members/:id/disable", requireAuthWithTenant, customerController.disableCustomer);
adminRouter.put("/members/:id/assign-staff", requireAuthWithTenant, customerController.assignStaffToCustomer);
adminRouter.get("/members/:id/price-history", requireAuthWithTenant, customerController.getCustomerPriceHistory);
adminRouter.get("/members/:id/sale-bills", requireAuthWithTenant, customerController.listCustomerSaleBills);
adminRouter.get("/members/:id/payments", requireAuthWithTenant, customerController.listCustomerPayments);
adminRouter.get("/members/:id/statements", requireAuthWithTenant, customerController.listCustomerStatements);

// ============ 报表/仪表盘 ============
adminRouter.get("/dashboard", requireAuthWithTenant, reportController.getDashboard);
adminRouter.get("/daily-sales-trend", requireAuthWithTenant, reportController.getDailySalesTrend);
adminRouter.get("/store-sales-performance", requireAuthWithTenant, reportController.getStoreSalesPerformance);
adminRouter.get("/inventory-alerts", requireAuthWithTenant, reportController.getInventoryAlerts);
adminRouter.get("/inventory-balance", requireAuthWithTenant, reportController.listInventoryBalance);
adminRouter.get("/inventory-logs", requireAuthWithTenant, reportController.listInventoryLogs);
adminRouter.get("/collection-links", requireAuthWithTenant, reportController.listCollectionLinks);
adminRouter.get("/payment-orders", requireAuthWithTenant, reportController.listPaymentOrders);
adminRouter.get("/refund-orders", requireAuthWithTenant, reportController.listRefundOrders);

// ============ 分享链接管理 ============
adminRouter.get("/collection-links/stats", requireAuthWithTenant, reportController.getCollectionLinkStats);
adminRouter.post("/collection-links/:linkNo/revoke", requireAuthWithTenant, reportController.revokeCollectionLink);
adminRouter.post("/sale-bills/batch-collection-link", requireAuthWithTenant, reportController.batchCreateCollectionLinks);

// ============ 销售报表 ============
adminRouter.get("/reports/sales-ranking", requireAuthWithTenant, reportController.getSalesRanking);
adminRouter.get("/reports/product-ranking", requireAuthWithTenant, reportController.getProductRanking);
adminRouter.get("/reports/sales-trend", requireAuthWithTenant, reportController.getSalesTrend);

// ============ 采购报表 ============
adminRouter.get("/reports/purchase-summary", requireAuthWithTenant, reportController.getPurchaseSummary);
adminRouter.get("/reports/purchase-trend", requireAuthWithTenant, reportController.getPurchaseTrend);
adminRouter.get("/reports/supplier-ranking", requireAuthWithTenant, reportController.getSupplierRanking);

// ============ 日结 ============
adminRouter.post("/daily-settlements", requireAuthWithTenant, dailySettlementController.createDailySettlement);
adminRouter.get("/daily-settlements", requireAuthWithTenant, dailySettlementController.listDailySettlements);
adminRouter.get("/daily-settlements/:id", requireAuthWithTenant, dailySettlementController.getDailySettlementDetail);

// ============ 采购管理 (admin) — 见 purchase.routes.ts / purchase-in-stock.routes.ts / purchase-return.routes.ts ============
// ============ 供应商管理 (admin) — 见 supplier.routes.ts ============
// ============ 销售退货 (admin) — 见 sale-return.routes.ts ============
// ============ 客户对账/收款 (admin) — 见 customer-statement.routes.ts / customer-payment.routes.ts ============