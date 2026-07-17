import { api } from "./request";

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

export const fetchRetailCartAnalysis = (params?: { keyword?: string; page?: number; pageSize?: number }) =>
  api.get("/admin/retail-cart/analysis", { params });


// ==================== Miniapp Config APIs ====================
export const fetchMiniappConfigs = () => api.get('/admin/miniapp/configs');
export const fetchMiniappConfig = (platform: string) => api.get(`/admin/miniapp/configs/${platform}`);
export const saveMiniappConfig = (platform: string, data: any) => api.put(`/admin/miniapp/configs/${platform}`, data);
export const fetchMiniappTemplates = () => api.get('/admin/miniapp/templates');
export const fetchMiniappTemplate = (id: number) => api.get(`/admin/miniapp/templates/${id}`);
export const publishMiniapp = (data: any) => api.post('/admin/miniapp/publish', data);
export const fetchMiniappPublishLogs = (params: any) => api.get('/admin/miniapp/publish-logs', { params });
export const setTenantModules = (id: number, data: any) => api.put(`/admin/tenants/${id}/modules`, data);


// ==================== Retail Announcement APIs ====================
export async function fetchRetailAnnouncements(params?: { storeId?: number; keyword?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/retail-announcements", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createRetailAnnouncement(payload: { storeId: number; title: string; content: string; isTop: boolean; startTime: string; endTime: string }) {
  const { data } = await api.post("/admin/retail-announcements", payload);
  return data.data;
}
export async function updateRetailAnnouncement(id: number, payload: { storeId?: number; title?: string; content?: string; isTop?: boolean; startTime?: string; endTime?: string; status?: string }) {
  const { data } = await api.put(`/admin/retail-announcements/${id}`, payload);
  return data.data;
}
export async function deleteRetailAnnouncement(id: number) {
  const { data } = await api.delete(`/admin/retail-announcements/${id}`);
  return data.data;
}


