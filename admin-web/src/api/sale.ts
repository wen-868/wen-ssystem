import { api } from "./request";

// ==================== Customer Price APIs ====================
export async function fetchCustomerPrices(params?: { page?: number; pageSize?: number; keyword?: string; customerId?: number; status?: string }) {
  const { data } = await api.get("/admin/customer-prices", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createCustomerPrice(payload: { customerId: number; customerName: string; skuId: number; skuName: string; standardPrice: number; customPrice: number; startDate?: string; endDate?: string; remark?: string }) {
  const { data } = await api.post("/admin/customer-prices", payload);
  return data.data;
}
export async function updateCustomerPrice(id: number, payload: { customPrice?: number; standardPrice?: number; startDate?: string; endDate?: string; remark?: string }) {
  const { data } = await api.put(`/admin/customer-prices/${id}`, payload);
  return data.data;
}
export async function deleteCustomerPrice(id: number) {
  const { data } = await api.delete(`/admin/customer-prices/${id}`);
  return data.data;
}
export async function batchSetCustomerPrices(payload: { customerId: number; customerName: string; skuIds: number[]; skuNames: string[]; standardPrices: number[]; discountRate: number; startDate?: string; endDate?: string }) {
  const { data } = await api.post("/admin/customer-prices/batch", payload);
  return data.data;
}


// ==================== Sale Return APIs ====================
export async function fetchSaleReturns(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/sale-returns", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createSaleReturn(payload: unknown) {
  const { data } = await api.post("/admin/sale-returns", payload);
  return data.data;
}


// ==================== Statement / Customer Payment APIs ====================
export async function fetchCustomerStatements(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customer-statements", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function generateCustomerStatement(payload: unknown) {
  const { data } = await api.post("/admin/customer-statements/generate", payload);
  return data.data;
}

export async function createCustomerPayment(payload: unknown) {
  const { data } = await api.post("/admin/customer-payments", payload);
  return data.data;
}


// ==================== Enhanced Sale Bills API ====================
export async function fetchSaleBillsEnhanced(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/sale-bills", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}


// ==================== Price Center APIs ====================
export async function fetchPriceLevels(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/prices/levels", { params });
  return data.data;
}
export async function createPriceLevel(payload: unknown) {
  const { data } = await api.post("/admin/prices/levels", payload);
  return data.data;
}
export async function updatePriceLevel(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/prices/levels/${id}`, payload);
  return data.data;
}
export async function deletePriceLevel(id: number) {
  const { data } = await api.delete(`/admin/prices/levels/${id}`);
  return data.data;
}
export async function fetchSkuPrices(skuId: number) {
  const { data } = await api.get(`/admin/prices/skus/${skuId}/prices`);
  return data.data;
}
export async function createSkuPrice(skuId: number, payload: unknown) {
  const { data } = await api.post(`/admin/prices/skus/${skuId}/prices`, payload);
  return data.data;
}
export async function updatePrice(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/prices/prices/${id}`, payload);
  return data.data;
}
export async function deletePrice(id: number) {
  const { data } = await api.delete(`/admin/prices/prices/${id}`);
  return data.data;
}
export async function fetchCustomerBindings(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/prices/customer-bindings", { params });
  return data.data;
}
export async function createCustomerBinding(payload: unknown) {
  const { data } = await api.post("/admin/prices/customer-bindings", payload);
  return data.data;
}
export async function approveCustomerBinding(id: number) {
  const { data } = await api.put(`/admin/prices/customer-bindings/${id}/approve`);
  return data.data;
}
export async function rejectCustomerBinding(id: number) {
  const { data } = await api.put(`/admin/prices/customer-bindings/${id}/reject`);
  return data.data;
}
export async function calcBestPrice(payload: unknown) {
  const { data } = await api.post("/admin/prices/best-price", payload);
  return data.data;
}
export async function fetchPriceChangeLogs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/prices/change-logs", { params });
  return data.data;
}


// ==================== Order Timeout Config APIs ====================
export async function fetchOrderTimeoutConfigs() {
  const { data } = await api.get("/admin/order-timeout/configs");
  return data.data;
}
export async function createOrderTimeoutConfig(payload: { orderType: string; timeoutType: string; timeoutMinutes: number; action: string; enabled?: boolean; description?: string }) {
  const { data } = await api.post("/admin/order-timeout/configs", payload);
  return data.data;
}
export async function updateOrderTimeoutConfig(id: number, payload: { orderType?: string; timeoutType?: string; timeoutMinutes?: number; action?: string; enabled?: boolean; description?: string }) {
  const { data } = await api.put(`/admin/order-timeout/configs/${id}`, payload);
  return data.data;
}
export async function deleteOrderTimeoutConfig(id: number) {
  const { data } = await api.delete(`/admin/order-timeout/configs/${id}`);
  return data.data;
}
export async function fetchOrderTimeoutLogs(params?: { page?: number; pageSize?: number; result?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/order-timeout/logs", { params });
  return data.data;
}
export async function fetchOrderTimeoutStatistics() {
  const { data } = await api.get("/admin/order-timeout/statistics");
  return data.data;
}


// ==================== Sale Bills Export API ====================
export async function exportSaleBillsCsv(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/sale-bills/export-csv", { params, responseType: "blob" });
  return data as Blob;
}


// ==================== 订单同步日志 ====================
export async function fetchOrderSyncLogs(params?: any) { const { data } = await api.get('/admin/order-sync-logs', { params }); return data.data; }
export async function retryOrderSync(id: number) { const { data } = await api.post(`/admin/order-sync-logs/${id}/retry`); return data.data; }


