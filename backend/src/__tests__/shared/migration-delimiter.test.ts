/**
 * S3-57：迁移 runner 感知 `DELIMITER` / `BEGIN…END`（过程体不再被 `;` 拆散）守门单测
 *
 * 缺陷（派单卡背景，可复跑）：
 *   ① 两个调用点把 `DELIMITER ` 行整行删掉，`splitSqlStatements` 只会按 `;` 切块
 *      ⇒ `DELIMITER $$ … CREATE PROCEDURE … BEGIN … ; … END$$` 的**过程体被拆成残片**，
 *      残片当独立语句下发（`safeExec` 只记日志不抛错）⇒ 过程从未建成（MIG-1 演练 29 条
 *      `ER_SP_DOES_NOT_EXIST` 即 `CALL` 依赖的过程不存在）；
 *   ② 调用点 `if (stmt.includes("CREATE PROCEDURE") || stmt.includes("DROP PROCEDURE")) continue;`
 *      ⇒ `092_租户ID.sql:282-283` 两条 `DROP PROCEDURE IF EXISTS` **从未执行**，辅助过程残留生产库。
 *
 * 本文件三层断言：
 *   A. `splitSqlStatements` 纯函数：DELIMITER 切换 + BEGIN…END 块边界 + 既有口径不回归；
 *   B. 真实 `092_租户ID.sql` 驱动 `runMigrations()`（假连接捕获**实际下发的语句序列**）：
 *      两个 `CREATE PROCEDURE` 块各作为**一条**完整语句下发；末尾两条 `DROP PROCEDURE` 被下发；
 *   C. 同批未放宽红线：默认 block 写闸门下 092 的 `CALL` 一条都不下发（MIG-4 不回归）。
 *
 * 夹具读取说明：本文件 `vi.mock("fs")` 之后，顶层 `import ... from "node:fs"` 会被 mock 命中
 * （vitest 4 的 `normalizeModuleId` 剥掉 `node:` 前缀），故真实文件走 `createRequire` 原生 require 读取
 * ——与 `migration-split.test.ts`（MIG-5b）同一口径。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

/** 真实 fs（绕开本文件的 `vi.mock("fs")`） */
const realFs = createRequire(resolve(process.cwd(), "__vitest-real-fs__.js"))(
  "node:fs"
) as typeof import("node:fs");

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

import { runMigrations, splitSqlStatements } from "../../shared/migration";

const REAL_MIGRATION_FILE = "092_租户ID.sql";

/** 真实文件路径（vitest 的 cwd 可能是 backend/ 或仓库根，逐候选探测；找不到即显式失败） */
function resolveRealMigrationPath(): string {
  const candidates = [
    resolve(process.cwd(), "docs/migrations", REAL_MIGRATION_FILE),
    resolve(process.cwd(), "../docs/migrations", REAL_MIGRATION_FILE),
    resolve(process.cwd(), "../../docs/migrations", REAL_MIGRATION_FILE),
  ];
  const found = candidates.find((p) => realFs.existsSync(p));
  if (!found) throw new Error(`找不到真实迁移文件：${REAL_MIGRATION_FILE}（探测：${candidates.join(" | ")}）`);
  return found;
}

/** 092 的真实内容（走真实 fs，不经 mock 注册表） */
const REAL_092 = realFs.readFileSync(resolveRealMigrationPath(), "utf8");

/** 复刻 migration.ts 第8步 / 5.5.8 步的预处理：只移除 USE 行（S3-57 起 DELIMITER 行必须保留） */
function cleanAndSplit(sql: string): string[] {
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  return splitSqlStatements(cleaned);
}

/** 夹具自证（内容层）：读到的必须是真实 092，否则下面全是空转（踩坑[103]） */
function assertReal092Fixture(): void {
  expect(REAL_092.length, `092 内容长度异常（疑似读到 fs mock 默认值）：${REAL_092.slice(0, 40)}`).toBeGreaterThan(5000);
  expect(REAL_092).toContain("USE liquor_inventory;");
  expect(REAL_092).toContain("DELIMITER $$");
  expect(REAL_092).toContain("CREATE PROCEDURE add_column_if_not_exists");
  expect(REAL_092).toContain("CREATE PROCEDURE add_index_if_not_exists");
}

