import { api } from "./request";

export async function adminLogin(username: string, password: string) {
  const { data } = await api.post("/admin/auth/login", { username, password });
  return data.data as { token: string; user: unknown };
}

export async function fetchDashboard() {
  const { data } = await api.get("/admin/reports/dashboard");
  return data.data;
}

export async function fetchProducts(params?: { keyword?: string; page?: number; pageSize?: number; storeId?: number; categoryId?: number }) {
  const { data } = await api.get("/admin/products", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createProduct(payload: unknown) {
  const { data } = await api.post("/admin/products", payload);
  return data.data;
}

export async function fetchStores() {
  const { data } = await api.get("/admin/system/stores");
  return data.data;
}

export async function fetchMembers(params?: { keyword?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/members", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function createMember(payload: { name: string; mobile: string; customerType: string; staffId?: number; contact?: string; address?: string; settlementType?: string; remark?: string }) {
  const { data } = await api.post("/admin/members", payload);
  return data.data;
}

export async function fetchStaff() {
  const { data } = await api.get("/admin/staff");
  return data.data;
}

export async function assignMember(memberId: number, staffId: number) {
  const { data } = await api.post(`/admin/members/${memberId}/assign`, { staffId });
  return data.data;
}

export async function fetchMemberPriceHistory(memberId: number, skuId: number) {
  const { data } = await api.get(`/admin/members/${memberId}/price-history`, { params: { skuId } });
  return data.data || [];
}

export async function fetchMemberDetail(id: number) {
  const { data } = await api.get(`/admin/members/${id}`);
  return data.data;
}

export async function updateMember(id: number, payload: { name?: string; mobile?: string; customerType?: "RETAIL" | "WHOLESALE"; contact?: string; address?: string; settlementType?: string; staffId?: number | null; remark?: string }) {
  const { data } = await api.put(`/admin/members/${id}`, payload);
  return data.data;
}

export async function disableMember(id: number, disabled: boolean) {
  const { data } = await api.put(`/admin/members/${id}/disable`, { disabled });
  return data.data;
}

export async function fetchMemberPurchaseStats(id: number) {
  const { data } = await api.get(`/admin/members/${id}/purchase-stats`);
  return data.data;
}

export async function fetchMemberSaleBills(id: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/admin/members/${id}/sale-bills`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchMemberPayments(id: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/admin/members/${id}/payments`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchMemberStatements(id: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/admin/members/${id}/statements`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function createStore(payload: {
  code: string;
  name: string;
  address?: string;
  phone?: string;
  contact?: string;
  lng?: number;
  lat?: number;
  deliveryRadius?: number;
  businessStatus?: string;
  fulfillmentDeliveryEnabled?: number | boolean;
  fulfillmentPickupEnabled?: number | boolean;
}) {
  const { data } = await api.post("/admin/system/stores", payload);
  return data.data;
}

export function fetchStoreDetail(id: number) {
  return api.get(`/admin/system/stores/${id}`)
}

export function updateStore(id: number, data: {
  name?: string
  address?: string
  contact?: string
  phone?: string
  deliveryRadius?: number
  businessStatus?: string
  openTime?: string
  closeTime?: string
  lng?: number
  lat?: number
  wxHeadImg?: string
  miniappAppid?: string
  wxMerchantName?: string
  wxServicePhone?: string
  wxQrcodeUrl?: string
  fulfillmentDeliveryEnabled?: number | boolean
  fulfillmentPickupEnabled?: number | boolean
}) {
  return api.put(`/admin/system/stores/${id}`, data)
}

export function updateStoreStatus(id: number, status: string) {
  return api.patch(`/admin/system/stores/${id}/status`, { status })
}

export function fetchWxInfo(storeId: number) {
  return api.post(`/admin/system/stores/${storeId}/wx-fetch`)
}

export async function updateProductPrice(skuId: number, payload: { retailPrice?: number; wholesalePrice?: number; miniappPrice?: number; storePrice?: number; costPrice?: number }) {
  const { data } = await api.put(`/admin/products/${skuId}/price`, payload);
  return data.data;
}

export async function updateProductStatus(spuId: number, status: "DRAFT" | "ON_SALE" | "OFF_SALE") {
  const { data } = await api.patch(`/admin/products/${spuId}/status`, { status });
  return data.data;
}

export async function fetchPriceLogs(skuId: number) {
  const { data } = await api.get(`/admin/products/${skuId}/price-logs`);
  return data.data as { records: unknown[] };
}

export async function fetchOrders(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/orders", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function exportOrdersCsv(params?: { keyword?: string; status?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/orders/export.csv", { params, responseType: "blob" });
  return data as Blob;
}

export async function fetchSaleBills() {
  const { data } = await api.get("/admin/sale-bills", { params: { page: 1, pageSize: 20 } });
  return data.data;
}

export async function fetchInventoryLogs() {
  const { data } = await api.get("/admin/inventory-logs", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchCollectionLinks(params?: { page?: number; pageSize?: number; status?: string; keyword?: string }) {
  const { data } = await api.get("/admin/collection-links", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}

export async function batchCreateCollectionLinks(payload: { billNos: string[]; shareChannel?: string; amount?: number; expireHours?: number }) {
  const { data } = await api.post("/admin/collection-links/batch", payload);
  return data.data;
}

export async function revokeCollectionLink(linkNo: string) {
  const { data } = await api.put(`/admin/collection-links/${linkNo}/revoke`);
  return data.data;
}

export async function fetchCollectionStats() {
  const { data } = await api.get("/admin/collection-links/stats");
  return data.data;
}

export async function fetchSaleBillCollectionLinks(billNo: string) {
  const { data } = await api.get(`/admin/sale-bills/${billNo}/collection-links`);
  return data.data;
}

