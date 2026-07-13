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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("store_token");
      localStorage.removeItem("admin_token");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(error);
  }
);

// 门店登录：后端暂无 /store/auth/login，复用 /admin/auth/login
// TODO: 后端提供 /store/auth/login 后请切换
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

export async function fetchInventory(keyword?: string) {
  const { data } = await api.get("/store/inventory", { params: keyword ? { keyword } : {} });
  return data.data;
}

export async function fetchStoreOrders(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function acceptStoreOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/accept`, {});
  return data.data;
}

export async function startDelivery(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/start-delivery`, {});
  return data.data;
}

export async function rejectStoreOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/reject`, {});
  return data.data;
}

export async function completeStoreOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/complete`, {});
  return data.data;
}

export async function fetchSaleBills(params?: { keyword?: string; collectionStatus?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/sale-bills", { params: { page: 1, pageSize: 20, ...params } });
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

export async function fetchInventoryLogs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/inventory/logs", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function fetchStoreCollectionLinks(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/collection-links", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function fetchStorePaymentOrders(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/payment-orders", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function fetchStoreRefundOrders(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/refund-orders", { params: { page: 1, pageSize: 30, ...params } });
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

export async function fetchHoldOrders(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/hold-orders", { params: { page: 1, pageSize: 30, ...params } });
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

export async function fetchDashboardOverview() {
  const { data } = await api.get("/admin/dashboard/overview");
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

// 日结提交：后端暂无 /store/daily-settle，复用 /admin/daily-settle
// TODO: 后端提供 /store/daily-settle 后请切换
export async function submitDailySettle(payload: { settleDate: string }) {
  const { data } = await api.post("/admin/daily-settle", payload);
  return data.data;
}

// 日结历史：后端暂无 /store/daily-settle，复用 /admin/daily-settle
// TODO: 后端提供 /store/daily-settle 后请切换
export async function fetchDailySettleHistory(params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }) {
  const { data } = await api.get("/admin/daily-settle", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

// ==================== Store Control APIs ====================
export async function fetchStoreControlStatus() {
  const { data } = await api.get("/store/control/status");
  return data.data;
}
export async function fetchStoreControlMyLogs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/control/my-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ==================== Transfer (调拨) APIs ====================
export async function fetchStoreInTransitTransfers() {
  const { data } = await api.get("/store/transfers/in-transit");
  return data.data;
}
export async function fetchStoreMyShipments() {
  const { data } = await api.get("/store/transfers/my-shipments");
  return data.data;
}
export async function receiveStoreTransfer(id: number, payload: unknown) {
  const { data } = await api.post(`/store/transfers/${id}/receive`, payload);
  return data.data;
}

// ==================== Stock Check (盘点) APIs ====================
export async function fetchStoreStockChecks() {
  const { data } = await api.get("/store/stock-checks/my");
  return data.data;
}
export async function fetchStoreStockCheckDetail(id: number) {
  const { data } = await api.get(`/store/stock-checks/${id}`);
  return data.data;
}
export async function updateStockCheckItem(checkId: number, itemId: number, payload: { actualQty: number }) {
  const { data } = await api.put(`/store/stock-checks/${checkId}/items/${itemId}`, payload);
  return data.data;
}
export async function submitStoreStockCheck(id: number) {
  const { data } = await api.post(`/store/stock-checks/${id}/submit`);
  return data.data;
}

// ==================== Shift (交接班) APIs ====================
export async function fetchShiftRecords(params?: { page?: number; pageSize?: number; date?: string; shiftType?: string }) {
  const { data } = await api.get("/store/shifts", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createShiftRecord(payload: {
  shiftType: string;
  startTime: string;
  endTime?: string;
  operatorId?: number;
  operatorName?: string;
  remark?: string;
}) {
  const { data } = await api.post("/store/shifts", payload);
  return data.data;
}

export async function fetchShiftDetail(shiftId: number) {
  const { data } = await api.get(`/store/shifts/${shiftId}`);
  return data.data;
}

export async function completeShift(shiftId: number, payload: {
  endTime: string;
  actualCash?: number;
  actualWechat?: number;
  actualAlipay?: number;
  remark?: string;
}) {
  const { data } = await api.post(`/store/shifts/${shiftId}/complete`, payload);
  return data.data;
}

export async function getShiftSalesStats(shiftId: number) {
  const { data } = await api.get(`/store/shifts/${shiftId}/sales-stats`);
  return data.data;
}

export async function getShiftStockCheck(shiftId: number) {
  const { data } = await api.get(`/store/shifts/${shiftId}/stock-check`);
  return data.data;
}

export async function submitShiftStockCheck(shiftId: number, items: Array<{ skuId: number; bookQty: number; actualQty: number; diffReason?: string }>) {
  const { data } = await api.post(`/store/shifts/${shiftId}/stock-check`, { items });
  return data.data;
}

// ==================== Member (会员) APIs ====================
export async function searchMember(keyword: string) {
  const { data } = await api.get("/store/members/search", { params: { keyword } });
  return data.data;
}

export async function getMemberDetail(memberId: number) {
  const { data } = await api.get(`/store/members/${memberId}`);
  return data.data;
}

export async function getMemberPoints(memberId: number) {
  const { data } = await api.get(`/store/members/${memberId}/points`);
  return data.data;
}

export async function getMemberPointsHistory(memberId: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/store/members/${memberId}/points/history`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function getMemberOrders(memberId: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/store/members/${memberId}/orders`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ==================== Sale Return (销售退货) APIs ====================
export async function fetchSaleReturns(params?: { page?: number; pageSize?: number; returnStatus?: string; date?: string }) {
  const { data } = await api.get("/store/sale-returns", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createSaleReturn(payload: {
  sourceBillNo: string;
  items: Array<{ skuId: number; skuName: string; quantity: number; unitPrice: number; reason?: string }>;
  remark?: string;
}) {
  const { data } = await api.post("/store/sale-returns", payload);
  return data.data;
}

export async function fetchSaleReturnDetail(returnNo: string) {
  const { data } = await api.get(`/store/sale-returns/${returnNo}`);
  return data.data;
}

export async function approveSaleReturn(returnNo: string) {
  const { data } = await api.post(`/store/sale-returns/${returnNo}/approve`);
  return data.data;
}

export async function rejectSaleReturn(returnNo: string, reason: string) {
  const { data } = await api.post(`/store/sale-returns/${returnNo}/reject`, { reason });
  return data.data;
}

// 前端错误上报
export async function reportFrontendError(payload: {
  error_type: string;
  message: string;
  stack?: string;
  url?: string;
}) {
  try {
    await api.post("/error-report", payload);
  } catch {
    // 上报失败静默，不触发二次错误
  }
}
