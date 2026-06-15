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

export async function searchStoreProducts(keyword: string) {
  const { data } = await api.get("/store/products", { params: { keyword } });
  return data.data as { records: any[] };
}

export async function searchStoreMembers(keyword: string) {
  const { data } = await api.get("/store/members", { params: { keyword } });
  return data.data as { records: any[] };
}

export async function createOfflinePayment(billNo: string, amount: number, paymentMethod: string) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/offline-payment`, { amount, paymentMethod });
  return data.data;
}

export async function createCollectionLink(billNo: string, amount: number, options?: { taxEnabled?: boolean; taxRate?: number }) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/collection-link`, {
    shareChannel: "LINK",
    amount,
    taxEnabled: options?.taxEnabled ?? false,
    taxRate: options?.taxRate ?? 0,
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

export async function fetchStoreRefundOrders() {
  const { data } = await api.get("/store/refund-orders", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function createHoldOrder(payload: {
  customerName?: string;
  customerMobile?: string;
  amount: number;
  remark?: string;
  items: Array<{ skuId: number; skuName: string; quantity: number; unitPrice: number; subtotalAmount: number }>;
}) {
  const { data } = await api.post("/store/hold-orders", payload);
  return data.data;
}

export async function fetchHoldOrders() {
  const { data } = await api.get("/store/hold-orders", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function restoreHoldOrder(holdNo: string) {
  const { data } = await api.post(`/store/hold-orders/${holdNo}/restore`);
  return data.data;
}

export async function deleteHoldOrder(holdNo: string) {
  const { data } = await api.delete(`/store/hold-orders/${holdNo}`);
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
