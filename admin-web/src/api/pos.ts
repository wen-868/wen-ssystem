import { api } from "./request";

// ==================== Position Management APIs ====================
export async function fetchPositions(params?: { page?: number; pageSize?: number; keyword?: string; departmentId?: number }) {
  const { data } = await api.get("/admin/positions", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createPosition(payload: { name: string; departmentId: number; level: "JUNIOR" | "MIDDLE" | "SENIOR" | "MANAGER"; salary?: string; description?: string; status?: string }) {
  const { data } = await api.post("/admin/positions", payload);
  return data.data;
}
export async function updatePosition(id: number, payload: { name?: string; departmentId?: number; level?: "JUNIOR" | "MIDDLE" | "SENIOR" | "MANAGER"; salary?: string; description?: string; status?: string }) {
  const { data } = await api.put(`/admin/positions/${id}`, payload);
  return data.data;
}
export async function togglePositionStatus(id: number) {
  const { data } = await api.patch(`/admin/positions/${id}/status`);
  return data.data;
}
export async function deletePosition(id: number) {
  const { data } = await api.delete(`/admin/positions/${id}`);
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


// ==================== 门店收银（POS）APIs ====================
// 以下函数供 admin-web 中合并的 pos 页面使用，复用后端 /store/* 路由
// 后端路由使用 requireAuthWithTenant，复用 admin-web 的 admin_token 即可

// ---------- 商品/会员搜索 ----------
/** 搜索商品：keyword 为空时返回全部在售商品；可同时按分类 / 条码过滤 */
export async function searchStoreProducts(params?: {
  keyword?: string;
  categoryId?: number;
  barcode?: string;
}) {
  const { data } = await api.get("/store/products", {
    params: {
      keyword: params?.keyword || "",
      categoryId: params?.categoryId,
      barcode: params?.barcode || ""
    }
  });
  return data.data as { records: any[] };
}

export async function searchStoreMembers(keyword: string) {
  const { data } = await api.get("/store/members", { params: { keyword } });
  return data.data as { records: any[] };
}

// ---------- 销售单 ----------
export async function createStoreSaleBill(payload: unknown) {
  const { data } = await api.post("/store/sale-bills", payload);
  return data.data;
}

export async function fetchStoreSaleBills(params?: {
  keyword?: string;
  collectionStatus?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get("/store/sale-bills", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchStoreSaleBillDetail(billNo: string) {
  const { data } = await api.get(`/store/sale-bills/${billNo}`);
  return data.data;
}

export async function createStoreOfflinePayment(billNo: string, amount: number, paymentMethod: string) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/offline-payment`, { amount, paymentMethod });
  return data.data;
}

export async function createStoreCollectionLink(billNo: string, amount: number, options?: { taxEnabled?: boolean; taxRate?: number }) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/collection-link`, {
    shareChannel: "LINK",
    amount,
    taxEnabled: options?.taxEnabled ?? false,
    taxRate: options?.taxRate ?? 0,
    expireHours: 72
  });
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

// ---------- 挂单 ----------
export async function createStoreHoldOrder(payload: {
  customerName?: string;
  customerMobile?: string;
  amount: number;
  remark?: string;
  items: Array<{ skuId: number; skuName: string; quantity: number; unitPrice: number; subtotalAmount: number }>;
}) {
  const { data } = await api.post("/store/hold-orders", payload);
  return data.data;
}

export async function fetchStoreHoldOrders(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/hold-orders", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function restoreStoreHoldOrder(holdNo: string) {
  const { data } = await api.post(`/store/hold-orders/${holdNo}/restore`);
  return data.data;
}

export async function deleteStoreHoldOrder(holdNo: string) {
  const { data } = await api.delete(`/store/hold-orders/${holdNo}`);
  return data.data;
}

// ---------- 订单履约 ----------
export async function fetchStoreOrders(params?: { page?: number; pageSize?: number; status?: string; keyword?: string }) {
  const { data } = await api.get("/store/orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchStoreOrderDetail(orderNo: string) {
  const { data } = await api.get(`/store/orders/${orderNo}`);
  return data.data;
}

export async function acceptStoreOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/accept`, {});
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

// ---------- 门店工作台 ----------
export async function fetchStoreDashboard() {
  const { data } = await api.get("/store/dashboard");
  return data.data;
}

export async function fetchStoreDashboardOverview() {
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

// ---------- 日结 ----------
export async function submitStoreDailySettle(payload: { settleDate: string; actualCash?: number; remark?: string }) {
  const { data } = await api.post("/admin/daily-settlements", payload);
  return data.data;
}

export async function fetchStoreDailySettleHistory(params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }) {
  const { data } = await api.get("/admin/daily-settlements", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

// ---------- 交接班 ----------
export async function fetchStoreShifts(params?: { page?: number; pageSize?: number; date?: string; shiftType?: string }) {
  const { data } = await api.get("/store/shift/history", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createStoreShift(payload: {
  shiftType: string;
  startTime: string;
  endTime?: string;
  operatorId?: number;
  operatorName?: string;
  remark?: string;
}) {
  const { data } = await api.post("/store/shift/settle", payload);
  return data.data;
}

export async function fetchStoreShiftDetail(shiftId: number) {
  const { data } = await api.get(`/store/shift/history`);
  return data.data;
}

export async function completeStoreShift(shiftId: number, payload: {
  endTime: string;
  actualCash?: number;
  actualWechat?: number;
  actualAlipay?: number;
  remark?: string;
}) {
  const { data } = await api.post(`/store/shift/settle`, payload);
  return data.data;
}

export async function getStoreShiftSalesStats(shiftId: number) {
  const { data } = await api.get(`/store/shifts/${shiftId}/sales-stats`);
  return data.data;
}

export async function getStoreShiftStockCheck(shiftId: number) {
  const { data } = await api.get(`/store/shifts/${shiftId}/stock-check`);
  return data.data;
}

export async function submitStoreShiftStockCheck(shiftId: number, items: Array<{ skuId: number; bookQty: number; actualQty: number; diffReason?: string }>) {
  const { data } = await api.post(`/store/shifts/${shiftId}/stock-check`, { items });
  return data.data;
}

// ---------- 销售退货 ----------
export async function fetchStoreSaleReturns(params?: { page?: number; pageSize?: number; returnStatus?: string; date?: string }) {
  const { data } = await api.get("/store/sale-returns", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createStoreSaleReturn(payload: {
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

// ---------- 优惠券核销 ----------
export async function verifyStoreCoupon(code: string) {
  const { data } = await api.post("/store/coupons/verify", { code });
  return data.data;
}

export async function manualVerifyStoreCoupon(payload: { couponCode: string; saleBillNo?: string }) {
  const { data } = await api.post("/store/coupons/manual-verify", payload);
  return data.data;
}

export async function fetchStoreCouponVerifyRecords(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get("/store/coupons/verify-records", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ---------- 门店管控 ----------
export async function fetchStoreControlStatus() {
  const { data } = await api.get("/store/control/status");
  return data.data;
}

export async function fetchStoreControlMyLogs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/store/control/my-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// ---------- 操作记录 ----------
export async function fetchStoreOperationLogs(params?: {
  page?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
  operatorName?: string;
  actionType?: string;
}) {
  const { data } = await api.get("/admin/operation-logs", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function fetchStoreOperationLogDetail(logId: number) {
  const { data } = await api.get(`/admin/operation-logs/${logId}`);
  return data.data;
}

export async function fetchExpiringTenants(days?: number) {
  const { data } = await api.get("/admin/monitor/expiring-tenants", { params: { days } });
  return data.data;
}

export async function notifyExpiringTenants(tenantIds: number[]) {
  const { data } = await api.post("/admin/monitor/notify-expiring", { tenantIds });
  return data.data;
}

