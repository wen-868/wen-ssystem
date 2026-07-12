import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/brand.service", () => ({
  list: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: 1 }),
  update: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  remove: vi.fn().mockResolvedValue({ affectedRows: 1 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { ok } from "@shared/response";
import { listBrands, createBrand, updateBrand, deleteBrand } from "@controllers/admin/brand.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe("brand.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listBrands - 应列出品牌", async () => {
    const req = mockReq();
    const res = mockRes();
    await listBrands(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createBrand - 应创建品牌", async () => {
    const req = mockReq({ body: { name: "Test Brand" } });
    const res = mockRes();
    await createBrand(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("updateBrand - 应更新品牌", async () => {
    const req = mockReq({ params: { id: 1 }, body: { name: "New Name" } });
    const res = mockRes();
    await updateBrand(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("deleteBrand - 应删除品牌", async () => {
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteBrand(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
