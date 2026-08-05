import { api } from "./request";

// ==================== After-sales APIs ====================
// 后端 adminListAftersales 读取 startDate/endDate（见 backend/src/controllers/admin/aftersale.controller.ts）
export async function fetchAfterSales(params?: { keyword?: string; status?: string; type?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/aftersales", { params });
  return data.data;
}
export async function fetchAfterSaleDetail(id: number) {
  const { data } = await api.get(`/admin/aftersales/${id}`);
  return data.data;
}
export async function approveAfterSale(id: number, payload?: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/approve`, payload);
  return data.data;
}
export async function rejectAfterSale(id: number, payload?: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/reject`, payload);
  return data.data;
}
export async function confirmReceiptAfterSale(id: number) {
  const { data } = await api.post(`/admin/aftersales/${id}/confirm-receipt`);
  return data.data;
}
export async function inspectAfterSale(id: number, payload: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/inspect`, payload);
  return data.data;
}
export async function completeAfterSale(id: number, payload: unknown) {
  const { data } = await api.post(`/admin/aftersales/${id}/complete`, payload);
  return data.data;
}
export async function fetchAfterSaleStatistics() {
  const { data } = await api.get("/admin/aftersales/statistics");
  return data.data;
}


