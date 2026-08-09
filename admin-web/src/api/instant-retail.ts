import { api } from "./request";

// ==================== Instant Retail APIs ====================
export async function fetchInstantRetailConfigs() {
  const { data } = await api.get("/admin/instant-retail/configs");
  return data.data;
}

export async function syncPlatformOrders(platform: string, payload?: { startTime?: string; endTime?: string; pageSize?: number }) {
  const { data } = await api.post(`/admin/instant-retail/configs/${platform}/sync-orders`, payload ?? {});
  return data.data;
}

export async function syncPlatformProducts(platform: string, payload?: { startTime?: string; endTime?: string; pageSize?: number }) {
  const { data } = await api.post(`/admin/instant-retail/configs/${platform}/sync-products`, payload ?? {});
  return data.data;
}

// 同步缓存状态（价格/商品）
export async function fetchSyncStatus(type: "price" | "product") {
  const { data } = await api.get(`/sync/${type}/status`);
  return data.data;
}

export async function fetchSyncLastTime(type: "price" | "product") {
  const { data } = await api.get(`/sync/${type}/last`);
  return data.data;
}

// 订单同步日志（真实后端接口 /api/miniapp-order-sync）
export async function fetchMiniappOrderSyncLogs(params?: { page?: number; pageSize?: number; orderNo?: string; status?: number }) {
  const { data } = await api.get("/miniapp-order-sync", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function retryMiniappOrderSync(orderNo: string) {
  const { data } = await api.post(`/miniapp-order-sync/${orderNo}/retry`);
  return data.data;
}

/** 订单同步日志（真实后端） */
export async function fetchInstantRetailSyncLogs(params?: { page?: number; pageSize?: number; status?: string; platform?: string }) {
  const { data } = await api.get("/admin/instant-retail/sync-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

/** 订单同步统计 */
export async function fetchInstantRetailSyncStats() {
  const { data } = await api.get("/admin/instant-retail/sync-stats");
  return data.data;
}

/** 平台商品映射列表 */
export async function fetchProductMaps(params?: { page?: number; pageSize?: number; platform?: string; syncStatus?: string; keyword?: string }) {
  const { data } = await api.get("/admin/instant-retail/product-maps", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

/** 平台商品映射统计 */
export async function fetchProductMapStats() {
  const { data } = await api.get("/admin/instant-retail/product-maps/stats");
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

export async function fetchInstantOrders(params?: { status?: string; orderNo?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/instant-retail/orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInstantOrderDetail(orderNo: string) {
  const { data } = await api.get(`/admin/instant-retail/orders/${orderNo}`);
  return data.data;
}

// 订单中心统计（今日订单/金额、待处理、异常、渠道占比、近30天趋势）
export async function fetchOrderCenterStats(params?: { storeId?: number }) {
  const { data } = await api.get("/admin/instant-retail/order-center-stats", { params });
  return data.data;
}
export async function updateInstantOrderStatus(orderNo: string, payload: { status: string; reason?: string }) {
  const { data } = await api.post(`/admin/instant-retail/orders/${orderNo}/status`, payload);
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

export async function fetchOrderBoardData() {
  const { data } = await api.get("/admin/instant-retail/order-board");
  return data.data;
}

export const fetchRetailCartAnalysis = (params?: { keyword?: string; page?: number; pageSize?: number }) =>
  api.get("/admin/retail-cart/analysis", { params });


// ==================== 门店配置 / 轮播 / 分类 ====================
export async function fetchShopConfig() {
  const { data } = await api.get("/admin/instant-retail/shop-config");
  return data.data;
}

export async function saveShopConfig(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/instant-retail/shop-config", payload);
  return data.data;
}

export async function fetchBanners() {
  const { data } = await api.get("/admin/instant-retail/banners");
  return data.data;
}

export async function createBanner(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/instant-retail/banners", payload);
  return data.data;
}

export async function updateBanner(id: number, payload: Record<string, unknown>) {
  const { data } = await api.put(`/admin/instant-retail/banners/${id}`, payload);
  return data.data;
}

export async function deleteBanner(id: number) {
  const { data } = await api.delete(`/admin/instant-retail/banners/${id}`);
  return data.data;
}

export async function fetchRetailCategories() {
  const { data } = await api.get("/admin/instant-retail/categories");
  return data.data;
}

export async function createRetailCategory(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/instant-retail/categories", payload);
  return data.data;
}

export async function updateRetailCategory(id: number, payload: Record<string, unknown>) {
  const { data } = await api.put(`/admin/instant-retail/categories/${id}`, payload);
  return data.data;
}

export async function deleteRetailCategory(id: number) {
  const { data } = await api.delete(`/admin/instant-retail/categories/${id}`);
  return data.data;
}

// ==================== Miniapp Config APIs ====================
export const fetchMiniappConfigs = () => api.get('/miniapp-config/configs');
export const fetchMiniappConfig = (platform: string) => api.get(`/miniapp-config/configs/${platform}`);
export const saveMiniappConfig = (platform: string, data: any) => api.put(`/miniapp-config/configs/${platform}`, data);
export const fetchMiniappTemplates = () => api.get('/miniapp-config/templates');
export const fetchMiniappTemplate = (id: number) => api.get(`/miniapp-config/templates/${id}`);
export const generateMiniappPackage = (data: any) => api.post('/miniapp-config/packages', data);
export const fetchMiniappPackageDownloadUrl = (id: number | string) => `${api.defaults.baseURL}/miniapp-config/packages/${id}/download`;
export const fetchMiniappPublishLogs = (params: any) => api.get('/miniapp-config/publish-logs', { params });
// 一键生成并发布（R96-05：生成代码包 + miniprogram-ci 上传体验版）
export const publishMiniapp = (data: any) => api.post('/miniapp-config/publish', data);
// 查询上传密钥配置状态（脱敏）
export const fetchMiniappKeyStatus = (platform: string) => api.get('/miniapp-config/key-status', { params: { platform } });
// 上传小程序上传密钥（.key 文件，multipart）
export const uploadMiniappKey = (platform: string, file: File, privateKeyPassword?: string) => {
  const form = new FormData();
  form.append("key", file);
  form.append("platform", platform);
  if (privateKeyPassword) form.append("privateKeyPassword", privateKeyPassword);
  return api.post('/miniapp-config/upload-key', form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
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


