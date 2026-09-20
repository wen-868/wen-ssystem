/**
 * S3-65 改密接口"假成功"端到端回归（本机无真库：mysql2 连接池替换为内存假库）
 *
 * 被测链路：services/admin/auth.service.ts changePassword / login
 *           + config/database.ts queryWithTenant（真实分支：含 tenant_id 注入与参数绑定）
 *           + shared/password.ts（**真实 bcrypt**，不 mock，保证"新旧口令"断言是真比对）
 *
 * 生产实测（凌舟 2026-09-19）：改密接口 3/3 返回 code 0「密码修改成功」，
 * 但新口令登录 400、旧口令登录 200、库内 password_hash 未变。
 *
 * 本文件覆盖三条硬断言：
 *   ① 改密后新口令可登录（拿令牌）+ 旧口令登录失败 —— 双向；
 *   ② 跨租户上下文（token 租户 ≠ 目标行租户）必须报错，不得静默成功；
 *   ③ UPDATE 命中 0 行（用户不存在/租户不匹配/记录被删）必须报错，不得返回"修改成功"。
 *
 * 何时红（修复前必须红）：参数绑定被挤位时 ①③ 均失败——改密"成功"但库内哈希没变、
 * 0 行也照样返回成功。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  store_id: number | null;
  status: number;
  tenant_id: string;
  login_fail_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  default_homepage: string | null;
  mfa_enabled: number;
  updated_at: string | null;
}

const h = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  users: [] as any[],
  /** 人为制造"UPDATE 命中 0 行"：SELECT 命中但 UPDATE 未命中（并发删除/租户上下文错位） */
  forceZeroUpdateRows: false,
}));

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => ({ query: h.poolQuery, end: vi.fn(), getConnection: vi.fn() }),
  },
}));

import { env } from "../../../config/env";
import { hashPassword, verifyPassword } from "../../../shared/password";
import { changePassword, login } from "../../../services/admin/auth.service";

const originalUseMockDb = env.USE_MOCK_DB;

const OLD_PASSWORD = "OldPass@123";
const NEW_PASSWORD = "NewPass@456";

// ==================== 内存假库（只实现被测链路用到的语句） ====================

let paramCursor = 0;
let currentParams: unknown[] = [];

function nextParam(): unknown {
  const value = currentParams[paramCursor];
  paramCursor += 1;
  return value;
}

/** 解析 WHERE 条件（按 SQL 文本顺序消费占位符） */
function buildWherePredicates(whereSql: string): Array<(row: any) => boolean> {
  return whereSql
    .split(/\s+AND\s+/i)
    .map((cond) => cond.trim())
    .filter(Boolean)
    .map((cond) => {
      let m = cond.match(/^([\w.]+)\s*=\s*\?$/i);
      if (m) {
        const col = m[1];
        const value = nextParam();
        return (row: any) => String(row[col]) === String(value);
      }
      m = cond.match(/^([\w.]+)\s*=\s*'([^']*)'$/i);
      if (m) return (row: any) => String(row[m![1]]) === m![2];
      m = cond.match(/^([\w.]+)\s*=\s*(\d+)$/i);
      if (m) return (row: any) => Number(row[m![1]]) === Number(m![2]);
      m = cond.match(/^([\w.]+)\s+IS\s+NULL$/i);
      if (m) return (row: any) => row[m![1]] == null;
      throw new Error(`[假库] 未支持的 WHERE 条件: ${cond}`);
    });
}

/**
 * 解析 SET 赋值。按 MySQL 语义，SET 子句里的占位符排在 WHERE 之前，
 * 因此必须**在解析阶段按 SQL 文本顺序消费参数**，不能等应用到行时再取
 * （否则 WHERE 会先拿到 SET 的参数，造成"假 0 行"）。
 */
function parseAssignments(setSql: string): Array<{ col: string; value: unknown }> {
  return setSql
    .split(/,(?![^()]*\))/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      let m = a.match(/^([\w.]+)\s*=\s*\?$/i);
      if (m) return { col: m[1], value: nextParam() };
      m = a.match(/^([\w.]+)\s*=\s*NOW\(\)$/i);
      if (m) return { col: m[1], value: new Date().toISOString() };
      m = a.match(/^([\w.]+)\s*=\s*NULL$/i);
      if (m) return { col: m[1], value: null };
      m = a.match(/^([\w.]+)\s*=\s*'([^']*)'$/i);
      if (m) return { col: m[1], value: m[2] };
      m = a.match(/^([\w.]+)\s*=\s*(-?[\d.]+)$/i);
      if (m) return { col: m[1], value: Number(m[2]) };
      throw new Error(`[假库] 未支持的 SET 片段: ${a}`);
    });
}

