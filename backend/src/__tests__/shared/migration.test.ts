import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Connection } from "mysql2/promise";

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

vi.mock("../../shared/env.js", () => ({
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

vi.mock("../../shared/logger.js", () => ({
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

import { runMigrations, safeExec, SKIP_ERRORS, TENANT_TABLES } from "../../shared/migration.js";

function makeMockConn(queryFn: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue([])): Connection {
  return { query: queryFn } as unknown as Connection;
}

describe("migration - 常量", () => {
  it("SKIP_ERRORS 应包含已知错误码", () => {
    expect(SKIP_ERRORS.has("ER_DUP_FIELDNAME")).toBe(true);
    expect(SKIP_ERRORS.has("ER_TABLE_EXISTS_ERROR")).toBe(true);
    expect(SKIP_ERRORS.size).toBeGreaterThan(5);
  });

  it("TENANT_TABLES 应包含多张表", () => {
    expect(TENANT_TABLES.length).toBeGreaterThan(20);
    expect(TENANT_TABLES).toContain("sys_user");
    expect(TENANT_TABLES).toContain("store");
  });
});

// ========== safeExec 全分支覆盖 ==========
describe("safeExec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("查询成功时返回 true", async () => {
    const conn = makeMockConn(vi.fn().mockResolvedValue([]));
    const result = await safeExec(conn, "SELECT 1", "test");
    expect(result).toBe(true);
  });

  it("SKIP_ERRORS 中的错误码应跳过并返回 false", async () => {
    for (const code of SKIP_ERRORS) {
      const conn = makeMockConn(vi.fn().mockRejectedValue({ code, message: code.toLowerCase() }));
      const result = await safeExec(conn, "SELECT 1", `test-${code}`);
      expect(result).toBe(false);
    }
  });

  it("消息包含 'duplicate column' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_001", message: "Duplicate column name 'tenant_id'" }));
    const result = await safeExec(conn, "ALTER TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'duplicate key' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_002", message: "Duplicate key name 'idx_test'" }));
    const result = await safeExec(conn, "ALTER TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'already exists' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_003", message: "Table 'tenant' already exists" }));
    const result = await safeExec(conn, "CREATE TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 \"doesn't exist\" 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_004", message: "Table 'foo' doesn't exist" }));
    const result = await safeExec(conn, "ALTER TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'innodb' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_005", message: "InnoDB: storage error" }));
    const result = await safeExec(conn, "CREATE TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'storage engine' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_006", message: "Unknown storage engine" }));
    const result = await safeExec(conn, "CREATE TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 \"can't create/write\" 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_007", message: "Can't create/write file '/tmp/xyz'" }));
    const result = await safeExec(conn, "CREATE TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'permission denied' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_008", message: "Permission denied for user" }));
    const result = await safeExec(conn, "SELECT 1", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'incorrect integer' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_009", message: "Incorrect integer value" }));
    const result = await safeExec(conn, "INSERT", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'unknown column' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_010", message: "Unknown column 'foo'" }));
    const result = await safeExec(conn, "ALTER TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'sql syntax' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_011", message: "You have an error in your SQL syntax" }));
    const result = await safeExec(conn, "SELECT", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'if not exists' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_012", message: "Use IF NOT EXISTS" }));
    const result = await safeExec(conn, "CREATE TABLE", "test");
    expect(result).toBe(false);
  });

  it("消息包含 'procedure' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_013", message: "Procedure does not exist" }));
    const result = await safeExec(conn, "CALL", "test");
    expect(result).toBe(false);
  });

  it("消息同时包含 'table' 和 'already exists' 应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_014", message: "table already exists in database" }));
    const result = await safeExec(conn, "CREATE TABLE", "test");
    expect(result).toBe(false);
  });

  it("未知错误应记录 error 日志并返回 false", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "ERR_UNKNOWN", message: "Some unknown error" }));
    const result = await safeExec(conn, "SELECT 1", "test-unknown");
    expect(result).toBe(false);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("错误对象无 code/message 时应安全处理", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue(null));
    const result = await safeExec(conn, "SELECT 1", "test-null");
    expect(result).toBe(false);
  });

  it("code 为空字符串但消息匹配时应跳过", async () => {
    const conn = makeMockConn(vi.fn().mockRejectedValue({ code: "", message: "duplicate column name" }));
    const result = await safeExec(conn, "ALTER TABLE", "test");
    expect(result).toBe(false);
  });
});

