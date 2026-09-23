/**
 * MIG-4：外部迁移写闸门（默认"挡"）单测
 *
 * 被测对象：`backend/src/shared/migration.ts` 的外部迁移段（第 8 步）+ 写闸门判定函数。
 * 需求（派工卡 MIG-4 交付物 1）：
 *   - 环境变量 `MIGRATION_WRITE_GATE` 取值 `block`（默认）/ `allow`；
 *   - `block` 时跳过"数据写语句（INSERT / UPDATE / DELETE / REPLACE）与 CALL"，逐条打日志；
 *   - `block` 不得跳过 CREATE TABLE / ALTER TABLE / CREATE INDEX / SELECT 等结构与非写语句；
 *   - 判定必须可靠（剥离前导空白/注释后取首关键字；`INSERT ... SELECT` 不得判成 SELECT）。
 *
 * harness 说明：本文件复刻 `migration.test.ts` 的进程内 harness（mock fs / mysql2 / logger / env），
 * 用"假迁移文件"驱动真实的 `runMigrations()`，断言"哪些语句真的发给了数据库连接"。
 * 同源断言在 `docs/evidence/MIG-4/tools/mig4-gate-verify.mjs` 里以同样口径复跑（本环境 vitest 起不来，
 * esbuild spawn EPERM，见 `docs/evidence/MIG-4/outputs/03-vitest-blocked.txt`）。
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
  mockReaddirSync: vi.fn().mockReturnValue(["001_test.sql"]),
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

import {
  runMigrations,
  resolveWriteGate,
  firstKeyword,
  isDataWriteStatement,
  statementTarget,
  DATA_WRITE_KEYWORDS,
} from "../../shared/migration";

// ========== 假迁移文件（MIG-4 交付物 2：含 INSERT / UPDATE / CALL / CREATE / ALTER 的构造用例） ==========
const FAKE_MIGRATION_FILE = "001_gate_fixture.sql";

/** 11 条语句：4 条结构/非写 + 7 条写语句或 CALL（含 INSERT ... SELECT 的易误判形状） */
const FIXTURE_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS `t_gate_demo` (id INT)",
  "INSERT INTO `t_gate_demo` (id) VALUES (1)",
  "/* 块注释在前：丢块缺陷修复后这类语句会进入执行路径 */ INSERT INTO `t_gate_demo` (id) VALUES (2)",
  "INSERT INTO `t_gate_demo` (id) SELECT id FROM `t_gate_demo`",
  "UPDATE `t_gate_demo` SET id = 5 WHERE id = 1",
  "DELETE FROM `t_gate_demo` WHERE id = 3",
  "REPLACE INTO `t_gate_demo` (id) VALUES (4)",
  "CALL `sync_gate_demo`()",
  "ALTER TABLE `t_gate_demo` ADD COLUMN name VARCHAR(50)",
  "CREATE INDEX idx_gate_demo ON `t_gate_demo` (id)",
  "SELECT COUNT(*) FROM `t_gate_demo`",
];

const FAKE_SQL = FIXTURE_STATEMENTS.join(";\n") + ";";

/** block 下应当照常执行的结构/非写语句（顺序即文件顺序） */
const EXPECTED_STRUCTURE = [
  FIXTURE_STATEMENTS[0],
  FIXTURE_STATEMENTS[8],
  FIXTURE_STATEMENTS[9],
  FIXTURE_STATEMENTS[10],
];

/** block 下应当被跳过、且必须各有一条日志的写语句 / CALL */
const EXPECTED_SKIPPED = [
  { index: 1, type: "INSERT", marker: "VALUES (1)", target: "t_gate_demo" },
  { index: 2, type: "INSERT", marker: "VALUES (2)", target: "t_gate_demo" },
  { index: 3, type: "INSERT", marker: "SELECT id FROM", target: "t_gate_demo" },
  { index: 4, type: "UPDATE", marker: "SET id = 5", target: "t_gate_demo" },
  { index: 5, type: "DELETE", marker: "WHERE id = 3", target: "t_gate_demo" },
  { index: 6, type: "REPLACE", marker: "VALUES (4)", target: "t_gate_demo" },
  { index: 7, type: "CALL", marker: "sync_gate_demo", target: "sync_gate_demo" },
];

/** 取"实际发给数据库连接的语句"（过滤掉内置迁移步骤的查询，只留本假文件相关的语句） */
function executedExternalStatements(): string[] {
  return mockQuery.mock.calls
    .map((call: unknown[]) => call[0])
    .filter(
      (sql: unknown): sql is string =>
        typeof sql === "string" && (sql.includes("t_gate_demo") || sql.includes("sync_gate_demo"))
    );
}

