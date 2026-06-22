import axios from "axios";

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".onepan.cn")) {
    return "https://api.onepan.cn/api";
  }
  return ["http://", "localhost", ":8080/api"].join("");
}

export const api = axios.create({
  baseURL: resolveApiBase()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("admin_token");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(error);
  }
);

export async function adminLogin(username: string, password: string) {
  const { data } = await api.post("/admin/auth/login", { username, password });
  return data.data as { token: string; user: unknown };
}

export async function fetchDashboard() {
  const { data } = await api.get("/admin/reports/dashboard");
  return data.data;
}

export async function fetchProducts(params?: { keyword?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/products", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createProduct(payload: unknown) {
  const { data } = await api.post("/admin/products", payload);
  return data.data;
}

export async function fetchStores() {
  const { data } = await api.get("/admin/stores");
  return data.data;
}

export async function fetchMembers(params?: { keyword?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/members", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function createMember(payload: { name: string; mobile: string; customerType: "RETAIL" | "WHOLESALE"; staffId?: number }) {
  const { data } = await api.post("/admin/members", payload);
  return data.data;
}

export async function fetchStaff() {
  const { data } = await api.get("/admin/staff");
  return data.data;
}

export async function assignMember(memberId: number, staffId: number) {
  const { data } = await api.post(`/admin/members/${memberId}/assign`, { staffId });
  return data.data;
}

export async function fetchMemberPriceHistory(memberId: number, skuId: number) {
  const { data } = await api.get(`/admin/members/${memberId}/price-history`, { params: { skuId } });
  return data.data || [];
}

export async function createStore(payload: { code: string; name: string; address?: string; phone?: string }) {
  const { data } = await api.post("/admin/stores", payload);
  return data.data;
}

export function fetchStoreDetail(id: number) {
  return api.get(`/admin/stores/${id}`)
}

export function updateStore(id: number, data: {
  name?: string
  address?: string
  contact?: string
  phone?: string
  deliveryRadius?: number
  businessStatus?: string
  miniappAppid?: string
  wxMerchantName?: string
  wxServicePhone?: string
  wxHeadImg?: string
  wxQrcodeUrl?: string
}) {
  return api.patch(`/admin/stores/${id}`, data)
}

export function fetchWxInfo(storeId: number) {
  return api.post(`/admin/stores/${storeId}/fetch-wx-info`)
}

export async function updateProductPrice(skuId: number, payload: { retailPrice?: number; wholesalePrice?: number; miniappPrice?: number }) {
  const { data } = await api.put(`/admin/products/${skuId}/price`, payload);
  return data.data;
}

export async function updateProductStatus(spuId: number, status: "DRAFT" | "ON_SALE" | "OFF_SALE") {
  const { data } = await api.patch(`/admin/products/${spuId}/status`, { status });
  return data.data;
}

export async function fetchPriceLogs(skuId: number) {
  const { data } = await api.get(`/admin/products/${skuId}/price-logs`);
  return data.data as { records: unknown[] };
}

export async function fetchOrders(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function exportOrdersCsv(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/orders/export.csv", { params, responseType: "blob" });
  return data as Blob;
}

export async function fetchSaleBills() {
  const { data } = await api.get("/admin/sale-bills", { params: { page: 1, pageSize: 20 } });
  return data.data;
}

export async function fetchInventoryLogs() {
  const { data } = await api.get("/admin/inventory/logs", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchCollectionLinks() {
  const { data } = await api.get("/admin/collection-links", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchPaymentOrders() {
  const { data } = await api.get("/admin/payment-orders", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchRefundOrders() {
  const { data } = await api.get("/admin/refund-orders", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchInventoryBalances() {
  const { data } = await api.get("/admin/inventory/balances");
  return data.data;
}

export async function fetchOrderDetail(orderNo: string) {
  const { data } = await api.get(`/admin/orders/${orderNo}`);
  return data.data;
}

export async function fetchDailySales() {
  const { data } = await api.get("/admin/reports/daily-sales");
  return data.data || [];
}

export async function fetchOrderStats() {
  const { data } = await api.get("/admin/reports/order-stats");
  return data.data || [];
}

export async function fetchStorePerformance() {
  const { data } = await api.get("/admin/reports/store-performance");
  return data.data || [];
}

export async function fetchInventoryAlerts() {
  const { data } = await api.get("/admin/inventory/alerts");
  return data.data || [];
}

export async function fetchSaleBillDetail(billNo: string) {
  const { data } = await api.get(`/store/sale-bills/${billNo}`);
  return data.data;
}

export async function createSaleBill(payload: {
  customerId?: number;
  items: Array<{ skuId: number; quantity: number; unitPrice: number }>;
  discountAmount?: number;
  roundDownAmount?: number;
  paymentMethod?: string;
  receivedAmount?: number;
}) {
  const { data } = await api.post("/store/sale-bills", payload);
  return data.data;
}

export async function acceptOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/accept`);
  return data.data;
}

export async function rejectOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/reject`);
  return data.data;
}

export async function startDelivery(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/start-delivery`);
  return data.data;
}

export async function completeDelivery(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/complete-delivery`);
  return data.data;
}

export async function batchUpdateOrderStatus(orderNos: string[], action: string) {
  const { data } = await api.post("/admin/orders/batch-action", { orderNos, action });
  return data.data;
}

export async function fetchOrderLogs(orderNo: string) {
  const { data } = await api.get(`/admin/orders/${orderNo}/logs`);
  return data.data || [];
}

export async function createCollectionLink(billNo: string, payload: { amount: number; shareChannel: string; expireHours: number }) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/collection-link`, payload);
  return data.data;
}

// ==================== Dashboard APIs ====================
export async function fetchDashboardOverview() {
  const { data } = await api.get("/admin/dashboard/overview");
  return data.data;
}

export async function fetchDashboardSalesTrend() {
  const { data } = await api.get("/admin/dashboard/sales-trend");
  return data.data;
}

export async function fetchDashboardCategoryPie() {
  const { data } = await api.get("/admin/dashboard/category-pie");
  return data.data;
}

export async function fetchDashboardTopProducts() {
  const { data } = await api.get("/admin/dashboard/top-products");
  return data.data;
}

export async function fetchDashboardTopCustomers() {
  const { data } = await api.get("/admin/dashboard/top-customers");
  return data.data;
}

export async function fetchDashboardRecentAlerts() {
  const { data } = await api.get("/admin/dashboard/recent-alerts");
  return data.data;
}

// ==================== Report APIs ====================
export async function fetchReportSalesDaily(params?: { dateType?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/sales-daily", { params });
  return data.data;
}

export async function fetchReportSalesRanking(params?: { dimension?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/sales-ranking", { params });
  return data.data;
}

export async function fetchReportSalesTrend(params?: { dateType?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/sales-trend", { params });
  return data.data;
}

export async function fetchReportCustomerContribution() {
  const { data } = await api.get("/admin/reports/customer-contribution");
  return data.data;
}

export async function fetchReportPurchaseSummary() {
  const { data } = await api.get("/admin/reports/purchase-summary");
  return data.data;
}

export async function fetchReportSupplierRanking() {
  const { data } = await api.get("/admin/reports/supplier-ranking");
  return data.data;
}

export async function fetchReportInventorySummary() {
  const { data } = await api.get("/admin/reports/inventory-summary");
  return data.data;
}

export async function fetchReportInventoryTurnover() {
  const { data } = await api.get("/admin/reports/inventory-turnover");
  return data.data;
}

export async function fetchReportInventoryAge() {
  const { data } = await api.get("/admin/reports/inventory-age");
  return data.data;
}

export async function fetchReportReceivablePayable() {
  const { data } = await api.get("/admin/reports/receivable-payable");
  return data.data;
}

export async function fetchReportPaymentAnalysis() {
  const { data } = await api.get("/admin/reports/payment-analysis");
  return data.data;
}

export async function fetchReportProfit() {
  const { data } = await api.get("/admin/reports/profit");
  return data.data;
}

export async function fetchReportBusinessOverview() {
  const { data } = await api.get("/admin/reports/business-overview");
  return data.data;
}

// ==================== Supplier APIs ====================
export async function fetchSuppliers(params?: { keyword?: string; supplyType?: string; status?: string }) {
  const { data } = await api.get("/admin/suppliers", { params });
  return data.data;
}

export async function createSupplier(payload: unknown) {
  const { data } = await api.post("/admin/suppliers", payload);
  return data.data;
}

// ==================== Purchase APIs ====================
export async function fetchPurchaseOrders(params?: { keyword?: string; status?: string }) {
  const { data } = await api.get("/admin/purchase-orders", { params });
  return data.data;
}

export async function createPurchaseOrder(payload: unknown) {
  const { data } = await api.post("/admin/purchase-orders", payload);
  return data.data;
}

export async function purchaseInStock(payload: unknown) {
  const { data } = await api.post("/admin/purchase-in-stock", payload);
  return data.data;
}

export async function createPurchaseReturn(payload: unknown) {
  const { data } = await api.post("/admin/purchase-returns", payload);
  return data.data;
}

// ==================== Sale Return APIs ====================
export async function fetchSaleReturns(params?: { keyword?: string; status?: string }) {
  const { data } = await api.get("/admin/sale-returns", { params });
  return data.data;
}

export async function createSaleReturn(payload: unknown) {
  const { data } = await api.post("/admin/sale-returns", payload);
  return data.data;
}

// ==================== Statement / Customer Payment APIs ====================
export async function fetchCustomerStatements(params?: { keyword?: string; status?: string }) {
  const { data } = await api.get("/admin/customer-statements", { params });
  return data.data;
}

export async function generateCustomerStatement(payload: unknown) {
  const { data } = await api.post("/admin/customer-statements/generate", payload);
  return data.data;
}

export async function createCustomerPayment(payload: unknown) {
  const { data } = await api.post("/admin/customer-payments", payload);
  return data.data;
}

// ==================== Alert APIs ====================
export async function fetchAlerts(params?: { type?: string; level?: string; status?: string }) {
  const { data } = await api.get("/admin/alerts/list", { params });
  return data.data;
}

export async function handleAlertItem(id: number, payload: { status: string }) {
  const { data } = await api.put(`/admin/alerts/${id}/handle`, payload);
  return data.data;
}

export async function fetchAlertRules() {
  const { data } = await api.get("/admin/alerts/rules");
  return data.data;
}

export async function updateAlertRule(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/alerts/rules/${id}`, payload);
  return data.data;
}

// ==================== Staff Management APIs ====================
export async function createStaff(payload: { username: string; realName: string; mobile: string; role: string; storeId?: number }) {
  const { data } = await api.post("/admin/staff", payload);
  return data.data;
}

export async function updateStaff(id: number, payload: { username?: string; realName?: string; mobile?: string; role?: string; storeId?: number }) {
  const { data } = await api.put(`/admin/staff/${id}`, payload);
  return data.data;
}

export async function toggleStaffStatus(id: number, status: number) {
  const { data } = await api.patch(`/admin/staff/${id}/status`, { status });
  return data.data;
}

// ==================== Product Edit API ====================
export async function updateProduct(spuId: number, payload: { name?: string; barcode?: string; category?: string; brand?: string; unit?: string; boxRatio?: number; specs?: string }) {
  const { data } = await api.put(`/admin/products/${spuId}`, payload);
  return data.data;
}

// ==================== Enhanced Sale Bills API ====================
export async function fetchSaleBillsEnhanced(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/sale-bills", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ==================== Enhanced Report APIs ====================
export async function fetchReportReceivablePayableEnhanced(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/receivable-payable", { params });
  return data.data;
}

export async function fetchReportProfitEnhanced(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/profit", { params });
  return data.data;
}

// ==================== Price Center APIs ====================
export async function fetchPriceLevels(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/prices/levels", { params });
  return data.data;
}
export async function createPriceLevel(payload: unknown) {
  const { data } = await api.post("/admin/prices/levels", payload);
  return data.data;
}
export async function updatePriceLevel(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/prices/levels/${id}`, payload);
  return data.data;
}
export async function deletePriceLevel(id: number) {
  const { data } = await api.delete(`/admin/prices/levels/${id}`);
  return data.data;
}
export async function fetchSkuPrices(skuId: number) {
  const { data } = await api.get(`/admin/prices/skus/${skuId}/prices`);
  return data.data;
}
export async function createSkuPrice(skuId: number, payload: unknown) {
  const { data } = await api.post(`/admin/prices/skus/${skuId}/prices`, payload);
  return data.data;
}
export async function updatePrice(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/prices/prices/${id}`, payload);
  return data.data;
}
export async function deletePrice(id: number) {
  const { data } = await api.delete(`/admin/prices/prices/${id}`);
  return data.data;
}
export async function fetchCustomerBindings(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/prices/customer-bindings", { params });
  return data.data;
}
export async function createCustomerBinding(payload: unknown) {
  const { data } = await api.post("/admin/prices/customer-bindings", payload);
  return data.data;
}
export async function approveCustomerBinding(id: number) {
  const { data } = await api.put(`/admin/prices/customer-bindings/${id}/approve`);
  return data.data;
}
export async function rejectCustomerBinding(id: number) {
  const { data } = await api.put(`/admin/prices/customer-bindings/${id}/reject`);
  return data.data;
}
export async function calcBestPrice(payload: unknown) {
  const { data } = await api.post("/admin/prices/best-price", payload);
  return data.data;
}
export async function fetchPriceChangeLogs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/prices/change-logs", { params });
  return data.data;
}

// ==================== Credit Management APIs ====================
export async function fetchCredits(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/credits", { params });
  return data.data;
}
export async function fetchCreditDetail(customerId: number) {
  const { data } = await api.get(`/admin/credits/${customerId}`);
  return data.data;
}
export async function createCredit(customerId: number, payload: unknown) {
  const { data } = await api.post(`/admin/credits/${customerId}`, payload);
  return data.data;
}
export async function updateCreditLimit(customerId: number, payload: unknown) {
  const { data } = await api.put(`/admin/credits/${customerId}/limit`, payload);
  return data.data;
}
export async function updateCreditTerm(customerId: number, payload: unknown) {
  const { data } = await api.put(`/admin/credits/${customerId}/term`, payload);
  return data.data;
}
export async function freezeCredit(customerId: number, payload: unknown) {
  const { data } = await api.post(`/admin/credits/${customerId}/freeze`, payload);
  return data.data;
}
export async function unfreezeCredit(customerId: number, payload: unknown) {
  const { data } = await api.post(`/admin/credits/${customerId}/unfreeze`, payload);
  return data.data;
}
export async function fetchCreditLogs(customerId: number) {
  const { data } = await api.get(`/admin/credits/${customerId}/logs`);
  return data.data;
}
export async function fetchCollections(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/credits/collections", { params });
  return data.data;
}
export async function createCollection(payload: unknown) {
  const { data } = await api.post("/admin/credits/collections", payload);
  return data.data;
}
export async function updateCollection(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/credits/collections/${id}`, payload);
  return data.data;
}
export async function fetchOverdueCollections(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/credits/collections/overdue", { params });
  return data.data;
}
export async function batchRemindCollections(payload: unknown) {
  const { data } = await api.post("/admin/credits/collections/batch-remind", payload);
  return data.data;
}
export async function fetchCollectionStatistics() {
  const { data } = await api.get("/admin/credits/collections/statistics");
  return data.data;
}

// ==================== After-sales APIs ====================
export async function fetchAfterSales(params?: { keyword?: string; status?: string; type?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/aftersales", { params });
  return data.data;
}
export async function fetchAfterSaleDetail(id: number) {
  const { data } = await api.get(`/admin/aftersales/${id}`);
  return data.data;
}
export async function approveAfterSale(id: number, payload?: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/approve`, payload);
  return data.data;
}
export async function rejectAfterSale(id: number, payload?: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/reject`, payload);
  return data.data;
}
export async function confirmReceiptAfterSale(id: number) {
  const { data } = await api.post(`/admin/aftersales/${id}/confirm-receipt`);
  return data.data;
}
export async function inspectAfterSale(id: number, payload: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/inspect`, payload);
  return data.data;
}
export async function completeAfterSale(id: number, payload: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/complete`, payload);
  return data.data;
}
export async function fetchAfterSaleStatistics() {
  const { data } = await api.get("/admin/aftersales/statistics");
  return data.data;
}

// ==================== Trace Management APIs ====================
export async function fetchTraceConfigs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/trace/configs", { params });
  return data.data;
}
export async function createTraceConfig(payload: unknown) {
  const { data } = await api.post("/admin/trace/configs", payload);
  return data.data;
}
export async function updateTraceConfig(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/trace/configs/${id}`, payload);
  return data.data;
}
export async function deleteTraceConfig(id: number) {
  const { data } = await api.delete(`/admin/trace/configs/${id}`);
  return data.data;
}
export async function generateTraceCodes(payload: unknown) {
  const { data } = await api.post("/admin/trace/codes/generate", payload);
  return data.data;
}
export async function fetchTraceCodes(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/trace/codes", { params });
  return data.data;
}
export async function fetchTraceCodeDetail(traceCode: string) {
  const { data } = await api.get(`/admin/trace/codes/${traceCode}`);
  return data.data;
}
export async function updateTraceCodeStatus(traceCode: string, payload: unknown) {
  const { data } = await api.post(`/admin/trace/codes/${traceCode}/status`, payload);
  return data.data;
}
export async function fetchTraceCodeStatistics() {
  const { data } = await api.get("/admin/trace/codes/statistics");
  return data.data;
}
export async function queryTraceCode(traceCode: string) {
  const { data } = await api.get(`/admin/trace/query/${traceCode}`);
  return data.data;
}
export async function fetchRecalls(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/trace/recalls", { params });
  return data.data;
}
export async function createRecall(payload: unknown) {
  const { data } = await api.post("/admin/trace/recalls", payload);
  return data.data;
}
export async function updateRecall(recallNo: string, payload: unknown) {
  const { data } = await api.put(`/admin/trace/recalls/${recallNo}`, payload);
  return data.data;
}
export async function executeRecall(recallNo: string, payload: unknown) {
  const { data } = await api.post(`/admin/trace/recalls/${recallNo}/execute`, payload);
  return data.data;
}
export async function completeRecall(recallNo: string) {
  const { data } = await api.put(`/admin/trace/recalls/${recallNo}/complete`);
  return data.data;
}

// ==================== Order Timeout Config APIs ====================
export async function fetchOrderTimeoutConfigs() {
  const { data } = await api.get("/admin/order-timeout/configs");
  return data.data;
}
export async function createOrderTimeoutConfig(payload: { orderType: string; timeoutType: string; timeoutMinutes: number; action: string; enabled?: boolean; description?: string }) {
  const { data } = await api.post("/admin/order-timeout/configs", payload);
  return data.data;
}
export async function updateOrderTimeoutConfig(id: number, payload: { orderType?: string; timeoutType?: string; timeoutMinutes?: number; action?: string; enabled?: boolean; description?: string }) {
  const { data } = await api.put(`/admin/order-timeout/configs/${id}`, payload);
  return data.data;
}
export async function deleteOrderTimeoutConfig(id: number) {
  const { data } = await api.delete(`/admin/order-timeout/configs/${id}`);
  return data.data;
}
export async function fetchOrderTimeoutLogs(params?: { page?: number; pageSize?: number; result?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/order-timeout/logs", { params });
  return data.data;
}
export async function fetchOrderTimeoutStatistics() {
  const { data } = await api.get("/admin/order-timeout/statistics");
  return data.data;
}

// ==================== Inventory Batch APIs ====================
export async function fetchInventoryBatches(params?: { page?: number; pageSize?: number; storeId?: number; skuId?: number; expiryStatus?: string }) {
  const { data } = await api.get("/admin/inventory-batch/batches", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInventoryBatchDetail(id: number) {
  const { data } = await api.get(`/admin/inventory-batch/batches/${id}`);
  return data.data;
}
export async function createInventoryBatch(payload: unknown) {
  const { data } = await api.post("/admin/inventory-batch/batches", payload);
  return data.data;
}
export async function updateInventoryBatch(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/inventory-batch/batches/${id}`, payload);
  return data.data;
}
export async function splitInventoryBatch(id: number, payload: unknown) {
  const { data } = await api.post(`/admin/inventory-batch/batches/${id}/split`, payload);
  return data.data;
}
export async function fetchFifoSuggestion(storeId: number, skuId: number) {
  const { data } = await api.get(`/admin/inventory-batch/batches/fifo-suggestion/${storeId}/${skuId}`);
  return data.data;
}

// ==================== Expiry Alert Config APIs ====================
export async function fetchExpiryConfigs() {
  const { data } = await api.get("/admin/inventory-batch/expiry-configs");
  return data.data;
}
export async function createExpiryConfig(payload: unknown) {
  const { data } = await api.post("/admin/inventory-batch/expiry-configs", payload);
  return data.data;
}
export async function updateExpiryConfig(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/inventory-batch/expiry-configs/${id}`, payload);
  return data.data;
}
export async function deleteExpiryConfig(id: number) {
  const { data } = await api.delete(`/admin/inventory-batch/expiry-configs/${id}`);
  return data.data;
}

// ==================== Expiry Alert Record APIs ====================
export async function fetchExpiryAlerts(params?: { page?: number; pageSize?: number; alertLevel?: number; status?: string; storeId?: number }) {
  const { data } = await api.get("/admin/inventory-batch/expiry-alerts", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function handleExpiryAlert(id: number, payload?: { remark?: string }) {
  const { data } = await api.put(`/admin/inventory-batch/expiry-alerts/${id}/handle`, payload || {});
  return data.data;
}
export async function fetchExpiryAlertStatistics() {
  const { data } = await api.get("/admin/inventory-batch/expiry-alerts/statistics");
  return data.data;
}

// ==================== Store Control APIs ====================
export async function fetchStoreControlConfigs() {
  const { data } = await api.get("/admin/store-control/configs");
  return data.data;
}
export async function fetchStoreControlConfig(storeId: number) {
  const { data } = await api.get(`/admin/store-control/configs/${storeId}`);
  return data.data;
}
export async function updateStoreControlConfig(storeId: number, payload: unknown) {
  const { data } = await api.put(`/admin/store-control/configs/${storeId}`, payload);
  return data.data;
}
export async function openStore(storeId: number) {
  const { data } = await api.post(`/admin/store-control/${storeId}/open`);
  return data.data;
}
export async function closeStore(storeId: number) {
  const { data } = await api.post(`/admin/store-control/${storeId}/close`);
  return data.data;
}
export async function suspendStore(storeId: number, reason?: string) {
  const { data } = await api.post(`/admin/store-control/${storeId}/suspend`, { reason });
  return data.data;
}
export async function resumeStore(storeId: number) {
  const { data } = await api.post(`/admin/store-control/${storeId}/resume`);
  return data.data;
}
export async function fetchStoreControlLogs(params?: { page?: number; pageSize?: number; storeId?: number; changeType?: string }) {
  const { data } = await api.get("/admin/store-control/logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ==================== Marketing - Coupon Template APIs ====================
export async function fetchCouponTemplates(params?: { page?: number; pageSize?: number; status?: string; type?: string; keyword?: string }) {
  const { data } = await api.get("/admin/marketing/coupons/templates", { params });
  return data.data;
}
export async function fetchCouponTemplateDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/coupons/templates/${id}`);
  return data.data;
}
export async function createCouponTemplate(payload: unknown) {
  const { data } = await api.post("/admin/marketing/coupons/templates", payload);
  return data.data;
}
export async function updateCouponTemplate(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/coupons/templates/${id}`, payload);
  return data.data;
}
export async function deleteCouponTemplate(id: number) {
  const { data } = await api.delete(`/admin/marketing/coupons/templates/${id}`);
  return data.data;
}
export async function activateCouponTemplate(id: number) {
  const { data } = await api.post(`/admin/marketing/coupons/templates/${id}/activate`);
  return data.data;
}
export async function pauseCouponTemplate(id: number) {
  const { data } = await api.post(`/admin/marketing/coupons/templates/${id}/pause`);
  return data.data;
}
export async function fetchUserCoupons(params?: { page?: number; pageSize?: number; status?: string; userId?: number; templateId?: number }) {
  const { data } = await api.get("/admin/marketing/coupons/users", { params });
  return data.data;
}
export async function fetchCouponStatistics() {
  const { data } = await api.get("/admin/marketing/coupons/statistics");
  return data.data;
}

// ==================== Marketing - Full Reduction APIs ====================
export async function fetchFullReductions(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/full-reduction", { params });
  return data.data;
}
export async function fetchFullReductionDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/promotions/full-reduction/${id}`);
  return data.data;
}
export async function createFullReduction(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/full-reduction", payload);
  return data.data;
}
export async function updateFullReduction(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/full-reduction/${id}`, payload);
  return data.data;
}
export async function deleteFullReduction(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/full-reduction/${id}`);
  return data.data;
}
export async function activateFullReduction(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/full-reduction/${id}/activate`);
  return data.data;
}
export async function pauseFullReduction(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/full-reduction/${id}/pause`);
  return data.data;
}

// ==================== Marketing - Flash Sale APIs ====================
export async function fetchFlashSales(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/flash-sale", { params });
  return data.data;
}
export async function fetchFlashSaleDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/promotions/flash-sale/${id}`);
  return data.data;
}
export async function createFlashSale(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/flash-sale", payload);
  return data.data;
}
export async function updateFlashSale(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/flash-sale/${id}`, payload);
  return data.data;
}
export async function deleteFlashSale(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/flash-sale/${id}`);
  return data.data;
}
export async function activateFlashSale(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/flash-sale/${id}/activate`);
  return data.data;
}
export async function pauseFlashSale(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/flash-sale/${id}/pause`);
  return data.data;
}
export async function fetchFlashSaleStatistics() {
  const { data } = await api.get("/admin/marketing/promotions/flash-sale/statistics");
  return data.data;
}

