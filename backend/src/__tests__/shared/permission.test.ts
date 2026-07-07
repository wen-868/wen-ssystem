import { describe, it, expect } from "vitest";
import { checkPermission, getDataScope, applyDataPermissionFilter, filterSensitiveFields } from "../../shared/permission.js";
import type { AuthUser } from "../../shared/auth.js";

function makeUser(roles: string[], opts?: { id?: number; storeId?: number | null }): AuthUser {
  return {
    id: opts?.id ?? 1,
    username: "test",
    roles,
    storeId: opts?.storeId ?? null,
    tenantId: "default",
  };
}

describe("permission", () => {
  describe("checkPermission", () => {
    it("权限列表包含目标权限时返回 true", () => {
      expect(checkPermission("product:create", ["product:create", "product:read"])).toBe(true);
    });

    it("权限列表不包含目标权限时返回 false", () => {
      expect(checkPermission("product:delete", ["product:create"])).toBe(false);
    });

    it("通配符 * 应匹配所有权限", () => {
      expect(checkPermission("anything", ["*"])).toBe(true);
    });

    it("空权限列表返回 false", () => {
      expect(checkPermission("test", [])).toBe(false);
    });

    it("空字符串权限码返回 false（不在列表中）", () => {
      expect(checkPermission("", ["test"])).toBe(false);
    });
  });

  describe("getDataScope", () => {
    it("SUPER_ADMIN 返回 ALL", () => {
      expect(getDataScope(makeUser(["SUPER_ADMIN"]))).toBe("ALL");
    });

    it("STORE_MANAGER 返回 STORE", () => {
      expect(getDataScope(makeUser(["STORE_MANAGER"]))).toBe("STORE");
    });

    it("SALES_STAFF 返回 SELF", () => {
      expect(getDataScope(makeUser(["SALES_STAFF"]))).toBe("SELF");
    });

    it("CUSTOMER_SERVICE 返回 SELF", () => {
      expect(getDataScope(makeUser(["CUSTOMER_SERVICE"]))).toBe("SELF");
    });

    it("无角色返回 SELF（默认）", () => {
      expect(getDataScope(makeUser([]))).toBe("SELF");
    });

    it("多角色取最高权限", () => {
      expect(getDataScope(makeUser(["SALES_STAFF", "SUPER_ADMIN"]))).toBe("ALL");
    });
  });

  describe("applyDataPermissionFilter", () => {
    it("ALL 范围返回 1=1", () => {
      expect(applyDataPermissionFilter(makeUser(["SUPER_ADMIN"]), "any_table")).toBe("1=1");
    });

    it("STORE 范围有 storeId 返回 store_id 条件", () => {
      const user = makeUser(["STORE_MANAGER"], { storeId: 5 });
      expect(applyDataPermissionFilter(user, "sale_bill")).toBe("store_id = 5");
    });

    it("STORE 范围无 storeId 返回 1=0", () => {
      const user = makeUser(["STORE_MANAGER"], { storeId: null });
      expect(applyDataPermissionFilter(user, "sale_bill")).toBe("1=0");
    });

    it("SELF 范围对 sys_user 表返回 id 条件", () => {
      const user = makeUser(["SALES_STAFF"], { id: 42 });
      expect(applyDataPermissionFilter(user, "sys_user")).toBe("id = 42");
    });

    it("SELF 范围对 employee 表返回 id 条件", () => {
      const user = makeUser(["SALES_STAFF"], { id: 10 });
      expect(applyDataPermissionFilter(user, "employee")).toBe("id = 10");
    });

    it("SELF 范围对非用户表返回 1=0", () => {
      const user = makeUser(["SALES_STAFF"], { id: 1 });
      expect(applyDataPermissionFilter(user, "product")).toBe("1=0");
    });
  });

  describe("filterSensitiveFields", () => {
    it("SUPER_ADMIN 不过滤任何字段", () => {
      const user = makeUser(["SUPER_ADMIN"]);
      const data = { name: "张三", mobile: "13800138000", password_hash: "xxx" };
      const result = filterSensitiveFields(user, "sys_user", data);
      expect(result).toEqual(data);
    });

    it("无权限角色应删除敏感字段", () => {
      const user = makeUser(["SALES_STAFF"]);
      const data = { name: "张三", mobile: "13800138000", password_hash: "xxx", id_card: "110101" };
      const result = filterSensitiveFields(user, "sys_user", data) as Record<string, unknown>;
      expect(result.name).toBe("张三");
      expect(result.password_hash).toBeUndefined();
      expect(result.mobile).toBeUndefined();
      expect(result.id_card).toBeUndefined();
    });

    it("有权限角色（STORE_MANAGER）不应删除敏感字段", () => {
      const user = makeUser(["STORE_MANAGER"]);
      const data = { name: "张三", mobile: "13800138000" };
      const result = filterSensitiveFields(user, "sys_user", data) as Record<string, unknown>;
      expect(result.mobile).toBe("13800138000");
    });

    it("未注册的表名应原样返回", () => {
      const user = makeUser(["SALES_STAFF"]);
      const data = { name: "test", cost_price: 100 };
      const result = filterSensitiveFields(user, "unknown_table", data);
      expect(result).toEqual(data);
    });

    it("数组数据也应正确过滤", () => {
      const user = makeUser(["SALES_STAFF"]);
      const data = [
        { name: "张三", mobile: "13800138000" },
        { name: "李四", mobile: "13900139000" },
      ];
      const result = filterSensitiveFields(user, "sys_user", data) as Record<string, unknown>[];
      expect(result).toHaveLength(2);
      expect(result[0].mobile).toBeUndefined();
      expect(result[1].mobile).toBeUndefined();
      expect(result[0].name).toBe("张三");
    });

    it("customer 表的敏感字段应按角色过滤", () => {
      const user = makeUser(["SALES_STAFF"]);
      const data = { name: "客户1", mobile: "13800000000", address: "地址" };
      const result = filterSensitiveFields(user, "customer", data) as Record<string, unknown>;
      expect(result.mobile).toBeUndefined();
      expect(result.address).toBeUndefined();
    });
  });
});
