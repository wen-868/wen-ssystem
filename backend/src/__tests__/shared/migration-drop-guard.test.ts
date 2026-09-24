/**
 * S3-106：外部迁移段"DROP TABLE 生产保护"由**文本包含判定**收窄为**首关键字判定**的守门单测
 *
 * 背景（来源：D1/S3-57 回传卡 §五 风险 8，执行方主动报备）：
 *   原实现是 `if (/DROP\s+TABLE/i.test(stmt)) continue;` —— 按**语句文本任意位置**匹配。
 *   D1 修复后过程定义（`CREATE PROCEDURE … BEGIN … END`）会作为**一条完整语句**下发，
 *   于是过程体内只要出现 `DROP TABLE` 字样（例如拼动态 SQL 的字符串），
 *   **整条过程定义就会被静默跳过**（无日志、无报错、过程永远建不成）——正是本项目吃过大亏的
 *   "静默跳过/静默失效"（踩坑[63] 的丢块、MIG 系列）。
 *
 * 本文件断言两件必须同时成立的事：
 *   (a) 真 `DROP TABLE …` 语句**仍被跳过**（含"前导整行注释 + DROP TABLE"的常见写法）——生产保护不回归；
 *   (b) **过程体内部含 `DROP TABLE` 字样时不再被跳过**——修复生效（整条过程定义照常下发）。
 *
 * harness 说明：复刻 `migration-write-gate.test.ts` / `migration-split.test.ts` 的进程内 harness
 * （mock fs / mysql2 / logger / env），用"假迁移文件"驱动真实的 `runMigrations()`，
 * 断言"哪些语句真的发给了数据库连接"。反红能力（回退成文本包含式 ⇒ (b) 必红）见证据包
 * `docs/evidence/S3-106/`（本沙箱跑不了 vitest：esbuild `spawn EPERM`，见踩坑[118]）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockQuery, mockEnd, mockCreateConnection } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const mockCreateConnection = vi.fn().mockResolvedValue({
    query: mockQuery,
    end: mockEnd,
  });
  return { mockQuery, mockEnd, mockCreateConnection };
});

vi.mock("mysql2/promise", () => ({
  default: {
    createConnection: mockCreateConnection,
  },
}));

vi.mock("../../shared/env", () => ({
  env: {
    USE_MOCK_DB: false,
    DB_HOST: "localhost",
    DB_PORT: 3306,
    DB_USER: "root",
    DB_PASSWORD: "test",
    DB_NAME: "test_db",
  },
}));

const { mockLoggerInfo, mockLoggerError, mockLoggerWarn, mockLoggerDebug } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
  },
}));

const { mockReadFileSync, mockReaddirSync, mockExistsSync, mockHashSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn().mockReturnValue("SELECT 1;"),
  mockReaddirSync: vi.fn().mockReturnValue([]),
  mockExistsSync: vi.fn().mockReturnValue(true),
  mockHashSync: vi.fn().mockReturnValue("$2b$10$mockedhashvalue"),
}));

vi.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
  existsSync: mockExistsSync,
}));

vi.mock("bcryptjs", () => ({
  default: { hashSync: mockHashSync },
  hashSync: mockHashSync,
}));

import { runMigrations, isDropTableStatement } from "../../shared/migration";

// ========== 假迁移文件（S3-106 交付物 2：真 DROP TABLE + 过程体内含 DROP TABLE 字样） ==========
const FAKE_MIGRATION_FILE = "001_drop_guard_fixture.sql";

/** 真 DROP TABLE（裸反引号表名）：必须仍被跳过 */
const REAL_DROP = "DROP TABLE IF EXISTS `t_drop_guard_real`";
/** 真 DROP TABLE（前导整行注释包裹，旧脚本常见写法）：必须仍被跳过 */
const COMMENTED_DROP = "-- 旧脚本里的写法：注释 + DROP TABLE\nDROP TABLE IF EXISTS `t_drop_guard_commented`";
/** 结构语句（对照组）：必须照常下发，证明本组断言不是"什么都没执行"的空转通过 */
const KEEP_TABLE = "CREATE TABLE IF NOT EXISTS `t_drop_guard_keep` (id INT)";

/**
 * 过程定义：整条语句下发（D1/S3-57 的能力），体内用**动态 SQL 字符串**拼 `DROP TABLE` 字样。
 * 这是"文本包含判定会误伤"的真实形态——过程要删的是临时表/残留表，与生产保护要挡的
 * "删业务表"完全是两回事，却被整条静默跳过。
 */
