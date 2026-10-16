import { api } from "./request";

export async function adminLogin(username: string, password: string) {
  const { data } = await api.post("/admin/auth/login", { username, password });
  return data.data as { token: string; user: unknown };
}

/**
 * 当前登录用户（S3-240）
 *
 * 返回体含 `permissions`（与 `t_sys_role.permissions` 同源，`backend/src/services/admin/auth.service.ts:252`）。
 * 用途：登录态本地缓存里没有权限串时补拉一次，供工作台**按钮级权限门**按码显隐
 * （`stores/app.ts#ensurePermissions`）。
 */
export async function fetchCurrentUser() {
  const { data } = await api.get("/admin/auth/me");
  return data.data;
}

/**
 * 演示账号凭据（唯一出处，禁止在其它业务代码里再写演示账号字面量）。
 * 构建期可用 VITE_DEMO_ACCOUNT / VITE_DEMO_PASSWORD 覆盖；未配置时回退默认 admin / admin@2026。
 * 口令合规：≥8 位 + 字母 + 数字 + 特殊字符（满足 backend/src/shared/password.ts 的校验口径）。
 */
export const DEMO_ACCOUNT: string = import.meta.env.VITE_DEMO_ACCOUNT || "admin";
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD || "admin@2026";

/** 初始化演示数据（幂等：业务表为空时自动填充） */
export async function seedDemoData() {
  const { data } = await api.post("/admin/demo/seed");
  return data.data;
}

/** 系统初始化：清空全部业务数据（需超级管理员 + 确认口令） */
export async function resetSystemData(confirm: string) {
  const { data } = await api.post("/admin/demo/reset", { confirm });
  return data.data;
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
  code?: string;
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
  // 后端 updateStore 支持 status（number），无独立 PATCH status 路由
  return api.put(`/admin/system/stores/${id}`, { status: Number(status) })
}

export function fetchWxInfo(storeId: number) {
  return api.get(`/admin/system/stores/${storeId}/wechat-info`)
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

export async function fetchSaleBills(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/sale-bills", { params: { page: 1, pageSize: 20, ...params } });
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
  // S3-184（收口总清单第 44 项）：后端真实注册的是 POST /api/admin/sale-bills/batch-collection-link
  // （admin-report.routes.ts:24）；原路径 /admin/collection-links/batch 未注册 ⇒ 404，页面批量生成实际打不到。
  // 契约对齐（report.controller.ts 的 zod）：amount 必须为正数且可选，表单里的 0 表示"收全部未收金额"（=不传）。
  const { billNos, shareChannel, amount, expireHours } = payload;
  const body: { billNos: string[]; shareChannel?: string; amount?: number; expireHours?: number } = { billNos };
  if (shareChannel) body.shareChannel = shareChannel;
  if (typeof amount === "number" && amount > 0) body.amount = amount;
  if (typeof expireHours === "number") body.expireHours = expireHours;
  const { data } = await api.post("/admin/sale-bills/batch-collection-link", body);
  return data.data;
}

export async function revokeCollectionLink(linkNo: string) {
  // S3-184（收口总清单第 44 项）：后端注册的是 POST /api/admin/collection-links/:linkNo/revoke
  // （admin-report.routes.ts:23）；原 PUT 方法未注册 ⇒ 404，页面撤销实际打不到。
  const { data } = await api.post(`/admin/collection-links/${linkNo}/revoke`);
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

