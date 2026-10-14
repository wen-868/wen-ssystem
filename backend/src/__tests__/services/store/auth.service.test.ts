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
import { constants } from "../../../config/constants";

describe("store/auth.service login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("登录成功返回 token 与用户信息", async () => {
    // S3-203：登录成功路径改用一个**非豁免**账号（豁免账号=唯一对外账号 admin，见下方专测），
    // 否则测不到标准的锁定/计数分支。
    mocks.queryOne.mockResolvedValueOnce({
      id: 1, username: "store_manager", password_hash: "hash", real_name: "管理员",
      store_id: 1, status: 1, tenant_id: "t1", login_fail_count: 0, locked_until: null,
    });
    mocks.verifyPassword.mockResolvedValueOnce(true);
    mocks.signToken.mockReturnValueOnce("token123");
    // S3-203：roles 查询与 permissions 查询都走 t_sys_user_role ur（同一处口径，见 shared/user-permissions.ts）
    mocks.query.mockImplementation((sql: string) => {
      if (String(sql).includes("FROM t_sys_user_role ur")) {
        return Promise.resolve([
          { role_code: "STORE_MANAGER", permissions: JSON.stringify(["store:view", "store:manage"]) },
        ]);
      }
      return Promise.resolve([]);
    });
    mocks.getUserAccessInfo.mockReturnValueOnce({ accessModes: ["CASHIER"] });

    const result = await login("store_manager", constants.DEMO_PASSWORD);
    expect(result.token).toBe("token123");
    // S3-203 新增强度：登录响应必须带上**从 t_sys_role.permissions 解析出来的**权限集合
    expect((result.user as { permissions?: string[] }).permissions).toEqual(["store:view", "store:manage"]);
    // 角色行必须带租户过滤（与工作台同判据）
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("r.tenant_id = ur.tenant_id"),
      expect.any(Array)
    );
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_sys_user SET login_fail_count = 0"),
      expect.any(Array)
    );
  });

  it("密码错误 5 次锁定账号", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 1, username: "store_manager", password_hash: "hash", real_name: "管理员",
      store_id: 1, status: 1, tenant_id: "t1", login_fail_count: 4, locked_until: null,
    });
    mocks.verifyPassword.mockResolvedValueOnce(false);
    await expect(login("store_manager", "wrong")).rejects.toThrow("已锁定");
    // 锁定更新（login_fail_count=5 + locked_until）
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("locked_until"),
      expect.any(Array)
    );
  });

  it("账号锁定中拒绝登录", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 1, username: "store_manager", password_hash: "hash", real_name: "管理员",
      store_id: 1, status: 1, tenant_id: "t1", login_fail_count: 5,
      locked_until: new Date(Date.now() + 600000),
    });
    await expect(login("store_manager", constants.DEMO_PASSWORD)).rejects.toThrow("账号已锁定");
  });

  // ── S3-203：唯一对外账号（admin，同时是演示入口）在**这条登录路径上**也必须永不锁死 ──
  it("S3-203：admin 处于锁定态仍不被拦，且失败时既不累加计数也不写 locked_until", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 1, username: constants.DEMO_USERNAME, password_hash: "hash", real_name: "超级管理员",
      store_id: null, status: 1, tenant_id: "default", login_fail_count: 9,
      locked_until: new Date(Date.now() + 600000),
    });
    mocks.verifyPassword.mockResolvedValueOnce(false);
    await expect(login(constants.DEMO_USERNAME, "wrong")).rejects.toThrow("账号或密码错误");
    // 不得写任何锁定/计数语句（豁免 = 不计数、不锁定）
    const wroteLock = mocks.query.mock.calls.some((c: unknown[]) =>
      String(c[0]).includes("login_fail_count")
    );
    expect(wroteLock).toBe(false);
  });

  it("账号不存在但存在待审注册申请 → 提示审核中而非密码错误", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(null) // t_sys_user 查无账号
      .mockResolvedValueOnce({ id: 8 }); // t_tenant_register_application PENDING
    await expect(login("13410954557", "Any#pwd1")).rejects.toThrow("注册申请正在审核中");
  });

  it("账号不存在且无待审申请 → 统一报账号或密码错误", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(null) // t_sys_user 查无账号
      .mockResolvedValueOnce(null); // 无 PENDING 申请
    await expect(login("nobody", "x")).rejects.toThrow("账号或密码错误");
  });
});
