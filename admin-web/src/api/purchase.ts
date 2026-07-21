import { api } from "./request";

// ==================== Supplier APIs ====================
export async function fetchSuppliers(params?: { keyword?: string; supplyType?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/suppliers", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createSupplier(payload: unknown) {
  const { data } = await api.post("/admin/suppliers", payload);
  return data.data;
}
export async function updateSupplier(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/suppliers/${id}`, payload);
  return data.data;
}


// ==================== Purchase APIs ====================
export async function fetchPurchaseOrders(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createPurchaseOrder(payload: unknown) {
  const { data } = await api.post("/admin/purchase-orders", payload);
  return data.data;
}

export async function fetchPurchaseOrderDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-orders/${id}`);
  return data.data;
}

export async function cancelPurchaseOrder(id: number) {
  const { data } = await api.post(`/admin/purchase-orders/${id}/cancel`);
  return data.data;
}

export async function confirmPurchaseOrder(id: number) {
  const { data } = await api.post(`/admin/purchase-orders/${id}/confirm`);
  return data.data;
}

export async function purchaseInStock(payload: unknown) {
  const { data } = await api.post("/admin/purchase-in-stocks", payload);
  return data.data;
}

export async function fetchPurchaseInStocks(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-in-stocks", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchPurchaseReturns(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-returns", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createPurchaseReturn(payload: unknown) {
  const { data } = await api.post("/admin/purchase-returns", payload);
  return data.data;
}


// ==================== Purchase Payment APIs ====================
export async function fetchPurchasePayments(params?: { supplierId?: number; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/purchase-payments", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchPurchasePaymentDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-payments/${id}`);
  return data.data;
}
export async function createPurchasePayment(payload: unknown) {
  const { data } = await api.post("/admin/purchase-payments", payload);
  return data.data;
}
export async function updatePurchasePayment(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/purchase-payments/${id}`, payload);
  return data.data;
}
export async function approvePurchasePayment(id: number) {
  const { data } = await api.post(`/admin/purchase-payments/${id}/approve`);
  return data.data;
}
export async function payPurchasePayment(id: number) {
  const { data } = await api.post(`/admin/purchase-payments/${id}/pay`);
  return data.data;
}
export async function cancelPurchasePayment(id: number) {
  const { data } = await api.post(`/admin/purchase-payments/${id}/cancel`);
  return data.data;
}
export async function fetchPurchasePaymentStatistics() {
  const { data } = await api.get("/admin/purchase-payments/statistics");
  return data.data;
}


// ==================== Supplier Statement APIs ====================
export async function fetchSupplierStatements(params?: { supplierId?: number; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/supplier-statements", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchSupplierStatementDetail(id: number) {
  const { data } = await api.get(`/admin/supplier-statements/${id}`);
  return data.data;
}
export async function generateSupplierStatement(payload: unknown) {
  const { data } = await api.post("/admin/supplier-statements/generate", payload);
  return data.data;
}
export async function confirmSupplierStatement(id: number) {
  const { data } = await api.post(`/admin/supplier-statements/${id}/confirm`);
  return data.data;
}
export async function disputeSupplierStatement(id: number, payload?: unknown) {
  const { data } = await api.post(`/admin/supplier-statements/${id}/dispute`, payload || {});
  return data.data;
}


// ==================== Purchase Plan APIs ====================
export async function fetchPurchasePlans(params?: { page?: number; pageSize?: number; status?: string; supplierId?: number }) {
  const { data } = await api.get("/admin/purchase-plans", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createPurchasePlan(payload: { planName: string; supplierId?: number; supplierName?: string; items: any[]; remark?: string }) {
  const { data } = await api.post("/admin/purchase-plans", payload);
  return data.data;
}
export async function fetchPurchasePlanDetail(id: number) {
  const { data } = await api.get(`/admin/purchase-plans/${id}`);
  return data.data;
}
export async function approvePurchasePlan(id: number) {
  const { data } = await api.post(`/admin/purchase-plans/${id}/approve`);
  return data.data;
}
export async function convertPurchasePlanToOrder(id: number) {
  const { data } = await api.post(`/admin/purchase-plans/${id}/convert`);
  return data.data;
}
export async function cancelPurchasePlan(id: number) {
  const { data } = await api.post(`/admin/purchase-plans/${id}/cancel`);
  return data.data;
}
export async function fetchReplenishmentSuggestions() {
  const { data } = await api.get("/admin/purchase-plans/replenish/suggestions");
  return data.data;
}

// ==================== 供应商联系人 ====================
export async function fetchSupplierContacts(supplierId: number) {
  const { data } = await api.get("/admin/supplier-contacts", { params: { supplierId } });
  return data.data;
}
export async function createSupplierContact(payload: {
  supplierId: number;
  name: string;
  mobile?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  position?: string;
  isPrimary?: number | boolean;
  remark?: string;
}) {
  const { data } = await api.post("/admin/supplier-contacts", payload);
  return data.data;
}
export async function updateSupplierContact(id: number, payload: {
  name?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  position?: string;
  isPrimary?: number | boolean;
  remark?: string;
}) {
  const { data } = await api.put(`/admin/supplier-contacts/${id}`, payload);
  return data.data;
}
export async function deleteSupplierContact(id: number) {
  const { data } = await api.delete(`/admin/supplier-contacts/${id}`);
  return data.data;
}
export async function setPrimarySupplierContact(id: number) {
  const { data } = await api.post(`/admin/supplier-contacts/${id}/set-primary`);
  return data.data;
}


