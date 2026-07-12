﻿﻿﻿﻿﻿/**
 * 库存盘点 service 单元测试
 * 被测文件：src/services/admin/stock-check.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  createCheck,
  listChecks,
  getStatistics,
  getCheckDetail,
  updateCheck,
  startCheck,
  completeCheck,
  cancelCheck,
  handleDiff,
  listMyChecks,
  getMyCheckDetail,
  updateItemQty,
  submitCheck,
} from "../../../services/admin/stock-check.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("PD20260709000001");
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
});

// ============ createCheck ============
describe("stock-check.service - createCheck", () => {
  it("成功创建", async () => {
    mockConn.execute.mockResolvedValue([{ insertId: 1 }, undefined]);
    const res = await createCheck({ storeId: 1, remark: "盘点", tenantId: "t1" });
    expect(res).toEqual({ checkId: 1, checkNo: "PD20260709000001" });
  });
});

// ============ listChecks ============
describe("stock-check.service - listChecks", () => {
  it("无可选条件 + totalRow 有值", async () => {
    mocks.query.mockResolvedValue([{ id: 1 }]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listChecks({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1 }] });
  });

  it("有 storeId + status + totalRow 为 null", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await listChecks({ page: 1, pageSize: 10, tenantId: "t1", storeId: 1, status: "DRAFT" });
    expect(res.total).toBe(0);
  });
});

// ============ getStatistics ============
describe("stock-check.service - getStatistics", () => {
  it("各字段有值", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ total: 10 })   // monthTotal
      .mockResolvedValueOnce({ total: 3 })     // diffCount
      .mockResolvedValueOnce({ total: 500 });   // diffAmount
    const res = await getStatistics("t1");
    expect(res).toEqual({ monthTotal: 10, diffCount: 3, diffAmount: 500 });
  });

  it("各字段为 null（?? 右）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getStatistics("t1");
    expect(res).toEqual({ monthTotal: 0, diffCount: 0, diffAmount: 0 });
  });
});

// ============ getCheckDetail ============
describe("stock-check.service - getCheckDetail", () => {
  it("盘点单存在", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1 });
    mocks.query.mockResolvedValue([{ id: 10 }]);
    const res = await getCheckDetail(1, "t1");
    expect(res).toEqual({ id: 1, items: [{ id: 10 }] });
  });

  it("盘点单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getCheckDetail(1, "t1")).rejects.toMatchObject({
      message: "盘点单不存在", statusCode: 404,
    });
  });
});

// ============ updateCheck ============
describe("stock-check.service - updateCheck", () => {
  it("盘点单不存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await expect(updateCheck(1, "t1", { remark: "test" })).rejects.toThrow("盘点单不存在");
  });

  it("状态非 DRAFT 时抛错", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "CHECKING" }], undefined]);
    await expect(updateCheck(1, "t1", { remark: "test" })).rejects.toThrow("仅草稿状态可编辑");
  });

  it("成功更新 remark（body.remark !== undefined true）", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "DRAFT" }], undefined]);
    const res = await updateCheck(1, "t1", { remark: "新备注" });
    expect(res).toEqual({ checkId: 1 });
  });

  it("remark 为 undefined 时不更新（body.remark !== undefined false）", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "DRAFT" }], undefined]);
    const res = await updateCheck(1, "t1", {} as any);
    expect(res).toEqual({ checkId: 1 });
    // 只有一次 execute（SELECT），没有 UPDATE
    expect(mockConn.execute).toHaveBeenCalledTimes(1);
  });
});

// ============ startCheck ============
describe("stock-check.service - startCheck", () => {
  it("盘点单不存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await expect(startCheck(1, "t1")).rejects.toThrow("盘点单不存在");
  });

  it("状态非 DRAFT 时抛错", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "COMPLETED", store_id: 1 }], undefined]);
    await expect(startCheck(1, "t1")).rejects.toThrow("仅草稿状态可开始盘点");
  });

  it("成功开始盘点 + skuRows 有值（循环执行）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "DRAFT", store_id: 1 }], undefined]);
      if (sql.includes("t_inventory_batch")) return Promise.resolve([[{ sku_id: 1, sku_name: "A", batch_no: "B1", quantity: 10 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await startCheck(1, "t1");
    expect(res).toEqual({ checkId: 1 });
  });

  it("成功开始盘点 + skuRows 为空（循环不执行）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "DRAFT", store_id: 1 }], undefined]);
      if (sql.includes("t_inventory_batch")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await startCheck(1, "t1");
    expect(res).toEqual({ checkId: 1 });
  });

  it("成功开始盘点 + sku_name/batch_no 为 null（|| 右分支）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "DRAFT", store_id: 1 }], undefined]);
      if (sql.includes("t_inventory_batch")) return Promise.resolve([[{ sku_id: 1, sku_name: null, batch_no: null, quantity: 5 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await startCheck(1, "t1");
    expect(res).toEqual({ checkId: 1 });
  });
});

// ============ completeCheck ============
describe("stock-check.service - completeCheck", () => {
  it("盘点单不存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await expect(completeCheck(1, "t1")).rejects.toThrow("盘点单不存在");
  });

  it("状态非 CHECKING 时抛错", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "DRAFT" }], undefined]);
    await expect(completeCheck(1, "t1")).rejects.toThrow("仅盘点中状态可完成");
  });

  it("成功完成盘点", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "CHECKING" }], undefined]);
      if (sql.includes("COUNT(*)")) return Promise.resolve([[{ total_sku: 5, diff_sku: 2, diff_amount: 100 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await completeCheck(1, "t1");
    expect(res).toEqual({ checkId: 1 });
  });
});

// ============ cancelCheck ============
describe("stock-check.service - cancelCheck", () => {
  it("盘点单不存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await expect(cancelCheck(1, "t1")).rejects.toThrow("盘点单不存在");
  });

  it("状态为 COMPLETED 时抛错（&& 全 true）", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "COMPLETED" }], undefined]);
    await expect(cancelCheck(1, "t1")).rejects.toThrow("仅草稿或盘点中状态可取消");
  });

  it("状态为 DRAFT 时成功取消（&& 左 false）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "DRAFT" }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await cancelCheck(1, "t1");
    expect(res).toEqual({ checkId: 1 });
  });

  it("状态为 CHECKING 时成功取消（&& 右 false）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "CHECKING" }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await cancelCheck(1, "t1");
    expect(res).toEqual({ checkId: 1 });
  });
});

// ============ handleDiff ============
describe("stock-check.service - handleDiff", () => {
  it("盘点单不存在时抛错", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check") && sql.includes("FOR UPDATE")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: 1 })).rejects.toThrow("盘点单不存在");
  });

  it("状态非 COMPLETED 时抛错", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check") && sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "CHECKING", store_id: 1 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: 1 })).rejects.toThrow("仅已完成状态可处理差异");
  });

  it("明细不存在时抛错", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check_item")) return Promise.resolve([[], undefined]);
      if (sql.includes("stock_check")) return Promise.resolve([[{ id: 1, status: "COMPLETED", store_id: 1 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: 1 })).rejects.toThrow("明细不存在");
  });

  it("差异已处理时抛错（item.handled true）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check_item")) return Promise.resolve([[{ id: 1, handled: 1, diff_qty: 5, sku_id: 1 }], undefined]);
      if (sql.includes("stock_check")) return Promise.resolve([[{ id: 1, status: "COMPLETED", store_id: 1 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: 1 })).rejects.toThrow("该差异已处理");
  });

  it("无差异时抛错（diff_qty === 0）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check_item")) return Promise.resolve([[{ id: 1, handled: 0, diff_qty: 0, sku_id: 1 }], undefined]);
      if (sql.includes("stock_check")) return Promise.resolve([[{ id: 1, status: "COMPLETED", store_id: 1 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: 1 })).rejects.toThrow("无差异需要处理");
  });

  it("inv 有值 + diffQty > 0（STOCK_CHECK_IN + UPDATE inv + userId 有值）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check_item")) return Promise.resolve([[{ id: 1, handled: 0, diff_qty: 5, sku_id: 1, sku_name: "A" }], undefined]);
      if (sql.includes("stock_check")) return Promise.resolve([[{ id: 1, status: "COMPLETED", store_id: 1, check_no: "PD1" }], undefined]);
      if (sql.includes("t_inventory_balance")) return Promise.resolve([[{ id: 1, available_qty: 10 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: 1 });
    expect(res).toEqual({ checkId: 1 });
  });

  it("inv 无值 + diffQty > 0（INSERT inv + STOCK_CHECK_IN + userId 无值）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check_item")) return Promise.resolve([[{ id: 1, handled: 0, diff_qty: 3, sku_id: 2, sku_name: "B" }], undefined]);
      if (sql.includes("stock_check")) return Promise.resolve([[{ id: 1, status: "COMPLETED", store_id: 1, check_no: "PD1" }], undefined]);
      if (sql.includes("t_inventory_balance")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: null as any });
    expect(res).toEqual({ checkId: 1 });
  });

  it("inv 无值 + diffQty < 0（不 INSERT inv + STOCK_CHECK_OUT）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check_item")) return Promise.resolve([[{ id: 1, handled: 0, diff_qty: -2, sku_id: 3, sku_name: "C" }], undefined]);
      if (sql.includes("stock_check")) return Promise.resolve([[{ id: 1, status: "COMPLETED", store_id: 1, check_no: "PD1" }], undefined]);
      if (sql.includes("t_inventory_balance")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await handleDiff({ checkId: 1, itemId: 1, tenantId: "t1", userId: 1 });
    expect(res).toEqual({ checkId: 1 });
  });
});

// ============ listMyChecks ============
describe("stock-check.service - listMyChecks", () => {
  it("返回门店盘点列表", async () => {
    mocks.query.mockResolvedValue([{ id: 1 }]);
    const res = await listMyChecks(1, "t1");
    expect(res).toEqual([{ id: 1 }]);
  });
});

// ============ getMyCheckDetail ============
describe("stock-check.service - getMyCheckDetail", () => {
  it("盘点单存在", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1 });
    mocks.query.mockResolvedValue([{ id: 10 }]);
    const res = await getMyCheckDetail(1, "t1");
    expect(res).toEqual({ id: 1, items: [{ id: 10 }] });
  });

  it("盘点单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getMyCheckDetail(1, "t1")).rejects.toMatchObject({
      message: "盘点单不存在", statusCode: 404,
    });
  });
});

// ============ updateItemQty ============
describe("stock-check.service - updateItemQty", () => {
  it("盘点单不存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await expect(updateItemQty({ checkId: 1, itemId: 1, actualQty: 5, tenantId: "t1" })).rejects.toThrow("盘点单不存在");
  });

  it("状态非 CHECKING 时抛错", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "DRAFT" }], undefined]);
    await expect(updateItemQty({ checkId: 1, itemId: 1, actualQty: 5, tenantId: "t1" })).rejects.toThrow("仅盘点中状态可录入");
  });

  it("明细不存在时抛错", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check_item")) return Promise.resolve([[], undefined]);
      if (sql.includes("stock_check")) return Promise.resolve([[{ id: 1, status: "CHECKING" }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(updateItemQty({ checkId: 1, itemId: 1, actualQty: 5, tenantId: "t1" })).rejects.toThrow("明细不存在");
  });

  it("成功录入 + cost_price 有值（?. 左 + ?? 左）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check") && sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "CHECKING" }], undefined]);
      if (sql.includes("stock_check_item") && sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, sku_id: 1, system_qty: 10 }], undefined]);
      if (sql.includes("t_product_sku")) return Promise.resolve([[{ cost_price: 20 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await updateItemQty({ checkId: 1, itemId: 1, actualQty: 8, tenantId: "t1" });
    expect(res).toEqual({ checkId: 1, itemId: 1 });
  });

  it("cost_price 为空（?. 右 + ?? 右）", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("stock_check") && sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "CHECKING" }], undefined]);
      if (sql.includes("stock_check_item") && sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, sku_id: 1, system_qty: 10 }], undefined]);
      if (sql.includes("t_product_sku")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await updateItemQty({ checkId: 1, itemId: 1, actualQty: 10, tenantId: "t1" });
    expect(res).toEqual({ checkId: 1, itemId: 1 });
  });
});

// ============ submitCheck ============
describe("stock-check.service - submitCheck", () => {
  it("盘点单不存在时抛错", async () => {
    mockConn.execute.mockResolvedValue([[], undefined]);
    await expect(submitCheck(1, "t1")).rejects.toThrow("盘点单不存在");
  });

  it("状态非 CHECKING 时抛错", async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1, status: "DRAFT" }], undefined]);
    await expect(submitCheck(1, "t1")).rejects.toThrow("仅盘点中状态可提交");
  });

  it("成功提交", async () => {
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ id: 1, status: "CHECKING" }], undefined]);
      if (sql.includes("COUNT(*)")) return Promise.resolve([[{ total_sku: 3, diff_sku: 1, diff_amount: 50 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await submitCheck(1, "t1");
    expect(res).toEqual({ checkId: 1 });
  });
});
