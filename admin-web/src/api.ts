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

export async function adminLogin(username: string, password: string) {
  const { data } = await api.post("/admin/auth/login", { username, password });
  return data.data as { token: string; user: unknown };
}

export async function fetchDashboard() {
  const { data } = await api.get("/admin/reports/dashboard");
  return data.data;
}

export async function fetchProducts() {
  const { data } = await api.get("/admin/products", { params: { page: 1, pageSize: 20 } });
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

export async function fetchMembers() {
  const { data } = await api.get("/admin/members", { params: { page: 1, pageSize: 30 } });
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

export async function updateProductPrice(skuId: number, payload: { retailPrice?: number; wholesalePrice?: number; miniappPrice?: number }) {
  const { data } = await api.put(`/admin/products/${skuId}/price`, payload);
  return data.data;
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

// ==================== 供应商管理 ====================
export async function fetchSuppliers(params?: { keyword?: string; supplierType?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/suppliers", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createSupplier(payload: any) {
  const { data } = await api.post("/admin/suppliers", payload);
  return data.data;
}

export async function fetchSupplierDetail(id: number) {
  const { data } = await api.get(`/admin/suppliers/${id}`);
  return data.data;
}

export async function updateSupplier(id: number, payload: any) {
  const { data } = await api.put(`/admin/suppliers/${id}`, payload);
  return data.data;
}

export async function updateSupplierStatus(id: number, status: string) {
  const { data } = await api.post(`/admin/suppliers/${id}/status`, { status });
  return data.data;
}

export async function fetchSupplierContacts(supplierId: number) {
  const { data } = await api.get(`/admin/suppliers/${supplierId}/contacts`);
  return data.data || [];
}

export async function addSupplierContact(supplierId: number, payload: any) {
  const { data } = await api.post(`/admin/suppliers/${supplierId}/contacts`, payload);
  return data.data;
}

// ==================== 采购订单 ====================
export async function fetchPurchaseOrders(params?: { supplierId?: number; orderStatus?: string; keyword?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createPurchaseOrder(payload: any) {
  const { data } = await api.post("/admin/purchase-orders", payload);
  return data.data;
}

export async function fetchPurchaseOrderDetail(orderNo: string) {
  const { data } = await api.get(`/admin/purchase-orders/${orderNo}`);
  return data.data;
}

export async function submitPurchaseOrder(orderNo: string) {
  const { data } = await api.post(`/admin/purchase-orders/${orderNo}/submit`);
  return data.data;
}

export async function auditPurchaseOrder(orderNo: string, passed: boolean = true, remark?: string) {
  const { data } = await api.post(`/admin/purchase-orders/${orderNo}/audit`, { passed, remark });
  return data.data;
}

export async function voidPurchaseOrder(orderNo: string) {
  const { data } = await api.post(`/admin/purchase-orders/${orderNo}/void`);
  return data.data;
}

export async function closePurchaseOrder(orderNo: string) {
  const { data } = await api.post(`/admin/purchase-orders/${orderNo}/close`);
  return data.data;
}

export async function payPurchaseOrder(orderNo: string, payAmount: number, payMethod?: string) {
  const { data } = await api.post(`/admin/purchase-orders/${orderNo}/payment`, { payAmount, payMethod });
  return data.data;
}

// ==================== 采购入库 ====================
export async function fetchPurchaseInStocks(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-in-stocks", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createPurchaseInStock(payload: any) {
  const { data } = await api.post("/admin/purchase-in-stocks", payload);
  return data.data;
}

// ==================== 客户对账 ====================
export async function fetchCustomerStatements(params?: { customerId?: number; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customer-statements", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ==================== 客户收款 ====================
export async function fetchCustomerPayments(params?: { customerId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customer-payments", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
