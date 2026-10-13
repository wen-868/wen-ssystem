/**
 * S3-183 回归护栏（P0 · 真实租户功能中心空白）
 *
 * 依据：docs/tasks/inbox/ACTIVE-S3-183.md（收口总清单第 17/18 项）
 *
 * 本文件钉四类判据（谁改回去谁就红）：
 *   A. `tenant-rbac-provision.service.ts` 的克隆/绑定语句口径（照 197：不用 INSERT IGNORE、
 *      幂等判据 (role_code, tenant_id) / (menu_code, tenant_id)、绑定的角色查询必须限定本租户、
 *      绑定幂等用 (user_id, role_id)）；
 *   B. 四个"建租户"落点都必须调用同一套供给逻辑（禁止某条链路上悄悄漏掉 —— 漏掉的那条就是
 *      "新租户一出生就坏"的原样复现）；
 *   C. `demoLogin()` 的 roles 查询必须带 `r.tenant_id = ur.tenant_id`（否则跨租户绑定会返回
 *      重复的 SUPER_ADMIN）；
 *   D. 迁移 198 的形状红线：只写三张系统表、零 DELETE、全文无 INSERT IGNORE、语句顶格写在注释块前
 *      （踩坑[63]）、注释内无 ASCII 分号。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  addTablePrefix,
  firstKeyword,
  isDataWriteStatement,
  splitSqlStatements,
} from "../../shared/migration";

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({ default: mocks }));

import {
  bindTenantAdminToOwnSuperAdmin,
  provisionTenantRbac,
  TENANT_RBAC_SOURCE_TENANT_ID,
  type SqlRunner,
} from "../../services/platform/tenant-rbac-provision.service";

const SERVICE_DIR = resolve(__dirname, "../../services");
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const FILE_198 = "198_租户角色菜单补全.sql";
const NEW_TENANT = "f0cbfe78-9f74-4966-9d1e-95aff8402d1c";

/** 记录型执行器：把每条 SQL 与参数记下来，并按需返回驱动形态的 affectedRows */
function recorder(affectedRows = 1) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const run: SqlRunner = async (sql, params) => {
    calls.push({ sql, params: params ?? [] });
    return { affectedRows };
  };
  return { calls, run };
}

describe("A. provisionTenantRbac（开通链路 · 角色/菜单克隆）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("发三条语句（角色 / 顶级菜单 / 子级菜单），全部用 NOT EXISTS 做幂等且不用 INSERT IGNORE", async () => {
    const { calls, run } = recorder(3);
    const result = await provisionTenantRbac(run, NEW_TENANT);

    expect(calls).toHaveLength(3);
    expect(calls[0].sql).toMatch(/^INSERT INTO t_sys_role/);
    expect(calls[1].sql).toMatch(/^INSERT INTO t_sys_menu/);
    expect(calls[2].sql).toMatch(/^INSERT INTO t_sys_menu/);

    // 角色克隆：带上读路径真正取值的列，幂等判据 (role_code, tenant_id)
    for (const column of ["role_code", "role_name", "description", "data_scope", "permissions", "status", "tenant_id"]) {
      expect(calls[0].sql).toContain(column);
    }
    expect(calls[0].sql).toContain("s.tenant_id = ?");
    expect(calls[0].sql).toContain("d.tenant_id = ? AND d.role_code = s.role_code");
    expect(calls[0].params).toEqual([NEW_TENANT, TENANT_RBAC_SOURCE_TENANT_ID, NEW_TENANT]);

    // 顶级 / 子级菜单分开，子级 parent_id 按 menu_code 重指向本租户自己的父行
    expect(calls[1].sql).toContain("m.parent_id IS NULL");
    expect(calls[2].sql).toContain("m.parent_id IS NOT NULL");
    expect(calls[2].sql).toContain("p.menu_code = sp.menu_code");
    expect(calls[1].params).toEqual([NEW_TENANT, TENANT_RBAC_SOURCE_TENANT_ID, NEW_TENANT]);
    expect(calls[2].params).toEqual([
      NEW_TENANT,
      TENANT_RBAC_SOURCE_TENANT_ID,
      NEW_TENANT,
      TENANT_RBAC_SOURCE_TENANT_ID,
      NEW_TENANT,
    ]);

    // 红线：少写列必须在严格模式下报错停下 ⇒ 不得用 INSERT IGNORE 掩盖冲突
    for (const call of calls) {
      expect(/INSERT\s+IGNORE/i.test(call.sql)).toBe(false);
    }
    expect(result).toEqual({ roleRows: 3, menuTopRows: 3, menuChildRows: 3 });
  });

  it("克隆源即新租户 ⇒ 显式抛错（不静默 0 行、不当成功）", async () => {
    const { calls, run } = recorder(1);
    await expect(provisionTenantRbac(run, TENANT_RBAC_SOURCE_TENANT_ID)).rejects.toThrow(
      /即克隆源/
    );
    expect(calls).toHaveLength(0);
  });

  it("affectedRows 兼容驱动两种返回形态（[ResultSetHeader] 与 ResultSetHeader）", async () => {
    const arrayShaped: SqlRunner = async () => [{ affectedRows: 2 }];
    expect(await provisionTenantRbac(arrayShaped, NEW_TENANT)).toEqual({
      roleRows: 2,
      menuTopRows: 2,
      menuChildRows: 2,
    });
    const objectShaped: SqlRunner = async () => ({ affectedRows: 1 });
    expect(await provisionTenantRbac(objectShaped, NEW_TENANT)).toEqual({
      roleRows: 1,
      menuTopRows: 1,
      menuChildRows: 1,
    });
  });
});

