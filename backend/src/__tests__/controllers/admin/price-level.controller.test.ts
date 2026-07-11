import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/price-level.service.js", () => ({
  listPriceLevels: vi.fn(),
  createPriceLevel: vi.fn(),
  updatePriceLevel: vi.fn(),
  disablePriceLevel: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as priceLevelService from "../../../services/admin/price-level.service.js";
import { ok, fail } from "../../../shared/response.js";
import {
  listPriceLevels,
  createPriceLevel,
  updatePriceLevel,
  disablePriceLevel,
} from "../../../controllers/admin/price-level.controller.js";

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

describe("price-level.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listPriceLevels - 应返回价格等级列表", async () => {
    (priceLevelService.listPriceLevels as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listPriceLevels(req as any, res as any);
    expect(priceLevelService.listPriceLevels).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createPriceLevel - 应创建价格等级", async () => {
    (priceLevelService.createPriceLevel as any).mockResolvedValue({ data: { id: 1 } });
    const req = mockReq({ body: { levelCode: "VIP", levelName: "VIP等级", discountRate: 0.9 } });
    const res = mockRes();
    await createPriceLevel(req as any, res as any);
    expect(priceLevelService.createPriceLevel).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createPriceLevel - 创建失败应返回错误", async () => {
    (priceLevelService.createPriceLevel as any).mockResolvedValue({ error: { code: "400", message: "等级编码已存在" } });
    const req = mockReq({ body: { levelCode: "VIP", levelName: "VIP等级", discountRate: 0.9 } });
    const res = mockRes();
    await createPriceLevel(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("updatePriceLevel - 应更新价格等级", async () => {
    (priceLevelService.updatePriceLevel as any).mockResolvedValue({ data: { id: 1 } });
    const req = mockReq({ params: { id: "1" }, body: { levelName: "新名称" } });
    const res = mockRes();
    await updatePriceLevel(req as any, res as any);
    expect(priceLevelService.updatePriceLevel).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updatePriceLevel - 更新失败应返回错误", async () => {
    (priceLevelService.updatePriceLevel as any).mockResolvedValue({ error: { code: "404", message: "价格等级不存在" } });
    const req = mockReq({ params: { id: "999" }, body: { levelName: "新名称" } });
    const res = mockRes();
    await updatePriceLevel(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("disablePriceLevel - 应禁用价格等级", async () => {
    (priceLevelService.disablePriceLevel as any).mockResolvedValue({ data: { id: 1 } });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await disablePriceLevel(req as any, res as any);
    expect(priceLevelService.disablePriceLevel).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("disablePriceLevel - 禁用失败应返回错误", async () => {
    (priceLevelService.disablePriceLevel as any).mockResolvedValue({ error: { code: "404", message: "价格等级不存在" } });
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await disablePriceLevel(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
