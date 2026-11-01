import { api } from "./request";

// ==================== After-sales APIs ====================
/**
 * ⚠️ WORKBENCH-12 修正：后端路由前缀已含 `/aftersales`，前端此前又重复写了一段，
 * 全部 8 条 admin 调用都成了 `/admin/aftersales/aftersales/...` 双段 ⇒ 生产态全部 404。
 *
 * 后端真源（`backend/src/routes/aftersale.routes.ts`）：
 *   prefix = `/api/admin`（同文件 line 81），router 内路径全部单段 `/aftersales...`：
 *     :46 GET  /aftersales
 *     :47 GET  /aftersales/statistics
 *     :48 GET  /aftersales/:id
 *     :49 POST /aftersales/:id/approve
 *     :51 POST /aftersales/:id/reject
 *     :67 POST /aftersales/:id/confirm-receipt
 *     :69 POST /aftersales/:id/inspect
 *     :74 POST /aftersales/:id/complete
 *   ⇒ 前端正确路径 = `/admin/aftersales` + `/...`（**无第二段 aftersales**）
 *
 * 注意：`statistics` 必须排在 `:id` 之前（与后端注册顺序一致）以避免被 `:id` 吞掉。
 */

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