async function fakeQuery(sqlRaw: string, params: unknown[] = []) {
  const sql = String(sqlRaw).replace(/\s+/g, " ").trim();
  const lower = sql.toLowerCase();

  // 本假库只实现 t_sys_user；角色/权限表等一律返回空集（登录链路不依赖角色即可签发令牌）
  if (!/\bt_sys_user\b/.test(lower)) return [[], []] as [unknown[], unknown[]];

  paramCursor = 0;
  currentParams = params;

  if (lower.startsWith("select")) {
    const selectMatch = sql.match(/^select\s+([\s\S]+?)\s+from\s+t_sys_user\b([\s\S]*)$/i)!;
    const columns = selectMatch[1].split(",").map((c) => c.trim());
    const rest = selectMatch[2];
    const whereMatch = rest.match(/\bwhere\s+([\s\S]*?)(?:\s+(?:ORDER BY|LIMIT)\b[\s\S]*)?$/i);
    const predicates = whereMatch ? buildWherePredicates(whereMatch[1]) : [];
    const limitMatch = rest.match(/\blimit\s+(\d+)/i);
    let rows = h.users.filter((u) => predicates.every((p) => p(u)));
    if (limitMatch) rows = rows.slice(0, Number(limitMatch[1]));
    const projected = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const col of columns) {
        const m = col.match(/^([\w.]+)(?:\s+AS\s+(\w+))?$/i);
        if (m) out[m[2] || m[1]] = row[m[1]];
      }
      return out;
    });
    return [projected, []] as [unknown[], unknown[]];
  }

  if (lower.startsWith("update")) {
    const setMatch = sql.match(/^update\s+t_sys_user\s+set\s+([\s\S]*?)\s+where\s+/i)!;
    const assignments = parseAssignments(setMatch[1]); // 先消费 SET 占位符（SQL 文本顺序在 WHERE 之前）
    const whereSql = sql.slice(lower.indexOf(" where ") + 7);
    const predicates = buildWherePredicates(whereSql); // 再消费 WHERE 占位符
    const targets = h.forceZeroUpdateRows ? [] : h.users.filter((u) => predicates.every((p) => p(u)));
    targets.forEach((row) => assignments.forEach(({ col, value }) => (row[col] = value)));
    return [[{ affectedRows: targets.length, insertId: 0 }], []] as [unknown[], unknown[]];
  }

  return [[], []] as [unknown[], unknown[]];
}

async function seedUsers() {
  h.users = [
    {
      id: 7,
      username: "admin",
      password_hash: await hashPassword(OLD_PASSWORD),
      real_name: "管理员",
      store_id: null,
      status: 1,
      tenant_id: "default",
      login_fail_count: 0,
      locked_until: null,
      last_login_at: null,
      default_homepage: null,
      mfa_enabled: 0,
      updated_at: null,
    },
    {
      id: 8,
      username: "other-tenant-admin",
      password_hash: await hashPassword(OLD_PASSWORD),
      real_name: "他租户管理员",
      store_id: null,
      status: 1,
      tenant_id: "t2",
      login_fail_count: 0,
      locked_until: null,
      last_login_at: null,
      default_homepage: null,
      mfa_enabled: 0,
      updated_at: null,
    },
  ] as UserRow[];
}

describe("services/admin/auth.service · changePassword（S3-65 假成功回归）", () => {
  beforeEach(async () => {
    env.USE_MOCK_DB = false; // 走真实分支（连接池被替换为内存假库，不联网）
    h.forceZeroUpdateRows = false;
    h.poolQuery.mockReset();
    h.poolQuery.mockImplementation(fakeQuery);
    await seedUsers();
  });

  afterEach(() => {
    env.USE_MOCK_DB = originalUseMockDb;
  });

  it("改密后：新口令可登录拿到令牌 + 旧口令登录失败（双向断言）", async () => {
    const user = h.users.find((u) => u.id === 7)!;
    const hashBefore = user.password_hash;

    const result = await changePassword(7, OLD_PASSWORD, NEW_PASSWORD, "default");
    expect(result.message).toBe("密码修改成功");

    // 库内哈希必须真的变了（生产实测此处没变 = 假成功）
    expect(user.password_hash).not.toBe(hashBefore);
    expect(await verifyPassword(NEW_PASSWORD, user.password_hash)).toBe(true);
    expect(await verifyPassword(OLD_PASSWORD, user.password_hash)).toBe(false);

    // 闭环：新口令登录成功（未启用 MFA 时返回 { token, user }）
    const ok = (await login("admin", NEW_PASSWORD)) as { token: string; user: { username: string } };
    expect(ok.token).toBeTruthy();
    expect(ok.user.username).toBe("admin");

    // 闭环：旧口令登录失败
    await expect(login("admin", OLD_PASSWORD)).rejects.toThrow("账号或密码错误");
  });

  it("跨租户上下文（token 租户 ≠ 目标行租户）必须报错，且库内哈希不变", async () => {
    const user = h.users.find((u) => u.id === 7)!;
    const hashBefore = user.password_hash;

    await expect(changePassword(7, OLD_PASSWORD, NEW_PASSWORD, "t2")).rejects.toThrow(
      /用户不存在|租户不匹配/
    );

    expect(user.password_hash).toBe(hashBefore);
    expect(await verifyPassword(OLD_PASSWORD, user.password_hash)).toBe(true);
    expect(await verifyPassword(NEW_PASSWORD, user.password_hash)).toBe(false);
  });

  it("UPDATE 命中 0 行时必须报错，不得返回「密码修改成功」", async () => {
    const user = h.users.find((u) => u.id === 7)!;
    const hashBefore = user.password_hash;
    h.forceZeroUpdateRows = true;

    await expect(changePassword(7, OLD_PASSWORD, NEW_PASSWORD, "default")).rejects.toThrow(
      /未更新任何记录/
    );

    expect(user.password_hash).toBe(hashBefore);
  });
});
