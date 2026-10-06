import { api } from "./request";

export async function adminLogin(username: string, password: string) {
  const { data } = await api.post("/admin/auth/login", { username, password });
  return data.data as { token: string; user: unknown };
}

/** 演示账号登录（免密，内置演示数据） */
export async function demoLogin() {
  const { data } = await api.post("/admin/auth/demo-login");
  return data.data as { token: string; user: unknown; csrfToken?: string; demo?: boolean };
}

/**
 * 演示账号凭据（唯一出处，禁止在其它业务代码里再写演示账号字面量）。
 * 构建期可用 VITE_DEMO_ACCOUNT / VITE_DEMO_PASSWORD 覆盖；未配置时回退默认 demo / Demo@2026。
 * 口令合规：≥8 位 + 字母 + 数字 + 特殊字符（满足 backend/src/shared/password.ts 的校验口径）。
 */
export const DEMO_ACCOUNT: string = import.meta.env.VITE_DEMO_ACCOUNT || "demo";
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD || "Demo@2026";

/** 账号被锁定、免密演示通道接管时的如实提示文案 */
export const DEMO_FALLBACK_NOTICE = "演示通道已接管";

/**
 * 判断登录失败是否属于「账号已锁定 / 失败次数过多」——命中才允许降级走免密演示通道。
 * 后端口径（backend/src/services/admin/auth.service.ts:124-147）：AppError(msg, 400) ⇒
 * HTTP 400 + { code: "400", msg: "账号已锁定，请N分钟后重试" | "登录失败次数过多，账号已锁定15分钟" }。
 * 其它错误（网络中断、账号或密码错误、登录限流 429 等）一律返回 false ⇒ 不降级。
 */
export function isAccountLockedError(error: unknown): boolean {
  const data = (error as {
    response?: { data?: { code?: unknown; msg?: unknown; message?: unknown } };
  } | undefined)?.response?.data;
  if (!data) return false;
  const code = String(data.code ?? "");
  const msg = String(data.msg ?? data.message ?? "");
  // 业务码非 0（无 code 视为业务失败）且提示含「锁定」
  return code !== "0" && msg.includes("锁定");
}

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

