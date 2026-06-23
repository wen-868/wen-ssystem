import { describe, expect, it } from "vitest";
import { canAccessStore, hasAnyRole } from "../shared/auth.js";

describe("auth role and store helpers", () => {
  it("allows admin roles to access admin APIs", () => {
    expect(hasAnyRole({ id: 1, username: "admin", roles: ["SUPER_ADMIN"], tenantId: "default" }, ["SUPER_ADMIN"])).toBe(true);
  });

  it("rejects store operator from admin-only APIs", () => {
    expect(hasAnyRole({ id: 2, username: "store", roles: ["STORE_OPERATOR"], storeId: 1, tenantId: "default" }, ["SUPER_ADMIN"])).toBe(false);
  });

  it("allows super admin to access any store", () => {
    expect(canAccessStore({ id: 1, username: "admin", roles: ["SUPER_ADMIN"], tenantId: "default" }, 2)).toBe(true);
  });

  it("prevents a store operator from accessing another store", () => {
    expect(canAccessStore({ id: 2, username: "store", roles: ["STORE_OPERATOR"], storeId: 1, tenantId: "default" }, 2)).toBe(false);
  });
});