/** 夹具自证（消费层）：runner 必须真的读过 092，避免"没读文件"时空转通过 */
function assert092WasConsumed(): void {
  const readPaths = mockReadFileSync.mock.calls.map((call: unknown[]) => String(call[0]));
  expect(
    readPaths.some((p) => p.endsWith(REAL_MIGRATION_FILE)),
    `runMigrations 未以 092 路径调用 readFileSync（实际调用：${JSON.stringify(readPaths.slice(0, 5))}）`
  ).toBe(true);
}

/** 假连接捕获到的"实际下发语句序列" */
function dispatchedStatements(): string[] {
  return mockQuery.mock.calls
    .map((call: unknown[]) => call[0])
    .filter((sql: unknown): sql is string => typeof sql === "string");
}

/** 取写闸门跳过日志的行文本 */
function gateSkipLogs(): string[] {
  return mockLoggerWarn.mock.calls
    .map((call: unknown[]) => call[0])
    .filter((m: unknown): m is string => typeof m === "string" && m.includes("写闸门 block 跳过"));
}

// ========== A. 纯函数：DELIMITER 语义 ==========
describe("splitSqlStatements：DELIMITER 语义（S3-57①）", () => {
  it("DELIMITER $$ 之间的过程体作为一条完整语句（体内的 ; 不切分）", () => {
    const sql = [
      "DELIMITER $$",
      "CREATE PROCEDURE p_demo()",
      "BEGIN",
      "  SELECT 1;",
      "  SELECT 2;",
      "END$$",
      "DELIMITER ;",
    ].join("\n");
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("CREATE PROCEDURE p_demo()");
    expect(result[0]).toContain("SELECT 1;");
    expect(result[0]).toContain("SELECT 2;");
    expect(result[0].trim().endsWith("END")).toBe(true);
  });

  it("DELIMITER 切回 ; 之后的语句按 ; 正常切分，且指令行本身不下发", () => {
    const sql = [
      "DELIMITER $$",
      "CREATE PROCEDURE p_demo() BEGIN SELECT 1; END$$",
      "DELIMITER ;",
      "CREATE TABLE t_demo (id INT);",
      "SELECT 2;",
    ].join("\n");
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(3);
    expect(result.some((s) => s.includes("CREATE TABLE t_demo"))).toBe(true);
    expect(result.some((s) => s.trim() === "SELECT 2")).toBe(true);
    expect(result.some((s) => s.toUpperCase().includes("DELIMITER"))).toBe(false);
  });

  it("自定义分隔符可以是 // 等多字符符号", () => {
    const sql = "DELIMITER //\nCREATE TRIGGER trg_demo BEFORE INSERT ON t_demo FOR EACH ROW BEGIN SET @a = 1; END//\nDELIMITER ;\nSELECT 3;";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("CREATE TRIGGER trg_demo");
    expect(result[0].trim().endsWith("END")).toBe(true);
    expect(result[1].trim()).toBe("SELECT 3");
  });
});

