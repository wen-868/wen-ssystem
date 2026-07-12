import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/order.service", () => ({
  listOrders: vi.fn(),
  exportOrdersCsv: vi.fn(),
  getOrderDetail: vi.fn(),
  getOrderStatusStats: vi.fn(),
  listSaleBills: vi.fn(),
  exportSaleBillsCsv: vi.fn(),
  cancelOrder: vi.fn(),
  remarkOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  batchUpdateOrderStatus: vi.fn(),
  getOrderOperationLogs: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as orderService from "../../../services/admin/order.service";
import { ok, fail } from "../../../shared/response";
import {
  listOrders, exportOrdersCsv, getOrderDetail, getOrderStatusStats,
  listSaleBills, exportSaleBillsCsv, cancelOrder, remarkOrder,
  updateOrderStatus, batchUpdateOrderStatus, getOrderOperationLogs
} from "../../../controllers/admin/order.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("order.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listOrders - 应返回订单列表", async () => {
    (orderService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 10 } });
    const res = mockRes();
    await listOrders(req as any, res as any);
    expect(orderService.listOrders).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getOrderDetail - 订单不存在应返回404", async () => {
    (orderService.getOrderDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { orderNo: "ORD999" } });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("getOrderDetail - 应返回订单详情", async () => {
    (orderService.getOrderDetail as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getOrderStatusStats - 应返回状态统计", async () => {
    (orderService.getOrderStatusStats as any).mockResolvedValue({ PENDING: 10 });
    const req = mockReq();
    const res = mockRes();
    await getOrderStatusStats(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("cancelOrder - 应取消订单", async () => {
    (orderService.cancelOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" }, body: { reason: "测试取消" } });
    const res = mockRes();
    await cancelOrder(req as any, res as any);
    expect(orderService.cancelOrder).toHaveBeenCalledWith("ORD001", "测试取消", 1, "admin", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("remarkOrder - 应备注订单", async () => {
    (orderService.remarkOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" }, body: { remark: "测试备注" } });
    const res = mockRes();
    await remarkOrder(req as any, res as any);
    expect(orderService.remarkOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateOrderStatus - 应更新订单状态", async () => {
    (orderService.updateOrderStatus as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" }, body: { status: "SHIPPED" } });
    const res = mockRes();
    await updateOrderStatus(req as any, res as any);
    expect(orderService.updateOrderStatus).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("batchUpdateOrderStatus - 空列表应抛出校验错误", async () => {
    const req = mockReq({ body: { orderNos: [], status: "SHIPPED" } });
    const res = mockRes();
    await expect(batchUpdateOrderStatus(req as any, res as any)).rejects.toThrow();
  });

  it("batchUpdateOrderStatus - 应批量更新状态", async () => {
    (orderService.batchUpdateOrderStatus as any).mockResolvedValue({ success: 5 });
    const req = mockReq({ body: { orderNos: ["ORD001", "ORD002"], status: "SHIPPED" } });
    const res = mockRes();
    await batchUpdateOrderStatus(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("exportOrdersCsv - 应导出CSV", async () => {
    (orderService.exportOrdersCsv as any).mockResolvedValue({ filename: "orders.csv", csv: "data" });
    const req = mockReq();
    const res = mockRes();
    await exportOrdersCsv(req as any, res as any);
    expect(res.setHeader).toHaveBeenCalledWith("content-type", "text/csv; charset=utf-8");
    expect(res.send).toHaveBeenCalledWith("data");
  });

  it("listSaleBills - 应返回销售单列表", async () => {
    (orderService.listSaleBills as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 10 } });
    const res = mockRes();
    await listSaleBills(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getOrderOperationLogs - 应返回操作日志", async () => {
    (orderService.getOrderOperationLogs as any).mockResolvedValue([]);
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await getOrderOperationLogs(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("listOrders - 不传page/pageSize时使用默认值", async () => {
    (orderService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listOrders(req as any, res as any);
    expect(orderService.listOrders).toHaveBeenCalledWith(1, 20, "", "", "", "", "t1");
  });

  it("listOrders - 传全部参数时正确解析", async () => {
    (orderService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 2, pageSize: 50, keyword: "test", status: "PENDING", dateStart: "2024-01-01", dateEnd: "2024-12-31" } });
    const res = mockRes();
    await listOrders(req as any, res as any);
    expect(orderService.listOrders).toHaveBeenCalledWith(2, 50, "test", "PENDING", "2024-01-01", "2024-12-31", "t1");
  });

  it("exportOrdersCsv - 传全部参数时正确解析", async () => {
    (orderService.exportOrdersCsv as any).mockResolvedValue({ filename: "orders.csv", csv: "data" });
    const req = mockReq({ query: { keyword: "test", status: "PENDING", dateStart: "2024-01-01", dateEnd: "2024-12-31" } });
    const res = mockRes();
    await exportOrdersCsv(req as any, res as any);
    expect(orderService.exportOrdersCsv).toHaveBeenCalledWith("test", "PENDING", "2024-01-01", "2024-12-31", "t1");
  });

  it("listSaleBills - 不传page/pageSize时使用默认值", async () => {
    (orderService.listSaleBills as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listSaleBills(req as any, res as any);
    expect(orderService.listSaleBills).toHaveBeenCalledWith(1, 20, "", "", "", "", "t1");
  });

  it("listSaleBills - 传全部参数时正确解析", async () => {
    (orderService.listSaleBills as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 2, pageSize: 50, keyword: "test", status: "PAID", dateStart: "2024-01-01", dateEnd: "2024-12-31" } });
    const res = mockRes();
    await listSaleBills(req as any, res as any);
    expect(orderService.listSaleBills).toHaveBeenCalledWith(2, 50, "test", "PAID", "2024-01-01", "2024-12-31", "t1");
  });

  it("exportSaleBillsCsv - 应导出销售单CSV", async () => {
    (orderService.exportSaleBillsCsv as any).mockResolvedValue({ filename: "sale-bills.csv", csv: "data" });
    const req = mockReq();
    const res = mockRes();
    await exportSaleBillsCsv(req as any, res as any);
    expect(res.setHeader).toHaveBeenCalledWith("content-type", "text/csv; charset=utf-8");
    expect(res.send).toHaveBeenCalledWith("data");
  });

  it("exportSaleBillsCsv - 传全部参数时正确解析", async () => {
    (orderService.exportSaleBillsCsv as any).mockResolvedValue({ filename: "sale-bills.csv", csv: "data" });
    const req = mockReq({ query: { keyword: "test", status: "PAID", dateStart: "2024-01-01", dateEnd: "2024-12-31" } });
    const res = mockRes();
    await exportSaleBillsCsv(req as any, res as any);
    expect(orderService.exportSaleBillsCsv).toHaveBeenCalledWith("test", "PAID", "2024-01-01", "2024-12-31", "t1");
  });

  it("cancelOrder - user无id/username时使用默认值", async () => {
    (orderService.cancelOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" }, body: { reason: "测试取消" }, user: {} });
    const res = mockRes();
    await cancelOrder(req as any, res as any);
    expect(orderService.cancelOrder).toHaveBeenCalledWith("ORD001", "测试取消", null, "系统用户", "t1");
  });

  it("remarkOrder - user无id/username时使用默认值", async () => {
    (orderService.remarkOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" }, body: { remark: "测试备注" }, user: {} });
    const res = mockRes();
    await remarkOrder(req as any, res as any);
    expect(orderService.remarkOrder).toHaveBeenCalledWith("ORD001", "测试备注", null, "系统用户", "t1");
  });

  it("updateOrderStatus - 传remark且user无id时使用默认值", async () => {
    (orderService.updateOrderStatus as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" }, body: { status: "SHIPPED", remark: "测试备注" }, user: {} });
    const res = mockRes();
    await updateOrderStatus(req as any, res as any);
    expect(orderService.updateOrderStatus).toHaveBeenCalledWith("ORD001", "SHIPPED", null, "系统用户", "测试备注", "t1");
  });

  it("batchUpdateOrderStatus - user无id/username时使用默认值", async () => {
    (orderService.batchUpdateOrderStatus as any).mockResolvedValue({ success: 5 });
    const req = mockReq({ body: { orderNos: ["ORD001", "ORD002"], status: "SHIPPED" }, user: {} });
    const res = mockRes();
    await batchUpdateOrderStatus(req as any, res as any);
    expect(orderService.batchUpdateOrderStatus).toHaveBeenCalledWith(["ORD001", "ORD002"], "SHIPPED", null, "系统用户", "t1");
  });
});
