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

export async function updateProductPrice(skuId: number, payload: { retailPrice?: number; wholesalePrice?: number; miniappPrice?: number; storePrice?: number; costPrice?: number }) {
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

export async function fetchCollectionLinks(params?: { page?: number; pageSize?: number; status?: string; keyword?: string }) {
  const { data } = await api.get("/admin/collection-links", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function batchCreateCollectionLinks(payload: { billNos: string[]; shareChannel?: string; amount?: number; expireHours?: number }) {
  const { data } = await api.post("/admin/collection-links/batch", payload);
  return data.data;
}

export async function revokeCollectionLink(linkNo: string) {
  const { data } = await api.put(`/admin/collection-links/${linkNo}/revoke`);
  return data.data;
}

export async function fetchCollectionStats() {
  const { data } = await api.get("/admin/collection-links/stats");
  return data.data;
}

export async function fetchSaleBillCollectionLinks(billNo: string) {
  const { data } = await api.get(`/admin/sale-bills/${billNo}/collection-links`);
  return data.data;
}

// ==================== Customer Price APIs ====================
export async function fetchCustomerPrices(params?: { page?: number; pageSize?: number; keyword?: string; customerId?: number; status?: string }) {
  const { data } = await api.get("/admin/customer-prices", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createCustomerPrice(payload: { customerId: number; customerName: string; skuId: number; skuName: string; standardPrice: number; customPrice: number; startDate?: string; endDate?: string; remark?: string }) {
  const { data } = await api.post("/admin/customer-prices", payload);
  return data.data;
}
export async function updateCustomerPrice(id: number, payload: { customPrice?: number; standardPrice?: number; startDate?: string; endDate?: string; remark?: string }) {
  const { data } = await api.put(`/admin/customer-prices/${id}`, payload);
  return data.data;
}
export async function deleteCustomerPrice(id: number) {
  const { data } = await api.delete(`/admin/customer-prices/${id}`);
  return data.data;
}
export async function batchSetCustomerPrices(payload: { customerId: number; customerName: string; skuIds: number[]; skuNames: string[]; standardPrices: number[]; discountRate: number; startDate?: string; endDate?: string }) {
  const { data } = await api.post("/admin/customer-prices/batch", payload);
  return data.data;
}

// ==================== Commission APIs ====================
export async function fetchCommissionRules(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/commission/rules", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createCommissionRule(payload: { name: string; ruleType: string; config: any; startDate?: string; endDate?: string; remark?: string }) {
  const { data } = await api.post("/admin/commission/rules", payload);
  return data.data;
}
export async function updateCommissionRule(id: number, payload: any) {
  const { data } = await api.put(`/admin/commission/rules/${id}`, payload);
  return data.data;
}
export async function deleteCommissionRule(id: number) {
  const { data } = await api.delete(`/admin/commission/rules/${id}`);
  return data.data;
}
export async function fetchCommissionRecords(params?: { page?: number; pageSize?: number; staffId?: number; status?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/commission/records", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function calculateCommission(payload: { dateStart: string; dateEnd: string }) {
  const { data } = await api.post("/admin/commission/calculate", payload);
  return data.data;
}
export async function settleCommission(ids: number[]) {
  const { data } = await api.post("/admin/commission/settle", { ids });
  return data.data;
}
export async function fetchCommissionStats() {
  const { data } = await api.get("/admin/commission/stats");
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

export async function fetchReportSupplierRanking(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/supplier-ranking", { params });
  return data.data;
}

export async function fetchReportPurchaseTrend(params?: { granularity?: string; months?: number }) {
  const { data } = await api.get("/admin/reports/purchase-trend", { params });
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

export async function fetchReportStaffPerformance(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/staff-performance", { params });
  return data.data;
}

// ==================== Supplier APIs ====================
export async function fetchSuppliers(params?: { keyword?: string; supplyType?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/suppliers", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createSupplier(payload: unknown) {
  const { data } = await api.post("/admin/suppliers", payload);
  return data.data;
}
export async function updateSupplier(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/suppliers/${id}`, payload);
  return data.data;
}

// ==================== Purchase APIs ====================
export async function fetchPurchaseOrders(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createPurchaseOrder(payload: unknown) {
  const { data } = await api.post("/admin/purchase-orders", payload);
  return data.data;
}

export async function fetchPurchaseOrderDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-orders/${id}`);
  return data.data;
}

export async function cancelPurchaseOrder(id: number) {
  const { data } = await api.post(`/admin/purchase-orders/${id}/cancel`);
  return data.data;
}

export async function confirmPurchaseOrder(id: number) {
  const { data } = await api.post(`/admin/purchase-orders/${id}/confirm`);
  return data.data;
}

export async function purchaseInStock(payload: unknown) {
  const { data } = await api.post("/admin/purchase-in-stocks", payload);
  return data.data;
}

export async function fetchPurchaseInStocks(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-in-stocks", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchPurchaseReturns(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-returns", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createPurchaseReturn(payload: unknown) {
  const { data } = await api.post("/admin/purchase-returns", payload);
  return data.data;
}

// ==================== Sale Return APIs ====================
export async function fetchSaleReturns(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/sale-returns", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createSaleReturn(payload: unknown) {
  const { data } = await api.post("/admin/sale-returns", payload);
  return data.data;
}

// ==================== Statement / Customer Payment APIs ====================
export async function fetchCustomerStatements(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customer-statements", { params: { page: 1, pageSize: 20, ...params } });
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
  const { data } = await api.get("/admin/supplier-statements", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchSupplierStatementDetail(id: number) {
  const { data } = await api.get(`/admin/supplier-statements/${id}`);
  return data.data;
}
export async function generateSupplierStatement(payload: unknown) {
  const { data } = await api.post("/admin/supplier-statements/generate", payload);
  return data.data;
}
export async function confirmSupplierStatement(id: number) {
  const { data } = await api.post(`/admin/supplier-statements/${id}/confirm`);
  return data.data;
}
export async function disputeSupplierStatement(id: number, payload?: unknown) {
  const { data } = await api.post(`/admin/supplier-statements/${id}/dispute`, payload || {});
  return data.data;
}

// ==================== Purchase Plan APIs ====================
export async function fetchPurchasePlans(params?: { page?: number; pageSize?: number; status?: string; supplierId?: number }) {
  const { data } = await api.get("/admin/purchase-plans", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createPurchasePlan(payload: { planName: string; supplierId?: number; supplierName?: string; items: any[]; remark?: string }) {
  const { data } = await api.post("/admin/purchase-plans", payload);
  return data.data;
}
export async function fetchPurchasePlanDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-plans/${id}`);
  return data.data;
}
export async function approvePurchasePlan(id: number) {
  const { data } = await api.post(`/admin/purchase-plans/${id}/approve`);
  return data.data;
}
export async function convertPurchasePlanToOrder(id: number) {
  const { data } = await api.post(`/admin/purchase-plans/${id}/convert`);
  return data.data;
}
export async function cancelPurchasePlan(id: number) {
  const { data } = await api.post(`/admin/purchase-plans/${id}/cancel`);
  return data.data;
}
export async function fetchReplenishmentSuggestions() {
  const { data } = await api.get("/admin/purchase-plans/replenish/suggestions");
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

// ==================== Instant Retail APIs ====================
export async function fetchInstantRetailConfigs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/instant-retail/configs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createInstantRetailConfig(payload: unknown) {
  const { data } = await api.post("/admin/instant-retail/configs", payload);
  return data.data;
}
export async function updateInstantRetailConfig(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/instant-retail/configs/${id}`, payload);
  return data.data;
}

export async function fetchShelfProducts(params?: { keyword?: string; category?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/instant-retail/shelf", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function addShelfProduct(payload: unknown) {
  const { data } = await api.post("/admin/instant-retail/shelf", payload);
  return data.data;
}
export async function removeShelfProduct(id: number) {
  const { data } = await api.delete(`/admin/instant-retail/shelf/${id}`);
  return data.data;
}
export async function updateShelfProduct(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/instant-retail/shelf/${id}`, payload);
  return data.data;
}

export async function fetchInstantOrders(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/instant-retail/orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInstantOrderDetail(orderNo: string) {
  const { data } = await api.get(`/admin/instant-retail/orders/${orderNo}`);
  return data.data;
}
export async function confirmInstantOrder(orderNo: string) {
  const { data } = await api.post(`/admin/instant-retail/orders/${orderNo}/confirm`);
  return data.data;
}
export async function cancelInstantOrder(orderNo: string) {
  const { data } = await api.post(`/admin/instant-retail/orders/${orderNo}/cancel`);
  return data.data;
}
export async function refundInstantOrder(orderNo: string) {
  const { data } = await api.post(`/admin/instant-retail/orders/${orderNo}/refund`);
  return data.data;
}

export async function fetchInstantPayments(params?: { orderNo?: string; paymentMethod?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/instant-retail/payments", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInstantPaymentDetail(paymentNo: string) {
  const { data } = await api.get(`/admin/instant-retail/payments/${paymentNo}`);
  return data.data;
}

export async function fetchInstantDeliveries(params?: { orderNo?: string; deliveryStatus?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/instant-retail/deliveries", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function assignDelivery(deliveryId: number, payload: { riderId: number; riderName: string }) {
  const { data } = await api.post(`/admin/instant-retail/deliveries/${deliveryId}/assign`, payload);
  return data.data;
}
export async function updateDeliveryStatus(deliveryId: number, payload: { status: string }) {
  const { data } = await api.put(`/admin/instant-retail/deliveries/${deliveryId}/status`, payload);
  return data.data;
}

export async function fetchInstantReportSummary(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/instant-retail/reports/summary", { params });
  return data.data;
}
export async function fetchInstantReportTrend(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/instant-retail/reports/trend", { params });
  return data.data;
}

export async function fetchInstantPlatformConfig() {
  const { data } = await api.get("/admin/instant-retail/platform/config");
  return data.data;
}
export async function updateInstantPlatformConfig(payload: unknown) {
  const { data } = await api.put("/admin/instant-retail/platform/config", payload);
  return data.data;
}

export async function fetchOrderBoardData() {
  const { data } = await api.get("/admin/instant-retail/order-board");
  return data.data;
}

// ==================== Brand APIs ====================
export async function fetchBrands(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/brands", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createBrand(payload: { name: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/brands", payload);
  return data.data;
}
export async function updateBrand(id: number, payload: { name?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/brands/${id}`, payload);
  return data.data;
}
export async function deleteBrand(id: number) {
  const { data } = await api.delete(`/admin/brands/${id}`);
  return data.data;
}

// ==================== Unit APIs ====================
export async function fetchUnits(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/units", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createUnit(payload: { name: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/units", payload);
  return data.data;
}
export async function updateUnit(id: number, payload: { name?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/units/${id}`, payload);
  return data.data;
}
export async function deleteUnit(id: number) {
  const { data } = await api.delete(`/admin/units/${id}`);
  return data.data;
}

// ==================== Product Import API ====================
export async function importProducts(payload: { rows: Record<string, unknown>[]; mapping?: Record<string, string> }) {
  const { data } = await api.post("/admin/products/import", payload);
  return data.data;
}

// ==================== Product Tag Group APIs ====================
export async function fetchProductTagGroups() {
  const { data } = await api.get("/admin/product-tag-groups");
  return data.data;
}
export async function createProductTagGroup(payload: { groupCode: string; groupName: string; description?: string; sortNo?: number }) {
  const { data } = await api.post("/admin/product-tag-groups", payload);
  return data.data;
}
export async function updateProductTagGroup(id: number, payload: { groupName?: string; description?: string; sortNo?: number; status?: string }) {
  const { data } = await api.put(`/admin/product-tag-groups/${id}`, payload);
  return data.data;
}
export async function deleteProductTagGroup(id: number) {
  const { data } = await api.delete(`/admin/product-tag-groups/${id}`);
  return data.data;
}

// ==================== Product Tag APIs ====================
export async function fetchProductTags(params?: { keyword?: string; tagType?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/product-tags", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createProductTag(payload: { name: string; tagType: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/product-tags", payload);
  return data.data;
}
export async function updateProductTag(id: number, payload: { name?: string; tagType?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/product-tags/${id}`, payload);
  return data.data;
}
export async function deleteProductTag(id: number) {
  const { data } = await api.delete(`/admin/product-tags/${id}`);
  return data.data;
}

// ==================== Product Category APIs ====================
export async function fetchProductCategories() {
  const { data } = await api.get("/admin/products/categories");
  return data.data;
}
export async function createProductCategory(payload: { name: string; parentId?: number; icon?: string; sortNo?: number }) {
  const { data } = await api.post("/admin/products/categories", payload);
  return data.data;
}
export async function updateProductCategory(id: number, payload: { name?: string; parentId?: number; icon?: string; sortNo?: number }) {
  const { data } = await api.put(`/admin/products/categories/${id}`, payload);
  return data.data;
}
export async function deleteProductCategory(id: number) {
  const { data } = await api.delete(`/admin/products/categories/${id}`);
  return data.data;
}
export async function sortProductCategory(id: number, payload: { parentId: number | null; sortOrder: number }) {
  const { data } = await api.put(`/admin/products/categories/${id}/sort`, payload);
  return data.data;
}

// ==================== Marketing Tag APIs ====================
export async function fetchMarketingTags(params?: { keyword?: string; tagType?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/marketing/tags", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createMarketingTag(payload: { name: string; tagType: string; color?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/marketing/tags", payload);
  return data.data;
}
export async function updateMarketingTag(id: number, payload: { name?: string; tagType?: string; color?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/marketing/tags/${id}`, payload);
  return data.data;
}
export async function deleteMarketingTag(id: number) {
  const { data } = await api.delete(`/admin/marketing/tags/${id}`);
  return data.data;
}
export async function fetchMarketingTagsByType() {
  const { data } = await api.get("/admin/marketing/tags/by-type");
  return data.data;
}
export async function fetchProductMarketingTags(productId: number) {
  const { data } = await api.get(`/admin/products/${productId}/marketing-tags`);
  return data.data;
}
export async function setProductMarketingTags(productId: number, tagIds: number[]) {
  const { data } = await api.put(`/admin/products/${productId}/marketing-tags`, { tagIds });
  return data.data;
}

// ==================== Daily Settlement APIs ====================
export async function fetchDailySettlements(params?: { page?: number; pageSize?: number; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/daily-settlements", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createDailySettlement(payload: { settlementDate: string; storeId?: number }) {
  const { data } = await api.post("/admin/daily-settlements", payload);
  return data.data;
}
export async function fetchDailySettlementDetail(id: number) {
  const { data } = await api.get(`/admin/daily-settlements/${id}`);
  return data.data;
}

// ==================== Order Stats API ====================
export async function fetchOrderStatusStats() {
  const { data } = await api.get("/admin/orders/stats");
  return data.data;
}

// ==================== Customer Stats API ====================
export async function fetchCustomerStats() {
  const { data } = await api.get("/admin/members/stats");
  return data.data;
}

// ==================== Inventory Balance API ====================
export async function fetchInventoryBalanceList() {
  const { data } = await api.get("/admin/inventory-balance");
  return data.data;
}

// ==================== Sale Bills Export API ====================
export async function exportSaleBillsCsv(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/sale-bills/export-csv", { params, responseType: "blob" });
  return data as Blob;
}

// ==================== Phase 6: 库存成本核算 API ====================
export async function fetchInventoryCostDetail(params?: { page?: number; pageSize?: number; storeId?: number; keyword?: string }) {
  const { data } = await api.get("/admin/inventory-cost/cost-detail", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInventoryCostTrend(params?: { skuId?: number; days?: number }) {
  const { data } = await api.get("/admin/inventory-cost/cost-trend", { params });
  return data.data;
}

// ==================== Phase 6: 库存预警配置 API ====================
export async function fetchStockWarningConfigs(params?: { page?: number; pageSize?: number; storeId?: number }) {
  const { data } = await api.get("/admin/stock-warning/configs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchStockWarnings(params?: { page?: number; pageSize?: number; storeId?: number }) {
  const { data } = await api.get("/admin/stock-warning/warnings", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createStockWarningConfig(payload: { storeId: number; skuIds: number[]; minQty: number; maxQty: number }) {
  const { data } = await api.post("/admin/stock-warning/config", payload);
  return data.data;
}
export async function updateStockWarningConfig(id: number, payload: { minQty?: number; maxQty?: number; enabled?: number }) {
  const { data } = await api.put(`/admin/stock-warning/configs/${id}`, payload);
  return data.data;
}
export async function deleteStockWarningConfig(id: number) {
  const { data } = await api.delete(`/admin/stock-warning/configs/${id}`);
  return data.data;
}

// ==================== Phase 6: 库存报表 API ====================
export async function fetchInventoryTurnover(params?: { page?: number; pageSize?: number; storeId?: number }) {
  const { data } = await api.get("/reports/inventory-turnover", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInventoryAge(params?: { storeId?: number }) {
  const { data } = await api.get("/reports/inventory-age", { params });
  return data.data;
}
export async function fetchInventoryABC(params?: { storeId?: number }) {
  const { data } = await api.get("/reports/inventory-abc", { params });
  return data.data;
}

// ==================== Phase 7: 客户管理 API ====================

// --- 积分与等级 ---
export async function fetchPointsRules() {
  const { data } = await api.get("/admin/customers/points-rules");
  return data.data;
}
export async function createPointsRule(payload: { name: string; earnType: string; earnRatio: number; dailyLimit: number }) {
  const { data } = await api.post("/admin/customers/points-rules", payload);
  return data.data;
}
export async function updatePointsRule(id: number, payload: { name?: string; earnRatio?: number; dailyLimit?: number; status?: string }) {
  const { data } = await api.put(`/admin/customers/points-rules/${id}`, payload);
  return data.data;
}
export async function deletePointsRule(id: number) {
  const { data } = await api.delete(`/admin/customers/points-rules/${id}`);
  return data.data;
}
export async function fetchPointsRecords(params?: { customerId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/points-records", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function adjustCustomerPoints(customerId: number, payload: { points: number; remark: string }) {
  const { data } = await api.post(`/admin/customers/customers/${customerId}/points/adjust`, payload);
  return data.data;
}
export async function fetchLevelConfigs() {
  const { data } = await api.get("/admin/customers/level-configs");
  return data.data;
}
export async function createLevelConfig(payload: { name: string; minPoints: number; maxPoints: number; discountRate: number; benefits: string }) {
  const { data } = await api.post("/admin/customers/level-configs", payload);
  return data.data;
}
export async function updateLevelConfig(id: number, payload: { name?: string; minPoints?: number; maxPoints?: number; discountRate?: number; benefits?: string; status?: string }) {
  const { data } = await api.put(`/admin/customers/level-configs/${id}`, payload);
  return data.data;
}
export async function deleteLevelConfig(id: number) {
  const { data } = await api.delete(`/admin/customers/level-configs/${id}`);
  return data.data;
}
export async function fetchLevelUpgradeRecords(params?: { customerId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/level-upgrade-records", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function updateMemberLevel(customerId: number, payload: { levelId: number; reason: string }) {
  const { data } = await api.post(`/admin/customers/customers/${customerId}/level`, payload);
  return data.data;
}

// --- 储值卡 ---
export async function fetchStoreValueCards(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/store-value-cards", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createStoreValueCard(payload: { customerId: number; amount: number }) {
  const { data } = await api.post("/admin/customers/store-value-cards", payload);
  return data.data;
}
export async function rechargeStoreValueCard(id: number, payload: { amount: number; paymentMethod: string; remark: string }) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/recharge`, payload);
  return data.data;
}
export async function consumeStoreValueCard(id: number, payload: { amount: number; source: string; remark: string }) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/consume`, payload);
  return data.data;
}
export async function refundStoreValueCard(id: number, payload: { amount: number; remark: string }) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/refund`, payload);
  return data.data;
}
export async function freezeStoreValueCard(id: number) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/freeze`);
  return data.data;
}
export async function unfreezeStoreValueCard(id: number) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/unfreeze`);
  return data.data;
}
export async function fetchStoreValueTransactions(params?: { cardId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/store-value-transactions", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// --- 会员体系 ---
export async function registerMember(payload: { name: string; mobile: string; password: string; referrerId?: number }) {
  const { data } = await api.post("/admin/customers/members/register", payload);
  return data.data;
}
export async function fetchMemberCard(customerId: number) {
  const { data } = await api.get(`/admin/customers/customers/${customerId}/card`);
  return data.data;
}
export async function fetchMemberBenefits() {
  const { data } = await api.get("/admin/customers/member-benefits");
  return data.data;
}
export async function updateMemberBenefits(levelId: number, payload: { benefits: { benefitCode: string; enabled: number; configValue?: string }[] }) {
  const { data } = await api.put(`/admin/customers/member-benefits/${levelId}`, payload);
  return data.data;
}

// --- 客户标签 ---
export async function fetchCustomerTags(params?: { tagGroup?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/customer-tags", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createCustomerTag(payload: { name: string; tagGroup: string; tagType: string; color: string; sortNo?: number }) {
  const { data } = await api.post("/admin/customers/customer-tags", payload);
  return data.data;
}
export async function updateCustomerTag(id: number, payload: { name?: string; tagGroup?: string; color?: string; sortNo?: number }) {
  const { data } = await api.put(`/admin/customers/customer-tags/${id}`, payload);
  return data.data;
}
export async function deleteCustomerTag(id: number) {
  const { data } = await api.delete(`/admin/customers/customer-tags/${id}`);
  return data.data;
}
export async function addCustomerTag(payload: { customerId: number; tagId: number }) {
  const { data } = await api.post("/admin/customers/customer-tags/add", payload);
  return data.data;
}
export async function removeCustomerTag(payload: { customerId: number; tagId: number }) {
  const { data } = await api.post("/admin/customers/customer-tags/remove", payload);
  return data.data;
}
export async function getCustomerTags(customerId: number) {
  const { data } = await api.get(`/admin/customers/customers/${customerId}/tags`);
  return data.data;
}

// --- 客户画像 ---
export async function fetchCustomerProfile(customerId: number) {
  const { data } = await api.get(`/admin/customers/customers/${customerId}/profile`);
  return data.data;
}
export async function updateCustomerProfile(customerId: number, payload: { ageRange?: string; gender?: string; preferCategories?: string; preferBrands?: string; lifecycleStage?: string }) {
  const { data } = await api.put(`/admin/customers/customers/${customerId}/profile`, payload);
  return data.data;
}

// --- 关怀规则 ---
export async function fetchCareRules() {
  const { data } = await api.get("/admin/customers/care-rules");
  return data.data;
}
export async function createCareRule(payload: { name: string; triggerType: string; contentTemplate: string; rewardPoints: number }) {
  const { data } = await api.post("/admin/customers/care-rules", payload);
  return data.data;
}
export async function updateCareRule(id: number, payload: { name?: string; triggerType?: string; contentTemplate?: string; rewardPoints?: number }) {
  const { data } = await api.put(`/admin/customers/care-rules/${id}`, payload);
  return data.data;
}
export async function deleteCareRule(id: number) {
  const { data } = await api.delete(`/admin/customers/care-rules/${id}`);
  return data.data;
}
export async function executeCareRule(id: number) {
  const { data } = await api.post(`/admin/customers/care-rules/${id}/execute`);
  return data.data;
}
export async function fetchCareLogs(params?: { page?: number; pageSize?: number; ruleId?: number }) {
  const { data } = await api.get("/admin/customers/care-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// --- 生命周期 ---
export async function fetchLifecycleStages() {
  const { data } = await api.get("/admin/customers/lifecycle/stages");
  return data.data;
}
export async function fetchLifecycleTrend() {
  const { data } = await api.get("/admin/customers/lifecycle/trend");
  return data.data;
}
export async function fetchLifecycleDetail(params?: { page?: number; pageSize?: number; stage?: string }) {
  const { data } = await api.get("/admin/customers/lifecycle/detail", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// --- 客户分群 ---
export async function fetchSegments() {
  const { data } = await api.get("/admin/customers/segments");
  return data.data;
}
export async function createSegment(payload: { name: string; conditions: Record<string, unknown>; refreshType: string }) {
  const { data } = await api.post("/admin/customers/segments", payload);
  return data.data;
}
export async function updateSegment(id: number, payload: { name?: string; conditions?: Record<string, unknown>; refreshType?: string }) {
  const { data } = await api.put(`/admin/customers/segments/${id}`, payload);
  return data.data;
}
export async function deleteSegment(id: number) {
  const { data } = await api.delete(`/admin/customers/segments/${id}`);
  return data.data;
}
export async function refreshSegment(id: number) {
  const { data } = await api.post(`/admin/customers/segments/${id}/refresh`);
  return data.data;
}
export async function fetchSegmentMembers(segmentId: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/admin/customers/segments/${segmentId}/members`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ==================== Phase 8: 财务往来 API ====================

// --- 收款 ---
export async function fetchReceipts(params?: { customerId?: number; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/receipts", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createReceipt(payload: { customerId: number; amount: number; paymentMethod: string; bankAccount: string; date: string }) {
  const { data } = await api.post("/admin/finance/receipts", payload);
  return data.data;
}
export async function getReceiptDetail(id: number) {
  const { data } = await api.get(`/admin/finance/receipts/${id}`);
  return data.data;
}
export async function writeoffReceipt(id: number, payload: { billIds: number[]; amounts: number[] }) {
  const { data } = await api.post(`/admin/finance/receipts/${id}/writeoff`, payload);
  return data.data;
}
export async function voidReceipt(id: number) {
  const { data } = await api.post(`/admin/finance/receipts/${id}/void`);
  return data.data;
}

// --- 付款 ---
export async function fetchPaymentsNew(params?: { supplierId?: number; type?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/payments", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createPaymentNew(payload: { supplierId: number; amount: number; type: string; paymentMethod: string; bankAccount: string; date: string }) {
  const { data } = await api.post("/admin/finance/payments", payload);
  return data.data;
}
export async function getPaymentDetail(id: number) {
  const { data } = await api.get(`/admin/finance/payments/${id}`);
  return data.data;
}
export async function writeoffPayment(id: number, payload: { billIds: number[]; amounts: number[] }) {
  const { data } = await api.post(`/admin/finance/payments/${id}/writeoff`, payload);
  return data.data;
}
export async function voidPayment(id: number) {
  const { data } = await api.post(`/admin/finance/payments/${id}/void`);
  return data.data;
}

// --- 应收应付汇总 ---
export async function fetchReceivablesSummary(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/finance/receivables-summary", { params });
  return data.data;
}
export async function fetchPayablesSummary(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/finance/payables-summary", { params });
  return data.data;
}

// --- 费用 ---
export async function fetchExpenses(params?: { expenseType?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/expenses", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createExpense(payload: { expenseType: string; category: string; amount: number; payee: string; paymentMethod: string; bankAccount: string; invoiceNo: string; expenseDate: string; remark: string }) {
  const { data } = await api.post("/admin/finance/expenses", payload);
  return data.data;
}
export async function getExpenseDetail(id: number) {
  const { data } = await api.get(`/admin/finance/expenses/${id}`);
  return data.data;
}
export async function approveExpense(id: number, approved: boolean) {
  const { data } = await api.post(`/admin/finance/expenses/${id}/approve`, { approved });
  return data.data;
}
export async function voidExpense(id: number) {
  const { data } = await api.post(`/admin/finance/expenses/${id}/void`);
  return data.data;
}
export async function fetchExpenseSummary(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/finance/expense-summary", { params });
  return data.data;
}

// --- 对账 ---
export async function fetchCustomerReconciliation(params?: { status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/reconciliation/customer", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchCustomerReconciliationDetail(id: number) {
  const { data } = await api.get(`/admin/finance/reconciliation/customer/${id}`);
  return data.data;
}
export async function confirmCustomerReconciliation(id: number) {
  const { data } = await api.post(`/admin/finance/reconciliation/customer/${id}/confirm`);
  return data.data;
}
export async function fetchSupplierReconciliation(params?: { status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/reconciliation/supplier", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchSupplierReconciliationDetail(id: number) {
  const { data } = await api.get(`/admin/finance/reconciliation/supplier/${id}`);
  return data.data;
}
export async function confirmSupplierReconciliation(id: number) {
  const { data } = await api.post(`/admin/finance/reconciliation/supplier/${id}/confirm`);
  return data.data;
}
export async function generateReconciliation(payload: { reconType: string; entityId: number; periodStart: string; periodEnd: string }) {
  const { data } = await api.post("/admin/finance/reconciliation/generate", payload);
  return data.data;
}

// --- 驾驶舱 ---
export async function fetchFinanceDashboard() {
  const { data } = await api.get("/admin/finance/dashboard");
  return data.data;
}
export async function fetchCashFlow(params?: { range?: string }) {
  const { data } = await api.get("/admin/finance/cash-flow", { params });
  return data.data;
}
export async function fetchProfitTrend(params?: { range?: string }) {
  const { data } = await api.get("/admin/finance/profit-trend", { params });
  return data.data;
}
export async function fetchTopCustomersAR() {
  const { data } = await api.get("/admin/finance/top-customers-ar");
  return data.data;
}
export async function fetchTopSuppliersAP() {
  const { data } = await api.get("/admin/finance/top-suppliers-ap");
  return data.data;
}
export async function fetchDailyReport(params?: { month?: string }) {
  const { data } = await api.get("/admin/finance/daily-report", { params });
  return data.data;
}
