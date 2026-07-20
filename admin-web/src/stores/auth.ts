import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface UserInfo {
  id?: number;
  username?: string;
  realName?: string;
  roles?: string[]; // 后端返回数组形式角色码（如 SUPER_ADMIN/STORE_MANAGER）
  tenantId?: number;
  csrfToken?: string; // CSRF 防护令牌，写操作需注入 x-csrf-token header
  [key: string]: unknown;
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string>("");
  const user = ref<UserInfo | null>(null);

  const isLoggedIn = computed(() => !!token.value);
  // 角色数组：与后端 roles: string[] 对齐，用于路由守卫 some() 判断
  const userRoles = computed<string[]>(() => user.value?.roles || []);
  const userName = computed(() => user.value?.realName || user.value?.username || "管理员");

  /**
   * 写入登录态。
   * @param newToken JWT token
   * @param newUser 用户信息（含 roles 数组）
   * @param csrfToken CSRF 令牌（后端登录接口下发，写操作需注入 x-csrf-token header）
   */
  function setAuth(newToken: string, newUser: UserInfo, csrfToken?: string) {
    token.value = newToken;
    if (csrfToken) {
      newUser.csrfToken = csrfToken;
    }
    user.value = newUser;
  }

  function clearAuth() {
    token.value = "";
    user.value = null;
  }

  function parseJwtExp(t: string): number | null {
    try {
      const parts = t.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  function isTokenExpired(): boolean {
    if (!token.value) return true;
    const exp = parseJwtExp(token.value);
    if (!exp) return false;
    return Date.now() >= exp;
  }

  return {
    token,
    user,
    isLoggedIn,
    userRoles,
    userName,
    setAuth,
    clearAuth,
    isTokenExpired,
  };
}, {
  persist: {
    key: "admin_auth",
    storage: localStorage,
    pick: ["token", "user"],
  },
});
