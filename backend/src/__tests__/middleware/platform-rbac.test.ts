/**
 * S3-193 · 平台侧 RBAC 机制单测（middleware/platform-rbac.ts）
 *
 * 覆盖判据表（与实现注释逐条对应）：
 *   ① 全通：role ∈ {PLATFORM_SUPER_ADMIN, SUPER_ADMIN} ⇒ 放行，且**不查**角色矩阵；
 *   ② 写码（:manage）⇒ 需 `can_page_btn = 1`；读码（:view）⇒ 需 `can_menu = 1`；
 *   ③ 未绑定角色（role 空/非法）⇒ 403 语义（no_admin_role）；
 *   ④ 角色行不存在 / 矩阵行缺失 ⇒ 403 语义；
 *   ⑤ 矩阵命中但位为 0 ⇒ 403 语义（matrix_deny）；
 *   ⑥ DB 异常 ⇒ **fail-closed**（allow=false, reason=check_error），不抛错；
 *   ⑦ 未登记权限码 ⇒ 注册期抛错（不静默放过）。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn()
}));

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn()
}));

import {
  PLATFORM_PERMISSIONS,
  PLATFORM_SUPER_ROLES,
  checkPlatformPermission,
  isRegisteredPlatformPermission,
  isPlatformSuperRole,
  normalizePlatformRoleCode,
  requirePlatformPermission,
  resolvePlatformPermission
} from "../../middleware/platform-rbac";

const WRITE_SPEC = resolvePlatformPermission("sysconfig:manage");
const READ_SPEC = resolvePlatformPermission("sysconfig:view");

/** 按 SQL 内容分派 mock：admin 角色行 / 角色行 / 矩阵行 */
function mockDb(rows: {
  adminRole?: string | null;
  roleRow?: { id: number; code: string } | null;
  matrix?: { canMenu: number; canPageBtn: number } | null;
}) {
  hoisted.queryOne.mockImplementation((sql: string) => {
    if (sql.includes("FROM t_platform_admin")) {
      return Promise.resolve(rows.adminRole === undefined ? null : { role: rows.adminRole });
    }
    if (sql.includes("FROM t_platform_role WHERE code")) {
      return Promise.resolve(rows.roleRow ?? null);
    }
    if (sql.includes("FROM t_platform_role_permission")) {
      return Promise.resolve(rows.matrix ?? null);
    }
    return Promise.resolve(null);
  });
}

describe("S3-193 · 权限码登记表", () => {
  it("写码按 `<域>:manage` 登记；读码派生自权限点目录（MENU 级），两侧都可解析", () => {
    expect(WRITE_SPEC).toMatchObject({ moduleCode: "sysconfig", level: "WRITE", catalogReady: true });
    expect(READ_SPEC).toMatchObject({ moduleCode: "sysconfig", level: "READ", catalogReady: true });
    // 读码来自 PERMISSION_CATALOG（7 个功能域各 1 条 MENU）+ 本单新增 9 条写码
    expect(PLATFORM_PERMISSIONS.size).toBe(16);
    expect(isRegisteredPlatformPermission("sysconfig:manage")).toBe(true);
    expect(isRegisteredPlatformPermission("sysconfig:delete-all")).toBe(false);
  });

  it("未登记的权限码在**注册期**抛错（避免拼错码静默失效）", () => {
    expect(() => requirePlatformPermission("sysconfig:mange")).toThrow(/未登记的平台权限码/);
  });
});

