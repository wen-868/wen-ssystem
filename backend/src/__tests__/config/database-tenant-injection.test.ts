/**
 * S3-65 根因回归测试：queryWithTenant 写路径（UPDATE/DELETE）的 tenant_id 注入与参数绑定
 *
 * 被测文件：src/config/database.ts（仅写路径 injectUpdateTenant / injectDeleteTenant）
 *
 * 生产实测（凌舟 2026-09-19）：
 *   ① POST /api/admin/auth/change-password 返回 code 0「密码修改成功」；
 *   ② 同一时刻新口令登录 400、旧口令登录 200；
 *   ③ 直查库 password_hash 前后完全一致 ⇒ 数据根本没被修改。
 *
 * 根因：injectUpdateTenant 在 WHERE 前插入 `tenant_id = ?` 时，把 tenantId **前置**到参数数组
 * （`[tenantId, ...params]`）。但 MySQL 是按"占位符在 SQL 文本中出现的顺序"取值的：SET 子句里的
 * 占位符排在 tenant_id 之前，于是 `UPDATE t_sys_user SET password_hash = ? ... WHERE id = ?`
 * 变成 password_hash 拿到 tenantId、tenant_id 拿到 bcrypt 哈希 ⇒ WHERE 永不成立 ⇒ 0 行受影响。
 * （同类问题 R95-03 已在 injectSelectTenant 修过，写路径当时漏了。）
 *
 * 本文件用假的 mysql2 连接池记录真实下发的 (SQL, params)，并按 MySQL 的占位符顺序语义
 * 判断目标行是否会被命中——修复前本文件必须红（0 行），修复后必须绿（命中目标行）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ poolQuery: vi.fn() }));

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => ({ query: h.poolQuery, end: vi.fn(), getConnection: vi.fn() }),
  },
}));

import { env } from "../../config/env";
import { queryWithTenant } from "../../config/database";

const originalUseMockDb = env.USE_MOCK_DB;

/** 取最后一次真实下发给 mysql2 的 SQL 与参数 */
function lastCall() {
  const call = h.poolQuery.mock.calls.at(-1);
  if (!call) throw new Error("没有向数据库下发任何语句");
  return { sql: String(call[0]).replace(/\s+/g, " ").trim(), params: call[1] as unknown[] };
}

/**
 * 按 MySQL 语义（占位符在 SQL 文本中出现顺序）绑定参数，判断某一行是否会被 WHERE 命中。
 * 这是"0 行受影响"的直接判据。
 */
function matchesRow(sql: string, params: unknown[], row: Record<string, unknown>) {
  const placeholders = [...sql.matchAll(/\?/g)].map((m) => m.index as number);
  const whereStart = sql.toLowerCase().indexOf(" where ");
  expect(whereStart).toBeGreaterThan(-1);
  const whereSql = sql.slice(whereStart + 7);
  const conditions = [...whereSql.matchAll(/([a-z_]+)\s*=\s*\?/gi)];
  const placeholdersBeforeWhere = placeholders.filter((i) => i < whereStart).length;
  return conditions.every(
    (c, idx) => String(row[c[1]]) === String(params[placeholdersBeforeWhere + idx])
  );
}

describe("config/database.ts · queryWithTenant 写路径 tenant_id 注入（S3-65）", () => {
  beforeEach(() => {
    env.USE_MOCK_DB = false; // 走真实分支（不联网：连接池被替换）
    h.poolQuery.mockReset();
    h.poolQuery.mockResolvedValue([[{ affectedRows: 1, insertId: 0 }], []]);
  });

  afterEach(() => {
    env.USE_MOCK_DB = originalUseMockDb;
  });

  it("UPDATE（SET 含占位符）注入的 tenant_id 必须绑到租户值，不能把 SET 参数挤位", async () => {
    await queryWithTenant(
      "UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?",
      ["HASHED", 7],
      "t1"
    );

    const { sql, params } = lastCall();
    expect(sql).toContain("SET password_hash = ?");
    expect(sql).toContain("WHERE tenant_id = ? AND id = ?");
    expect(params).toEqual(["HASHED", "t1", 7]);

    // 决定性断言：目标行必须被命中（不命中 = 改密静默失效）
    expect(matchesRow(sql, params, { id: 7, tenant_id: "t1" })).toBe(true);
    // 且不得把 bcrypt 哈希当作租户值参与匹配（修复前的错误行为）
    expect(matchesRow(sql, params, { id: 7, tenant_id: "HASHED" })).toBe(false);
  });

  it("UPDATE（SET 无占位符）注入 tenant_id 仍保持前置绑定", async () => {
    await queryWithTenant("UPDATE t_todo SET status = 'DONE' WHERE id = ?", [9], "t2");

    const { sql, params } = lastCall();
    expect(sql).toContain("WHERE tenant_id = ? AND id = ?");
    expect(params).toEqual(["t2", 9]);
    expect(matchesRow(sql, params, { id: 9, tenant_id: "t2" })).toBe(true);
  });

  it("UPDATE（无 WHERE）追加 tenant_id 条件且参数在末尾", async () => {
    await queryWithTenant("UPDATE t_store_control_config SET updated_at = NOW()", [], "t3");

    const { sql, params } = lastCall();
    expect(sql).toBe("UPDATE t_store_control_config SET updated_at = NOW() WHERE tenant_id = ?");
    expect(params).toEqual(["t3"]);
  });

  it("DELETE 注入 tenant_id 后参数位置与占位符顺序一致", async () => {
    await queryWithTenant(
      "DELETE FROM t_sys_user_role WHERE user_id = ? AND role_id = ?",
      [11, 22],
      "t4"
    );

    const { sql, params } = lastCall();
    expect(sql).toContain("WHERE tenant_id = ? AND user_id = ? AND role_id = ?");
    expect(params).toEqual(["t4", 11, 22]);
    expect(matchesRow(sql, params, { user_id: 11, role_id: 22, tenant_id: "t4" })).toBe(true);
  });

  it("SQL 已自带 tenant_id 条件时不重复注入、参数原样下发", async () => {
    await queryWithTenant(
      "UPDATE t_sys_user SET password_hash = ? WHERE tenant_id = ? AND id = ?",
      ["H", "t1", 7],
      "t9"
    );

    const { sql, params } = lastCall();
    expect(sql).toBe("UPDATE t_sys_user SET password_hash = ? WHERE tenant_id = ? AND id = ?");
    expect(params).toEqual(["H", "t1", 7]);
    expect(matchesRow(sql, params, { id: 7, tenant_id: "t1" })).toBe(true);
  });
});