// ==================== Marketing - Group Buy APIs ====================
export async function fetchGroupBuys(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/group-buy", { params });
  return data.data;
}
export async function fetchGroupBuyDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/promotions/group-buy/${id}`);
  return data.data;
}
export async function createGroupBuy(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/group-buy", payload);
  return data.data;
}
export async function updateGroupBuy(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/group-buy/${id}`, payload);
  return data.data;
}
export async function deleteGroupBuy(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/group-buy/${id}`);
  return data.data;
}
export async function activateGroupBuy(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/group-buy/${id}/activate`);
  return data.data;
}
export async function fetchGroupBuyTeams(params?: { page?: number; pageSize?: number; activityId?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/group-buy/teams", { params });
  return data.data;
}

// ==================== Marketing - Stack Rule APIs ====================
export async function fetchStackRules() {
  const { data } = await api.get("/admin/marketing/promotions/stack-rules");
  return data.data;
}
export async function createStackRule(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/stack-rules", payload);
  return data.data;
}
export async function updateStackRule(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/stack-rules/${id}`, payload);
  return data.data;
}
export async function deleteStackRule(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/stack-rules/${id}`);
  return data.data;
}
export async function calculatePromotion(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/calculate", payload);
  return data.data;
}

// ==================== Audit Log APIs ====================
export async function fetchAuditLogs(params?: { page?: number; pageSize?: number; userId?: number; action?: string; resourceType?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/audit-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchAuditLogStatistics() {
  const { data } = await api.get("/admin/audit-logs/statistics");
  return data.data;
}

// ==================== Export APIs ====================
export async function exportCustomersCsv(params?: { keyword?: string }) {
  const { data } = await api.get("/admin/export/customers", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportSuppliersCsv(params?: { keyword?: string; supplyType?: string }) {
  const { data } = await api.get("/admin/export/suppliers", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportProductsCsv(params?: { keyword?: string }) {
  const { data } = await api.get("/admin/export/products", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportInventoryCsv(params?: { storeId?: number; keyword?: string }) {
  const { data } = await api.get("/admin/export/inventory", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportPurchaseOrdersCsv(params?: { keyword?: string; status?: string }) {
  const { data } = await api.get("/admin/export/purchase-orders", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportPaymentsCsv(params?: { status?: string }) {
  const { data } = await api.get("/admin/export/payments", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportAuditLogsCsv(params?: { action?: string; resourceType?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/export/audit-logs", { params, responseType: "blob" });
  return data as Blob;
}

// ==================== System Config APIs ====================
export async function fetchSysConfig() {
  const { data } = await api.get("/admin/sys-config");
  return data.data;
}
export async function fetchSysConfigGroup(group: string) {
  const { data } = await api.get(`/admin/sys-config/${group}`);
  return data.data;
}
export async function batchUpdateSysConfig(payload: { config_key: string; config_value: string }[]) {
  const { data } = await api.put("/admin/sys-config/batch", payload);
  return data.data;
}
export async function createSysConfig(payload: { config_key: string; config_value?: string; config_group: string; description?: string }) {
  const { data } = await api.post("/admin/sys-config", payload);
  return data.data;
}

// ==================== Purchase Payment APIs ====================
export async function fetchPurchasePayments(params?: { supplierId?: number; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-payments", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchPurchasePaymentDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-payments/${id}`);
  return data.data;
}
export async function createPurchasePayment(payload: unknown) {
  const { data } = await api.post("/admin/purchase-payments", payload);
  return data.data;
}
export async function updatePurchasePayment(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/purchase-payments/${id}`, payload);
  return data.data;
}
export async function approvePurchasePayment(id: number) {
  const { data } = await api.post(`/admin/purchase-payments/${id}/approve`);
  return data.data;
}
export async function payPurchasePayment(id: number) {
  const { data } = await api.post(`/admin/purchase-payments/${id}/pay`);
  return data.data;
}
export async function cancelPurchasePayment(id: number) {
  const { data } = await api.post(`/admin/purchase-payments/${id}/cancel`);
  return data.data;
}
export async function fetchPurchasePaymentStatistics() {
  const { data } = await api.get("/admin/purchase-payments/statistics");
  return data.data;
}

// ==================== Supplier Statement APIs ====================
export async function fetchSupplierStatements(params?: { supplierId?: number; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-payments/supplier-statements", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchSupplierStatementDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-payments/supplier-statements/${id}`);
  return data.data;
}
export async function generateSupplierStatement(payload: unknown) {
  const { data } = await api.post("/admin/purchase-payments/supplier-statements/generate", payload);
  return data.data;
}
export async function confirmSupplierStatement(id: number) {
  const { data } = await api.post(`/admin/purchase-payments/supplier-statements/${id}/confirm`);
  return data.data;
}
export async function disputeSupplierStatement(id: number, payload?: unknown) {
  const { data } = await api.post(`/admin/purchase-payments/supplier-statements/${id}/dispute`, payload || {});
  return data.data;
}

// ==================== RBAC / Role APIs ====================
export async function fetchRoles() {
  const { data } = await api.get("/admin/roles");
  return data.data;
}
export async function fetchRoleDetail(id: number) {
  const { data } = await api.get(`/admin/roles/${id}`);
  return data.data;
}
export async function createRole(payload: unknown) {
  const { data } = await api.post("/admin/roles", payload);
  return data.data;
}
export async function updateRole(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/roles/${id}`, payload);
  return data.data;
}
export async function deleteRole(id: number) {
  const { data } = await api.delete(`/admin/roles/${id}`);
  return data.data;
}
export async function fetchUserRoles(userId: number) {
  const { data } = await api.get(`/admin/roles/users/${userId}/roles`);
  return data.data;
}
export async function setUserRoles(userId: number, roleIds: number[]) {
  const { data } = await api.put(`/admin/roles/users/${userId}/roles`, { roleIds });
  return data.data;
}

// ==================== Notification APIs ====================
export async function fetchNotifications(params?: { type?: string; isRead?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/notifications", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchNotificationUnreadCount() {
  const { data } = await api.get("/admin/notifications/unread-count");
  return data.data;
}
export async function markNotificationRead(id: number) {
  const { data } = await api.put(`/admin/notifications/${id}/read`);
  return data.data;
}
export async function markAllNotificationsRead() {
  const { data } = await api.post("/admin/notifications/read-all");
  return data.data;
}
export async function sendNotification(payload: unknown) {
  const { data } = await api.post("/admin/notifications/send", payload);
  return data.data;
}

// ==================== Transfer (调拨) APIs ====================
export async function fetchTransfers(params?: { page?: number; pageSize?: number; status?: string; storeId?: number; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/transfers", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchTransferDetail(id: number) {
  const { data } = await api.get(`/admin/transfers/${id}`);
  return data.data;
}
export async function createTransfer(payload: unknown) {
  const { data } = await api.post("/admin/transfers", payload);
  return data.data;
}
export async function updateTransfer(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/transfers/${id}`, payload);
  return data.data;
}
export async function submitTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/submit`);
  return data.data;
}
export async function approveTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/approve`);
  return data.data;
}
export async function rejectTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/reject`);
  return data.data;
}
export async function cancelTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/cancel`);
  return data.data;
}
export async function shipTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/ship`);
  return data.data;
}
export async function receiveTransfer(id: number, payload: unknown) {
  const { data } = await api.post(`/store/transfers/${id}/receive`, payload);
  return data.data;
}
export async function fetchTransferStatistics() {
  const { data } = await api.get("/admin/transfers/statistics");
  return data.data;
}

// ==================== Stock Check (盘点) APIs ====================
export async function fetchStockChecks(params?: { page?: number; pageSize?: number; storeId?: number; status?: string }) {
  const { data } = await api.get("/admin/stock-checks", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchStockCheckDetail(id: number) {
  const { data } = await api.get(`/admin/stock-checks/${id}`);
  return data.data;
}
export async function createStockCheck(payload: unknown) {
  const { data } = await api.post("/admin/stock-checks", payload);
  return data.data;
}
export async function updateStockCheck(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/stock-checks/${id}`, payload);
  return data.data;
}
export async function startStockCheck(id: number) {
  const { data } = await api.post(`/admin/stock-checks/${id}/start`);
  return data.data;
}
export async function completeStockCheck(id: number) {
  const { data } = await api.post(`/admin/stock-checks/${id}/complete`);
  return data.data;
}
export async function cancelStockCheck(id: number) {
  const { data } = await api.post(`/admin/stock-checks/${id}/cancel`);
  return data.data;
}
export async function handleStockCheckDiff(id: number, payload: { itemId: number }) {
  const { data } = await api.post(`/admin/stock-checks/${id}/handle-diff`, payload);
  return data.data;
}
export async function fetchStockCheckStatistics() {
  const { data } = await api.get("/admin/stock-checks/statistics");
  return data.data;
}
