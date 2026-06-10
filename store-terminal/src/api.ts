import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:8080/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("store_token") || localStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function storeLogin(username: string, password: string) {
  const { data } = await api.post("/admin/auth/login", { username, password });
  return data.data as { token: string; user: unknown };
}

export async function createSaleBill(payload: unknown) {
  const { data } = await api.post("/store/sale-bills", payload);
  return data.data;
}

export async function createCollectionLink(billNo: string, amount: number) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/collection-link`, {
    shareChannel: "LINK",
    amount,
    expireHours: 72
  });
  return data.data;
}

export async function fetchInventory() {
  const { data } = await api.get("/store/inventory");
  return data.data;
}

export async function fetchStoreOrders() {
  const { data } = await api.get("/store/orders", { params: { page: 1, pageSize: 20 } });
  return data.data;
}

export async function acceptStoreOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/accept`, {});
  return data.data;
}

export async function completeStoreOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/complete`, {});
  return data.data;
}

export async function fetchSaleBills() {
  const { data } = await api.get("/store/sale-bills", { params: { page: 1, pageSize: 20 } });
  return data.data;
}

export async function fetchSaleBillDetail(billNo: string) {
  const { data } = await api.get(`/store/sale-bills/${billNo}`);
  return data.data;
}

export async function adjustInventory(params: { skuId: number; stockType: string; change: number; remark?: string }) {
  const { data } = await api.post("/store/inventory/adjust", params);
  return data.data;
}

export async function fetchInventoryLogs() {
  const { data } = await api.get("/store/inventory/logs", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchStoreCollectionLinks() {
  const { data } = await api.get("/store/collection-links", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchStorePaymentOrders() {
  const { data } = await api.get("/store/payment-orders", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchStoreOrderDetail(orderNo: string) {
  const { data } = await api.get(`/store/orders/${orderNo}`);
  return data.data;
}

export async function fetchStoreDashboard() {
  const { data } = await api.get("/store/dashboard");
  return data.data;
}

export async function fetchStoreDailySales() {
  const { data } = await api.get("/store/daily-sales");
  return data.data || [];
}

export async function fetchStoreInventoryAlerts() {
  const { data } = await api.get("/store/inventory/alerts");
  return data.data || [];
}
