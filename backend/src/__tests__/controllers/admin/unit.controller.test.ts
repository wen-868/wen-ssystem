import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/unit.service", () => ({
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
import { listUnits, createUnit, updateUnit, deleteUnit } from "@controllers/admin/unit.controller";

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

describe("unit.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listUnits - 应列出单位", async () => {
    const req = mockReq();
    const res = mockRes();
    await listUnits(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createUnit - 应创建单位", async () => {
    const req = mockReq({ body: { name: "Test Unit", code: "TEST" } });
    const res = mockRes();
    await createUnit(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("updateUnit - 应更新单位", async () => {
    const req = mockReq({ params: { id: 1 }, body: { name: "New Name" } });
    const res = mockRes();
    await updateUnit(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("deleteUnit - 应删除单位", async () => {
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteUnit(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