describe("A2. bindTenantAdminToOwnSuperAdmin（首个管理员绑定本租户角色行）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("角色查询限定本租户（不限租户就会绑到 default 的角色行 = 197 的 F2 判红）", async () => {
    const { calls, run } = recorder(1);
    const bound = await bindTenantAdminToOwnSuperAdmin(run, NEW_TENANT, 42);

    expect(bound).toBe(true);
    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0];
    expect(sql).toMatch(/^INSERT INTO t_sys_user_role/);
    expect(sql).toContain("r.tenant_id = ? AND r.role_code = ?");
    expect(sql).toContain("ur.user_id = ? AND ur.role_id = r.id");
    expect(sql).toContain("ORDER BY r.id ASC");
    expect(params).toEqual([42, NEW_TENANT, NEW_TENANT, "SUPER_ADMIN", 42]);
  });

  it("没有新增行（本租户缺 SUPER_ADMIN 行或已有绑定）⇒ 返回 false 且留 WARN，不静默放过", async () => {
    const { run } = recorder(0);
    expect(await bindTenantAdminToOwnSuperAdmin(run, NEW_TENANT, 42)).toBe(false);
    expect(mocks.warn).toHaveBeenCalled();
  });
});

describe("B. 四个开通落点都接到同一套供给逻辑（漏一处就是『新租户一出生就坏』的原样复现）", () => {
  const landingPoints = [
    { file: "platform-tenant.service.ts", note: "POST /api/platform/tenants（工作台侧「新建租户」页）" },
    { file: "tenant-register.service.ts", note: "PUT /api/platform/applications/:id/approve（官网自注册审批）" },
    { file: "platform/tenant-admin.service.ts", note: "平台服务层 initializeTenantDefaults（当前无路由注册，防复发）" },
  ];

  for (const point of landingPoints) {
    it(`${point.file} 调用 provisionTenantRbac（${point.note}）`, () => {
      const text = readFileSync(resolve(SERVICE_DIR, point.file), "utf-8");
      expect(text).toContain("provisionTenantRbac(");
    });
  }

  it("两个『创建管理员』的落点同时要把该账号绑到本租户 SUPER_ADMIN（platform-tenant / tenant-register）", () => {
    for (const file of ["platform-tenant.service.ts", "tenant-register.service.ts"]) {
      const text = readFileSync(resolve(SERVICE_DIR, file), "utf-8");
      expect(text).toContain("bindTenantAdminToOwnSuperAdmin(");
    }
  });
});

describe("C. demoLogin 的 roles 查询带租户过滤（收口总清单第 17 项）", () => {
  it("JOIN t_sys_role 处必须同时匹配 r.tenant_id = ur.tenant_id", () => {
    const text = readFileSync(resolve(SERVICE_DIR, "admin/auth.service.ts"), "utf-8");
    const loginFn = text.slice(text.indexOf("export async function demoLogin"));
    const rolesQuery = loginFn.slice(loginFn.indexOf("SELECT r.role_code"));
    expect(rolesQuery.slice(0, 400)).toContain(
      "JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id"
    );
  });
});

