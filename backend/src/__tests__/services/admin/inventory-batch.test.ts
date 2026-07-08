/**
 * 库存批次管理 service 单元测试
 * 被测文件：src/services/admin/inventory-batch.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

import {
  listBatches,
  getBatchDetail,
  createBatch,
  updateBatch,
  splitBatch,
  getFifoSuggestion,
  getBatchTrace,
  getProductBatches,
  listExpiryConfigs,
  createExpiryConfig,
  updateExpiryConfig,
  deleteExpiryConfig,
  listExpiryAlerts,
  handleExpiryAlert,
  getExpiryAlertStatistics,
  runExpiryScan,
} from "../../../services/admin/inventory-batch.service.js";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
});

// ============ listBatches ============
describe("inventory-batch.service - listBatches", () => {
  it("覆盖所有 expiry 分支 + days_remaining 有值 + totalRow 有值", async () => {
    mocks.query.mockResolvedValue([
      { expiry_date: null },                               // 无 expiry_date（默认 正常）
      { expiry_date: "2020-01-01", days_remaining: -5 },   // remaining < 0（已过期）
      { expiry_date: "2020-01-01", days_remaining: 5 },    // remaining <= 7（即将过期）
      { expiry_date: "2020-01-01", days_remaining: 10 },   // remaining <= 15（临期）
      { expiry_date: "2020-01-01", days_remaining: 20 },   // remaining <= 30（临近效期）
      { expiry_date: "2020-01-01", days_remaining: 50 },   // remaining > 30（正常）
    ]);
    mocks.queryOne.mockResolvedValue({ total: 6 });
    const res = await listBatches("t1", { page: 1, pageSize: 10 });
    expect(res.total).toBe(6);
    expect(res.records[0].expiryStatusText).toBe("正常");
    expect(res.records[1].expiryStatusText).toBe("已过期");
    expect(res.records[2].expiryStatusText).toBe("即将过期");
    expect(res.records[3].expiryStatusText).toBe("临期");
    expect(res.records[4].expiryStatusText).toBe("临近效期");
    expect(res.records[5].expiryStatusText).toBe("正常");
  });

  it("days_remaining 为 null 时计算 Math.floor（!= null false）", async () => {
    mocks.query.mockResolvedValue([{ expiry_date: "2099-12-31", days_remaining: null }]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listBatches("t1", { page: 1, pageSize: 10 });
    expect(res.records[0].expiryStatusText).toBeDefined();
  });

  it("expiryStatus=expired + storeId + skuId + totalRow null", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await listBatches("t1", { page: 1, pageSize: 10, storeId: 1, skuId: 1, expiryStatus: "expired" });
    expect(res.total).toBe(0);
  });

  it("expiryStatus=danger", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await listBatches("t1", { page: 1, pageSize: 10, expiryStatus: "danger" });
  });

  it("expiryStatus=warning", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await listBatches("t1", { page: 1, pageSize: 10, expiryStatus: "warning" });
  });

  it("expiryStatus=normal", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await listBatches("t1", { page: 1, pageSize: 10, expiryStatus: "normal" });
  });
});

// ============ getBatchDetail ============
describe("inventory-batch.service - getBatchDetail", () => {
  it("返回批次详情", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, batch_no: "B1" });
    const res = await getBatchDetail("t1", 1);
    expect(res).toEqual({ id: 1, batch_no: "B1" });
  });
});

// ============ createBatch ============
describe("inventory-batch.service - createBatch", () => {
  it("批次号已存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1 }], undefined]);
    await expect(createBatch("t1", { storeId: 1, skuId: 1, batchNo: "B1", quantity: 10 } as any))
      .rejects.toThrow("批次号已存在");
  });

  it("成功创建 + 所有可选字段有值（?? 左）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[], undefined]) // existing 查询（无重复）
      .mockResolvedValueOnce([{ insertId: 5 }, undefined]); // INSERT
    const res = await createBatch("t1", {
      storeId: 1, skuId: 1, batchNo: "B1", quantity: 10,
      productionDate: "2026-01-01", expiryDate: "2027-01-01",
      costPrice: 20, supplierId: 2, inboundOrderId: 3,
    });
    expect(res).toBe(5);
  });

  it("成功创建 + 所有可选字段无值（?? 右）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[], undefined])
      .mockResolvedValueOnce([{ insertId: 6 }, undefined]);
    const res = await createBatch("t1", {
      storeId: 1, skuId: 1, batchNo: "B2", quantity: 5,
    });
    expect(res).toBe(6);
  });
});

// ============ updateBatch ============
describe("inventory-batch.service - updateBatch", () => {
  it("所有字段有值（4 个 if true）", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await updateBatch("t1", 1, { quantity: 20, productionDate: "2026-01-01", expiryDate: "2027-01-01", costPrice: 30 });
    expect(mockConn.execute).toHaveBeenCalledTimes(1);
  });

  it("无字段更新（sets.length === 0）", async () => {
    await updateBatch("t1", 1, {} as any);
    expect(mockConn.execute).not.toHaveBeenCalled();
  });
});

// ============ splitBatch ============
describe("inventory-batch.service - splitBatch", () => {
  it("批次不存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await expect(splitBatch("t1", 1, { splitQuantity: 5, newBatchNo: "B2" })).rejects.toThrow("批次不存在");
  });

  it("拆分数量大于批次数量时抛错", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, quantity: 3 }], undefined]);
    await expect(splitBatch("t1", 1, { splitQuantity: 5, newBatchNo: "B2" })).rejects.toThrow("拆分数量不能大于批次数量");
  });

  it("成功拆分", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ id: 1, quantity: 10, store_id: 1, sku_id: 1, production_date: "2026-01-01", expiry_date: "2027-01-01", cost_price: 20, supplier_id: 2, inbound_order_id: 3 }], undefined])
      .mockResolvedValueOnce([[], undefined]) // UPDATE
      .mockResolvedValueOnce([{ insertId: 7 }, undefined]); // INSERT
    const res = await splitBatch("t1", 1, { splitQuantity: 4, newBatchNo: "B2" });
    expect(res).toBe(7);
  });
});

// ============ getFifoSuggestion ============
describe("inventory-batch.service - getFifoSuggestion", () => {
  it("返回 FIFO 建议列表", async () => {
    mocks.query.mockResolvedValue([{ id: 1, batch_no: "B1", quantity: 10 }]);
    const res = await getFifoSuggestion("t1", 1, 1);
    expect(res).toEqual([{ id: 1, batch_no: "B1", quantity: 10 }]);
  });
});

// ============ getBatchTrace ============
describe("inventory-batch.service - getBatchTrace", () => {
  it("批次不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getBatchTrace("t1", 1)).rejects.toMatchObject({
      message: "批次不存在", statusCode: 404,
    });
  });

  it("无 inbound_order_id + saleItems 有值 + 所有字段有值", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, batch_no: "B1", quantity: 10, inbound_order_id: null });
    mocks.query.mockResolvedValueOnce([{ bill_no: "S1", created_at: "2026-07-09", quantity: 5 }]);
    const res = await getBatchTrace("t1", 1);
    expect(res).toHaveLength(2); // sale + current
    expect(res[0].type).toBe("sale");
    expect(res[1].type).toBe("current");
  });

  it("有 inbound_order_id + inStock 有值 + 所有字段有值", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, batch_no: "B1", quantity: 10, inbound_order_id: 5 });
    mocks.query.mockResolvedValueOnce([{ stock_no: "RK1", created_at: "2026-07-08" }]); // inStock
    mocks.query.mockResolvedValueOnce([]); // saleItems 空
    const res = await getBatchTrace("t1", 1);
    expect(res).toHaveLength(2); // purchase + current
    expect(res[0].type).toBe("purchase");
    expect(res[0].refNo).toBe("RK1");
  });

  it("有 inbound_order_id + inStock 无值（空数组）+ saleItems 空 + batch_no/quantity 无值", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, batch_no: null, quantity: null, inbound_order_id: 5 });
    mocks.query.mockResolvedValueOnce([]); // inStock 空
    mocks.query.mockResolvedValueOnce([]); // saleItems 空
    const res = await getBatchTrace("t1", 1);
    expect(res).toHaveLength(1); // current only
    expect(res[0].type).toBe("current");
    expect(res[0].detail).toBe(""); // batch_no null → ""
  });

  it("inStock 有值但字段为 null + saleItems 有值但字段为 null", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, batch_no: "B1", quantity: null, inbound_order_id: 5 });
    mocks.query.mockResolvedValueOnce([{ stock_no: null, created_at: null }]); // inStock 字段 null
    mocks.query.mockResolvedValueOnce([{ bill_no: null, created_at: null, quantity: null }]); // saleItems 字段 null
    const res = await getBatchTrace("t1", 1);
    expect(res).toHaveLength(3); // purchase + sale + current
    expect(res[0].refNo).toBe("");
    expect(res[1].refNo).toBe("");
  });
});

// ============ getProductBatches ============
describe("inventory-batch.service - getProductBatches", () => {
  it("返回产品批次列表", async () => {
    mocks.query.mockResolvedValue([{ id: 1, batch_no: "B1" }]);
    const res = await getProductBatches("t1", 1);
    expect(res).toEqual([{ id: 1, batch_no: "B1" }]);
  });
});

// ============ listExpiryConfigs ============
describe("inventory-batch.service - listExpiryConfigs", () => {
  it("返回效期配置列表", async () => {
    mocks.query.mockResolvedValue([{ id: 1, alert_level: 1 }]);
    const res = await listExpiryConfigs("t1");
    expect(res).toEqual([{ id: 1, alert_level: 1 }]);
  });
});

// ============ createExpiryConfig ============
describe("inventory-batch.service - createExpiryConfig", () => {
  it("enabled=true（三元左）", async () => {
    mocks.query.mockResolvedValue({ insertId: 1 } as any);
    const res = await createExpiryConfig("t1", {
      alertLevel: 1, levelName: "一级", daysBeforeExpiry: 7,
      action: "WARN", color: "#FF0000", enabled: true, description: "测试",
    });
    expect(res).toBe(1);
  });

  it("enabled=false（三元右）", async () => {
    mocks.query.mockResolvedValue({ insertId: 2 } as any);
    const res = await createExpiryConfig("t1", {
      alertLevel: 2, levelName: "二级", daysBeforeExpiry: 30,
      action: "BLOCK", color: "#00FF00", enabled: false, description: "测试2",
    });
    expect(res).toBe(2);
  });
});

// ============ updateExpiryConfig ============
describe("inventory-batch.service - updateExpiryConfig", () => {
  it("所有字段有值 + enabled=true", async () => {
    mocks.query.mockResolvedValue([]);
    await updateExpiryConfig("t1", 1, {
      levelName: "一级", daysBeforeExpiry: 7, action: "WARN",
      color: "#FF0000", enabled: true, description: "更新",
    });
    expect(mocks.query).toHaveBeenCalled();
  });

  it("无字段更新（sets.length === 0）", async () => {
    await updateExpiryConfig("t1", 1, {} as any);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("enabled=false（三元右）", async () => {
    mocks.query.mockResolvedValue([]);
    await updateExpiryConfig("t1", 1, { enabled: false });
    expect(mocks.query).toHaveBeenCalled();
  });
});

// ============ deleteExpiryConfig ============
describe("inventory-batch.service - deleteExpiryConfig", () => {
  it("成功删除", async () => {
    mocks.query.mockResolvedValue([]);
    await deleteExpiryConfig("t1", 1);
    expect(mocks.query).toHaveBeenCalled();
  });
});

// ============ listExpiryAlerts ============
describe("inventory-batch.service - listExpiryAlerts", () => {
  it("无可选条件 + totalRow 有值", async () => {
    mocks.query.mockResolvedValue([{ id: 1 }]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listExpiryAlerts("t1", { page: 1, pageSize: 10 });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1 }] });
  });

  it("有 alertLevel + status + storeId + totalRow null", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await listExpiryAlerts("t1", { page: 1, pageSize: 10, alertLevel: 1, status: "PENDING", storeId: 1 });
    expect(res.total).toBe(0);
  });
});

// ============ handleExpiryAlert ============
describe("inventory-batch.service - handleExpiryAlert", () => {
  it("userId 有值（?? 左）", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await handleExpiryAlert("t1", 1, 100);
    expect(mockConn.execute).toHaveBeenCalled();
  });

  it("userId 为 null（?? 右）", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await handleExpiryAlert("t1", 1, null as any);
    expect(mockConn.execute).toHaveBeenCalled();
  });
});

// ============ getExpiryAlertStatistics ============
describe("inventory-batch.service - getExpiryAlertStatistics", () => {
  it("totalPending 有值", async () => {
    mocks.query
      .mockResolvedValueOnce([{ alert_level: 1, count: 5, pending_count: 3 }]) // stats
      .mockResolvedValueOnce([{ date: "2026-07-09", count: 2 }]); // trend
    mocks.queryOne.mockResolvedValue({ total: 3 });
    const res = await getExpiryAlertStatistics("t1");
    expect(res.totalPending).toBe(3);
    expect(res.byLevel).toHaveLength(1);
    expect(res.trend).toHaveLength(1);
  });

  it("totalPending 为 null（?? 右）", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await getExpiryAlertStatistics("t1");
    expect(res.totalPending).toBe(0);
  });
});

// ============ runExpiryScan ============
describe("inventory-batch.service - runExpiryScan", () => {
  it("tenantIds 为空时直接返回", async () => {
    mocks.query.mockResolvedValue([]);
    await runExpiryScan();
    expect(mockConn.execute).not.toHaveBeenCalled();
  });

  it("configs 为空时 continue", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await runExpiryScan();
    expect(mockConn.execute).not.toHaveBeenCalled();
  });

  it("batches 为空时 continue", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([{ days_before_expiry: 7, alert_level: 1, action: "WARN" }]);
      if (sql.includes("t_product_sku")) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await runExpiryScan();
    expect(mockConn.execute).not.toHaveBeenCalled();
  });

  it("daysRemaining < 0（UPDATE EXPIRED + continue）", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([{ days_before_expiry: 7, alert_level: 1, action: "WARN" }]);
      if (sql.includes("t_product_sku")) return Promise.resolve([{ id: 1, expiry_date: "2020-01-01", store_id: 1, sku_id: 1, sku_name: "A", batch_no: "B1" }]);
      return Promise.resolve([]);
    });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("DATEDIFF")) return Promise.resolve([[{ days_remaining: -5 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await runExpiryScan();
  });

  it("daysRemaining > config.days_before_expiry（&& 左 false，no match，continue）", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([{ days_before_expiry: 7, alert_level: 1, action: "WARN" }]);
      if (sql.includes("t_product_sku")) return Promise.resolve([{ id: 1, expiry_date: "2099-01-01", store_id: 1, sku_id: 1, sku_name: "A", batch_no: "B1" }]);
      return Promise.resolve([]);
    });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("DATEDIFF")) return Promise.resolve([[{ days_remaining: 100 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await runExpiryScan();
  });

  it("match + existing 有值（UPDATE days_remaining + continue）", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([{ days_before_expiry: 7, alert_level: 1, action: "WARN" }]);
      if (sql.includes("t_product_sku")) return Promise.resolve([{ id: 1, expiry_date: "2099-01-01", store_id: 1, sku_id: 1, sku_name: "A", batch_no: "B1" }]);
      return Promise.resolve([]);
    });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("DATEDIFF")) return Promise.resolve([[{ days_remaining: 5 }], undefined]);
      if (sql.includes("SELECT id FROM t_expiry_alert_record")) return Promise.resolve([[{ id: 99 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await runExpiryScan();
  });

  it("match + existing 无值 + action=WARN（INSERT，不 BLOCK）+ sku_name 有值（|| 左）", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([{ days_before_expiry: 7, alert_level: 1, action: "WARN" }]);
      if (sql.includes("t_product_sku")) return Promise.resolve([{ id: 1, expiry_date: "2099-01-01", store_id: 1, sku_id: 1, sku_name: "A", batch_no: "B1", production_date: "2026-01-01" }]);
      return Promise.resolve([]);
    });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("DATEDIFF")) return Promise.resolve([[{ days_remaining: 5 }], undefined]);
      if (sql.includes("SELECT id FROM t_expiry_alert_record")) return Promise.resolve([[], undefined]);
      if (sql.includes("INSERT INTO t_expiry_alert_record")) return Promise.resolve([{ insertId: 1 }, undefined]);
      return Promise.resolve([[], undefined]);
    });
    await runExpiryScan();
  });

  it("match + existing 无值 + action=BLOCK（INSERT + UPDATE batch）+ sku_name null（|| 右）", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([{ days_before_expiry: 7, alert_level: 1, action: "BLOCK" }]);
      if (sql.includes("t_product_sku")) return Promise.resolve([{ id: 1, expiry_date: "2099-01-01", store_id: 1, sku_id: 1, sku_name: null, batch_no: "B1", production_date: "2026-01-01" }]);
      return Promise.resolve([]);
    });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("DATEDIFF")) return Promise.resolve([[{ days_remaining: 5 }], undefined]);
      if (sql.includes("SELECT id FROM t_expiry_alert_record")) return Promise.resolve([[], undefined]);
      if (sql.includes("INSERT INTO t_expiry_alert_record")) return Promise.resolve([{ insertId: 1 }, undefined]);
      return Promise.resolve([[], undefined]);
    });
    await runExpiryScan();
  });

  it("DATEDIFF 返回空数组（?. 右分支 + ?? 右分支 → daysRemaining=0 → match）", async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes("DISTINCT")) return Promise.resolve([{ tenant_id: "t1" }]);
      if (sql.includes("t_expiry_alert_config")) return Promise.resolve([{ days_before_expiry: 7, alert_level: 1, action: "WARN" }]);
      if (sql.includes("t_product_sku")) return Promise.resolve([{ id: 1, expiry_date: "2099-01-01", store_id: 1, sku_id: 1, sku_name: "A", batch_no: "B1", production_date: "2026-01-01" }]);
      return Promise.resolve([]);
    });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("DATEDIFF")) return Promise.resolve([[], undefined]); // rows[0] 不存在
      if (sql.includes("SELECT id FROM t_expiry_alert_record")) return Promise.resolve([[], undefined]);
      if (sql.includes("INSERT INTO t_expiry_alert_record")) return Promise.resolve([{ insertId: 1 }, undefined]);
      return Promise.resolve([[], undefined]);
    });
    await runExpiryScan();
  });
});
