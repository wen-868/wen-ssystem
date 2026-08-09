import { api } from "./request";

// ========== 库存共享（R100 商用化） ==========
export async function fetchShareSetting() {
  const { data } = await api.get("/admin/inventory-share/settings");
  return data.data;
}
export async function updateShareSetting(payload: Record<string, unknown>) {
  const { data } = await api.put("/admin/inventory-share/settings", payload);
  return data.data;
}
export async function fetchShareProducts(params?: { page?: number; pageSize?: number; keyword?: string }) {
  const { data } = await api.get("/admin/inventory-share/products", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function addShareProduct(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/inventory-share/products", payload);
  return data.data;
}
export async function batchAddShareProducts(payload: { skuIds: number[] }) {
  const { data } = await api.post("/admin/inventory-share/products/batch-add", payload);
  return data.data;
}
export async function batchRemoveShareProducts(payload: { ids: number[] }) {
  const { data } = await api.post("/admin/inventory-share/products/batch-remove", payload);
  return data.data;
}
export async function updateShareProduct(id: number, payload: Record<string, unknown>) {
  const { data } = await api.put(`/admin/inventory-share/products/${id}`, payload);
  return data.data;
}
export async function removeShareProduct(id: number) {
  const { data } = await api.delete(`/admin/inventory-share/products/${id}`);
  return data.data;
}

// ========== Dashboard - 库存分析 ==========
export async function fetchDashboardInventoryStats() {
  const { data } = await api.get("/admin/dashboard/inventory-stats");
  return data.data;
}

export async function fetchDashboardInventoryTurnover() {
  const { data } = await api.get("/admin/dashboard/inventory-turnover");
  return data.data;
}

export async function fetchDashboardInventoryWarning() {
  const { data } = await api.get("/admin/dashboard/inventory-warning");
  return data.data;
}

export async function fetchDashboardInventoryValueAnalysis() {
  const { data } = await api.get("/admin/dashboard/inventory-value-analysis");
  return data.data;
}


// ==================== Inventory Batch APIs ====================
export async function fetchInventoryBatches(params?: { page?: number; pageSize?: number; storeId?: number; skuId?: number; expiryStatus?: string }) {
  const { data } = await api.get("/admin/inventory-batch/batches", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInventoryBatchDetail(id: number) {
  const { data } = await api.get(`/admin/inventory-batch/batches/${id}`);
  return data.data;
}
export async function createInventoryBatch(payload: unknown) {
  const { data } = await api.post("/admin/inventory-batch/batches", payload);
  return data.data;
}
export async function updateInventoryBatch(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/inventory-batch/batches/${id}`, payload);
  return data.data;
}
export async function splitInventoryBatch(id: number, payload: unknown) {
  const { data } = await api.post(`/admin/inventory-batch/batches/${id}/split`, payload);
  return data.data;
}
export async function fetchFifoSuggestion(storeId: number, skuId: number) {
  const { data } = await api.get(`/admin/inventory-batch/batches/fifo-suggestion/${storeId}/${skuId}`);
  return data.data;
}


// ==================== Expiry Alert Config APIs ====================
export async function fetchExpiryConfigs() {
  const { data } = await api.get("/admin/inventory-batch/expiry-configs");
  return data.data;
}
export async function createExpiryConfig(payload: unknown) {
  const { data } = await api.post("/admin/inventory-batch/expiry-configs", payload);
  return data.data;
}
export async function updateExpiryConfig(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/inventory-batch/expiry-configs/${id}`, payload);
  return data.data;
}
export async function deleteExpiryConfig(id: number) {
  const { data } = await api.delete(`/admin/inventory-batch/expiry-configs/${id}`);
  return data.data;
}


// ==================== Expiry Alert Record APIs ====================
export async function fetchExpiryAlerts(params?: { page?: number; pageSize?: number; alertLevel?: number; status?: string; storeId?: number }) {
  const { data } = await api.get("/admin/inventory-batch/expiry-alerts", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function handleExpiryAlert(id: number, payload?: { remark?: string }) {
  const { data } = await api.put(`/admin/inventory-batch/expiry-alerts/${id}/handle`, payload || {});
  return data.data;
}
export async function fetchExpiryAlertStatistics() {
  const { data } = await api.get("/admin/inventory-batch/expiry-alerts/statistics");
  return data.data;
}


// ==================== Store Control APIs ====================
export async function fetchStoreControlConfigs() {
  const { data } = await api.get("/admin/store-control/configs");
  return data.data;
}
export async function fetchStoreControlConfig(storeId: number) {
  const { data } = await api.get(`/admin/store-control/configs/${storeId}`);
  return data.data;
}
export async function updateStoreControlConfig(storeId: number, payload: unknown) {
  const { data } = await api.put(`/admin/store-control/configs/${storeId}`, payload);
  return data.data;
}
export async function openStore(storeId: number) {
  const { data } = await api.post(`/admin/store-control/${storeId}/open`);
  return data.data;
}
export async function closeStore(storeId: number) {
  const { data } = await api.post(`/admin/store-control/${storeId}/close`);
  return data.data;
}
export async function suspendStore(storeId: number, reason?: string) {
  const { data } = await api.post(`/admin/store-control/${storeId}/suspend`, { reason });
  return data.data;
}
export async function resumeStore(storeId: number) {
  const { data } = await api.post(`/admin/store-control/${storeId}/resume`);
  return data.data;
}
export async function fetchStoreControlLogs(params?: { page?: number; pageSize?: number; storeId?: number; changeType?: string }) {
  const { data } = await api.get("/admin/store-control/logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}


// ==================== Transfer (调拨) APIs ====================
export async function fetchTransfers(params?: { page?: number; pageSize?: number; status?: string; storeId?: number; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/transfers", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchTransferDetail(id: number) {
  const { data } = await api.get(`/admin/transfers/${id}`);
  return data.data;
}
export async function createTransfer(payload: unknown) {
  const { data } = await api.post("/admin/transfers", payload);
  return data.data;
}
export async function updateTransfer(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/transfers/${id}`, payload);
  return data.data;
}
export async function submitTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/submit`);
  return data.data;
}
export async function approveTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/approve`);
  return data.data;
}
export async function rejectTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/reject`);
  return data.data;
}
export async function cancelTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/cancel`);
  return data.data;
}
export async function shipTransfer(id: number) {
  const { data } = await api.post(`/admin/transfers/${id}/ship`);
  return data.data;
}
export async function receiveTransfer(id: number, payload: unknown) {
  const { data } = await api.post(`/store/transfers/${id}/receive`, payload);
  return data.data;
}
export async function fetchTransferStatistics() {
  const { data } = await api.get("/admin/transfers/statistics");
  return data.data;
}
export async function fetchTransferTrend(days = 30) {
  const { data } = await api.get("/admin/transfers/trend", { params: { days } });
  return data.data;
}


// ==================== Stock Check (盘点) APIs ====================
export async function fetchStockChecks(params?: { page?: number; pageSize?: number; storeId?: number; status?: string }) {
  const { data } = await api.get("/admin/stock-checks", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchStockCheckDetail(id: number) {
  const { data } = await api.get(`/admin/stock-checks/${id}`);
  return data.data;
}
export async function createStockCheck(payload: unknown) {
  const { data } = await api.post("/admin/stock-checks", payload);
  return data.data;
}
export async function updateStockCheck(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/stock-checks/${id}`, payload);
  return data.data;
}
export async function startStockCheck(id: number) {
  const { data } = await api.post(`/admin/stock-checks/${id}/start`);
  return data.data;
}
export async function completeStockCheck(id: number) {
  const { data } = await api.post(`/admin/stock-checks/${id}/complete`);
  return data.data;
}
export async function cancelStockCheck(id: number) {
  const { data } = await api.post(`/admin/stock-checks/${id}/cancel`);
  return data.data;
}
export async function handleStockCheckDiff(id: number, payload: { itemId: number }) {
  const { data } = await api.post(`/admin/stock-checks/${id}/handle-diff`, payload);
  return data.data;
}
export async function fetchStockCheckStatistics() {
  const { data } = await api.get("/admin/stock-checks/statistics");
  return data.data;
}


// ==================== Inventory Balance API ====================
export async function fetchInventoryBalanceList() {
  const { data } = await api.get("/admin/inventory-balance");
  return data.data;
}


// ==================== Phase 6: 库存成本核算 API ====================
export async function fetchInventoryCostDetail(params?: { page?: number; pageSize?: number; storeId?: number; keyword?: string }) {
  const { data } = await api.get("/admin/inventory/cost-detail", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInventoryCostTrend(params?: { skuId?: number; days?: number }) {
  const { data } = await api.get("/admin/inventory/cost-trend", { params });
  return data.data;
}


// ==================== Phase 6: 库存预警配置 API ====================
export async function fetchStockWarningConfigs(params?: { page?: number; pageSize?: number; storeId?: number }) {
  const { data } = await api.get("/admin/stock-warnings/configs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchStockWarnings(params?: { page?: number; pageSize?: number; storeId?: number }) {
  const { data } = await api.get("/admin/stock-warnings/", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createStockWarningConfig(payload: { storeId: number; skuIds: number[]; minQty: number; maxQty: number }) {
  const { data } = await api.post("/admin/stock-warnings/config", payload);
  return data.data;
}
export async function updateStockWarningConfig(id: number, payload: { minQty?: number; maxQty?: number; enabled?: number }) {
  const { data } = await api.put(`/admin/stock-warnings/configs/${id}`, payload);
  return data.data;
}
export async function deleteStockWarningConfig(id: number) {
  const { data } = await api.delete(`/admin/stock-warnings/configs/${id}`);
  return data.data;
}


// ==================== Phase 6: 库存报表 API ====================
export async function fetchInventoryTurnover(params?: { page?: number; pageSize?: number; storeId?: number }) {
  const { data } = await api.get("/admin/reports/inventory-turnover", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchInventoryAge(params?: { storeId?: number }) {
  const { data } = await api.get("/admin/reports/inventory-age", { params });
  return data.data;
}
export async function fetchInventoryABC(params?: { storeId?: number }) {
  const { data } = await api.get("/admin/reports/inventory-abc", { params });
  return data.data;
}
