import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/category.service", () => ({
  list: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: 1 }),
  update: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  remove: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  sort: vi.fn().mockResolvedValue({ affectedRows: 1 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { ok } from "@shared/response";
import { listCategories, createCategory, updateCategory, deleteCategory, sortCategory } from "@controllers/admin/category.controller";

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

describe("category.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listCategories - 应列出分类", async () => {
    const req = mockReq();
    const res = mockRes();
    await listCategories(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createCategory - 应创建分类", async () => {
    const req = mockReq({ body: { name: "Test Category" } });
    const res = mockRes();
    await createCategory(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("updateCategory - 应更新分类", async () => {
    const req = mockReq({ params: { id: 1 }, body: { name: "New Name" } });
    const res = mockRes();
    await updateCategory(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("deleteCategory - 应删除分类", async () => {
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteCategory(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("sortCategory - 应排序分类", async () => {
    const req = mockReq({ params: { id: 1 }, body: { sortNo: 10 } });
    const res = mockRes();
    await sortCategory(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
