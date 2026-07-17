import { api } from "./request";

// ==================== Trace Management APIs ====================
export async function fetchTraceConfigs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/trace/configs", { params });
  return data.data;
}
export async function createTraceConfig(payload: unknown) {
  const { data } = await api.post("/admin/trace/configs", payload);
  return data.data;
}
export async function updateTraceConfig(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/trace/configs/${id}`, payload);
  return data.data;
}
export async function deleteTraceConfig(id: number) {
  const { data } = await api.delete(`/admin/trace/configs/${id}`);
  return data.data;
}
export async function generateTraceCodes(payload: unknown) {
  const { data } = await api.post("/admin/trace/codes/generate", payload);
  return data.data;
}
export async function fetchTraceCodes(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/trace/codes", { params });
  return data.data;
}
export async function fetchTraceCodeDetail(traceCode: string) {
  const { data } = await api.get(`/admin/trace/codes/${traceCode}`);
  return data.data;
}
export async function updateTraceCodeStatus(traceCode: string, payload: unknown) {
  const { data } = await api.post(`/admin/trace/codes/${traceCode}/status`, payload);
  return data.data;
}
export async function fetchTraceCodeStatistics() {
  const { data } = await api.get("/admin/trace/codes/statistics");
  return data.data;
}
export async function queryTraceCode(traceCode: string) {
  const { data } = await api.get(`/admin/trace/query/${traceCode}`);
  return data.data;
}
export async function fetchRecalls(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/trace/recalls", { params });
  return data.data;
}
export async function createRecall(payload: unknown) {
  const { data } = await api.post("/admin/trace/recalls", payload);
  return data.data;
}
export async function updateRecall(recallNo: string, payload: unknown) {
  const { data } = await api.put(`/admin/trace/recalls/${recallNo}`, payload);
  return data.data;
}
export async function executeRecall(recallNo: string, payload: unknown) {
  const { data } = await api.post(`/admin/trace/recalls/${recallNo}/execute`, payload);
  return data.data;
}
export async function completeRecall(recallNo: string) {
  const { data } = await api.put(`/admin/trace/recalls/${recallNo}/complete`);
  return data.data;
}


