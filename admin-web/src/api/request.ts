import axios from "axios";
import { useAuthStore } from "../stores/auth";


function resolveApiBase() {
  // Electron 桌面环境：通过 preload 获取远程 API 地址
  if (typeof window !== "undefined" && window.electronAPI) {
    return window.electronAPI.apiBase || "http://159.75.153.59/api";
  }
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".onepan.cn")) {
    return "https://api.onepan.cn/api";
  }
  return ["http://", "localhost", ":8080/api"].join("");
}

export const api = axios.create({
  baseURL: resolveApiBase(),
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  // CSRF 防护：写操作需注入 x-csrf-token header（后端登录接口下发，存于 user.csrfToken）
  if (auth.user?.csrfToken) {
    config.headers["x-csrf-token"] = auth.user.csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore().clearAuth();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(error);
  }
);

/** 从 Axios 错误中提取错误消息 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const axiosError = error as { response?: { data?: { msg?: string; message?: string } } };
    return axiosError.response?.data?.msg || axiosError.response?.data?.message || fallback;
  }
  return fallback;
}