const ROUTINE_WITH_DYNAMIC_DROP = `CREATE PROCEDURE \`sync_drop_guard\`()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 't_drop_guard_stale') THEN
    SET @drop_guard_sql = 'DROP TABLE IF EXISTS t_drop_guard_stale';
    PREPARE drop_guard_stmt FROM @drop_guard_sql;
    EXECUTE drop_guard_stmt;
    DEALLOCATE PREPARE drop_guard_stmt;
  END IF;
END`;

/**
 * 夹具①（"真 DROP 语句"组，无过程体）：用于 (a) 断言生产保护未回归。
 * 刻意不含过程体，使 (a) 在"收窄前/后"两种实现下都应保持绿——只有 (b) 才是"该红就红"的对象。
 */
const FIXTURE_GUARD_ONLY_SQL = [
  "-- S3-106 夹具①（仅用于驱动外部迁移段，不代表任何真实迁移）",
  `${REAL_DROP};`,
  `${KEEP_TABLE};`,
  `${COMMENTED_DROP};`,
].join("\n");

/** 夹具②（"过程体"组，无真 DROP 语句）：用于 (b) 断言过程定义不再被静默跳过 */
const FIXTURE_ROUTINE_SQL = [
  "-- S3-106 夹具②（仅用于驱动外部迁移段，不代表任何真实迁移）",
  `${KEEP_TABLE};`,
  "DELIMITER $$",
  `${ROUTINE_WITH_DYNAMIC_DROP}$$`,
  "DELIMITER ;",
].join("\n");

/** 当前用例使用的夹具内容（每个用例开头显式指定，runner 的 readFileSync 桩按它返回） */
let currentFixtureSql = FIXTURE_ROUTINE_SQL;

/** 只保留与假迁移文件相关的下发语句（内置迁移步骤下发的其它语句不参与断言） */
function externalStatements(): string[] {
  return mockQuery.mock.calls
    .map((call: unknown[]) => call[0])
    .filter(
      (sql: unknown): sql is string =>
        typeof sql === "string" &&
        ["t_drop_guard_real", "t_drop_guard_commented", "t_drop_guard_keep", "sync_drop_guard"].some((m) =>
          sql.includes(m)
        )
    );
}

/** 取"DROP TABLE 生产保护"跳过日志的行文本 */
function dropGuardLogs(): string[] {
  return mockLoggerWarn.mock.calls
    .map((call: unknown[]) => call[0])
    .filter((m: unknown): m is string => typeof m === "string" && m.includes("跳过 DROP TABLE"));
}

/**
 * 夹具自证（消费层）：runMigrations 必须真的读过假迁移文件、假文件必须真的下发过语句。
 * 目的：让"夹具没被读 / 外部迁移段没跑"这种情况必红，而不是让下面的断言空转通过（踩坑[103]）。
 */
function assertFixtureWasConsumed(): void {
  const readPaths = mockReadFileSync.mock.calls.map((call: unknown[]) => String(call[0]));
  expect(
    readPaths.some((p) => p.endsWith(FAKE_MIGRATION_FILE)),
    `runMigrations 未以夹具路径调用 readFileSync（实际调用：${JSON.stringify(readPaths.slice(0, 5))}）`
  ).toBe(true);
  expect(externalStatements().length, "外部迁移段一条夹具语句都没下发").toBeGreaterThan(0);
}

describe("S3-106 DROP TABLE 保护 · 判定函数（纯函数）", () => {
  it("语句本身以 DROP TABLE 开头判真（含前导空白/注释、IF EXISTS、DELIMITER $$ 块）", () => {
    for (const sql of [
      "DROP TABLE `t_x`",
      "DROP TABLE IF EXISTS `t_x`",
      "  \n\tDROP   TABLE IF EXISTS `t_x`",
      "-- 行注释\n/* 块注释 */\nDROP TABLE IF EXISTS `t_x`",
      "DROP TABLE IF EXISTS t_x$$",
    ]) {
      expect(isDropTableStatement(sql), sql).toBe(true);
    }
  });

  it("过程体内含 DROP TABLE 字样判假（整条例程语句的首关键字是 CREATE）", () => {
    for (const sql of [
      ROUTINE_WITH_DYNAMIC_DROP,
      `${ROUTINE_WITH_DYNAMIC_DROP}$$`,
      "CREATE TABLE `t_x` (id INT COMMENT 'DROP TABLE 示例')",
      "CREATE TRIGGER `trg_x` AFTER INSERT ON `t_x` FOR EACH ROW DELETE FROM `t_log` WHERE id = 1 AND `memo` = 'DROP TABLE t_y'",
    ]) {
      expect(isDropTableStatement(sql), sql).toBe(false);
    }
  });

  it("非 DROP TABLE 的其它 DROP / 仅注释 / 空文本判假", () => {
    for (const sql of [
      "DROP PROCEDURE IF EXISTS add_column_if_not_exists",
      "DROP INDEX idx_x ON `t_x`",
      "-- 注释里提到 DROP TABLE IF EXISTS t_x",
      "SELECT 'DROP TABLE t_x'",
      "",
    ]) {
      expect(isDropTableStatement(sql), sql).toBe(false);
    }
  });
});

