import axios from "axios";

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".onepan.cn")) {
    return "https://api.onepan.cn/api";
  }
  return "/api";
}

export const api = axios.create({
  baseURL: resolveApiBase()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("saas_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("saas_token");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(error);
  }
);

// ==================== 认证 ====================
export function saasLogin(username: string, password: string) {
  return api.post("/platform/login", { username, password });
}

// ==================== 租户管理 ====================
export function getTenants(params: any) {
  return api.get("/platform/tenants", { params });
}

export function getTenantDetail(id: number) {
  return api.get(`/platform/tenants/${id}`);
}

export function approveTenant(id: number) {
  return api.post(`/platform/tenants/${id}/approve`);
}

export function suspendTenant(id: number) {
  return api.post(`/platform/tenants/${id}/suspend`);
}

export function enableTenant(id: number) {
  return api.post(`/platform/tenants/${id}/enable`);
}

// ==================== 套餐管理 ====================
export function getPackages(params: any) {
  return api.get("/platform/packages", { params });
}

export function getPackageDetail(id: number) {
  return api.get(`/platform/packages/${id}`);
}

export function createPackage(data: any) {
  return api.post("/platform/packages", data);
}

export function updatePackage(id: number, data: any) {
  return api.put(`/platform/packages/${id}`, data);
}

export function deletePackage(id: number) {
  return api.delete(`/platform/packages/${id}`);
}

// ==================== 订阅管理 ====================
export function getSubscriptions(params: any) {
  return api.get("/platform/subscriptions", { params });
}

export function getSubscriptionDetail(id: number) {
  return api.get(`/platform/subscriptions/${id}`);
}

export function renewSubscription(id: number, data: any) {
  return api.post(`/platform/subscriptions/${id}/renew`, data);
}

export function upgradeSubscription(id: number, data: any) {
  return api.post(`/platform/subscriptions/${id}/upgrade`, data);
}

export function downgradeSubscription(id: number, data: any) {
  return api.post(`/platform/subscriptions/${id}/downgrade`, data);
}

// ==================== 平台看板 ====================
export function getPlatformOverview() {
  return api.get("/platform/overview");
}

export function getPlatformTrends(params: any) {
  return api.get("/platform/trends", { params });
}

// ==================== 平台配置 ====================
export function getPlatformConfig() {
  return api.get("/platform/config");
}

export function updatePlatformConfig(data: any) {
  return api.put("/platform/config", data);
}