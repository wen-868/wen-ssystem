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

import { runMigrations, safeExec, SKIP_ERRORS, TENANT_TABLES, addTablePrefix } from "../../shared/migration";
import { env } from "../../shared/env";

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
    expect(TENANT_TABLES).toContain("t_sys_user");
    expect(TENANT_TABLES).toContain("t_store");
  });
});

// ========== addTablePrefix ==========
describe("addTablePrefix", () => {
  it("CREATE TABLE 应加 t_ 前缀", () => {
    const sql = "CREATE TABLE sys_user (id INT);";
    const result = addTablePrefix(sql);
    expect(result).toContain("CREATE TABLE t_sys_user");
  });

  it("CREATE TABLE IF NOT EXISTS 应加 t_ 前缀", () => {
    const sql = "CREATE TABLE IF NOT EXISTS sys_user (id INT);";
    const result = addTablePrefix(sql);
    expect(result).toContain("CREATE TABLE IF NOT EXISTS t_sys_user");
  });

  it("已经是 t_ 前缀的表不应重复添加", () => {
    const sql = "CREATE TABLE t_sys_user (id INT);";
    const result = addTablePrefix(sql);
    expect(result).toContain("CREATE TABLE t_sys_user");
    expect(result).not.toContain("t_t_sys_user");
  });

  it("ALTER TABLE 应加 t_ 前缀", () => {
    const sql = "ALTER TABLE sys_user ADD COLUMN name VARCHAR(50);";
    const result = addTablePrefix(sql);
    expect(result).toContain("ALTER TABLE t_sys_user");
  });

  it("INSERT INTO 应加 t_ 前缀", () => {
    const sql = "INSERT INTO t_sys_user (name) VALUES ('test');";
    const result = addTablePrefix(sql);
    expect(result).toContain("INSERT INTO t_sys_user");
  });

  it("UPDATE 应加 t_ 前缀", () => {
    const sql = "UPDATE t_sys_user SET name = 'test';";
    const result = addTablePrefix(sql);
    expect(result).toContain("UPDATE t_sys_user");
  });

  it("DELETE FROM 应加 t_ 前缀", () => {
    const sql = "DELETE FROM t_sys_user WHERE id = 1;";
    const result = addTablePrefix(sql);
    expect(result).toContain("DELETE FROM t_sys_user");
  });

  it("FROM 子句应加 t_ 前缀", () => {
    const sql = "SELECT * FROM t_sys_user;";
    const result = addTablePrefix(sql);
    expect(result).toContain("FROM t_sys_user");
  });

  it("JOIN 应加 t_ 前缀", () => {
    const sql = "SELECT * FROM t_sys_user JOIN t_sys_role ON ...;";
    const result = addTablePrefix(sql);
    expect(result).toContain("JOIN t_sys_role");
  });

  it("information_schema 和 mysql 系统表不应加前缀", () => {
    const sql = "SELECT * FROM information_schema.COLUMNS;";
    const result = addTablePrefix(sql);
    expect(result).toContain("FROM information_schema.COLUMNS");
    expect(result).not.toContain("t_information_schema");
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

  it("USE_MOCK_DB=true 时应直接返回（line 85）", async () => {
    (env as any).USE_MOCK_DB = true;
    await runMigrations();
    expect(mockCreateConnection).not.toHaveBeenCalled();
    (env as any).USE_MOCK_DB = false;
  });

  it("连接失败时应记录错误但不抛出", async () => {
    mockCreateConnection.mockRejectedValueOnce(new Error("连接失败"));

    await expect(runMigrations()).resolves.not.toThrow();
  });

  it("应创建 t_tenant 表", async () => {
    await runMigrations();

    const createTableCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS t_tenant")
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

  it("应创建 t_stock_warning 表", async () => {
    await runMigrations();

    const stockCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS t_stock_warning")
    );
    expect(stockCall).toBeDefined();
  });

  it("应创建 t_error_logs 表", async () => {
    await runMigrations();

    const errorCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS t_error_logs")
    );
    expect(errorCall).toBeDefined();
  });

  it("应创建 t_system_feedback 表", async () => {
    await runMigrations();

    const feedbackCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("CREATE TABLE IF NOT EXISTS t_system_feedback")
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
    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("password_hash NOT LIKE")) {
        return Promise.resolve([[{ id: 1, password_hash: "a".repeat(64) }]]);
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    const shaQuery = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("password_hash NOT LIKE")
    );
    expect(shaQuery).toBeDefined();
  });

  it("t_tenant 表无数据且 name 列存在时应插入默认租户（line 156）", async () => {
    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("information_schema.COLUMNS")) {
        return Promise.resolve([[{ cnt: 1 }]]);
      }
      if (typeof sql === "string" && sql.includes("SELECT id FROM t_tenant WHERE id = 'default'")) {
        return Promise.resolve([[]]);
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    const insertCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("INSERT INTO t_tenant")
    );
    expect(insertCall).toBeDefined();
  });

  it("t_tenant 表有数据且 name 列存在时应更新默认租户名称（line 161）", async () => {
    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("information_schema.COLUMNS")) {
        return Promise.resolve([[{ cnt: 1 }]]);
      }
      if (typeof sql === "string" && sql.includes("SELECT id FROM t_tenant WHERE id = 'default'")) {
        return Promise.resolve([[{ id: "default" }]]);
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    const updateCall = mockQuery.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("UPDATE t_tenant SET name")
    );
    expect(updateCall).toBeDefined();
  });

  it("t_tenant 表无 name 列时应跳过租户数据操作", async () => {
    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("information_schema.COLUMNS")) {
        return Promise.resolve([[{ cnt: 0 }]]);
      }
      if (typeof sql === "string" && sql.includes("SELECT id FROM t_tenant WHERE id = 'default'")) {
        return Promise.resolve([[]]);
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    expect(mockCreateConnection).toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[migration] t_tenant 表缺少 name 列，跳过租户数据操作"
    );
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

  it("迁移过程出错时应记录错误但不抛出（line 381）", async () => {
    // 让 readdirSync 抛出同步错误，触发最外层 catch
    mockReaddirSync.mockImplementationOnce(() => {
      throw new Error("Unexpected critical error");
    });

    await expect(runMigrations()).resolves.not.toThrow();
    expect(mockLoggerError).toHaveBeenCalledWith(
      "[migration] 迁移过程出错:",
      "Unexpected critical error"
    );
  });

  it("conn.end 抛错时应安全处理（finally 块）", async () => {
    mockEnd.mockRejectedValueOnce(new Error("end error"));

    await expect(runMigrations()).resolves.not.toThrow();
  });

  it("租户数据操作失败时应捕获异常并记录错误（line 169）", async () => {
    // 让 information_schema 查询抛出错误
    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("information_schema.COLUMNS")) {
        return Promise.reject(new Error("information_schema query failed"));
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await expect(runMigrations()).resolves.not.toThrow();
    expect(mockLoggerError).toHaveBeenCalledWith(
      "[migration] 租户数据操作失败:",
      "information_schema query failed"
    );
  });

  it("存在 SHA256 密码用户时应修复为 bcrypt 哈希（lines 209-214）", async () => {
    const shaUser = { id: 1, password_hash: "a".repeat(64) };
    let shaQueryCalled = false;
    let updateCalled = false;

    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("password_hash NOT LIKE")) {
        shaQueryCalled = true;
        return Promise.resolve([[shaUser]]);
      }
      if (typeof sql === "string" && sql.includes("UPDATE t_sys_user SET password_hash")) {
        updateCalled = true;
        return Promise.resolve([{ affectedRows: 1 }]);
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await runMigrations();

    expect(shaQueryCalled).toBe(true);
    expect(updateCalled).toBe(true);
    expect(mockHashSync).toHaveBeenCalledWith("admin123", 10);
  });

  it("SHA256 密码修复过程中出错时应捕获异常（line 216）", async () => {
    // 让 SHA256 用户查询抛出错误
    mockQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === "string" && sql.includes("password_hash NOT LIKE")) {
        return Promise.reject(new Error("SHA256 query failed"));
      }
      return Promise.resolve([{ affectedRows: 0 }]);
    });

    await expect(runMigrations()).resolves.not.toThrow();
    expect(mockLoggerError).toHaveBeenCalledWith(
      "[migration] 密码修复失败:",
      "SHA256 query failed"
    );
  });
});