describe("S3-106 DROP TABLE 保护 · runMigrations 外部迁移段", () => {
  beforeEach(() => {
    currentFixtureSql = FIXTURE_ROUTINE_SQL;
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ affectedRows: 0 }]);
    mockEnd.mockReset();
    mockEnd.mockResolvedValue(undefined);
    mockCreateConnection.mockReset();
    mockCreateConnection.mockResolvedValue({ query: mockQuery, end: mockEnd });
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
    // 只对假迁移文件返回假 SQL：runMigrations 内部还有若干步骤会 readFileSync 后整文件下发，
    // 若无差别返回假文件，它会被那些步骤重复执行，断言就不再是"外部迁移段"的结果
    mockReadFileSync.mockImplementation((pathArg: unknown) =>
      String(pathArg).endsWith(FAKE_MIGRATION_FILE) ? currentFixtureSql : "SELECT 1;"
    );
    mockReaddirSync.mockReturnValue([FAKE_MIGRATION_FILE]);
    mockExistsSync.mockReturnValue(true);
    mockHashSync.mockReturnValue("$2b$10$mockedhashvalue");
    delete process.env.MIGRATION_WRITE_GATE;
  });

  afterEach(() => {
    delete process.env.MIGRATION_WRITE_GATE;
  });

  it("(a) 真 DROP TABLE 仍被跳过：两条 DROP 都不下发，各有一条保护日志", async () => {
    currentFixtureSql = FIXTURE_GUARD_ONLY_SQL;
    await runMigrations();
    assertFixtureWasConsumed();

    const stmts = externalStatements();
    // 对照组先行：结构语句照常下发（否则"DROP 未下发"可能只是外部迁移段没跑）
    expect(
      stmts.some((s) => s.includes("CREATE TABLE IF NOT EXISTS `t_drop_guard_keep`")),
      "对照组失败：结构语句未下发"
    ).toBe(true);
    // 生产保护：真 DROP TABLE（两种写法）一条都不下发
    expect(stmts.filter((s) => /^\s*DROP\s+TABLE/i.test(s))).toEqual([]);
    expect(stmts.some((s) => s.includes("t_drop_guard_real"))).toBe(false);
    expect(stmts.some((s) => s.includes("t_drop_guard_commented"))).toBe(false);
    // 每条被跳过的 DROP TABLE 都有日志（不得静默跳过）
    const logs = dropGuardLogs();
    expect(logs).toHaveLength(2);
    expect(logs.every((m) => m.includes(FAKE_MIGRATION_FILE))).toBe(true);
  });

  it("(b) 过程体内部含 DROP TABLE 字样时不再被跳过（整条过程定义照常下发）", async () => {
    await runMigrations();
    assertFixtureWasConsumed();

    const stmts = externalStatements();
    const routine = stmts.find((s) => s.includes("sync_drop_guard"));
    expect(
      routine,
      "过程定义必须整条下发：修复前（文本包含判定）它会被静默跳过，过程永远建不成"
    ).toBeDefined();
    // 过程体原样保留（含动态 SQL 字符串里的 DROP TABLE 字样），没有被静默丢弃
    expect(routine).toContain("CREATE PROCEDURE");
    expect(routine).toContain("DROP TABLE IF EXISTS t_drop_guard_stale");
    // 过程体没有被按 `;` 拆散（D1/S3-57 能力未回归）：整条过程只算一条下发语句
    expect(stmts.filter((s) => s.includes("t_drop_guard_stale"))).toHaveLength(1);
    // 过程定义不得被"DROP TABLE 生产保护"拦下（该夹具里没有任何真 DROP TABLE 语句 ⇒ 保护日志应为 0）
    expect(dropGuardLogs()).toHaveLength(0);
  });
});
