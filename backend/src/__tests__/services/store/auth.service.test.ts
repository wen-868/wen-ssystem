import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  signToken: vi.fn(),
  getUserAccessInfo: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

vi.mock("../../../middleware/auth", () => ({
  signToken: mocks.signToken,
  getUserAccessInfo: mocks.getUserAccessInfo,
}));

vi.mock("../../../shared/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));

import { login } from "../../../services/store/auth.service";

describe("store/auth.service login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("登录成功返回 token 与用户信息", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 1, username: "admin", password_hash: "hash", real_name: "管理员",
      store_id: 1, status: 1, tenant_id: "t1", login_fail_count: 0, locked_until: null,
    });
    mocks.verifyPassword.mockResolvedValueOnce(true);
    mocks.signToken.mockReturnValueOnce("token123");
    mocks.query
      .mockResolvedValueOnce(undefined) // UPDATE login_fail_count=0
      .mockResolvedValueOnce([{ role_code: "STORE_MANAGER" }]); // roles
    mocks.getUserAccessInfo.mockReturnValueOnce({ permissions: ["store:*"], accessModes: ["CASHIER"] });

    const result = await login("admin", "admin123");
    expect(result.token).toBe("token123");
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_sys_user SET login_fail_count = 0"),
      expect.any(Array)
    );
  });

  it("密码错误 5 次锁定账号", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 1, username: "admin", password_hash: "hash", real_name: "管理员",
      store_id: 1, status: 1, tenant_id: "t1", login_fail_count: 4, locked_until: null,
    });
    mocks.verifyPassword.mockResolvedValueOnce(false);
    await expect(login("admin", "wrong")).rejects.toThrow("已锁定");
    // 锁定更新（login_fail_count=5 + locked_until）
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("locked_until"),
      expect.any(Array)
    );
  });

  it("账号锁定中拒绝登录", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 1, username: "admin", password_hash: "hash", real_name: "管理员",
      store_id: 1, status: 1, tenant_id: "t1", login_fail_count: 5,
      locked_until: new Date(Date.now() + 600000),
    });
    await expect(login("admin", "admin123")).rejects.toThrow("账号已锁定");
  });
});