describe("S3-193 · 角色口径归一", () => {
  it("超管口径兼容两套写法，其它角色不误判", () => {
    expect(PLATFORM_SUPER_ROLES).toEqual(["PLATFORM_SUPER_ADMIN", "SUPER_ADMIN"]);
    expect(isPlatformSuperRole("PLATFORM_SUPER_ADMIN")).toBe(true);
    expect(isPlatformSuperRole(" super_admin ")).toBe(true);
    expect(isPlatformSuperRole("PLATFORM_ADMIN")).toBe(false);
    expect(isPlatformSuperRole(null)).toBe(false);
  });

  it("粗粒度角色 → 平台角色码（小写 + 既有 code 约束），非法值 ⇒ null", () => {
    expect(normalizePlatformRoleCode("PLATFORM_ADMIN")).toBe("platform_admin");
    expect(normalizePlatformRoleCode("SUPPORT")).toBe("support");
    expect(normalizePlatformRoleCode("")).toBeNull();
    expect(normalizePlatformRoleCode(null)).toBeNull();
    expect(normalizePlatformRoleCode("A")).toBeNull(); // 长度 <2，不合 code 约束
    expect(normalizePlatformRoleCode("1bad")).toBeNull(); // 非小写字母开头
  });
});

describe("S3-193 · 判定表", () => {
  beforeEach(() => {
    hoisted.query.mockReset();
    hoisted.queryOne.mockReset();
  });

  it("① 超管 ⇒ 放行，且不查角色矩阵（只查一次管理员角色）", async () => {
    mockDb({ adminRole: "PLATFORM_SUPER_ADMIN" });
    const decision = await checkPlatformPermission(1, WRITE_SPEC);
    expect(decision).toMatchObject({ allow: true, reason: "super" });
    expect(hoisted.queryOne).toHaveBeenCalledTimes(1);
    expect(String(hoisted.queryOne.mock.calls[0][0])).toContain("FROM t_platform_admin");
  });

  it("② 写码需 can_page_btn=1；读码需 can_menu=1（同域两种码判据不同）", async () => {
    mockDb({
      adminRole: "PLATFORM_ADMIN",
      roleRow: { id: 7, code: "platform_admin" },
      matrix: { canMenu: 1, canPageBtn: 0 }
    });
    const write = await checkPlatformPermission(9, WRITE_SPEC);
    expect(write).toMatchObject({ allow: false, reason: "matrix_deny" });
    expect(write.message).toContain("sysconfig:manage");

    const read = await checkPlatformPermission(9, READ_SPEC);
    expect(read).toMatchObject({ allow: true, reason: "matrix_allow" });
  });

  it("③ 未绑定/非法角色 ⇒ 403 语义（no_admin_role），不查矩阵", async () => {
    mockDb({ adminRole: null });
    const decision = await checkPlatformPermission(9, WRITE_SPEC);
    expect(decision).toMatchObject({ allow: false, reason: "no_admin_role" });
    expect(hoisted.queryOne).toHaveBeenCalledTimes(1);
  });

  it("④ 角色行不存在 / 矩阵行缺失 ⇒ 403 语义（两条原因可区分）", async () => {
    mockDb({ adminRole: "SUPPORT", roleRow: null });
    expect(await checkPlatformPermission(9, WRITE_SPEC)).toMatchObject({
      allow: false,
      reason: "role_not_configured"
    });

    mockDb({ adminRole: "SUPPORT", roleRow: { id: 3, code: "support" }, matrix: null });
    expect(await checkPlatformPermission(9, WRITE_SPEC)).toMatchObject({
      allow: false,
      reason: "matrix_missing"
    });
  });

  it("⑤ 矩阵命中且位为 1 ⇒ 放行（can_page_btn=1）", async () => {
    mockDb({
      adminRole: "SUPPORT",
      roleRow: { id: 3, code: "support" },
      matrix: { canMenu: 1, canPageBtn: 1 }
    });
    expect(await checkPlatformPermission(9, WRITE_SPEC)).toMatchObject({
      allow: true,
      reason: "matrix_allow",
      roleCode: "support"
    });
  });

  it("⑥ DB 异常 ⇒ fail-closed（allow=false / check_error），不抛错", async () => {
    hoisted.queryOne.mockRejectedValue(new Error("ER_NO_SUCH_TABLE"));
    const decision = await checkPlatformPermission(9, WRITE_SPEC);
    expect(decision).toMatchObject({ allow: false, reason: "check_error" });
    expect(decision.message).toContain("已按拒绝处理");
  });
});