/** 取写闸门跳过日志的行文本 */
function gateSkipLogs(): string[] {
  return mockLoggerWarn.mock.calls
    .map((call: unknown[]) => call[0])
    .filter((m: unknown): m is string => typeof m === "string" && m.includes("写闸门 block 跳过"));
}

describe("MIG-4 写闸门 · 判定函数（纯函数）", () => {
  it("DATA_WRITE_KEYWORDS 覆盖 INSERT / UPDATE / DELETE / REPLACE / CALL", () => {
    expect([...DATA_WRITE_KEYWORDS]).toEqual(["INSERT", "UPDATE", "DELETE", "REPLACE", "CALL"]);
  });

  it("firstKeyword 能剥离前导空白与注释后取首关键字", () => {
    expect(firstKeyword("INSERT INTO x (id) VALUES (1)")).toBe("INSERT");
    expect(firstKeyword("   \n\tUPDATE x SET a = 1")).toBe("UPDATE");
    expect(firstKeyword("-- 行注释\nINSERT INTO x (id) VALUES (1)")).toBe("INSERT");
    expect(firstKeyword("# 井号注释\nDELETE FROM x WHERE id = 1")).toBe("DELETE");
    expect(firstKeyword("/* 块注释 */\nREPLACE INTO x (id) VALUES (1)")).toBe("REPLACE");
    expect(firstKeyword("\n\n-- 注释一\n-- 注释二\nCALL p()")).toBe("CALL");
    expect(firstKeyword("-- 只有注释，没有语句")).toBe("");
    expect(firstKeyword("/* 未闭合块注释")).toBe("");
  });

  it("isDataWriteStatement：写语句与 CALL 判真，结构/非写语句判假", () => {
    for (const sql of [
      "INSERT INTO `t_x` (id) VALUES (1)",
      "INSERT IGNORE INTO `t_x` (id) VALUES (1)",
      "UPDATE `t_x` SET id = 1",
      "DELETE FROM `t_x` WHERE id = 1",
      "REPLACE INTO `t_x` (id) VALUES (1)",
      "CALL `p_gate`()",
      "  /* 注释 */ insert into t_x (id) values (1)",
    ]) {
      expect(isDataWriteStatement(sql), sql).toBe(true);
    }
    for (const sql of [
      "CREATE TABLE IF NOT EXISTS `t_x` (id INT)",
      "ALTER TABLE `t_x` ADD COLUMN name VARCHAR(50)",
      "CREATE INDEX idx_x ON `t_x` (id)",
      "SELECT COUNT(*) FROM `t_x`",
      "-- 注释里提到 INSERT 但整块只有注释",
      "/* 注释 */ SELECT 1",
    ]) {
      expect(isDataWriteStatement(sql), sql).toBe(false);
    }
  });

  it("`INSERT ... SELECT` 不得被误判成 SELECT（首关键字口径）", () => {
    const insertSelect = "INSERT INTO `t_x` (id) SELECT id FROM `t_y`";
    expect(firstKeyword(insertSelect)).toBe("INSERT");
    expect(isDataWriteStatement(insertSelect)).toBe(true);
  });

  it("statementTarget 取表名 / 过程名（供日志核对），非写语句返回空串", () => {
    expect(statementTarget("INSERT INTO `t_x` (id) VALUES (1)")).toBe("t_x");
    expect(statementTarget("INSERT IGNORE INTO t_x (id) VALUES (1)")).toBe("t_x");
    expect(statementTarget("REPLACE INTO `t_x` (id) VALUES (1)")).toBe("t_x");
    expect(statementTarget("UPDATE `t_x` SET id = 1")).toBe("t_x");
    expect(statementTarget("DELETE FROM `t_x` WHERE id = 1")).toBe("t_x");
    expect(statementTarget("CALL `p_gate`()")).toBe("p_gate");
    expect(statementTarget("-- 注释\nINSERT INTO `t_x` (id) VALUES (1)")).toBe("t_x");
    expect(statementTarget("CREATE TABLE `t_x` (id INT)")).toBe("");
  });

  it("resolveWriteGate：默认（未设置）必须是 block，只有显式 allow 才放行", () => {
    // 验收标准 2：默认值必须是"挡"——不给参数即读 process.env.MIGRATION_WRITE_GATE
    const previous = process.env.MIGRATION_WRITE_GATE;
    try {
      delete process.env.MIGRATION_WRITE_GATE;
      expect(resolveWriteGate()).toBe("block");
      process.env.MIGRATION_WRITE_GATE = "allow";
      expect(resolveWriteGate()).toBe("allow");
      process.env.MIGRATION_WRITE_GATE = "";
      expect(resolveWriteGate()).toBe("block");
    } finally {
      if (previous === undefined) delete process.env.MIGRATION_WRITE_GATE;
      else process.env.MIGRATION_WRITE_GATE = previous;
    }
    const cases: Array<[string | undefined, "block" | "allow"]> = [
      ["", "block"],
      [" ", "block"],
      ["block", "block"],
      ["BLOCK", "block"],
      ["yes", "block"],
      ["1", "block"],
      ["allow", "allow"],
      ["ALLOW", "allow"],
      [" allow ", "allow"],
    ];
    for (const [raw, expected] of cases) {
      expect(resolveWriteGate(raw), String(raw)).toBe(expected);
    }
  });
});

