import { api } from "./request";

// ==================== Export APIs ====================
export async function exportCustomersCsv(params?: { keyword?: string }) {
  const { data } = await api.get("/admin/export/customers", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportSuppliersCsv(params?: { keyword?: string; supplyType?: string }) {
  const { data } = await api.get("/admin/export/suppliers", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportProductsCsv(params?: { keyword?: string }) {
  const { data } = await api.get("/admin/export/products", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportInventoryCsv(params?: { storeId?: number; keyword?: string }) {
  const { data } = await api.get("/admin/export/inventory", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportPurchaseOrdersCsv(params?: { keyword?: string; status?: string }) {
  const { data } = await api.get("/admin/export/purchase-orders", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportPaymentsCsv(params?: { status?: string }) {
  const { data } = await api.get("/admin/export/payments", { params, responseType: "blob" });
  return data as Blob;
}
export async function exportAuditLogsCsv(params?: { action?: string; resourceType?: string; dateStart?: string; dateEnd?: string; ip?: string; userName?: string; userId?: number }) {
  const { data } = await api.get("/admin/system/audit-logs/export", { params, responseType: "blob" });
  return data as Blob;
}


