import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/rbac.service", () => ({
  checkUserPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@shared/response", () => ({
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { requirePermission, checkUserPermission } from "@middleware/rbac-auth";

describe("rbac-auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requirePermission - 有权限应调用next", async () => {
    const mockNext = vi.fn();
    const middleware = requirePermission("test:read");
    await middleware({ user: { id: 1, roles: [] }, tenantId: 1 } as any, {} as any, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it("requirePermission - SUPER_ADMIN应直接通过", async () => {
    const mockNext = vi.fn();
    const middleware = requirePermission("test:read");
    await middleware({ user: { id: 1, roles: ["SUPER_ADMIN"] }, tenantId: 1 } as any, {} as any, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it("checkUserPermission - 应调用service", async () => {
    const result = await checkUserPermission(1, 1, "test:read");
    expect(result).toBe(true);
  });
});
