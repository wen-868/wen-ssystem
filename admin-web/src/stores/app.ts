import { defineStore } from "pinia";
import { ref } from "vue";

export const useAppStore = defineStore("app", () => {
  const tenantId = ref<number | null>(null);
  const tenantName = ref<string>("");
  const permissions = ref<string[]>([]);

  function setTenant(id: number, name: string) {
    tenantId.value = id;
    tenantName.value = name;
  }

  function setPermissions(perms: string[]) {
    permissions.value = perms;
  }

  function hasPermission(perm: string): boolean {
    return permissions.value.includes(perm);
  }

  return {
    tenantId,
    tenantName,
    permissions,
    setTenant,
    setPermissions,
    hasPermission,
  };
}, {
  persist: {
    key: "admin_app",
    storage: localStorage,
    pick: ["tenantId", "tenantName", "permissions"],
  },
});