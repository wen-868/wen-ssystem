import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("../../shared/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn().mockReturnValue("SELECT 1;"),
  readdirSync: vi.fn().mockReturnValue(["001_test.sql"]),
  existsSync: vi.fn().mockReturnValue(true),
}));

import { runMigrations } from "../../shared/migration.js";

describe("migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue([{ affectedRows: 0 }]);
  });

  it("USE_MOCK_DB=false 时应执行迁移流程", async () => {
    await runMigrations();

    // 应该创建了数据库连接
    expect(mockCreateConnection).toHaveBeenCalled();
    // 应该执行了多次查询
    expect(mockQuery.mock.calls.length).toBeGreaterThan(5);
    // 应该关闭了连接
    expect(mockEnd).toHaveBeenCalled();
  });

  it("连接失败时应记录错误但不抛出", async () => {
    mockCreateConnection.mockRejectedValueOnce(new Error("连接失败"));

    await expect(runMigrations()).resolves.not.toThrow();
  });

  it("应创建 tenant 表", async () => {
    await runMigrations();

    const createTableCall = mockQuery.mock.calls.find(
      call => typeof call[0] === "string" && call[0].includes("CREATE TABLE IF NOT EXISTS tenant")
    );
    expect(createTableCall).toBeDefined();
  });

  it("应为所有租户表添加 tenant_id 列", async () => {
    await runMigrations();

    const alterCalls = mockQuery.mock.calls.filter(
      call => typeof call[0] === "string" && call[0].includes("ADD COLUMN") && call[0].includes("tenant_id")
    );
    expect(alterCalls.length).toBeGreaterThan(10);
  });

  it("应执行外部迁移文件", async () => {
    await runMigrations();

    const externalCall = mockQuery.mock.calls.find(
      call => typeof call[0] === "string" && call[0].includes("SELECT 1")
    );
    expect(externalCall).toBeDefined();
  });

  it("应跳过存储过程语句", async () => {
    const { readFileSync } = await import("fs");
    (readFileSync as any).mockReturnValue("CREATE PROCEDURE test() BEGIN SELECT 1; END;");

    await runMigrations();

    // 存储过程不应被执行
    const procCall = mockQuery.mock.calls.find(
      call => typeof call[0] === "string" && call[0].includes("CREATE PROCEDURE")
    );
    expect(procCall).toBeUndefined();
  });

  it("应创建 stock_warning 表", async () => {
    await runMigrations();

    const stockCall = mockQuery.mock.calls.find(
      call => typeof call[0] === "string" && call[0].includes("CREATE TABLE IF NOT EXISTS stock_warning")
    );
    expect(stockCall).toBeDefined();
  });

  it("应创建 error_logs 表", async () => {
    await runMigrations();

    const errorCall = mockQuery.mock.calls.find(
      call => typeof call[0] === "string" && call[0].includes("CREATE TABLE IF NOT EXISTS error_logs")
    );
    expect(errorCall).toBeDefined();
  });

  it("应创建 system_feedback 表", async () => {
    await runMigrations();

    const feedbackCall = mockQuery.mock.calls.find(
      call => typeof call[0] === "string" && call[0].includes("CREATE TABLE IF NOT EXISTS system_feedback")
    );
    expect(feedbackCall).toBeDefined();
  });

  it("迁移目录不存在时应跳过外部迁移", async () => {
    const { existsSync } = await import("fs");
    (existsSync as any).mockReturnValue(false);

    await runMigrations();

    // 仍然应该执行了内部迁移
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
});
