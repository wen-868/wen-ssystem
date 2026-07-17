import { api } from "./request";

// ==================== Alert APIs ====================
export async function fetchAlerts(params?: { type?: string; level?: string; status?: string }) {
  const { data } = await api.get("/admin/alerts/list", { params });
  return data.data;
}

export async function handleAlertItem(id: number, payload: { status: string }) {
  const { data } = await api.put(`/admin/alerts/${id}/handle`, payload);
  return data.data;
}

export async function fetchAlertRules() {
  const { data } = await api.get("/admin/alerts/rules");
  return data.data;
}

export async function updateAlertRule(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/alerts/rules/${id}`, payload);
  return data.data;
}


