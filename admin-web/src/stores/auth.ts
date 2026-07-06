import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface UserInfo {
  id?: number;
  username?: string;
  realName?: string;
  role?: string;
  tenantId?: number;
  [key: string]: unknown;
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string>("");
  const user = ref<UserInfo | null>(null);

  const isLoggedIn = computed(() => !!token.value);
  const userRole = computed(() => user.value?.role || null);
  const userName = computed(() => user.value?.realName || user.value?.username || "管理员");

  function setAuth(newToken: string, newUser: UserInfo) {
    token.value = newToken;
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
    userRole,
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