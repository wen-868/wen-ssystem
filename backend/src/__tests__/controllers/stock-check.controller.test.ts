import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/stock-check.service.js", () => ({
  createCheck: vi.fn(),
  listChecks: vi.fn(),
  getStatistics: vi.fn(),
  getCheckDetail: vi.fn(),
  updateCheck: vi.fn(),
  startCheck: vi.fn(),
  completeCheck: vi.fn(),
  cancelCheck: vi.fn(),
  handleDiff: vi.fn(),
  listMyChecks: vi.fn(),
  getMyCheckDetail: vi.fn(),
  updateItemQty: vi.fn(),
  submitCheck: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as stockCheckService from "../../services/admin/stock-check.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  create,
  getStatistics,
  list,
  getDetail,
  update,
  start,
  complete,
  cancel,
  handleDiff,
  getMyList,
  updateItem,
  submit,
} from "../../controllers/stock-check.controller.js";

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

describe("stock-check.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create - 应创建盘点单", async () => {
    (stockCheckService.createCheck as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { storeId: 1, remark: "测试盘点" } });
    const res = mockRes();
    await create(req as any, res as any);
    expect(stockCheckService.createCheck).toHaveBeenCalledWith({ storeId: 1, remark: "测试盘点", tenantId: "t1" });
    expect(ok).toHaveBeenCalled();
  });

  it("list - 应返回盘点单列表", async () => {
    (stockCheckService.listChecks as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any);
    expect(stockCheckService.listChecks).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getStatistics - 应返回盘点统计", async () => {
    (stockCheckService.getStatistics as any).mockResolvedValue({ total: 10 });
    const req = mockReq();
    const res = mockRes();
    await getStatistics(req as any, res as any);
    expect(stockCheckService.getStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getDetail - 应返回盘点单详情", async () => {
    (stockCheckService.getCheckDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getDetail(req as any, res as any);
    expect(stockCheckService.getCheckDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("update - 应更新盘点单", async () => {
    (stockCheckService.updateCheck as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { remark: "更新备注" } });
    const res = mockRes();
    await update(req as any, res as any);
    expect(stockCheckService.updateCheck).toHaveBeenCalledWith(1, "t1", { remark: "更新备注" });
    expect(ok).toHaveBeenCalled();
  });

  it("start - 应开始盘点", async () => {
    (stockCheckService.startCheck as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await start(req as any, res as any);
    expect(stockCheckService.startCheck).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("complete - 应完成盘点", async () => {
    (stockCheckService.completeCheck as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await complete(req as any, res as any);
    expect(stockCheckService.completeCheck).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("cancel - 应取消盘点", async () => {
    (stockCheckService.cancelCheck as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await cancel(req as any, res as any);
    expect(stockCheckService.cancelCheck).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("handleDiff - 应处理差异", async () => {
    (stockCheckService.handleDiff as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { itemId: 2 } });
    const res = mockRes();
    await handleDiff(req as any, res as any);
    expect(stockCheckService.handleDiff).toHaveBeenCalledWith({
      checkId: 1, itemId: 2, tenantId: "t1", userId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getMyList - 未关联门店应返回400", async () => {
    const req = mockReq({ user: { id: 1, username: "admin" } });
    const res = mockRes();
    await getMyList(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("未关联门店");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getMyList - 应返回我的盘点单", async () => {
    (stockCheckService.listMyChecks as any).mockResolvedValue([]);
    const req = mockReq({ user: { id: 1, username: "admin", storeId: 10 } });
    const res = mockRes();
    await getMyList(req as any, res as any);
    expect(stockCheckService.listMyChecks).toHaveBeenCalledWith(10, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateItem - 应更新盘点项数量", async () => {
    (stockCheckService.updateItemQty as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1", itemId: "2" }, body: { actualQty: 50 } });
    const res = mockRes();
    await updateItem(req as any, res as any);
    expect(stockCheckService.updateItemQty).toHaveBeenCalledWith({
      checkId: 1, itemId: 2, actualQty: 50, tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("submit - 应提交盘点", async () => {
    (stockCheckService.submitCheck as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await submit(req as any, res as any);
    expect(stockCheckService.submitCheck).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
