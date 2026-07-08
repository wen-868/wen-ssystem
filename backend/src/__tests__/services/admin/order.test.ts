/**
 * 销售订单 service 单元测试
 * 被测文件：src/services/store/order.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  completeOrderDelivery: vi.fn(),
  updateTraceCodesBySkuList: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

vi.mock("../../../shared/fulfillment.js", () => ({
  completeOrderDelivery: mocks.completeOrderDelivery,
}));

vi.mock("../../../shared/trace-code.js", () => ({
  updateTraceCodesBySkuList: mocks.updateTraceCodesBySkuList,
}));

import {
  listOrders,
  getOrderDetail,
  acceptOrder,
  startDelivery,
  completeDelivery,
  rejectOrder,
  cancelOrder,
} from "../../../services/store/order.service.js";

const mockConn = { query: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("IL20260709000001");
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
});

describe("order.service - listOrders", () => {
  it("total 有值（?. 左 + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ orderNo: "O1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listOrders({ page: 1, pageSize: 10, storeId: null, status: null, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ orderNo: "O1" }] });
  });

  it("total 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listOrders({ page: 1, pageSize: 10, storeId: 1, status: "PENDING", tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("order.service - getOrderDetail", () => {
  it("订单存在时返回带 items 的详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ orderNo: "O1" });
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1 }]);
    const res = await getOrderDetail("O1", "t1");
    expect(res).toEqual({ orderNo: "O1", items: [{ skuId: 1 }] });
  });

  it("订单不存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getOrderDetail("O1", "t1");
    expect(res).toBeNull();
  });
});

describe("order.service - acceptOrder", () => {
  it("affectedRows > 0 时成功", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await acceptOrder("O1", "t1");
    expect(res).toEqual({ orderNo: "O1", status: "ACCEPTED" });
  });

  it("result 为 null 时返回 null（!result 走 true）", async () => {
    mocks.queryWithTenant.mockResolvedValue(null);
    const res = await acceptOrder("O1", "t1");
    expect(res).toBeNull();
  });

  it("affectedRows === 0 时返回 null（|| 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 0 });
    const res = await acceptOrder("O1", "t1");
    expect(res).toBeNull();
  });
});

describe("order.service - startDelivery", () => {
  it("affectedRows > 0 + userId/username 有值（?? 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await startDelivery("O1", "t1", 10, "张三");
    expect(res).toEqual({ orderNo: "O1", status: "DELIVERING" });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });

  it("result 为 null 时返回 null", async () => {
    mocks.queryWithTenant.mockResolvedValue(null);
    const res = await startDelivery("O1", "t1", 10, "张三");
    expect(res).toBeNull();
  });

  it("affectedRows === 0 时返回 null", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 0 });
    const res = await startDelivery("O1", "t1", 10, "张三");
    expect(res).toBeNull();
  });

  it("userId/username 为 null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    await startDelivery("O1", "t1", null, null as unknown as string);
    const logCall = mocks.queryWithTenant.mock.calls[1];
    expect(logCall[1][0]).toBeNull();
    expect(logCall[1][1]).toBe("系统用户");
  });
});

describe("order.service - completeDelivery", () => {
  it("tenantId 存在 + skuIds 有值（if true + length > 0）", async () => {
    mocks.completeOrderDelivery.mockResolvedValue({ orderNo: "O1", status: "COMPLETED" });
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("tenant_id AS tenantId")) return Promise.resolve([[{ tenantId: "t1" }], undefined]);
      if (sql.includes("sku_id")) return Promise.resolve([[{ sku_id: 1 }, { sku_id: 2 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mocks.updateTraceCodesBySkuList.mockResolvedValue(undefined);
    const res = await completeDelivery("O1", 10);
    expect(res).toEqual({ orderNo: "O1", status: "COMPLETED" });
    expect(mocks.updateTraceCodesBySkuList).toHaveBeenCalledOnce();
  });

  it("tenantId 存在 + skuIds 为空（if true + length === 0）", async () => {
    mocks.completeOrderDelivery.mockResolvedValue({ orderNo: "O2", status: "COMPLETED" });
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("tenant_id AS tenantId")) return Promise.resolve([[{ tenantId: "t1" }], undefined]);
      if (sql.includes("sku_id")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await completeDelivery("O2", 10);
    expect(res).toEqual({ orderNo: "O2", status: "COMPLETED" });
    expect(mocks.updateTraceCodesBySkuList).not.toHaveBeenCalled();
  });

  it("tenantId 为空（if false 分支，?. 右）", async () => {
    mocks.completeOrderDelivery.mockResolvedValue({ orderNo: "O3", status: "COMPLETED" });
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("tenant_id AS tenantId")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    const res = await completeDelivery("O3", null);
    expect(res).toEqual({ orderNo: "O3", status: "COMPLETED" });
    expect(mocks.updateTraceCodesBySkuList).not.toHaveBeenCalled();
  });
});

describe("order.service - rejectOrder / cancelOrder（releaseOrderReservation）", () => {
  it("订单不存在时抛错", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(rejectOrder("O1", null, "t1")).rejects.toThrow("订单不存在或状态不可释放库存");
  });

  it("REJECTED + 有 items + qty > 0（status === REJECTED true）", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ order_no: "O1", store_id: 1 }], undefined]);
      if (sql.includes("reservedQty")) return Promise.resolve([[{ skuId: 1, reservedQty: 5 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mockConn.execute.mockResolvedValue([]);
    const res = await rejectOrder("O1", 10, "t1");
    expect(res).toEqual({ orderNo: "O1", status: "REJECTED" });
  });

  it("CANCELLED + qty 为 0 跳过（qty <= 0 continue + status === REJECTED false）", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ order_no: "O2", store_id: 1 }], undefined]);
      if (sql.includes("reservedQty")) return Promise.resolve([[{ skuId: 1, reservedQty: 0 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mockConn.execute.mockResolvedValue([]);
    const res = await cancelOrder("O2", 10, "t1");
    expect(res).toEqual({ orderNo: "O2", status: "CANCELLED" });
  });

  it("REJECTED + reservedQty 为 undefined（?? 0 右分支 + qty <= 0 continue）", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ order_no: "O3", store_id: 1 }], undefined]);
      if (sql.includes("reservedQty")) return Promise.resolve([[{ skuId: 1, reservedQty: undefined }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mockConn.execute.mockResolvedValue([]);
    const res = await rejectOrder("O3", 10, "t1");
    expect(res).toEqual({ orderNo: "O3", status: "REJECTED" });
  });

  it("CANCELLED + qty > 0（status === REJECTED false 分支 + ORDER_CANCEL + 订单取消释放占用库存）", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ order_no: "O4", store_id: 1 }], undefined]);
      if (sql.includes("reservedQty")) return Promise.resolve([[{ skuId: 1, reservedQty: 3 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mockConn.execute.mockResolvedValue([]);
    const res = await cancelOrder("O4", 10, "t1");
    expect(res).toEqual({ orderNo: "O4", status: "CANCELLED" });
  });
});
