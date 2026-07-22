/**
 * 管理端认证 service 单元测试
 * 被测文件：src/services/admin/auth.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  signToken: vi.fn(),
  getUserAccessInfo: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  signToken: mocks.signToken,
  getUserAccessInfo: mocks.getUserAccessInfo,
  AuthUser: {},
}));

vi.mock("../../../shared/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
  validatePassword: mocks.validatePassword,
}));

import { login, getMe, getSettings, updateSettings, changePassword } from "../../../services/admin/auth.service";

describe("auth.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("login", () => {
    it("账号不存在时抛错", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(login("u", "p")).rejects.toThrow("账号或密码错误");
    });

    it("账号停用时抛错", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1, status: 0, password_hash: "h", login_fail_count: 0, locked_until: null });
      await expect(login("u", "p")).rejects.toThrow("账号已禁用");
    });

    it("密码错误时更新失败次数并抛错", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1, status: 1, password_hash: "h", login_fail_count: 0, locked_until: null });
      mocks.verifyPassword.mockResolvedValue(false);
      mocks.query.mockResolvedValue(undefined);
      await expect(login("u", "p")).rejects.toThrow("还剩4次尝试机会");
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE t_sys_user SET login_fail_count"),
        [1, null, 1]
      );
    });

    it("登录失败5次后账号被锁定", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1, status: 1, password_hash: "h", login_fail_count: 4, locked_until: null });
      mocks.verifyPassword.mockResolvedValue(false);
      mocks.query.mockResolvedValue(undefined);
      await expect(login("u", "p")).rejects.toThrow("账号已锁定15分钟");
    });

    it("账号锁定期间无法登录", async () => {
      const lockedUntil = new Date(Date.now() + 600000);
      mocks.queryOne.mockResolvedValue({ id: 1, status: 1, password_hash: "h", login_fail_count: 5, locked_until: lockedUntil });
      await expect(login("u", "p")).rejects.toThrow("账号已锁定");
    });

    it("登录成功返回 token 和 user", async () => {
      mocks.queryOne.mockResolvedValue({
        id: 1, username: "u", password_hash: "h", real_name: "r",
        store_id: 2, status: 1, tenant_id: "t1",
        login_fail_count: 0, locked_until: null,
      });
      mocks.verifyPassword.mockResolvedValue(true);
      mocks.query.mockResolvedValue([{ role_code: "ADMIN" }]);
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN", permissions: ["*"] });
      mocks.signToken.mockReturnValue("token_xxx");
      const res = await login("u", "p");
      expect(res.token).toBe("token_xxx");
      expect(res.user.username).toBe("u");
      expect(res.user.roles).toEqual(["ADMIN"]);
      expect(res.user.tenantId).toBe("t1");
      expect(mocks.signToken).toHaveBeenCalled();
    });

    it("tenant_id 为空时使用 default", async () => {
      mocks.queryOne.mockResolvedValue({
        id: 1, username: "u", password_hash: "h", real_name: "r",
        store_id: null, status: 1, tenant_id: null,
        login_fail_count: 0, locked_until: null,
      });
      mocks.verifyPassword.mockResolvedValue(true);
      mocks.query.mockResolvedValue([]);
      mocks.getUserAccessInfo.mockReturnValue({});
      mocks.signToken.mockReturnValue("t");
      const res = await login("u", "p");
      expect(res.user.tenantId).toBe("default");
    });
  });

  describe("getMe", () => {
    it("用户设置了 /cashier 主页时 defaultMode 为 CASHIER", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: "/cashier" });
      mocks.query.mockResolvedValue([]); // getUserPermissions 结果
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const user = { id: 1, tenantId: "t1" } as any;
      const res = await getMe(user);
      expect(res.defaultMode).toBe("CASHIER");
    });

    it("用户设置了其他主页时 defaultMode 为 ADMIN", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: "/dashboard" });
      mocks.query.mockResolvedValue([]); // getUserPermissions 结果
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "CASHIER" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.defaultMode).toBe("ADMIN");
    });

    it("未设置主页时使用 accessInfo.defaultMode", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      mocks.query.mockResolvedValue([]); // getUserPermissions 结果
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.defaultMode).toBe("ADMIN");
    });

    it("返回用户权限列表", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: null });
      mocks.query.mockResolvedValue([
        { permissions: JSON.stringify(["product:read", "order:read"]) },
        { permissions: JSON.stringify(["order:write"]) },
      ]);
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.permissions).toEqual(expect.arrayContaining(["product:read", "order:read", "order:write"]));
      expect(res.permissions.length).toBe(3);
    });

    // ============ R54遗留 生产环境登录500修复：normalizePermissions 容错测试 ============
    // 生产环境 mysql2 默认会把 JSON 类型列自动解析为 JS 对象（数组），
    // 原 getUserPermissions 用 JSON.parse(role.permissions) 对数组调用会抛异常导致登录 500。
    // 以下测试覆盖 normalizePermissions 对各种 permissions 返回形态的容错处理。

    it("permissions 为 JS 数组时（mysql2 自动解析 JSON）应直接使用，不抛异常", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: null });
      // 模拟 mysql2 自动解析 JSON 类型列后返回的 JS 数组（生产环境 500 根因）
      mocks.query.mockResolvedValue([
        { permissions: ["product:read", "order:read"] },
        { permissions: ["order:write"] },
      ]);
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.permissions).toEqual(expect.arrayContaining(["product:read", "order:read", "order:write"]));
      expect(res.permissions.length).toBe(3);
    });

    it("permissions 为 null 时应返回空数组", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: null });
      mocks.query.mockResolvedValue([{ permissions: null }]);
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.permissions).toEqual([]);
    });

    it("permissions 为空字符串时应返回空数组", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: null });
      mocks.query.mockResolvedValue([{ permissions: "" }]);
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.permissions).toEqual([]);
    });

    it("permissions 为非法 JSON 字符串时应容错返回空数组，不抛异常", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: null });
      mocks.query.mockResolvedValue([{ permissions: "not-a-json" }]);
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.permissions).toEqual([]);
    });

    it("permissions 为混合形态（数组 + 字符串 + null）时应正确合并去重", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: null });
      mocks.query.mockResolvedValue([
        { permissions: ["perm1", "perm2"] },           // JS 数组（mysql2 自动解析）
        { permissions: JSON.stringify(["perm2", "perm3"]) }, // JSON 字符串
        { permissions: null },                          // null
      ]);
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      const res = await getMe({ id: 1, tenantId: "t1" } as any);
      expect(res.permissions).toEqual(expect.arrayContaining(["perm1", "perm2", "perm3"]));
      expect(res.permissions.length).toBe(3); // 去重后 perm1/perm2/perm3
    });
  });

  describe("login - getUserPermissions 容错（R54遗留 生产500修复）", () => {
    it("登录时 permissions 为 JS 数组（mysql2 自动解析）应正常返回，不抛 500", async () => {
      mocks.queryOne.mockResolvedValue({
        id: 1, username: "u", password_hash: "h", real_name: "r",
        store_id: 2, status: 1, tenant_id: "t1",
        login_fail_count: 0, locked_until: null,
      });
      mocks.verifyPassword.mockResolvedValue(true);
      // login 中 query 调用顺序：
      //   1) UPDATE t_sys_user SET login_fail_count=0（重置失败次数，返回值无关）
      //   2) SELECT r.role_code（查角色编码）
      //   3) SELECT r.permissions（getUserPermissions 内部，返回 JS 数组形态）
      mocks.query
        .mockResolvedValueOnce([])                                      // 1) UPDATE
        .mockResolvedValueOnce([{ role_code: "ADMIN" }])                // 2) SELECT role_code
        .mockResolvedValueOnce([{ permissions: ["admin:read", "admin:write"] }]); // 3) SELECT permissions
      mocks.getUserAccessInfo.mockReturnValue({ defaultMode: "ADMIN" });
      mocks.signToken.mockReturnValue("token_xxx");
      const res = await login("u", "p");
      expect(res.token).toBe("token_xxx");
      expect(res.user.permissions).toEqual(["admin:read", "admin:write"]);
    });
  });

  describe("getSettings", () => {
    it("返回 defaultHomepage", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ default_homepage: "/x" });
      const res = await getSettings(1, "t1");
      expect(res.defaultHomepage).toBe("/x");
    });

    it("无记录时返回 null", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await getSettings(1, "t1");
      expect(res.defaultHomepage).toBeNull();
    });
  });

  describe("updateSettings", () => {
    it("更新设置返回 success", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updateSettings(1, "/home", "t1");
      expect(res).toEqual({ success: true });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });
  });

  describe("changePassword", () => {
    it("用户不存在时抛错", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(changePassword(1, "old", "new", "t1")).rejects.toThrow("用户不存在");
    });

    it("旧密码错误时抛错", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, passwordHash: "h" });
      mocks.verifyPassword.mockResolvedValue(false);
      await expect(changePassword(1, "old", "new", "t1")).rejects.toThrow("旧密码错误");
    });

    it("成功修改密码", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, passwordHash: "h" });
      mocks.verifyPassword.mockResolvedValue(true);
      mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
      mocks.hashPassword.mockResolvedValue("new_hash");
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await changePassword(1, "old", "new", "t1");
      expect(res.message).toBe("密码修改成功");
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("UPDATE t_sys_user SET password_hash");
      expect(params).toEqual(["new_hash", 1]);
    });

    it("新密码不符合要求时抛错", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, passwordHash: "h" });
      mocks.verifyPassword.mockResolvedValue(true);
      mocks.validatePassword.mockReturnValue({ valid: false, errors: ["密码长度至少8位", "密码必须包含字母"] });
      await expect(changePassword(1, "old", "123456", "t1")).rejects.toThrow("密码不符合要求");
    });
  });
});
