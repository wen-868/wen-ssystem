/**
 * C6-2-T6：平台角色 + 权限矩阵 + 权限点目录服务
 * （t_platform_role / t_platform_role_permission / t_platform_permission_catalog）
 *
 * 口径（对应 R101-派单-20260926-C6-2-T6 交付物②、验收标准⑥⑦）：
 * - 空表/空目录诚实空态：roles: [] / modules: [] / matrix 的 false+false+''，读路径零写库；
 * - domainCount = 矩阵中 can_menu=1 的 module_code **去重数**（反测 c：不是角色行数/矩阵行数）；
 * - 内置角色保护：删除 ⇒ 400；改 name ⇒ 400（remark/enabled 可改）；
 * - code 唯一冲突 ⇒ 409（含唯一键竞态兜底）；
 * - 未传字段不得被覆盖成空（只写传了的字段）；
 * - moduleCode 必须在目录模块集合内、dataScope 必须在目录的 4 档内，否则 400；
 * - 整表替换在同一事务内先删后插。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM，踩坑[R101-C2-0]同例），用例只写好，执行由凌舟在本机跑。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import {
  listPlatformRoles,
  listPermissionCatalog,
  createPlatformRole,
  updatePlatformRole,
  deletePlatformRole,
  getRolePermissions,
  replaceRolePermissions,
} from "../../../services/platform/platform-role.service";
import { AppError } from "../../../shared/app-error";

interface ExecCall {
  sql: string;
  params: unknown[];
}

function execCalls(): ExecCall[] {
  return (mocks.connExecute.mock.calls as unknown[][]).map((call) => ({
    sql: String(call[1]),
    params: (call[2] ?? []) as unknown[],
  }));
}

/** 目录行（与迁移 179 预置一致的 7 域 MENU + ticket 7 BUTTON + 4 DATA 的最小可用子集） */
const CATALOG_ROWS = [
  { moduleCode: "ai", moduleName: "AI 能力管控", permCode: "ai:view", permName: "查看 AI 能力管控", permLevel: "MENU" },
  { moduleCode: "common", moduleName: "数据范围档位", permCode: "scope:all", permName: "全部租户", permLevel: "DATA" },
  { moduleCode: "common", moduleName: "数据范围档位", permCode: "scope:billing-all", permName: "账单口径全部", permLevel: "DATA" },
  { moduleCode: "common", moduleName: "数据范围档位", permCode: "scope:follow-group", permName: "指定跟进组", permLevel: "DATA" },
  { moduleCode: "common", moduleName: "数据范围档位", permCode: "scope:gray-group", permName: "灰度组租户", permLevel: "DATA" },
  { moduleCode: "ticket", moduleName: "工单系统", permCode: "ticket:view", permName: "查看工单系统", permLevel: "MENU" },
  { moduleCode: "ticket", moduleName: "工单系统", permCode: "ticket:reply", permName: "公开回复工单", permLevel: "BUTTON" },
  { moduleCode: "ticket", moduleName: "工单系统", permCode: "ticket:note", permName: "内部备注", permLevel: "BUTTON" },
  { moduleCode: "tenant", moduleName: "租户管理", permCode: "tenant:view", permName: "查看租户管理", permLevel: "MENU" },
];

describe("C6-2-T6 · GET /api/platform/admins/roles（角色列表 + domainCount）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 7, affectedRows: 1 }, undefined]);
  });

  it("空表 ⇒ roles: []，读路径不写库、不生种子", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listPlatformRoles();

    expect(result).toEqual({ roles: [] });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("domainCount 口径 = can_menu=1 的 module_code 去重数（反测 c：不是角色行数/矩阵行数）", async () => {
    mocks.query.mockResolvedValueOnce([
      { id: 1, name: "超级管理员", code: "super_admin", type: "builtin", domainCount: "7" },
      { id: 2, name: "工单专员", code: "ticket_ops", type: "custom", domainCount: 1 },
      { id: 3, name: "待配置角色", code: "empty_role", type: "custom", domainCount: null },
    ]);
    const { roles } = await listPlatformRoles();

    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("FROM t_platform_role r");
    expect(sql).toContain("LEFT JOIN t_platform_role_permission p ON p.role_id = r.id");
    expect(sql).toContain("COUNT(DISTINCT CASE WHEN p.can_menu = 1 THEN p.module_code END)");
    // 错口径反证：若改成"角色行数"（COUNT(*)）或"矩阵行数"（COUNT(p.id)）本断言必红
    expect(sql).not.toContain("COUNT(*)");
    expect(sql).not.toContain("COUNT(p.id)");
    expect(roles).toEqual([
      { id: 1, name: "超级管理员", code: "super_admin", type: "builtin", domainCount: 7 },
      { id: 2, name: "工单专员", code: "ticket_ops", type: "custom", domainCount: 1 },
      { id: 3, name: "待配置角色", code: "empty_role", type: "custom", domainCount: 0 },
    ]);
  });
});

