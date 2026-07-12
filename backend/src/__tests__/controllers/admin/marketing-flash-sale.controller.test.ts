import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/marketing-flash-sale.service", () => ({
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

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as flashSaleService from "../../../services/admin/marketing-flash-sale.service";
import { ok } from "../../../shared/response";
import {
  createFlashSale,
  listFlashSales,
  getFlashSale,
  updateFlashSale,
  deleteFlashSale,
  activateFlashSale,
  pauseFlashSale,
  getFlashSaleStatistics,
  listActiveFlashSales,
  buyFlashSale,
} from "../../../controllers/admin/marketing-flash-sale.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

describe("marketing-flash-sale.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createFlashSale - 应创建限时抢购", async () => {
    (flashSaleService.createFlashSale as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        name: "限时抢购",
        productId: 1,
        skuId: 1,
        flashPrice: 99,
        originalPrice: 199,
        totalStock: 100,
        startTime: "2024-01-01",
        endTime: "2024-01-02",
      },
    });
    const res = mockRes();
    await createFlashSale(req as any, res as any);
    expect(flashSaleService.createFlashSale).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ id: 1 });
  });

  it("createFlashSale - 缺少必填字段应抛出错误", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createFlashSale(req as any, res as any)).rejects.toThrow();
  });

  it("listFlashSales - 应返回限时抢购列表", async () => {
    (flashSaleService.listFlashSales as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listFlashSales(req as any, res as any);
    expect(flashSaleService.listFlashSales).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getFlashSale - 应返回单个限时抢购", async () => {
    (flashSaleService.getFlashSale as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getFlashSale(req as any, res as any);
    expect(flashSaleService.getFlashSale).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateFlashSale - 应更新限时抢购", async () => {
    (flashSaleService.updateFlashSale as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { name: "更新名称" },
    });
    const res = mockRes();
    await updateFlashSale(req as any, res as any);
    expect(flashSaleService.updateFlashSale).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteFlashSale - 应删除限时抢购", async () => {
    (flashSaleService.deleteFlashSale as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteFlashSale(req as any, res as any);
    expect(flashSaleService.deleteFlashSale).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("activateFlashSale - 应激活限时抢购", async () => {
    (flashSaleService.activateFlashSale as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await activateFlashSale(req as any, res as any);
    expect(flashSaleService.activateFlashSale).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("pauseFlashSale - 应暂停限时抢购", async () => {
    (flashSaleService.pauseFlashSale as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await pauseFlashSale(req as any, res as any);
    expect(flashSaleService.pauseFlashSale).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getFlashSaleStatistics - 应返回限时抢购统计", async () => {
    (flashSaleService.getFlashSaleStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getFlashSaleStatistics(req as any, res as any);
    expect(flashSaleService.getFlashSaleStatistics).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listActiveFlashSales - 应返回进行中的限时抢购", async () => {
    (flashSaleService.listActiveFlashSales as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listActiveFlashSales(req as any, res as any);
    expect(flashSaleService.listActiveFlashSales).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("buyFlashSale - 应购买限时抢购商品", async () => {
    (flashSaleService.buyFlashSale as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { userId: 1, quantity: 1 },
    });
    const res = mockRes();
    await buyFlashSale(req as any, res as any);
    expect(flashSaleService.buyFlashSale).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("buyFlashSale - 参数验证失败应抛出错误", async () => {
    const req = mockReq({
      params: { id: 1 },
      body: {},
    });
    const res = mockRes();
    await expect(buyFlashSale(req as any, res as any)).rejects.toThrow();
  });
});