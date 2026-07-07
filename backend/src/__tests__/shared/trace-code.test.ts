import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryOneWithTenant, mockConnQuery, mockConnExecute } = vi.hoisted(() => ({
  mockQueryOneWithTenant: vi.fn(),
  mockConnQuery: vi.fn(),
  mockConnExecute: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  queryOneWithTenant: mockQueryOneWithTenant,
  query: vi.fn(),
  execute: vi.fn(),
}));

import { verifyTraceCode, verifyTraceCodeSimple, bindTraceCodeOnInStock, updateTraceCodeOnOutStock } from "../../shared/trace-code.js";

// ========== verifyTraceCodeSimple ==========
describe("verifyTraceCodeSimple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("追溯码存在且状态正常时返回 valid=true", async () => {
    mockQueryOneWithTenant.mockResolvedValue({
      traceCode: "TC001",
      currentStatus: "PRODUCED",
      fraudAlert: 0,
      skuId: 1,
    });

    const result = await verifyTraceCodeSimple("TC001", "1");
    expect(result.valid).toBe(true);
    expect(result.message).toBe("验证通过");
  });

  it("追溯码不存在时返回 valid=false", async () => {
    mockQueryOneWithTenant.mockResolvedValue(null);

    const result = await verifyTraceCodeSimple("TC001", "1");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("追溯码不存在");
  });

  it("追溯码被标记为疑似仿冒时返回 valid=false", async () => {
    mockQueryOneWithTenant.mockResolvedValue({
      traceCode: "TC002",
      currentStatus: "PRODUCED",
      fraudAlert: 1,
    });

    const result = await verifyTraceCodeSimple("TC002", "1");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("追溯码已被标记为疑似仿冒");
  });

  it("追溯码已销毁时返回 valid=false", async () => {
    mockQueryOneWithTenant.mockResolvedValue({
      traceCode: "TC003",
      currentStatus: "DESTROYED",
      fraudAlert: 0,
    });

    const result = await verifyTraceCodeSimple("TC003", "1");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("销毁");
  });

  it("追溯码已过期时返回 valid=false", async () => {
    mockQueryOneWithTenant.mockResolvedValue({
      traceCode: "TC004",
      currentStatus: "EXPIRED",
      fraudAlert: 0,
    });

    const result = await verifyTraceCodeSimple("TC004", "1");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("过期");
  });

  it("DB 查询出错时应抛出异常", async () => {
    mockQueryOneWithTenant.mockRejectedValue(new Error("DB Error"));

    await expect(verifyTraceCodeSimple("TC001", "1")).rejects.toThrow("DB Error");
  });
});

// ========== verifyTraceCode ==========
describe("verifyTraceCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("追溯码存在且状态正常时返回 valid=true", async () => {
    const mockConn = {
      query: vi.fn().mockResolvedValue([[{
        traceCode: "TC001",
        currentStatus: "PRODUCED",
        fraudAlert: 0,
        skuId: 1,
      }]]),
    };

    const result = await verifyTraceCode(mockConn, "1", "TC001");
    expect(result.valid).toBe(true);
    expect(result.message).toBe("验证通过");
  });

  it("追溯码不存在时返回 valid=false", async () => {
    const mockConn = {
      query: vi.fn().mockResolvedValue([[]]),
    };

    const result = await verifyTraceCode(mockConn, "1", "TC999");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("追溯码不存在");
  });

  it("追溯码已销毁时返回 valid=false", async () => {
    const mockConn = {
      query: vi.fn().mockResolvedValue([[{
        traceCode: "TC003",
        currentStatus: "DESTROYED",
        fraudAlert: 0,
      }]]),
    };

    const result = await verifyTraceCode(mockConn, "1", "TC003");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("销毁");
  });
});

// ========== bindTraceCodeOnInStock ==========
describe("bindTraceCodeOnInStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ONE_PER_BATCH 模式应只生成 1 个追溯码", async () => {
    const mockConn = {
      query: vi.fn().mockResolvedValue([[{ codePrefix: "TR", shelfLifeDays: 365 }]]),
      execute: vi.fn().mockResolvedValue([{}]),
    };

    const codes = await bindTraceCodeOnInStock(mockConn, "1", {
      skuId: 1,
      skuName: "测试商品",
      batchNo: "B001",
      quantity: 10,
      codeMode: "ONE_PER_BATCH",
    });

    expect(codes).toHaveLength(1);
    expect(codes[0]).toContain("TR");
  });

  it("ONE_PER_ITEM 模式应生成与数量相同的追溯码", async () => {
    const mockConn = {
      query: vi.fn().mockResolvedValue([[{ codePrefix: "TR", shelfLifeDays: 365 }]]),
      execute: vi.fn().mockResolvedValue([{}]),
    };

    const codes = await bindTraceCodeOnInStock(mockConn, "1", {
      skuId: 1,
      skuName: "测试商品",
      batchNo: "B001",
      quantity: 5,
      codeMode: "ONE_PER_ITEM",
    });

    expect(codes).toHaveLength(5);
  });

  it("无 SKU 配置时应使用全局配置", async () => {
    const mockConn = {
      query: vi.fn()
        .mockResolvedValueOnce([[]])  // SKU 级别无配置
        .mockResolvedValueOnce([[{ codePrefix: "GLOBAL", shelfLifeDays: 180 }]]),  // 全局配置
      execute: vi.fn().mockResolvedValue([{}]),
    };

    const codes = await bindTraceCodeOnInStock(mockConn, "1", {
      skuId: 1,
      skuName: "测试商品",
      batchNo: "B001",
      quantity: 1,
      codeMode: "ONE_PER_BATCH",
    });

    expect(codes[0]).toContain("GLOBAL");
  });

  it("无任何配置时应使用默认前缀 TR", async () => {
    const mockConn = {
      query: vi.fn()
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]),
      execute: vi.fn().mockResolvedValue([{}]),
    };

    const codes = await bindTraceCodeOnInStock(mockConn, "1", {
      skuId: 1,
      skuName: "测试商品",
      batchNo: "B001",
      quantity: 1,
      codeMode: "ONE_PER_BATCH",
    });

    expect(codes[0]).toContain("TR");
  });
});

// ========== updateTraceCodeOnOutStock ==========
describe("updateTraceCodeOnOutStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应更新追溯码状态为 SOLD", async () => {
    const mockConn = {
      execute: vi.fn().mockResolvedValue([{}]),
    };

    await updateTraceCodeOnOutStock(mockConn, "1", ["TC001", "TC002"], "ORD001", "销售出库");

    // 每个码应执行 2 次 SQL（更新 + 事件日志）
    expect(mockConn.execute).toHaveBeenCalledTimes(4);
  });

  it("空数组不应执行任何 SQL", async () => {
    const mockConn = {
      execute: vi.fn(),
    };

    await updateTraceCodeOnOutStock(mockConn, "1", [], "ORD001", "销售出库");

    expect(mockConn.execute).not.toHaveBeenCalled();
  });
});
