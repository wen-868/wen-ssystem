import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createLimitedDiscount: vi.fn(),
  listLimitedDiscounts: vi.fn(),
  getLimitedDiscountDetail: vi.fn(),
  updateLimitedDiscount: vi.fn(),
  deleteLimitedDiscount: vi.fn(),
  activateLimitedDiscount: vi.fn(),
  pauseLimitedDiscount: vi.fn(),
  getDiscountProducts: vi.fn(),
  addDiscountProduct: vi.fn(),
  removeDiscountProduct: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-limited-discount.service", () => ({
  createLimitedDiscount: mocks.createLimitedDiscount,
  listLimitedDiscounts: mocks.listLimitedDiscounts,
  getLimitedDiscountDetail: mocks.getLimitedDiscountDetail,
  updateLimitedDiscount: mocks.updateLimitedDiscount,
  deleteLimitedDiscount: mocks.deleteLimitedDiscount,
  activateLimitedDiscount: mocks.activateLimitedDiscount,
  pauseLimitedDiscount: mocks.pauseLimitedDiscount,
  getDiscountProducts: mocks.getDiscountProducts,
  addDiscountProduct: mocks.addDiscountProduct,
  removeDiscountProduct: mocks.removeDiscountProduct,
}));

import {
  createLimitedDiscount,
  listLimitedDiscounts,
  getLimitedDiscountDetail,
  updateLimitedDiscount,
  deleteLimitedDiscount,
  activateLimitedDiscount,
  pauseLimitedDiscount,
  getDiscountProducts,
  addDiscountProduct,
  removeDiscountProduct,
} from "../../../controllers/admin/marketing-limited-discount.controller";

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

describe("admin marketing-limited-discount.controller", () => {
  it("createLimitedDiscount - 应创建限时折扣", async () => {
    const body = {
      name: "夏日特惠8折",
      discountType: "PERCENTAGE",
      discountValue: 0.8,
      startTime: "2026-07-01",
      endTime: "2026-07-31",
    };
    mocks.createLimitedDiscount.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createLimitedDiscount(req, res, vi.fn());
    expect(mocks.createLimitedDiscount).toHaveBeenCalledWith(
      expect.objectContaining({ name: "夏日特惠8折" }),
      "t1",
      1
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createLimitedDiscount - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { name: "测试" } });
    const res = mockRes();
    await expect(createLimitedDiscount(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.createLimitedDiscount).not.toHaveBeenCalled();
  });

  it("listLimitedDiscounts - 应返回限时折扣列表", async () => {
    mocks.listLimitedDiscounts.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { status: "ACTIVE", page: "1", pageSize: "10" } });
    const res = mockRes();
    await listLimitedDiscounts(req, res, vi.fn());
    expect(mocks.listLimitedDiscounts).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", status: "ACTIVE", page: 1, pageSize: 10 })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("listLimitedDiscounts - 使用默认分页参数", async () => {
    mocks.listLimitedDiscounts.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listLimitedDiscounts(req, res, vi.fn());
    expect(mocks.listLimitedDiscounts).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 })
    );
  });

  it("getLimitedDiscountDetail - 应返回限时折扣详情", async () => {
    mocks.getLimitedDiscountDetail.mockResolvedValue({ id: 1, name: "活动1" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getLimitedDiscountDetail(req, res, vi.fn());
    expect(mocks.getLimitedDiscountDetail).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("updateLimitedDiscount - 应更新限时折扣", async () => {
    const body = { name: "新名称", status: "ACTIVE" };
    mocks.updateLimitedDiscount.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateLimitedDiscount(req, res, vi.fn());
    expect(mocks.updateLimitedDiscount).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "新名称" }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteLimitedDiscount - 应删除限时折扣", async () => {
    mocks.deleteLimitedDiscount.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteLimitedDiscount(req, res, vi.fn());
    expect(mocks.deleteLimitedDiscount).toHaveBeenCalledWith(1, "t1");
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });

  it("activateLimitedDiscount - 应激活限时折扣", async () => {
    mocks.activateLimitedDiscount.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await activateLimitedDiscount(req, res, vi.fn());
    expect(mocks.activateLimitedDiscount).toHaveBeenCalledWith(1, "t1");
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });

  it("pauseLimitedDiscount - 应暂停限时折扣", async () => {
    mocks.pauseLimitedDiscount.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await pauseLimitedDiscount(req, res, vi.fn());
    expect(mocks.pauseLimitedDiscount).toHaveBeenCalledWith(1, "t1");
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });

  it("getDiscountProducts - 应返回折扣商品列表", async () => {
    mocks.getDiscountProducts.mockResolvedValue([]);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getDiscountProducts(req, res, vi.fn());
    expect(mocks.getDiscountProducts).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("addDiscountProduct - 应添加折扣商品", async () => {
    const body = { skuIds: [1, 2, 3] };
    mocks.addDiscountProduct.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await addDiscountProduct(req, res, vi.fn());
    expect(mocks.addDiscountProduct).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ skuIds: [1, 2, 3] }),
      "t1"
    );
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });

  it("addDiscountProduct - 空 skuIds 时 zod 校验抛错", async () => {
    const req = mockReq({ params: { id: "1" }, body: { skuIds: [] } });
    const res = mockRes();
    await expect(addDiscountProduct(req, res, vi.fn())).rejects.toThrow();
  });

  it("removeDiscountProduct - 应移除折扣商品", async () => {
    mocks.removeDiscountProduct.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1", productId: "10" } });
    const res = mockRes();
    await removeDiscountProduct(req, res, vi.fn());
    expect(mocks.removeDiscountProduct).toHaveBeenCalledWith(1, 10, "t1");
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });
});
