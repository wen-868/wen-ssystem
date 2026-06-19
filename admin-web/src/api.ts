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
