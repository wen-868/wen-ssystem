import { defineStore } from "pinia";
import { ref } from "vue";
import { hasPermissionCodes, normalizePermissionList } from "../config/permission-gates";

export const useAppStore = defineStore("app", () => {
  const tenantId = ref<number | null>(null);
  const tenantName = ref<string>("");
  /**
   * 当前登录账号的权限码集合（后端登录响应 / `/admin/auth/me` 下发，来源 = `t_sys_role.permissions`）。
   *
   * S3-240：`null` = **尚未取到**（升级前本地缓存可能没有该字段）⇒ 按钮门按失败关闭处理，
   * 由 `ensurePermissions()` 补拉一次 `/admin/auth/me` 后填实。
   */
  const permissions = ref<string[] | null>(null);
  /** 是否已成功取到权限码（成功一次后不再重复拉取；持久化，刷新页面不重拉） */
  const permissionsLoaded = ref(false);

  let inflight: Promise<void> | null = null;

  function setTenant(id: number, name: string) {
    tenantId.value = id;
    tenantName.value = name;
  }

  /** 写入权限码（登录成功 / `/admin/auth/me` 回来后调用）。非数组一律按"未取到"处理（失败关闭）。 */
  function setPermissions(perms: unknown) {
    const list = normalizePermissionList(perms);
    if (list === null) {
      permissions.value = null;
      permissionsLoaded.value = false;
      return;
    }
    permissions.value = list;
    permissionsLoaded.value = true;
  }

  /**
   * 按码判定（单码）。S3-240 起改为**与后端同源的通配匹配**：
   * 生产 `SUPER_ADMIN` / `OPERATION_ADMIN` 的角色权限串是 `["*"]`，旧实现 `includes(code)`
   * 会把店主判成"不持码"（假回归）。未取到权限码 ⇒ 不通过（失败关闭）。
   */
  function hasPermission(perm: string): boolean {
    return hasPermissionCodes(permissions.value, [perm]);
  }

  /** 按码判定（多码 = 全部持有才通过）。供页面/组件复用，避免各页自造判定。 */
  function hasPermissionCodesAll(codes: readonly string[]): boolean {
    return hasPermissionCodes(permissions.value, codes);
  }

  /**
   * 补拉权限码：仅当**尚未取到**时拉一次 `/admin/auth/me`（并发去重）。
   *
   * 为什么需要：权限串虽随登录响应下发，但升级前的老本地缓存里没有该字段；
   * 若不补拉，老会话在重新登录前会把所有按钮门一律隐藏。
   * 拉取失败 ⇒ 保持"未取到"（失败关闭），下次导航再试；不抛错、不阻塞导航。
   */
  async function ensurePermissions(): Promise<void> {
    if (permissionsLoaded.value) return;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        // 动态导入：避免 stores 的静态依赖图把 axios / import.meta.env 拖进
        // admin-web/tests/*.spec.mjs 的 Node 直载用例（那套 harness 没有 Vite 环境）
        const { fetchCurrentUser } = await import("../api/common");
        const me: any = await fetchCurrentUser();
        setPermissions(me?.permissions);
      } catch {
        // 失败关闭：权限仍为 null ⇒ 门一律不显示；不清会话（由 401 拦截器负责）
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  return {
    tenantId,
    tenantName,
    permissions,
    permissionsLoaded,
    setTenant,
    setPermissions,
    hasPermission,
    hasPermissionCodes: hasPermissionCodesAll,
    ensurePermissions,
  };
}, {
  persist: {
    key: "admin_app",
    storage: localStorage,
    pick: ["tenantId", "tenantName", "permissions", "permissionsLoaded"],
  },
});
