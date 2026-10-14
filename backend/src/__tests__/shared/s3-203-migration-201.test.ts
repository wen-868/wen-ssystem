/**
 * S3-203 门禁·迁移 `docs/migrations/201_账号口径统一.sql` 的可执行性与红线自检
 *
 * 防两件事：
 *   ① **踩坑[63] 复现**：迁移 runner 的 `splitSqlStatements()` 会剥掉语句块**开头的整行注释**，
 *      若一条语句的正文被注释"粘连"（注释后没有独立起头），整条会被静默丢弃 —— 迁移看着成功、实际没跑。
 *      本用例用**同一个 splitter** 断言：200 号迁移被切成 5 条语句（4 条 UPDATE + 1 条验证 SELECT），
 *      一条都不少，且每条首行都不是注释。
 *   ② **红线**：迁移文件里只能有 bcrypt 哈希，**不得出现任何明文口令**（含唯一对外那一个公开值）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitSqlStatements } from "../../shared/migration";

const migrationPath = join(__dirname, "../../../../docs/migrations/201_账号口径统一.sql");
const sql = readFileSync(migrationPath, "utf8");
const statements = splitSqlStatements(sql);

describe("S3-203 迁移 200：语句切分与红线自检", () => {
  it("① splitter 切出 5 条语句，且没有一条以注释开头（踩坑[63] 不复现）", () => {
    expect(statements).toHaveLength(5);
    for (const stmt of statements) {
      expect(stmt.trimStart().startsWith("--")).toBe(false);
    }
  });

  it("① 4 条 UPDATE 分别命中：租户 admin / 平台 admin / 门店两账号 / demo 停用", () => {
    const updates = statements.filter((s) => /^UPDATE\b/i.test(s));
    expect(updates).toHaveLength(4);
    expect(updates[0]).toContain("t_sys_user");
    expect(updates[0]).toContain("username = 'admin'");
    expect(updates[1]).toContain("t_platform_admin");
    expect(updates[2]).toContain("'store_manager'");
    expect(updates[2]).toContain("'store_operator'");
    expect(updates[3]).toContain("username = 'demo'");
    expect(updates[3]).toContain("status = 0");
  });

  it("① 幂等守卫：每条 UPDATE 的 WHERE 都带「值尚不等于目标值」条件（否则第二遍会因 updated_at 产生假变更）", () => {
    const updates = statements.filter((s) => /^UPDATE\b/i.test(s));
    for (const stmt of updates) {
      expect(stmt).toMatch(/password_hash\s*(<>|!=)/);
    }
  });

  it("① 末尾带验证 SQL（便于执行后人工核对）", () => {
    const last = statements[statements.length - 1];
    expect(last.startsWith("SELECT")).toBe(true);
    expect(last).toContain("t_sys_user");
    expect(last).toContain("t_platform_admin");
  });

  it("② 红线：文件内零明文口令 —— 只允许 v2$ 前缀的 bcrypt 哈希", () => {
    // 公开口令值也不许出现在迁移文件里（口径只在 constants.ts / .env.example）
    expect(sql).not.toContain("admin@2026");
    // 所有 password_hash 赋值都得是 v2$ 哈希
    const assignments = sql.match(/password_hash\s*=\s*(CASE username|'[^']*')/g) ?? [];
    expect(assignments.length).toBeGreaterThan(0);
    for (const m of sql.matchAll(/password_hash\s*=\s*'([^']*)'/g)) {
      expect(m[1].startsWith("v2$$2b$12$")).toBe(true);
    }
    expect(sql).toContain("THEN 'v2$$2b$12$");
  });
});
