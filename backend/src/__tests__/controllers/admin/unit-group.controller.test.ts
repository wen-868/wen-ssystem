import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/unit-group.service", () => ({
  listGroups: vi.fn().mockResolvedValue([]),
  getGroup: vi.fn().mockResolvedValue({ id: 1 }),
  createGroup: vi.fn().mockResolvedValue({ id: 1 }),
  updateGroup: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  deleteGroup: vi.fn().mockResolvedValue({ affectedRows: 1 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { ok } from "@shared/response";
import { listUnitGroups, getUnitGroup, createUnitGroup, updateUnitGroup, deleteUnitGroup } from "@controllers/admin/unit-group.controller";

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

describe("unit-group.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listUnitGroups - 应列出单位组", async () => {
    const req = mockReq();
    const res = mockRes();
    await listUnitGroups(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getUnitGroup - 应获取单位组", async () => {
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getUnitGroup(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createUnitGroup - 应创建单位组", async () => {
    const req = mockReq({ body: { name: "Test Group" } });
    const res = mockRes();
    await createUnitGroup(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("updateUnitGroup - 应更新单位组", async () => {
    const req = mockReq({ params: { id: 1 }, body: { name: "New Name" } });
    const res = mockRes();
    await updateUnitGroup(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("deleteUnitGroup - 应删除单位组", async () => {
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteUnitGroup(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
