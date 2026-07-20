import { api } from "./request";

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

// ==================== CustomerVisit APIs ====================
export const fetchCustomerVisits = (params: any) => api.get('/admin/customer-visits', { params });
export const createCustomerVisit = (data: any) => api.post('/admin/customer-visits', data);
export const checkinCustomerVisit = (id: number, data?: any) => api.post(`/admin/customer-visits/${id}/checkin`, data);
export const checkoutCustomerVisit = (id: number, data?: any) => api.post(`/admin/customer-visits/${id}/checkout`, data);
export const cancelCustomerVisit = (id: number) => api.post(`/admin/customer-visits/${id}/cancel`);
export const fetchCustomerVisitDetail = (id: number) => api.get(`/admin/customer-visits/${id}`);
export const fetchCustomerVisitStatistics = (params: any) => api.get('/admin/customer-visits/statistics', { params });
export const updateCustomerVisit = (id: number, data: any) => api.put(`/admin/customer-visits/${id}`, data);
export const deleteCustomerVisit = (id: number) => api.delete(`/admin/customer-visits/${id}`);

export async function exportCustomerVisitsCsv(params?: {
  keyword?: string;
  customerId?: number;
  visitorName?: string;
  visitType?: string;
  purpose?: string;
}) {
  const { data } = await api.get("/admin/customer-visits/export", { params, responseType: "blob" });
  return data as Blob;
}

// ==================== 营销活动统计 ====================
export async function getMarketingOverview(params?: { startDate?: string; endDate?: string }) { const { data } = await api.get('/admin/marketing/dashboard/overview', { params }); return data.data; }
export async function getActivityStats(params?: { startDate?: string; endDate?: string; activityType?: string }) { const { data } = await api.get('/admin/marketing/dashboard/activity-stats', { params }); return data.data; }
export async function getSingleActivityStats(activityId: number, activityType?: string) { const { data } = await api.get(`/admin/marketing/dashboard/activity-stats/${activityId}`, { params: { activityType } }); return data.data; }
export async function getCouponStats() { const { data } = await api.get('/admin/marketing/dashboard/coupon-stats'); return data.data; }
export async function getMarketingTrend(params?: { period?: string; startDate?: string; endDate?: string }) { const { data } = await api.get('/admin/marketing/dashboard/trend', { params }); return data.data; }
export async function getActivityRanking(params?: { rankBy?: string; startDate?: string; endDate?: string }) { const { data } = await api.get('/admin/marketing/dashboard/activity-ranking', { params }); return data.data; }
export async function getActivityComparison(params?: { activityIds?: number[]; startDate?: string; endDate?: string }) { const { data } = await api.get('/admin/marketing/dashboard/activity-comparison', { params }); return data.data; }
export async function getActivityEffectAnalysis(activityId: number, params?: { activityType?: string; startDate?: string; endDate?: string }) { const { data } = await api.get(`/admin/marketing/dashboard/activity-effect/${activityId}`, { params }); return data.data; }
export async function getActivityConversionTrend(activityId: number, params?: { period?: string }) { const { data } = await api.get(`/admin/marketing/dashboard/activity-conversion-trend/${activityId}`, { params }); return data.data; }

// ==================== PurchaseContract API ====================
export async function fetchPurchaseContracts(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  supplierId?: number;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { data } = await api.get("/admin/purchase-contracts", { params });
  return data.data;
}

export async function fetchPurchaseContractDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-contracts/${id}`);
  return data.data;
}

export async function createPurchaseContract(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/purchase-contracts", payload);
  return data.data;
}

export async function updatePurchaseContract(id: number, payload: Record<string, unknown>) {
  const { data } = await api.put(`/admin/purchase-contracts/${id}`, payload);
  return data.data;
}

export async function deletePurchaseContract(id: number) {
  const { data } = await api.delete(`/admin/purchase-contracts/${id}`);
  return data.data;
}

export async function exportPurchaseContractsCsv(params?: {
  keyword?: string;
  status?: string;
  supplierId?: number;
}) {
  const { data } = await api.get("/admin/purchase-contracts/export", { params, responseType: "blob" });
  return data as Blob;
}
