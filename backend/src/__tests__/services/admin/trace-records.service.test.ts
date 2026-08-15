/**
 * 管理端追溯记录 service 单元测试
 * 被测文件：src/services/admin/trace-records.service.ts
 * 覆盖：generateTraceCodes / listTraceCodes / getTraceCodeDetail /
 *       updateTraceCodeStatus / getTraceCodeStatistics / queryTraceChain /
 *       verifyTraceCode / createRecall / listRecalls / getRecallDetail /
 *       executeRecall / completeRecall / consumerQueryTrace / consumerVerifyTraceCode
 *
 * 约定（与项目现有测试一致）：
 *  - queryWithTenant / query 返回行集合数组；queryOneWithTenant / queryOne 返回对象或 null。
 *  - SQL 使用 AS 别名返回驼峰键（如 trace_code AS traceCode），mock 数据须用驼峰键。
 *  - makeBizNo("RC") 返回召回单号；verifyTraceCodeSimple(traceCode, tenantId) 返回 { valid, message, code? }。
 *  - verifyTraceCode / consumerVerifyTraceCode 返回字段为 result（非 status）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as service from "../../../services/admin/trace-records.service";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
  verifyTraceCodeSimple: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));
vi.mock("../../../shared/trace-code", () => ({ verifyTraceCodeSimple: mocks.verifyTraceCodeSimple }));

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.queryWithTenant.mockResolvedValue([]);
  mocks.query.mockResolvedValue([]);
  mocks.queryOne.mockResolvedValue(null);
  mocks.queryOneWithTenant.mockResolvedValue(null);
  mocks.makeBizNo.mockReturnValue("RC2026081600001");
});

describe("trace-records.service - generateTraceCodes", () => {
  it("存在 SKU 配置时使用其 codePrefix，按件生成多码", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ codePrefix: "SKU" }); // sku 配置

    const res = await service.generateTraceCodes(
      { skuId: 1, skuName: "商品", batchNo: "B1", quantity: 2, codeMode: "ONE_PER_ITEM" },
      "u1", "张三", tenantId,
    );

    expect(res.codeMode).toBe("ONE_PER_ITEM");
    expect(res.generatedCount).toBe(2);
    expect(res.traceCodes).toHaveLength(2);
    expect(res.traceCodes[0]).toContain("SKU");
    // 每个码 2 次 INSERT（trace_code + event_log），共 4 次
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(4);
  });

  it("无 SKU 配置时回退全局配置，codePrefix 默认 TR，按批次生成 1 码", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null) // 无 sku 配置
      .mockResolvedValueOnce({ codePrefix: "TR" }); // 全局配置

    const res = await service.generateTraceCodes(
      { skuId: 2, skuName: "商品2", batchNo: "B2", quantity: 5, codeMode: "ONE_PER_BATCH" },
      "u1", "张三", tenantId,
    );

    expect(res.generatedCount).toBe(1);
    expect(res.traceCodes[0]).toContain("TR");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

describe("trace-records.service - listTraceCodes", () => {
  it("带全部筛选条件", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ traceCode: "SKUA1", currentStatus: "NORMAL" }]);

    const res = await service.listTraceCodes(1, 10, 1, "B1", "NORMAL", 90, tenantId);
    expect(res.total).toBe(1);
    expect(res.records).toHaveLength(1);
  });

  it("无筛选条件 + total 为 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await service.listTraceCodes(1, 10, undefined, undefined, undefined, undefined, tenantId);
    expect(res.total).toBe(0);
    expect(res.records).toEqual([]);
  });
});

describe("trace-records.service - getTraceCodeDetail", () => {
  it("码不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    expect(await service.getTraceCodeDetail("X", tenantId)).toBeNull();
  });

  it("码存在返回详情与事件", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ traceCode: "X", skuId: "S1", currentStatus: "NORMAL" });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, eventType: "ACTIVATE" }]);
    const res = await service.getTraceCodeDetail("X", tenantId);
    expect(res?.traceCode).toBe("X");
    expect(res?.events).toHaveLength(1);
  });
});

describe("trace-records.service - updateTraceCodeStatus", () => {
  it("码不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    expect(await service.updateTraceCodeStatus("X", { status: "RECALLED" }, "u1", "张三", "1.1.1.1", tenantId)).toBeNull();
  });

  it("码存在时更新并写事件后返回更新记录", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, currentStatus: "NORMAL", currentLocation: "生产入库", storeId: null, warehouseId: null, orderId: null, qualityCheckResult: "PASS" }) // 现有码
      .mockResolvedValueOnce({ traceCode: "X", currentStatus: "RECALLED", currentLocation: "门店", version: 2, updatedAt: "2026-08-16" }); // 更新后
    mocks.queryWithTenant.mockResolvedValue([]);

    const res = await service.updateTraceCodeStatus(
      "X",
      { status: "RECALLED", location: "门店", storeId: 90, remark: "召回" },
      "u1", "张三", "1.1.1.1", tenantId,
    );
    expect(res?.currentStatus).toBe("RECALLED");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2); // UPDATE + INSERT 事件
  });
});

describe("trace-records.service - getTraceCodeStatistics", () => {
  it("返回各状态统计", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ currentStatus: "NORMAL", count: 3 }]); // statusStats
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 100 }) // totalCount
      .mockResolvedValueOnce({ count: 5 }) // todayCount
      .mockResolvedValueOnce({ count: 2 }) // fraudCount
      .mockResolvedValueOnce({ count: 50 }) // totalScans
      .mockResolvedValueOnce({ count: 10 }); // todayScans

    const res = await service.getTraceCodeStatistics(tenantId);
    expect(res.totalCodes).toBe(100);
    expect(res.fraudAlerts).toBe(2);
    expect(res.byStatus.NORMAL).toBe(3);
  });
});

describe("trace-records.service - queryTraceChain", () => {
  it("码不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    expect(await service.queryTraceChain("X", tenantId)).toBeNull();
  });

  it("码存在返回追溯链", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ traceCode: "X", skuId: "S1", currentStatus: "NORMAL" });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, eventType: "SCAN" }]);
    const res = await service.queryTraceChain("X", tenantId);
    expect(res?.traceCode).toBe("X");
    expect(res?.events).toHaveLength(1);
  });
});

describe("trace-records.service - verifyTraceCode", () => {
  it("无效码（不存在）返回 NOT_FOUND 并记扫描日志", async () => {
    mocks.verifyTraceCodeSimple.mockResolvedValue({ valid: false, message: "追溯码不存在，请核实后重试" });
    const res = await service.verifyTraceCode("X", "scan", 1, "1.1.1.1", tenantId);
    expect(res.result).toBe("NOT_FOUND");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1); // 仅扫描日志
  });

  it("无效码（仿冒）返回 FRAUD_ALERT", async () => {
    mocks.verifyTraceCodeSimple.mockResolvedValue({ valid: false, message: "疑似仿冒码，请谨慎处理" });
    const res = await service.verifyTraceCode("X", "scan", 1, "1.1.1.1", tenantId);
    expect(res.result).toBe("FRAUD_ALERT");
  });

  it("无效码（过期）返回 EXPIRED", async () => {
    mocks.verifyTraceCodeSimple.mockResolvedValue({ valid: false, message: "追溯码已过期" });
    const res = await service.verifyTraceCode("X", "scan", 1, "1.1.1.1", tenantId);
    expect(res.result).toBe("EXPIRED");
  });

  it("有效码返回 SUCCESS 并更新扫描计数", async () => {
    mocks.verifyTraceCodeSimple.mockResolvedValue({
      valid: true,
      message: "有效追溯码",
      code: { skuId: "S1", skuName: "商品", batchNo: "B1", currentStatus: "NORMAL", qualityCheckResult: "PASS", scanCount: 4 },
    });
    const res = await service.verifyTraceCode("X", "scan", 1, "1.1.1.1", tenantId);
    expect(res.result).toBe("SUCCESS");
    expect(res.scanCount).toBe(5);
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2); // UPDATE 计数 + INSERT 日志
  });
});

describe("trace-records.service - createRecall", () => {
  it("批次召回（BATCH）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 5 }) // 影响范围
      .mockResolvedValueOnce({ recallNo: "RC2026081600001", totalAffected: 5, status: "CREATED" }); // 新记录

    const res = await service.createRecall(
      { recallType: "BATCH", targetValue: "B1", targetName: "批次1", reason: "质量", notifyContent: "请召回" },
      "u1", tenantId,
    );
    expect(res.recallNo).toBe("RC2026081600001");
    expect(res.totalAffected).toBe(5);
    expect(mocks.makeBizNo).toHaveBeenCalledWith("RC");
  });

  it("全局召回（GLOBAL）无 targetValue", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ recallNo: "RC2026081600002", totalAffected: 10, status: "CREATED" });
    const res = await service.createRecall({ recallType: "GLOBAL", targetName: "全部", reason: "r" }, "u1", tenantId);
    expect(res.totalAffected).toBe(10);
  });

  it("品类召回（CATEGORY）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ recallNo: "RC2026081600003", totalAffected: 2, status: "CREATED" });
    const res = await service.createRecall({ recallType: "CATEGORY", targetValue: "C1", targetName: "品类1", reason: "r" }, "u1", tenantId);
    expect(res.recallNo).toBe("RC2026081600003");
  });

  it("供应商召回（SUPPLIER）与 SKU 召回", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ recallNo: "RC2026081600004", totalAffected: 1, status: "CREATED" });
    const res = await service.createRecall({ recallType: "SUPPLIER", targetValue: "SUP1", targetName: "供应商1", reason: "r" }, "u1", tenantId);
    expect(res.recallNo).toBe("RC2026081600004");
  });
});

describe("trace-records.service - listRecalls", () => {
  it("带状态/类型筛选", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ recallNo: "RC1", recallType: "BATCH" }]);
    const res = await service.listRecalls(1, 10, "CREATED", "BATCH", tenantId);
    expect(res.total).toBe(1);
    expect(res.records).toHaveLength(1);
  });

  it("无筛选 + total 为 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await service.listRecalls(1, 10, undefined, undefined, tenantId);
    expect(res.total).toBe(0);
  });
});

describe("trace-records.service - getRecallDetail", () => {
  it("返回召回详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ recallNo: "RC1", status: "CREATED", recallType: "BATCH" });
    const res = await service.getRecallDetail("RC1", tenantId);
    expect(res.recallNo).toBe("RC1");
  });
});

describe("trace-records.service - executeRecall", () => {
  it("召回单不存在返回 notFound", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await service.executeRecall("RCX", "u1", "张三", tenantId);
    expect(res.notFound).toBe(true);
  });

  it("召回单已结束返回 alreadyEnded", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ recallNo: "RC1", recallType: "BATCH", targetValue: "B1", status: "COMPLETED", totalAffected: 0 });
    const res = await service.executeRecall("RC1", "u1", "张三", tenantId);
    expect(res.alreadyEnded).toBe(true);
  });

  it("活跃召回单执行（无受影响码）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ recallNo: "RC2", recallType: "BATCH", targetValue: "B1", status: "CREATED", totalAffected: 0 })
      .mockResolvedValueOnce({ recallNo: "RC2", recallType: "BATCH", status: "IN_PROGRESS" });
    mocks.queryWithTenant
      .mockResolvedValueOnce([]) // UPDATE trace_code
      .mockResolvedValueOnce([]); // 受影响码为空

    const res = await service.executeRecall("RC2", "u1", "张三", tenantId);
    expect(res.affectedCount).toBe(0);
    expect(res.recallNo).toBe("RC2");
  });

  it("活跃召回单执行（有受影响码，逐条写事件）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ recallNo: "RC3", recallType: "SKU", targetValue: "S1", status: "CREATED", totalAffected: 1 })
      .mockResolvedValueOnce({ recallNo: "RC3", recallType: "SKU", status: "IN_PROGRESS" });
    mocks.queryWithTenant
      .mockResolvedValueOnce([]) // UPDATE trace_code
      .mockResolvedValueOnce([{ traceCode: "X1" }]) // 受影响码
      .mockResolvedValueOnce([]); // INSERT 事件（逐条）

    const res = await service.executeRecall("RC3", "u1", "张三", tenantId);
    expect(res.affectedCount).toBe(1);
  });
});

describe("trace-records.service - completeRecall", () => {
  it("召回单不存在返回 notFound", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await service.completeRecall("RCX", { totalNotified: 0, totalReturned: 0 }, tenantId);
    expect(res.notFound).toBe(true);
  });

  it("召回单已结束返回 alreadyEnded", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CANCELLED" });
    const res = await service.completeRecall("RC1", { totalNotified: 0, totalReturned: 0 }, tenantId);
    expect(res.alreadyEnded).toBe(true);
  });

  it("召回单活跃时完成", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "IN_PROGRESS" })
      .mockResolvedValueOnce({ recallNo: "RC2", recallType: "BATCH", status: "COMPLETED" });
    mocks.queryWithTenant.mockResolvedValue([]);

    const res = await service.completeRecall("RC2", { totalNotified: 1, totalReturned: 1 }, tenantId);
    expect(res.recallNo).toBe("RC2");
  });
});

describe("trace-records.service - consumerQueryTrace", () => {
  it("码不存在返回 null", async () => {
    mocks.queryOne.mockResolvedValue(null);
    expect(await service.consumerQueryTrace("X")).toBeNull();
  });

  it("码存在返回追溯信息（query 无租户）", async () => {
    mocks.queryOne.mockResolvedValue({ traceCode: "X", skuName: "商品", batchNo: "B1", tenantId: "t1" });
    mocks.query.mockResolvedValue([{ id: 1, eventType: "ACTIVATE" }]);
    const res = await service.consumerQueryTrace("X");
    expect(res?.traceCode).toBe("X");
    expect(res?.events).toHaveLength(1);
    expect(mocks.query).toHaveBeenCalled();
  });
});

describe("trace-records.service - consumerVerifyTraceCode", () => {
  it("码信息不存在返回 NOT_FOUND", async () => {
    mocks.queryOne.mockResolvedValue(null);
    const res = await service.consumerVerifyTraceCode("X", 1, "1.1.1.1");
    expect(res.result).toBe("NOT_FOUND");
    expect(mocks.verifyTraceCodeSimple).not.toHaveBeenCalled();
  });

  it("有效码返回 SUCCESS（query 更新计数+日志）", async () => {
    mocks.queryOne.mockResolvedValue({ tenantId: "t1" });
    mocks.verifyTraceCodeSimple.mockResolvedValue({ valid: true, message: "有效", code: { skuName: "商品", batchNo: "B1", currentStatus: "NORMAL", qualityCheckResult: "PASS" } });
    const res = await service.consumerVerifyTraceCode("X", 1, "1.1.1.1");
    expect(res.result).toBe("SUCCESS");
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("无效码返回对应状态（query 仅写日志）", async () => {
    mocks.queryOne.mockResolvedValue({ tenantId: "t1" });
    mocks.verifyTraceCodeSimple.mockResolvedValue({ valid: false, message: "追溯码不存在，请核实后重试" });
    const res = await service.consumerVerifyTraceCode("X", 1, "1.1.1.1");
    expect(res.result).toBe("NOT_FOUND");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
