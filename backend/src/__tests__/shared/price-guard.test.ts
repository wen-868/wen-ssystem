import { describe, it, expect, vi } from "vitest";

const { mockQueryWithTenant } = vi.hoisted(() => ({
  mockQueryWithTenant: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  queryWithTenant: mockQueryWithTenant,
}));

vi.mock("../../shared/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  canAccessPriceField,
  filterPriceFields,
  filterPriceFieldsBatch,
  getAccessiblePriceFields,
  getBlockedPriceFields,
  getPricePermissionMatrix,
  logUnauthorizedAccess,
} from "../../shared/price-guard.js";
import type { AuthUser } from "../../shared/auth.js";

function makeUser(roles: string[]): AuthUser {
  return {
    id: 1,
    username: "test",
    roles,
    storeId: null,
    tenantId: "default",
  };
}

describe("price-guard", () => {
  describe("canAccessPriceField", () => {
    it("SUPER_ADMIN 可访问所有字段", () => {
      const user = makeUser(["SUPER_ADMIN"]);
      expect(canAccessPriceField(user, "costPrice")).toBe(true);
      expect(canAccessPriceField(user, "wholesalePrice")).toBe(true);
      expect(canAccessPriceField(user, "anyField")).toBe(true);
    });

    it("FINANCE_STAFF 可访问成本价", () => {
      expect(canAccessPriceField(makeUser(["FINANCE_STAFF"]), "costPrice")).toBe(true);
      expect(canAccessPriceField(makeUser(["FINANCE_STAFF"]), "cost_price")).toBe(true);
    });

    it("FINANCE_STAFF 不可访问供应商价", () => {
      expect(canAccessPriceField(makeUser(["FINANCE_STAFF"]), "supplierPrice")).toBe(false);
    });

    it("STORE_MANAGER 可访问批发价", () => {
      expect(canAccessPriceField(makeUser(["STORE_MANAGER"]), "wholesalePrice")).toBe(true);
    });

    it("STORE_MANAGER 不可访问成本价", () => {
      expect(canAccessPriceField(makeUser(["STORE_MANAGER"]), "costPrice")).toBe(false);
    });

    it("PURCHASE_STAFF 可访问成本价和供应商价", () => {
      expect(canAccessPriceField(makeUser(["PURCHASE_STAFF"]), "costPrice")).toBe(true);
      expect(canAccessPriceField(makeUser(["PURCHASE_STAFF"]), "supplierPrice")).toBe(true);
    });

    it("PURCHASE_STAFF 不可访问批发价", () => {
      expect(canAccessPriceField(makeUser(["PURCHASE_STAFF"]), "wholesalePrice")).toBe(false);
    });

    it("非敏感字段任何角色都可访问", () => {
      expect(canAccessPriceField(makeUser(["SALES_STAFF"]), "productName")).toBe(true);
      expect(canAccessPriceField(makeUser(["SALES_STAFF"]), "sku")).toBe(true);
    });

    it("SALES_STAFF 可访问建议零售价", () => {
      expect(canAccessPriceField(makeUser(["SALES_STAFF"]), "suggestedRetailPrice")).toBe(true);
    });

    it("SALES_STAFF 不可访问利润和毛利率", () => {
      expect(canAccessPriceField(makeUser(["SALES_STAFF"]), "profit")).toBe(false);
      expect(canAccessPriceField(makeUser(["SALES_STAFF"]), "margin")).toBe(false);
    });
  });

  describe("filterPriceFields", () => {
    it("SUPER_ADMIN 不过滤", () => {
      const user = makeUser(["SUPER_ADMIN"]);
      const data = { name: "商品", costPrice: 100, wholesalePrice: 80 };
      const result = filterPriceFields(user, data);
      expect(result.filtered).toEqual(data);
      expect(result.blockedFields).toEqual([]);
    });

    it("SALES_STAFF 成本价和批发价应被过滤为 null", () => {
      const user = makeUser(["SALES_STAFF"]);
      const data = { name: "商品", costPrice: 100, wholesalePrice: 80, retailPrice: 120 };
      const result = filterPriceFields(user, data);
      expect(result.filtered.costPrice).toBeNull();
      expect(result.filtered.wholesalePrice).toBeNull();
      expect(result.filtered.retailPrice).toBe(120);
      expect(result.blockedFields).toContain("costPrice");
      expect(result.blockedFields).toContain("wholesalePrice");
    });

    it("非价格字段不受影响", () => {
      const user = makeUser(["SALES_STAFF"]);
      const data = { id: 1, name: "商品", barcode: "123456" };
      const result = filterPriceFields(user, data);
      expect(result.filtered.id).toBe(1);
      expect(result.filtered.name).toBe("商品");
      expect(result.blockedFields).toEqual([]);
    });
  });

  describe("filterPriceFieldsBatch", () => {
    it("批量过滤应处理每个元素", () => {
      const user = makeUser(["SALES_STAFF"]);
      const data = [
        { name: "商品A", costPrice: 100 },
        { name: "商品B", costPrice: 200 },
      ];
      const result = filterPriceFieldsBatch(user, data);
      expect(result.filtered).toHaveLength(2);
      expect(result.filtered[0].costPrice).toBeNull();
      expect(result.filtered[1].costPrice).toBeNull();
      expect(result.blockedFields).toContain("costPrice");
    });

    it("SUPER_ADMIN 批量不过滤", () => {
      const user = makeUser(["SUPER_ADMIN"]);
      const data = [{ name: "商品A", costPrice: 100 }];
      const result = filterPriceFieldsBatch(user, data);
      expect(result.filtered[0].costPrice).toBe(100);
      expect(result.blockedFields).toEqual([]);
    });

    it("空数组返回空数组", () => {
      const user = makeUser(["SALES_STAFF"]);
      const result = filterPriceFieldsBatch(user, []);
      expect(result.filtered).toEqual([]);
      expect(result.blockedFields).toEqual([]);
    });
  });

  describe("getAccessiblePriceFields", () => {
    it("SUPER_ADMIN 返回所有敏感字段", () => {
      const fields = getAccessiblePriceFields(makeUser(["SUPER_ADMIN"]));
      expect(fields.length).toBeGreaterThan(0);
      expect(fields).toContain("costPrice");
      expect(fields).toContain("wholesalePrice");
    });

    it("FINANCE_STAFF 不包含供应商价", () => {
      const fields = getAccessiblePriceFields(makeUser(["FINANCE_STAFF"]));
      expect(fields).toContain("costPrice");
      expect(fields).not.toContain("supplierPrice");
    });

    it("PURCHASE_STAFF 包含成本价和供应商价", () => {
      const fields = getAccessiblePriceFields(makeUser(["PURCHASE_STAFF"]));
      expect(fields).toContain("costPrice");
      expect(fields).toContain("supplierPrice");
    });
  });

  describe("getBlockedPriceFields", () => {
    it("SUPER_ADMIN 返回空数组", () => {
      expect(getBlockedPriceFields(makeUser(["SUPER_ADMIN"]))).toEqual([]);
    });

    it("SALES_STAFF 被禁止访问的字段包含成本价", () => {
      const blocked = getBlockedPriceFields(makeUser(["SALES_STAFF"]));
      expect(blocked).toContain("costPrice");
      expect(blocked).toContain("wholesalePrice");
      expect(blocked).toContain("supplierPrice");
    });

    it("FINANCE_STAFF 被禁止访问的字段包含供应商价", () => {
      const blocked = getBlockedPriceFields(makeUser(["FINANCE_STAFF"]));
      expect(blocked).toContain("supplierPrice");
      expect(blocked).not.toContain("costPrice");
    });
  });

  describe("getPricePermissionMatrix", () => {
    it("应返回所有敏感字段的权限矩阵", () => {
      const matrix = getPricePermissionMatrix();
      expect(Object.keys(matrix).length).toBeGreaterThan(0);
      expect(matrix.costPrice).toBeDefined();
      expect(matrix.costPrice.description).toBe("成本价");
      expect(Array.isArray(matrix.costPrice.roles)).toBe(true);
    });

    it("每个字段都包含 description 和 roles", () => {
      const matrix = getPricePermissionMatrix();
      for (const [field, info] of Object.entries(matrix)) {
        expect(info.description).toBeTruthy();
        expect(Array.isArray(info.roles)).toBe(true);
        expect(info.roles.length).toBeGreaterThan(0);
      }
    });
  });

  describe("logUnauthorizedAccess", () => {
    it("应成功写入审计日志", async () => {
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 1 });

      await expect(
        logUnauthorizedAccess(makeUser(["SALES_STAFF"]), "view_cost_price", "尝试查看成本价", "product:1", "default")
      ).resolves.not.toThrow();

      expect(mockQueryWithTenant).toHaveBeenCalled();
    });

    it("DB 错误时不应抛出（静默失败）", async () => {
      mockQueryWithTenant.mockRejectedValue(new Error("DB Error"));

      await expect(
        logUnauthorizedAccess(makeUser(["SALES_STAFF"]), "view_cost_price", "尝试查看成本价", "product:1", "default")
      ).resolves.not.toThrow();
    });
  });

  describe("canAccessPriceLevel", () => {
    it("SUPER_ADMIN 可访问所有等级", async () => {
      const { canAccessPriceLevel } = await import("../../shared/price-guard.js");
      expect(await canAccessPriceLevel(makeUser(["SUPER_ADMIN"]), "VIP", "default")).toBe(true);
    });

    it("STORE_MANAGER 可访问所有等级", async () => {
      const { canAccessPriceLevel } = await import("../../shared/price-guard.js");
      expect(await canAccessPriceLevel(makeUser(["STORE_MANAGER"]), "VIP", "default")).toBe(true);
    });

    it("FINANCE_STAFF 可访问所有等级", async () => {
      const { canAccessPriceLevel } = await import("../../shared/price-guard.js");
      expect(await canAccessPriceLevel(makeUser(["FINANCE_STAFF"]), "VIP", "default")).toBe(true);
    });

    it("SALES_STAFF 只能访问 RETAIL 等级", async () => {
      const { canAccessPriceLevel } = await import("../../shared/price-guard.js");
      expect(await canAccessPriceLevel(makeUser(["SALES_STAFF"]), "RETAIL", "default")).toBe(true);
    });

    it("SALES_STAFF 不可访问非 RETAIL 等级", async () => {
      const { canAccessPriceLevel } = await import("../../shared/price-guard.js");
      expect(await canAccessPriceLevel(makeUser(["SALES_STAFF"]), "VIP", "default")).toBe(false);
    });

    it("无角色用户不可访问任何等级", async () => {
      const { canAccessPriceLevel } = await import("../../shared/price-guard.js");
      expect(await canAccessPriceLevel(makeUser([]), "RETAIL", "default")).toBe(false);
    });
  });
});