// ========== A2. 纯函数：BEGIN…END 块边界（默认分隔符，无 DELIMITER 行） ==========
describe("splitSqlStatements：BEGIN…END 块边界（S3-57②）", () => {
  it("默认分隔符下，CREATE PROCEDURE … BEGIN … ; … END; 整块为一条语句", () => {
    const sql = [
      "CREATE PROCEDURE p_demo()",
      "BEGIN",
      "  DECLARE n INT DEFAULT 0;",
      "  SELECT COUNT(*) INTO n FROM information_schema.COLUMNS;",
      "  IF n = 0 THEN",
      "    SET @sql = 'SELECT 1;';",
      "  END IF;",
      "END;",
      "SELECT 9;",
    ].join("\n");
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("DECLARE n INT DEFAULT 0;");
    expect(result[0]).toContain("END IF;");
    expect(result[0].trim().endsWith("END")).toBe(true);
    expect(result[1].trim()).toBe("SELECT 9");
  });

  it("非例程语句不受影响：CREATE TABLE 里的 ; 仍按语句边界切分", () => {
    const sql = "CREATE TABLE t_demo (id INT);\nSELECT 1;\nDROP PROCEDURE IF EXISTS p_demo;";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(3);
    expect(result[2].trim()).toBe("DROP PROCEDURE IF EXISTS p_demo");
  });
});

// ========== A3. 既有口径不回归（字符串 / 注释 / 注释块首） ==========
describe("splitSqlStatements：既有口径不回归", () => {
  it("字符串字面量里的 ; 不再被当语句边界", () => {
    const sql = "INSERT INTO t_demo (a) VALUES ('x;y');\nSELECT 2;";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("'x;y'");
  });

  it("行注释 / 块注释里的 ; 不再被当语句边界", () => {
    const sql = "-- 说明; 分号\nSELECT 1; /* 块注释; 分号 */\nSELECT 2;";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(2);
    // 块首的整行注释按既有口径剥离（MIG-5），故第一条只剩语句本身
    expect(result[0]).toBe("SELECT 1");
    // 第二条里的块注释（含注释内的 ;）原样保留，且没有多切出一条垃圾语句
    expect(result[1]).toContain("/* 块注释; 分号 */");
    expect(result[1]).toContain("SELECT 2");
  });

  it("注释开头的块仍保留其后的真实语句（MIG-5 / 踩坑[63] 不回归）", () => {
    const sql = "-- 编号: 006 说明\nSET FOREIGN_KEY_CHECKS = 0;";
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("SET FOREIGN_KEY_CHECKS = 0");
  });
});

