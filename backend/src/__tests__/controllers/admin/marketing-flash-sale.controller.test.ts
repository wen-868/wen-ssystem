/**
 * 管理端限时抢购 controller 单元测试
 * 被测文件：src/controllers/admin/marketing-flash-sale.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  createFlashSale: vi.fn(),
  listFlashSales: vi.fn(),
  getFlashSale: vi.fn(),
  updateFlashSale: vi.fn(),
  deleteFlashSale: vi.fn(),
  activateFlashSale: vi.fn(),
  pauseFlashSale: vi.fn(),
  getFlashSaleStatistics: vi.fn(),
  listActiveFlashSales: vi.fn(),
  buyFlashSale: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/marketing-flash-sale.service.js", () => ({
  createFlashSale: mocks.createFlashSale,
  listFlashSales: mocks.listFlashSales,
  getFlashSale: mocks.getFlashSale,
  updateFlashSale: mocks.updateFlashSale,
  deleteFlashSale: mocks.deleteFlashSale,
  activateFlashSale: mocks.activateFlashSale,
  pauseFlashSale: mocks.pauseFlashSale,
  getFlashSaleStatistics: mocks.getFlashSaleStatistics,
  listActiveFlashSales: mocks.listActiveFlashSales,
  buyFlashSale: mocks.buyFlashSale,
}));

import {
  createFlashSale,
  listFlashSales,
  getFlashSale,
  deleteFlashSale,
  activateFlashSale,
  pauseFlashSale,
  getFlashSaleStatistics,
  buyFlashSale,
} from "../../../controllers/admin/marketing-flash-sale.controller.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin marketing-flash-sale.controller", () => {
  it("createFlashSale 成功创建限时抢购", async () => {
    const body = {
      name: "夏日特惠",
      productId: 1,
      skuId: 10,
      flashPrice: 9.9,
      originalPrice: 19.9,
      totalStock: 100,
      startTime: "2026-07-01",
      endTime: "2026-07-07",
    };
    mocks.createFlashSale.mockResolvedValue({ id: 1, name: "夏日特惠" });
    const req = mockReq({ body });
    const res = mockRes();
    await createFlashSale(req, res);
    expect(mocks.createFlashSale).toHaveBeenCalledWith(expect.objectContaining({ name: "夏日特惠", productId: 1 }), "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1, name: "夏日特惠" });
    expect(res.json).toHaveBeenCalled();
  });

  it("createFlashSale 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { name: "缺商品" } });
    const res = mockRes();
    await expect(createFlashSale(req, res)).rejects.toThrow();
    expect(mocks.createFlashSale).not.toHaveBeenCalled();
  });

  it("listFlashSales 正确传递分页和状态参数", async () => {
    mocks.listFlashSales.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { page: "3", pageSize: "15", status: "ACTIVE" } });
    const res = mockRes();
    await listFlashSales(req, res);
    expect(mocks.listFlashSales).toHaveBeenCalledWith(3, 15, "t1", "ACTIVE");
    expect(res.json).toHaveBeenCalled();
  });

  it("listFlashSales 使用默认分页参数", async () => {
    mocks.listFlashSales.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listFlashSales(req, res);
    expect(mocks.listFlashSales).toHaveBeenCalledWith(1, 20, "t1", undefined);
  });

  it("getFlashSale 根据 params.id 获取详情", async () => {
    mocks.getFlashSale.mockResolvedValue({ id: 8 });
    const req = mockReq({ params: { id: "8" } });
    const res = mockRes();
    await getFlashSale(req, res);
    expect(mocks.getFlashSale).toHaveBeenCalledWith(8, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteFlashSale 成功删除", async () => {
    mocks.deleteFlashSale.mockResolvedValue({ id: 4 });
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    await deleteFlashSale(req, res);
    expect(mocks.deleteFlashSale).toHaveBeenCalledWith(4, "t1");
  });

  it("activateFlashSale 激活活动", async () => {
    mocks.activateFlashSale.mockResolvedValue({ id: 2, status: "ACTIVE" });
    const req = mockReq({ params: { id: "2" } });
    const res = mockRes();
    await activateFlashSale(req, res);
    expect(mocks.activateFlashSale).toHaveBeenCalledWith(2, "t1");
  });

  it("pauseFlashSale 暂停活动", async () => {
    mocks.pauseFlashSale.mockResolvedValue({ id: 2, status: "PAUSED" });
    const req = mockReq({ params: { id: "2" } });
    const res = mockRes();
    await pauseFlashSale(req, res);
    expect(mocks.pauseFlashSale).toHaveBeenCalledWith(2, "t1");
  });

  it("getFlashSaleStatistics 返回统计数据", async () => {
    mocks.getFlashSaleStatistics.mockResolvedValue({ totalSales: 50 });
    const req = mockReq();
    const res = mockRes();
    await getFlashSaleStatistics(req, res);
    expect(mocks.getFlashSaleStatistics).toHaveBeenCalledWith("t1");
  });

  it("buyFlashSale 成功购买", async () => {
    mocks.buyFlashSale.mockResolvedValue({ orderNo: "FS001" });
    const req = mockReq({ params: { id: "5" }, body: { userId: 1, quantity: 2 } });
    const res = mockRes();
    await buyFlashSale(req, res);
    expect(mocks.buyFlashSale).toHaveBeenCalledWith(5, 1, 2, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("buyFlashSale quantity 缺失时 zod 校验抛错", async () => {
    const req = mockReq({ params: { id: "5" }, body: { userId: 1 } });
    const res = mockRes();
    await expect(buyFlashSale(req, res)).rejects.toThrow();
    expect(mocks.buyFlashSale).not.toHaveBeenCalled();
  });
});