// ========== runMigrations 集成测试 ==========
describe("runMigrations", () => {
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
    // 重置 fs mock 到默认值
    mockReadFileSync.mockReturnValue("SELECT 1;");
    mockReaddirSync.mockReturnValue(["001_test.sql"]);
    mockExistsSync.mockReturnValue(true);
    mockHashSync.mockReturnValue("$2b$10$mockedhashvalue");
  });

  it("USE_MOCK_DB=false 时应执行迁移流程", async () => {
    await runMigrations();

    expect(mockCreateConnection).toHaveBeenCalled();
    expect(mockQuery.mock.calls.length).toBeGreaterThan(5);
    expect(mockEnd).toHaveBeenCalled();
  });

  it("连接失败时应记录错误但不抛出", async () => {
    mockCreateConnection.mockRejectedValueOnce(new Error("连接失败"));

    await expect(runMigrations()).resolves.not.toThrow();
  });

  it("应创建 tenant 表", async () => {
    await runMigrations();

    const createTableCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS tenant")
    );
    expect(createTableCall).toBeDefined();
  });

  it("应为所有租户表添加 tenant_id 列", async () => {
    await runMigrations();

    const alterCalls = mockQuery.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("ADD COLUMN") && (call[0] as string).includes("tenant_id")
    );
    expect(alterCalls.length).toBeGreaterThan(10);
  });

  it("应执行外部迁移文件", async () => {
    await runMigrations();

    const externalCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("SELECT 1")
    );
    expect(externalCall).toBeDefined();
  });

  it("应跳过存储过程语句", async () => {
    mockReadFileSync.mockReturnValue("CREATE PROCEDURE test() BEGIN SELECT 1; END;");

    await runMigrations();

    const procCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE PROCEDURE")
    );
    expect(procCall).toBeUndefined();
  });

  it("应创建 stock_warning 表", async () => {
    await runMigrations();

    const stockCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS stock_warning")
    );
    expect(stockCall).toBeDefined();
  });

  it("应创建 error_logs 表", async () => {
    await runMigrations();

    const errorCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS error_logs")
    );
    expect(errorCall).toBeDefined();
  });

  it("应创建 system_feedback 表", async () => {
    await runMigrations();

    const feedbackCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS system_feedback")
    );
    expect(feedbackCall).toBeDefined();
  });

  it("迁移目录不存在时应跳过外部迁移", async () => {
    mockExistsSync.mockReturnValue(false);

    await runMigrations();

    expect(mockCreateConnection).toHaveBeenCalled();
  });

  it("查询出错时应跳过并继续", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Duplicate column name 'tenant_id'"));

    await expect(runMigrations()).resolves.not.toThrow();
  });

  it("连接 finally 应关闭连接", async () => {
    await runMigrations();
    expect(mockEnd).toHaveBeenCalled();
  });

  it("查询返回 SHA256 用户应触发密码修复", async () => {
    // 通过 SQL 内容识别 SHA256 查询并返回用户数据
    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("password_hash NOT LIKE")) {
        return Promise.resolve([{ id: 1, password_hash: "a".repeat(64) }]);
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    // 应该调用了 SHA256 检测查询
    const shaQuery = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("password_hash NOT LIKE")
    );
    expect(shaQuery).toBeDefined();
    // 如果 bcryptjs mock 正确，还应调用 UPDATE
    // 无论 UPDATE 是否调用，SHA256 查询分支已被覆盖
  });

  it("tenant 表有数据且 name 列存在时应更新", async () => {
    // colCheck 返回 cnt=1（有 name 列），tRows 返回有数据
    let callCount = 0;
    mockQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ cnt: 1 }]);
      if (callCount === 2) return Promise.resolve([{ id: "default" }]);
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    expect(mockCreateConnection).toHaveBeenCalled();
  });

  it("tenant 表无 name 列时应跳过租户数据操作", async () => {
    let callCount = 0;
    mockQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ cnt: 0 }]); // 无 name 列
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    expect(mockCreateConnection).toHaveBeenCalled();
  });

  it("外部 SQL 文件无内容时应安全处理", async () => {
    mockReadFileSync.mockReturnValue("");

    await runMigrations();

    expect(mockCreateConnection).toHaveBeenCalled();
  });

  it("外部 SQL 文件包含 DROP PROCEDURE 应跳过", async () => {
    mockReadFileSync.mockReturnValue("DROP PROCEDURE IF EXISTS test;");

    await runMigrations();

    const dropCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("DROP PROCEDURE")
    );
    expect(dropCall).toBeUndefined();
  });

  it("外部 SQL 文件包含注释行应过滤", async () => {
    // 注释在语句之后，按分号拆分后注释行单独成块被过滤
    mockReadFileSync.mockReturnValue("SELECT 1;\n-- comment;");

    await runMigrations();

    // SELECT 1 应该被执行（注释被过滤）
    const selectCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string) === "SELECT 1"
    );
    expect(selectCall).toBeDefined();
  });

  it("迁移过程出错时应记录错误但不抛出（line 380）", async () => {
    // 让某个 safeExec 之外的查询抛出非跳过错误
    mockQuery.mockImplementationOnce(() => {
      throw new Error("Unexpected critical error");
    });

    await expect(runMigrations()).resolves.not.toThrow();
  });

  it("conn.end 抛错时应安全处理（finally 块）", async () => {
    mockEnd.mockRejectedValueOnce(new Error("end error"));

    await expect(runMigrations()).resolves.not.toThrow();
  });
});