describe("C6-2-T6 · GET /api/platform/permissions/catalog（权限点目录）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("空目录 ⇒ modules: []，读路径不写库", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listPermissionCatalog();

    expect(result).toEqual({ modules: [] });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("按 module_code 分组、组内 MENU→BUTTON→DATA 顺序保留，级别统一大写", async () => {
    mocks.query.mockResolvedValueOnce(CATALOG_ROWS);
    const { modules } = await listPermissionCatalog();

    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("FROM t_platform_permission_catalog");
    expect(sql).toContain("FIELD(perm_level, 'MENU', 'BUTTON', 'DATA')");

    expect(modules.map((m) => m.moduleCode)).toEqual(["ai", "common", "ticket", "tenant"]);
    const ticket = modules.find((m) => m.moduleCode === "ticket");
    expect(ticket?.moduleName).toBe("工单系统");
    expect(ticket?.permissions).toEqual([
      { permCode: "ticket:view", permName: "查看工单系统", permLevel: "MENU" },
      { permCode: "ticket:reply", permName: "公开回复工单", permLevel: "BUTTON" },
      { permCode: "ticket:note", permName: "内部备注", permLevel: "BUTTON" },
    ]);
  });
});

describe("C6-2-T6 · POST /api/platform/roles（新建自定义角色）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 11, affectedRows: 1 }, undefined]);
  });

  it("成功：落库 type 固定 custom、remark 未填则 NULL，返回 { id }", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const result = await createPlatformRole({ name: "工单专员", code: "ticket_ops" });

    expect(result).toEqual({ id: 11 });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const calls = execCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("INSERT INTO t_platform_role");
    expect(calls[0].sql).toContain("'custom'");
    expect(calls[0].params).toEqual(["工单专员", "ticket_ops", null]);
  });

  it("code 冲突（已存在）⇒ 409，且不进入事务", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 3 });
    await expect(
      createPlatformRole({ name: "重复编码", code: "ticket_ops" })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("并发竞态（唯一键 ER_DUP_ENTRY）同样 409，不外泄 500", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.transaction.mockRejectedValueOnce(
      Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 })
    );
    await expect(
      createPlatformRole({ name: "竞态角色", code: "race_role" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("C6-2-T6 · PUT /api/platform/roles/:id（存在才写）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  it("只传 remark ⇒ UPDATE 只含 remark，未传的 name/enabled 不被覆盖成空", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, type: "custom" });
    const result = await updatePlatformRole(5, { remark: "只改备注" });

    expect(result).toEqual({ id: 5, changedFields: ["remark"] });
    const calls = execCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("UPDATE t_platform_role SET remark = ?");
    expect(calls[0].sql).not.toContain("name = ?");
    expect(calls[0].sql).not.toContain("enabled = ?");
    expect(calls[0].params).toEqual(["只改备注", 5]);
  });

  it("内置角色改 name ⇒ 400，且不进入事务", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, type: "builtin" });
    await expect(
      updatePlatformRole(1, { name: "换个名字" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("内置角色改 remark/enabled ⇒ 允许（只锁最小必要面）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, type: "builtin" });
    const result = await updatePlatformRole(1, { remark: "内置角色备注", enabled: false });

    expect(result.changedFields).toEqual(["remark", "enabled"]);
    expect(execCalls()[0].params).toEqual(["内置角色备注", 0, 1]);
  });

  it("角色不存在 ⇒ 404，不进入事务", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(updatePlatformRole(999, { name: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    // 404 是业务错误（AppError），不是 TypeError/500
    mocks.queryOne.mockResolvedValue(null);
    await expect(updatePlatformRole(999, { name: "x" })).rejects.toBeInstanceOf(AppError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("未传任何可改字段 ⇒ 400（不产生空 UPDATE）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, type: "custom" });
    await expect(updatePlatformRole(5, {})).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("C6-2-T6 · DELETE /api/platform/roles/:id（内置保护 + 事务连删）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
  });

  it("内置角色删除 ⇒ 400（反测 a：去掉校验即变红），且不删任何行", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, type: "builtin" });
    await expect(deletePlatformRole(1)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("角色不存在 ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(deletePlatformRole(404)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("自定义角色 ⇒ 同一事务内先删矩阵行、再删角色，返回被删矩阵行数", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 8, type: "custom" });
    mocks.connExecute
      .mockResolvedValueOnce([{ affectedRows: 4 }, undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);

    const result = await deletePlatformRole(8);

    expect(result).toEqual({ id: 8, deletedPermissions: 4 });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const calls = execCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("DELETE FROM t_platform_role_permission WHERE role_id = ?");
    expect(calls[0].params).toEqual([8]);
    expect(calls[1].sql).toContain("DELETE FROM t_platform_role WHERE id = ?");
    expect(calls[1].params).toEqual([8]);
  });
});

describe("C6-2-T6 · GET /api/platform/roles/:id/permissions（矩阵读取，目录全覆盖）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("角色不存在 ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(getRolePermissions(77)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("目录里的每个 module_code 都出现；无记录 ⇒ false/false/''（空态），有记录按落库值", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 2, type: "custom" });
    mocks.query
      .mockResolvedValueOnce(CATALOG_ROWS)
      .mockResolvedValueOnce([
        { moduleCode: "ticket", canMenu: 1, canPageBtn: 1, dataScope: "scope:follow-group" },
      ]);

    const result = await getRolePermissions(2);

    expect(result.roleId).toBe(2);
    expect(result.matrix.map((c) => c.moduleCode)).toEqual(["ai", "common", "ticket", "tenant"]);
    expect(result.matrix[0]).toEqual({
      moduleCode: "ai",
      canMenu: false,
      canPageBtn: false,
      dataScope: "",
    });
    expect(result.matrix[2]).toEqual({
      moduleCode: "ticket",
      canMenu: true,
      canPageBtn: true,
      dataScope: "scope:follow-group",
    });
    expect(String(mocks.query.mock.calls[1][0])).toContain(
      "FROM t_platform_role_permission WHERE role_id = ?"
    );
  });
});

describe("C6-2-T6 · PUT /api/platform/roles/:id/permissions（整表替换）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.queryOne.mockResolvedValue({ id: 3, type: "custom" });
    mocks.query.mockResolvedValue(CATALOG_ROWS);
    mocks.connExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  it("整表替换：同一事务先 DELETE 再逐行 INSERT，返回保存条数", async () => {
    const result = await replaceRolePermissions(3, [
      { moduleCode: "ticket", canMenu: true, canPageBtn: true, dataScope: "scope:all" },
      { moduleCode: "tenant", canMenu: true, canPageBtn: false, dataScope: "" },
    ]);

    expect(result).toEqual({ roleId: 3, saved: 2 });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const calls = execCalls();
    expect(calls[0].sql).toContain("DELETE FROM t_platform_role_permission WHERE role_id = ?");
    expect(calls[1].sql).toContain("INSERT INTO t_platform_role_permission");
    expect(calls[1].params).toEqual([3, "ticket", 1, 1, "scope:all"]);
    expect(calls[2].params).toEqual([3, "tenant", 1, 0, null]);
  });

  it("dataScope 传前端中文标签（全部租户）⇒ 归一化为目录 perm_code（scope:all）落库", async () => {
    await replaceRolePermissions(3, [
      { moduleCode: "ticket", canMenu: false, canPageBtn: false, dataScope: "全部租户" },
    ]);
    expect(execCalls()[1].params).toEqual([3, "ticket", 0, 0, "scope:all"]);
  });

  it("moduleCode 不在目录 ⇒ 400（反测 b：忽略非法值即变红），且不删不插", async () => {
    await expect(
      replaceRolePermissions(3, [
        { moduleCode: "not_in_catalog", canMenu: true, canPageBtn: false, dataScope: "" },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("dataScope 不在 4 档内 ⇒ 400，且不删不插", async () => {
    await expect(
      replaceRolePermissions(3, [
        { moduleCode: "ticket", canMenu: true, canPageBtn: false, dataScope: "本人" },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("matrix 内 moduleCode 重复 ⇒ 400（否则会撞 uk_role_module 变 500，不做静默去重）", async () => {
    await expect(
      replaceRolePermissions(3, [
        { moduleCode: "ticket", canMenu: true, canPageBtn: false, dataScope: "" },
        { moduleCode: "ticket", canMenu: false, canPageBtn: true, dataScope: "" },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("角色不存在 ⇒ 404，且不删不插", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(replaceRolePermissions(999, [])).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
