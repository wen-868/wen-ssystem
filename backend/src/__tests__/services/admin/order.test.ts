﻿﻿﻿﻿﻿/**
 * 管理端订单 service 单元测试
 * 被测文件：src/services/admin/order.service.ts
 * 覆盖全部 12 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  listOrders,
  exportOrdersCsv,
  getOrderDetail,
  getOrderStatusStats,
  listSaleBills,
  exportSaleBillsCsv,
  validateStatusTransition,
  cancelOrder,
  remarkOrder,
  updateOrderStatus,
  batchUpdateOrderStatus,
  getOrderOperationLogs,
} from "../../../services/admin/order.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("LOG20260709000001");
  mocks.transaction.mockImplementation(async (cb: (conn: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ============ listOrders ============
describe("admin order.service - listOrders", () => {
  it("全部筛选条件有值 + total 有值（?. 左 + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ orderNo: "O1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listOrders(1, 10, "张三", "PENDING", "2026-01-01", "2026-12-31", "t1");
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ orderNo: "O1" }] });
    // 验证 queryWithTenant 参数包含全部筛选条件（tenantId + like*3 + status + dateStart + dateEnd + pageSize + offset）
    const callArgs = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(callArgs.length).toBe(9);
  });

  it("无筛选条件 + totalRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listOrders(1, 10, "", "", "", "", "t1");
    expect(res.total).toBe(0);
    expect(res.records).toEqual([]);
  });
});

// ============ exportOrdersCsv ============
describe("admin order.service - exportOrdersCsv", () => {
  it("全部筛选条件有值 + 有数据（escapeCsv 正常分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      {
        orderNo: "O1", storeId: 1, customerType: "WHOLESALE", fulfillmentType: "DELIVERY",
        orderStatus: "COMPLETED", payStatus: "PAID", payableAmount: 100,
        receiverName: "张三", receiverMobile: "13800000000", createdAt: "2026-01-01",
      },
    ]);
    const res = await exportOrdersCsv("张三", "PENDING", "2026-01-01", "2026-12-31", "t1");
    expect(res.csv.startsWith("\uFEFF")).toBe(true);
    expect(res.csv).toContain("订单号");
    expect(res.csv).toContain("O1");
    expect(res.filename).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("无筛选条件 + 无数据（escapeCsv value 为 undefined → 空字符串分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await exportOrdersCsv("", "", "", "", "t1");
    expect(res.csv).toContain("订单号");
    // 只有 header 行，无数据行
    const lines = res.csv.split("\n");
    expect(lines.length).toBe(1);
  });

  it("数据含双引号时转义（replace 引号转义分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      {
        orderNo: "O2", storeId: 1, customerType: "RETAIL", fulfillmentType: "PICKUP",
        orderStatus: "PENDING", payStatus: "UNPAID", payableAmount: 50,
        receiverName: '李"四', receiverMobile: "13900000000", createdAt: "2026-02-01",
      },
    ]);
    const res = await exportOrdersCsv("", "", "", "", "t1");
    expect(res.csv).toContain('李""四');
  });

  it("字段含 null/undefined 时 escapeCsv 使用空字符串（value ?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      {
        orderNo: "O3", storeId: null, customerType: undefined, fulfillmentType: null,
        orderStatus: "PENDING", payStatus: "UNPAID", payableAmount: null,
        receiverName: null, receiverMobile: undefined, createdAt: null,
      },
    ]);
    const res = await exportOrdersCsv("", "", "", "", "t1");
    // null/undefined 字段应被转为空字符串 ""，而非 "null"
    expect(res.csv).not.toContain("null");
    expect(res.csv).toContain('""');
  });
});

// ============ getOrderDetail ============
describe("admin order.service - getOrderDetail", () => {
  it("订单存在时返回带 items 的详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ orderNo: "O1" });
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, skuName: "茅台" }]);
    const res = await getOrderDetail("O1", "t1");
    expect(res).toEqual({ orderNo: "O1", items: [{ skuId: 1, skuName: "茅台" }] });
  });

  it("订单不存在时返回 null（!order 走 true 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getOrderDetail("O1", "t1");
    expect(res).toBeNull();
    // items 查询不应被调用
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });
});

// ============ getOrderStatusStats ============
describe("admin order.service - getOrderStatusStats", () => {
  it("返回状态统计列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { status: "PENDING", count: 5 },
      { status: "COMPLETED", count: 3 },
    ]);
    const res = await getOrderStatusStats("t1");
    expect(res).toEqual([
      { status: "PENDING", count: 5 },
      { status: "COMPLETED", count: 3 },
    ]);
  });
});

// ============ listSaleBills ============
describe("admin order.service - listSaleBills", () => {
  it("全部筛选条件有值 + total 有值（?. 左 + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ billNo: "XS1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listSaleBills(1, 10, "张三", "PAID", "2026-01-01", "2026-12-31", "t1");
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ billNo: "XS1" }] });
  });

  it("无筛选条件 + totalRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listSaleBills(1, 10, "", "", "", "", "t1");
    expect(res.total).toBe(0);
    expect(res.records).toEqual([]);
  });
});

// ============ exportSaleBillsCsv ============
describe("admin order.service - exportSaleBillsCsv", () => {
  it("全部筛选条件有值 + 有数据", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      {
        billNo: "XS1", storeId: 1, customerName: "张三", customerMobile: "13800000000",
        receivableAmount: 100, receivedAmount: 100, unreceivedAmount: 0,
        collectionStatus: "PAID", businessStatus: "COMPLETED", createdAt: "2026-01-01",
      },
    ]);
    const res = await exportSaleBillsCsv("张三", "PAID", "2026-01-01", "2026-12-31", "t1");
    expect(res.csv.startsWith("\uFEFF")).toBe(true);
    expect(res.csv).toContain("销售单号");
    expect(res.csv).toContain("XS1");
    expect(res.filename).toMatch(/^sale-bills-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("无筛选条件 + 无数据", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await exportSaleBillsCsv("", "", "", "", "t1");
    expect(res.csv).toContain("销售单号");
    expect(res.csv.split("\n").length).toBe(1);
  });

  it("字段含 null/undefined 时 escapeCsv 使用空字符串（value ?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      {
        billNo: "XS2", storeId: null, customerName: undefined, customerMobile: null,
        receivableAmount: null, receivedAmount: undefined, unreceivedAmount: null,
        collectionStatus: null, businessStatus: undefined, createdAt: null,
      },
    ]);
    const res = await exportSaleBillsCsv("", "", "", "", "t1");
    expect(res.csv).not.toContain("null");
    expect(res.csv).toContain('""');
  });
});

// ============ validateStatusTransition ============
describe("admin order.service - validateStatusTransition", () => {
  it("合法转换 PENDING → ACCEPTED 返回 true（allowed 存在 + includes true）", () => {
    expect(validateStatusTransition("PENDING", "ACCEPTED")).toBe(true);
  });

  it("非法转换 PENDING → COMPLETED 返回 false（allowed 存在 + includes false）", () => {
    expect(validateStatusTransition("PENDING", "COMPLETED")).toBe(false);
  });

  it("from 不存在返回 false（allowed 为 undefined → 三元 false 分支）", () => {
    expect(validateStatusTransition("UNKNOWN", "ACCEPTED")).toBe(false);
  });

  it("COMPLETED 无后续状态（空数组 includes false）", () => {
    expect(validateStatusTransition("COMPLETED", "CANCELLED")).toBe(false);
  });
});

// ============ cancelOrder ============
describe("admin order.service - cancelOrder", () => {
  it("订单不存在时抛错（!order true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(cancelOrder("O1", "原因", 1, "admin", "t1")).rejects.toThrow("订单不存在");
  });

  it("订单已取消时抛错（order_status === CANCELLED true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "CANCELLED" });
    await expect(cancelOrder("O1", "原因", 1, "admin", "t1")).rejects.toThrow("订单已取消");
  });

  it("订单已完成时抛错（order_status === COMPLETED true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "COMPLETED" });
    await expect(cancelOrder("O1", "原因", 1, "admin", "t1")).rejects.toThrow("已完成订单无法取消");
  });

  it("正常取消 + 有 items（for 循环执行）+ reason 有值 + operatorId 有值", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "PENDING" });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("SELECT sku_id, qty")) {
        return Promise.resolve([[{ sku_id: 1, qty: 5 }, { sku_id: 2, qty: 3 }], undefined]);
      }
      return Promise.resolve([]);
    });
    const res = await cancelOrder("O1", "客户取消", 1, "admin", "t1");
    expect(res).toEqual({ orderNo: "O1", status: "CANCELLED" });
    expect(mocks.makeBizNo).toHaveBeenCalledWith("LOG");
    // 验证库存释放 UPDATE 被调用（2 个 item）
    const invUpdates = mockConn.execute.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes("UPDATE t_inventory_balance")
    );
    expect(invUpdates.length).toBe(2);
  });

  it("正常取消 + items 为空（for 循环不执行）+ reason 无值（|| 右分支）+ operatorId 为 null（?? 0 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "ACCEPTED" });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("SELECT sku_id, qty")) {
        return Promise.resolve([[], undefined]);
      }
      return Promise.resolve([]);
    });
    const res = await cancelOrder("O2", "", null, "admin", "t1");
    expect(res).toEqual({ orderNo: "O2", status: "CANCELLED" });
    // 验证库存释放 UPDATE 未被调用
    const invUpdates = mockConn.execute.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes("UPDATE t_inventory_balance")
    );
    expect(invUpdates.length).toBe(0);
    // 验证 INSERT log 使用了默认 reason 和 operatorId ?? 0
    const logInserts = mockConn.execute.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes("INSERT INTO t_operation_log")
    );
    expect(logInserts.length).toBe(1);
    const logParams = logInserts[0][1] as unknown[];
    expect(logParams[2]).toBe(0);             // operatorId ?? 0
    expect(logParams[4]).toBe("管理员取消订单"); // reason || "管理员取消订单"
  });
});

// ============ remarkOrder ============
describe("admin order.service - remarkOrder", () => {
  it("订单不存在时抛错（!order true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(remarkOrder("O1", "备注", 1, "admin", "t1")).rejects.toThrow("订单不存在");
  });

  it("正常备注（!order false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "PENDING" });
    mockConn.execute.mockResolvedValue([]);
    const res = await remarkOrder("O1", "加急处理", 1, "admin", "t1");
    expect(res).toEqual({ orderNo: "O1", remark: "加急处理" });
    expect(mocks.makeBizNo).toHaveBeenCalledWith("LOG");
  });

  it("operatorId 为 null 时使用默认值 0（?? 0 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "PENDING" });
    mockConn.execute.mockResolvedValue([]);
    const res = await remarkOrder("O2", "备注", null, "admin", "t1");
    expect(res).toEqual({ orderNo: "O2", remark: "备注" });
    const logInserts = mockConn.execute.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes("INSERT INTO t_operation_log")
    );
    expect(logInserts.length).toBe(1);
    const logParams = logInserts[0][1] as unknown[];
    expect(logParams[2]).toBe(0); // operatorId ?? 0
  });
});

// ============ updateOrderStatus ============
describe("admin order.service - updateOrderStatus", () => {
  it("订单不存在时抛错（!order true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateOrderStatus("O1", "ACCEPTED", 1, "admin", null, "t1")).rejects.toThrow("订单不存在");
  });

  it("非法状态转换时抛错（!validateStatusTransition true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "COMPLETED" });
    await expect(updateOrderStatus("O1", "ACCEPTED", 1, "admin", null, "t1"))
      .rejects.toThrow("订单状态不能从 COMPLETED 变更为 ACCEPTED");
  });

  it("合法转换 + remark 有值（|| 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "PENDING" });
    mockConn.execute.mockResolvedValue([]);
    const res = await updateOrderStatus("O1", "ACCEPTED", 1, "admin", "手动接单", "t1");
    expect(res).toEqual({ orderNo: "O1", fromStatus: "PENDING", toStatus: "ACCEPTED" });
  });

  it("合法转换 + remark 无值 + operatorId 为 null（|| 右分支 + ?? 0 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ order_status: "ACCEPTED" });
    mockConn.execute.mockResolvedValue([]);
    const res = await updateOrderStatus("O2", "DELIVERING", null, "admin", null, "t1");
    expect(res).toEqual({ orderNo: "O2", fromStatus: "ACCEPTED", toStatus: "DELIVERING" });
    // 验证 INSERT log 使用了默认 remark 和 operatorId ?? 0
    const logInserts = mockConn.execute.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes("INSERT INTO t_operation_log")
    );
    expect(logInserts.length).toBe(1);
    const logParams = logInserts[0][1] as unknown[];
    expect(logParams[2]).toBe(0); // operatorId ?? 0
    expect(logParams[4]).toBe("状态变更: ACCEPTED -> DELIVERING");
  });
});

// ============ batchUpdateOrderStatus ============
describe("admin order.service - batchUpdateOrderStatus", () => {
  it("全部成功（try 成功分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ order_status: "PENDING" })
      .mockResolvedValueOnce({ order_status: "PENDING" });
    mockConn.execute.mockResolvedValue([]);
    const res = await batchUpdateOrderStatus(["O1", "O2"], "ACCEPTED", 1, "admin", "t1");
    expect(res.total).toBe(2);
    expect(res.successCount).toBe(2);
    expect(res.results[0]).toEqual({ orderNo: "O1", success: true });
    expect(res.results[1]).toEqual({ orderNo: "O2", success: true });
  });

  it("部分成功部分失败（O1 成功 + O2 订单不存在 + O3 状态非法，catch 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ order_status: "PENDING" })   // O1 成功
      .mockResolvedValueOnce(null)                            // O2 订单不存在
      .mockResolvedValueOnce({ order_status: "COMPLETED" }); // O3 非法转换
    mockConn.execute.mockResolvedValue([]);
    const res = await batchUpdateOrderStatus(["O1", "O2", "O3"], "ACCEPTED", 1, "admin", "t1");
    expect(res.total).toBe(3);
    expect(res.successCount).toBe(1);
    expect(res.results[0]).toEqual({ orderNo: "O1", success: true });
    expect(res.results[1]).toEqual({ orderNo: "O2", success: false, error: "订单不存在" });
    expect(res.results[2].success).toBe(false);
    expect(res.results[2].error).toContain("订单状态不能从");
  });

  it("空数组（for 循环不执行）", async () => {
    const res = await batchUpdateOrderStatus([], "ACCEPTED", 1, "admin", "t1");
    expect(res).toEqual({ results: [], total: 0, successCount: 0 });
  });
});

// ============ getOrderOperationLogs ============
describe("admin order.service - getOrderOperationLogs", () => {
  it("返回操作日志列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { logNo: "L1", module: "ORDER", action: "CANCEL", bizNo: "O1", operatorId: 1, operatorName: "admin", remark: "取消", createdAt: "2026-01-01" },
    ]);
    const res = await getOrderOperationLogs("O1", "t1");
    expect(res).toEqual([
      { logNo: "L1", module: "ORDER", action: "CANCEL", bizNo: "O1", operatorId: 1, operatorName: "admin", remark: "取消", createdAt: "2026-01-01" },
    ]);
  });
});