// ========== B. 真实 092 驱动 runMigrations（假连接捕获下发序列） ==========
describe("092_租户ID.sql 反测：过程体完整成块 + DROP 不再被跳过", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ affectedRows: 0 }]);
    mockEnd.mockReset();
    mockEnd.mockResolvedValue(undefined);
    mockCreateConnection.mockReset();
    mockCreateConnection.mockResolvedValue({ query: mockQuery, end: mockEnd });
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
    // 只对 092 返回真实内容：其余路径返回哑语句，避免内置步骤把 092 重复执行
    mockReadFileSync.mockImplementation((pathArg: unknown) =>
      String(pathArg).endsWith(REAL_MIGRATION_FILE) ? REAL_092 : "SELECT 1;"
    );
    mockReaddirSync.mockReturnValue([REAL_MIGRATION_FILE]);
    mockExistsSync.mockReturnValue(true);
    mockHashSync.mockReturnValue("$2b$10$mockedhashvalue");
    delete process.env.MIGRATION_WRITE_GATE;
  });

  it("真实 092 文本：按调用点口径清理（只去 USE 行）后，两个过程体各为一条完整语句", () => {
    assertReal092Fixture();
    const statements = cleanAndSplit(REAL_092);
    const procedures = statements.filter((s) => s.includes("CREATE PROCEDURE"));
    expect(procedures).toHaveLength(2);
    for (const stmt of procedures) {
      expect(stmt).toContain("DEALLOCATE PREPARE stmt;");
      expect(stmt.trim().endsWith("END")).toBe(true);
    }
    // DELIMITER 指令行本身不得进入下发语句
    expect(statements.some((s) => s.toUpperCase().includes("DELIMITER"))).toBe(false);
  });

  it("两个 CREATE PROCEDURE 块各作为一条完整语句下发（不被 ; 拆散）", async () => {
    assertReal092Fixture();
    await runMigrations();
    const queries = dispatchedStatements();
    assert092WasConsumed();

    const createProc = queries.filter((s) => s.includes("CREATE PROCEDURE"));
    expect(createProc, `CREATE PROCEDURE 下发条数应为 2，实际 ${createProc.length}`).toHaveLength(2);

    const addColumn = createProc.find((s) => s.includes("CREATE PROCEDURE add_column_if_not_exists"));
    const addIndex = createProc.find((s) => s.includes("CREATE PROCEDURE add_index_if_not_exists"));
    expect(addColumn, "未下发 add_column_if_not_exists 的完整 CREATE PROCEDURE").toBeDefined();
    expect(addIndex, "未下发 add_index_if_not_exists 的完整 CREATE PROCEDURE").toBeDefined();

    // 过程体必须完整（含体内 DECLARE / IF / PREPARE / DEALLOCATE），而不是被 ; 切成残片
    for (const [stmt, variable] of [
      [addColumn as string, "col_count"],
      [addIndex as string, "idx_count"],
    ]) {
      expect(stmt).toContain(`DECLARE ${variable} INT DEFAULT 0;`);
      expect(stmt).toContain("IF ");
      expect(stmt).toContain("DEALLOCATE PREPARE stmt;");
      expect(stmt.trim().endsWith("END")).toBe(true);
    }

    // 旧缺陷的残片一条都不允许出现（被拆散时这些片段会各自成为一条下发语句）
    const fragments = new Set(["END IF", "DEALLOCATE PREPARE stmt", "SET @sql = CONCAT('ALTER TABLE `', tbl_name, '` ADD COLUMN `', col_name, '` ', col_def)", "BEGIN"]);
    const leaked = queries.map((s) => s.trim()).filter((s) => fragments.has(s));
    expect(leaked, `过程体残片被当独立语句下发：${JSON.stringify(leaked)}`).toEqual([]);
  });

  it("文件末尾两条 DROP PROCEDURE 被下发（不再被 :1068 的 continue 跳过）", async () => {
    assertReal092Fixture();
    await runMigrations();
    const queries = dispatchedStatements();
    assert092WasConsumed();

    const drops = queries.filter((s) => /^DROP PROCEDURE IF EXISTS/i.test(s.trim()));
    expect(drops, `DROP PROCEDURE 下发条数应为 4，实际 ${drops.length}`).toHaveLength(4);
    // 每条辅助过程各被 DROP 两次：开头（建之前清理）+ 文件末尾（第 282-283 行，此前被整块跳过）
    for (const name of ["add_column_if_not_exists", "add_index_if_not_exists"]) {
      const matched = drops.filter((s) => s.includes(name));
      expect(matched, `${name} 的 DROP PROCEDURE 应为 2 条（开头 + 末尾），实际 ${matched.length}`).toHaveLength(2);
    }
    // 旧行为日志（"跳过存储过程语句"）不得再出现
    const legacySkipLogs = mockLoggerInfo.mock.calls
      .map((call: unknown[]) => call[0])
      .filter((m: unknown): m is string => typeof m === "string" && m.includes("跳过存储过程语句"));
    expect(legacySkipLogs, `仍有"跳过存储过程语句"日志：${JSON.stringify(legacySkipLogs.slice(0, 3))}`).toEqual([]);
  });

  it("红线未放宽：默认 block 写闸门下 092 的 CALL 一条都不下发", async () => {
    assertReal092Fixture();
    await runMigrations();
    const queries = dispatchedStatements();
    assert092WasConsumed();

    expect(queries.filter((s) => /^\s*CALL\b/i.test(s))).toEqual([]);
    // 092 的 CALL 全部被闸门挡下并逐条留日志（数量与文件里的 CALL 条数一致）
    const callSkips = gateSkipLogs().filter((m) => m.includes("CALL 语句"));
    const callCountInFile = (REAL_092.match(/^\s*CALL\s/gim) ?? []).length;
    expect(callSkips).toHaveLength(callCountInFile);
    expect(callSkips[0]).toContain("CALL 语句");
  });
});