describe("D. 迁移 198 形状约束（存量租户补全）", () => {
  const raw = readFileSync(resolve(MIGRATIONS_DIR, FILE_198), "utf-8").replace(/\r\n/g, "\n");
  const statements = splitSqlStatements(
    raw
      .split("\n")
      .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
      .join("\n")
  );
  const prepared = statements.map((s) => addTablePrefix(s));
  const joined = prepared.join("\n");
  const sqlOnly = statements.join("\n");
  const writes = statements.filter((s) => isDataWriteStatement(s));

  it("文件存在，且首行是可执行语句（不是注释块，规避踩坑[63]）", () => {
    expect(existsSync(resolve(MIGRATIONS_DIR, FILE_198))).toBe(true);
    const firstLine = raw.split("\n").find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("INSERT")).toBe(true);
  });

  it("切块后 7 条语句：5 条写语句（角色 / 顶级菜单 / 子级菜单 / 绑定改指 / 零绑定兜底）+ 2 条核对 SELECT", () => {
    expect(statements).toHaveLength(7);
    expect(writes).toHaveLength(5);
    expect(statements.filter((s) => firstKeyword(s) === "SELECT")).toHaveLength(2);
  });

  it("红线：全文无 INSERT IGNORE、无 DELETE（禁止先插后删），绑定改指是原地 UPDATE", () => {
    expect(/INSERT\s+IGNORE/i.test(sqlOnly)).toBe(false);
    expect(/INSERT\s+IGNORE/i.test(joined)).toBe(false);
    expect(writes.filter((s) => firstKeyword(s) === "DELETE")).toHaveLength(0);
    expect(/DELETE\s+(FROM|r|m|ur)/i.test(sqlOnly)).toBe(false);
    const bindingUpdate = writes.find((s) => firstKeyword(s) === "UPDATE" && /UPDATE t_sys_user_role/i.test(s));
    expect(bindingUpdate, "缺少 UPDATE t_sys_user_role 语句").toBeTruthy();
    expect(bindingUpdate!).toContain("SET ur.role_id = d.id");
    expect(bindingUpdate!).toContain("d.role_code = s.role_code");
    expect(bindingUpdate!).toContain("WHERE s.tenant_id <> ur.tenant_id");
  });

  it("顺序铁律：先克隆角色行、再克隆菜单、最后才是绑定改指与零绑定兜底", () => {
    const roleClone = statements.findIndex((s) => /^INSERT INTO t_sys_role/i.test(s));
    const menuClones = statements
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => /^INSERT INTO t_sys_menu/i.test(s))
      .map(({ i }) => i);
    const bindingUpdate = statements.findIndex((s) => /^UPDATE t_sys_user_role/i.test(s));
    const fallbackBind = statements.findIndex((s) => /^INSERT INTO t_sys_user_role/i.test(s));
    expect(roleClone).toBe(0);
    expect(menuClones).toEqual([1, 2]);
    expect(bindingUpdate).toBe(3);
    expect(fallbackBind).toBe(4);
  });

  it("只写三张系统表（t_sys_role / t_sys_menu / t_sys_user_role），零业务表", () => {
    const writeTargets = [
      ...sqlOnly.matchAll(/^\s*INSERT INTO (t_[a-z0-9_]+)|^\s*UPDATE (t_[a-z0-9_]+)/gim),
    ].map((m) => m[1] ?? m[2]);
    expect([...new Set(writeTargets)].sort()).toEqual([
      "t_sys_menu",
      "t_sys_role",
      "t_sys_user_role",
    ]);
    for (const table of ["t_sale_bill", "t_member", "t_product_spu", "t_store", "t_purchase_order"]) {
      expect(joined).not.toContain(table);
    }
    expect(joined).not.toContain("t_t_");
  });

  it("末两条是核对 SELECT（tenants_without_roles / cross_tenant_bindings）与 result 摘要", () => {
    expect(firstKeyword(statements[5])).toBe("SELECT");
    expect(statements[5]).toContain("tenants_without_roles");
    expect(statements[5]).toContain("tenants_without_menus");
    expect(statements[5]).toContain("cross_tenant_bindings");
    expect(firstKeyword(statements[6])).toBe("SELECT");
    expect(statements[6]).toContain("AS result");
  });

  it("注释块给出执行方式（MIG-4 写闸门）与回滚口径，且注释内无 ASCII 分号", () => {
    expect(raw).toContain("MIGRATION_WRITE_GATE");
    expect(raw).toContain("run-migration.mjs");
    expect(raw).toContain("回滚");
    const commentLines = raw.split("\n").filter((line) => line.trim().startsWith("--"));
    expect(commentLines.length).toBeGreaterThan(20);
    for (const line of commentLines) {
      expect(line.includes(";")).toBe(false);
    }
  });

  it("迁移编号不变量：docs/migrations 下 198 只对应本文件", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("198_"))).toEqual([FILE_198]);
  });
});
