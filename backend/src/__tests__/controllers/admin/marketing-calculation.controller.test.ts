import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  calculatePromotion: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-calculation.service", () => ({
  calculatePromotion: mocks.calculatePromotion,
}));

import {
  calculatePromotion,
} from "../../../controllers/admin/marketing-calculation.controller";

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

describe("admin marketing-calculation.controller", () => {
  it("calculatePromotion - 应计算营销优惠", async () => {
    const body = {
      items: [
        { skuId: 1, productId: 100, quantity: 2, unitPrice: 50, categoryId: 1, brandId: 1 },
        { skuId: 2, productId: 200, quantity: 1, unitPrice: 100, categoryId: 2, brandId: 2 },
      ],
      couponTemplateId: 1,
      fullReductionIds: [1, 2],
    };
    mocks.calculatePromotion.mockResolvedValue({ finalAmount: 180, discountAmount: 20 });
    const req = mockReq({ body });
    const res = mockRes();
    await calculatePromotion(req, res, vi.fn());
    expect(mocks.calculatePromotion).toHaveBeenCalledWith(
      expect.objectContaining({ items: expect.any(Array) }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("calculatePromotion - 缺少 items 时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(calculatePromotion(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.calculatePromotion).not.toHaveBeenCalled();
  });

  it("calculatePromotion - items 为空数组时 zod 校验抛错", async () => {
    const req = mockReq({ body: { items: [] } });
    const res = mockRes();
    await expect(calculatePromotion(req, res, vi.fn())).rejects.toThrow();
  });

  it("calculatePromotion - items 中缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { items: [{ skuId: 1 }] } });
    const res = mockRes();
    await expect(calculatePromotion(req, res, vi.fn())).rejects.toThrow();
  });

  it("calculatePromotion - 可选参数不传也能正常计算", async () => {
    const body = {
      items: [
        { skuId: 1, productId: 100, quantity: 2, unitPrice: 50 },
      ],
    };
    mocks.calculatePromotion.mockResolvedValue({ finalAmount: 100 });
    const req = mockReq({ body });
    const res = mockRes();
    await calculatePromotion(req, res, vi.fn());
    expect(mocks.calculatePromotion).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