describe("MIG-4 写闸门 · runMigrations 外部迁移段", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ affectedRows: 0 }]);
    mockEnd.mockReset();
    mockEnd.mockResolvedValue(undefined);
    mockCreateConnection.mockReset();
    mockCreateConnection.mockResolvedValue({
      query: mockQuery,
      end: mockEnd,
    });
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
    // 只对假迁移文件返回假 SQL：runMigrations 内部还有若干步骤会 readFileSync 后**整文件下发**，
    // 若无差别返回假迁移文件，假文件会被那些步骤重复执行，断言就不再是"外部迁移段"的结果
    mockReadFileSync.mockImplementation((pathArg: unknown) =>
      String(pathArg).endsWith(FAKE_MIGRATION_FILE) ? FAKE_SQL : "SELECT 1;"
    );
    mockReaddirSync.mockReturnValue([FAKE_MIGRATION_FILE]);
    mockExistsSync.mockReturnValue(true);
    mockHashSync.mockReturnValue("$2b$10$mockedhashvalue");
    // 默认挡：确保环境变量未设置
    delete process.env.MIGRATION_WRITE_GATE;
  });

  afterEach(() => {
    delete process.env.MIGRATION_WRITE_GATE;
  });

  it("默认挡：只有结构语句被执行，写语句与 CALL 一条都不执行", async () => {
    await runMigrations();

    expect(executedExternalStatements()).toEqual(EXPECTED_STRUCTURE);
    for (const { marker } of EXPECTED_SKIPPED) {
      expect(
        executedExternalStatements().some((sql) => sql.includes(marker)),
        `被跳过的语句不应执行：${marker}`
      ).toBe(false);
    }
  });

  it("默认挡：每条被跳过的语句都有一条含 文件 + 语句类型 + 目标表 的日志", async () => {
    await runMigrations();

    const logs = gateSkipLogs();
    expect(logs).toHaveLength(EXPECTED_SKIPPED.length);
    for (const { type, target } of EXPECTED_SKIPPED) {
      expect(
        logs.some(
          (m: string) =>
            m.includes(FAKE_MIGRATION_FILE) &&
            m.includes(`${type} 语句`) &&
            m.includes(`目标 ${target}`)
        ),
        `缺少 ${type}(${target}) 的写闸门日志`
      ).toBe(true);
    }
    // 日志必须给出放行方式，避免运维"不知道为什么被跳过"
    expect(logs.every((m: string) => m.includes("MIGRATION_WRITE_GATE=allow"))).toBe(true);
  });

  it("默认挡：info 日志声明本次运行生效的闸门取值", async () => {
    await runMigrations();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining("外部迁移写闸门=block（默认）")
    );
  });

  it("默认挡：非法取值（MIGRATION_WRITE_GATE=yes）按 fail-safe 处理为 block", async () => {
    process.env.MIGRATION_WRITE_GATE = "yes";

    await runMigrations();

    expect(executedExternalStatements()).toEqual(EXPECTED_STRUCTURE);
    expect(gateSkipLogs()).toHaveLength(EXPECTED_SKIPPED.length);
  });

  it("显式放行（MIGRATION_WRITE_GATE=allow）：同一组语句全部执行，且不再有跳过日志", async () => {
    process.env.MIGRATION_WRITE_GATE = "allow";

    await runMigrations();

    expect(executedExternalStatements()).toEqual(FIXTURE_STATEMENTS);
    expect(gateSkipLogs()).toHaveLength(0);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining("外部迁移写闸门=allow（显式配置）")
    );
  });
});
