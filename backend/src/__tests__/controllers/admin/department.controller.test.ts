import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/department.service", () => ({
  getDepartments: vi.fn().mockResolvedValue([]),
  getDepartmentTree: vi.fn().mockResolvedValue([]),
  createDepartment: vi.fn().mockResolvedValue({ id: 1 }),
  updateDepartment: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  deleteDepartment: vi.fn().mockResolvedValue({ affectedRows: 1 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { ok } from "@shared/response";
import { getDepartments, getDepartmentTree, createDepartment, updateDepartment, deleteDepartment, moveDepartment } from "@controllers/admin/department.controller";

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

describe("department.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDepartments - 应获取部门列表", async () => {
    const req = mockReq();
    const res = mockRes();
    await getDepartments(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getDepartmentTree - 应获取部门树", async () => {
    const req = mockReq();
    const res = mockRes();
    await getDepartmentTree(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createDepartment - 应创建部门", async () => {
    const req = mockReq({ body: { name: "Test Department" } });
    const res = mockRes();
    await createDepartment(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("updateDepartment - 应更新部门", async () => {
    const req = mockReq({ params: { id: 1 }, body: { name: "New Name" } });
    const res = mockRes();
    await updateDepartment(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("deleteDepartment - 应删除部门", async () => {
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteDepartment(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("moveDepartment - 应移动部门", async () => {
    const req = mockReq({ params: { id: 1 }, body: { parentId: 2 } });
    const res = mockRes();
    await moveDepartment(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
