import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:8080/api"
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
