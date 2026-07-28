import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/data-permission.service", () => ({
  listDataPermissions: vi.fn(),
  getDataPermissionDetail: vi.fn(),
  createDataPermission: vi.fn(),
  updateDataPermission: vi.fn(),
  deleteDataPermission: vi.fn(),
  getRoleDataPermissions: vi.fn(),
  assignRoleDataPermission: vi.fn(),
  removeRoleDataPermission: vi.fn(),
  getUserDataPermissions: vi.fn(),
  checkDataPermission: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as service from "@services/admin/data-permission.service";
import { ok } from "@shared/response";
import {
  listDataPermissions,
  getDataPermissionDetail,
  createDataPermission,
  updateDataPermission,
  deleteDataPermission,
  getRoleDataPermissions,
  assignRoleDataPermission,
  removeRoleDataPermission,
  getUserDataPermissions,
  checkDataPermission,
} from "@controllers/admin/data-permission.controller";

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

describe("data-permission.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listDataPermissions - 应返回数据权限列表", async () => {
    (service.listDataPermissions as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listDataPermissions(req as any, res as any, vi.fn());
    expect(service.listDataPermissions).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getDataPermissionDetail - 应返回数据权限详情", async () => {
    (service.getDataPermissionDetail as any).mockResolvedValue({ id: 1, permissionName: "全部数据" });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getDataPermissionDetail(req as any, res as any, vi.fn());
    expect(service.getDataPermissionDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createDataPermission - 应创建数据权限", async () => {
    (service.createDataPermission as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        permissionName: "自定义权限",
        permissionCode: "DATA_CUSTOM",
        permissionType: "STORE",
      },
    });
    const res = mockRes();
    await createDataPermission(req as any, res as any, vi.fn());
    expect(service.createDataPermission).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createDataPermission - zod验证失败", async () => {
    const req = mockReq({ body: { permissionName: "", permissionCode: "" } });
    const res = mockRes();
    await expect(createDataPermission(req as any, res as any, vi.fn())).rejects.toThrow();
  });

  it("updateDataPermission - 应更新数据权限", async () => {
    (service.updateDataPermission as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 }, body: { permissionName: "新名称" } });
    const res = mockRes();
    await updateDataPermission(req as any, res as any, vi.fn());
    expect(service.updateDataPermission).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteDataPermission - 应删除数据权限", async () => {
    (service.deleteDataPermission as any).mockResolvedValue({ deleted: true });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteDataPermission(req as any, res as any, vi.fn());
    expect(service.deleteDataPermission).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getRoleDataPermissions - 应返回角色数据权限", async () => {
    (service.getRoleDataPermissions as any).mockResolvedValue([]);
    const req = mockReq({ params: { roleId: 1 } });
    const res = mockRes();
    await getRoleDataPermissions(req as any, res as any, vi.fn());
    expect(service.getRoleDataPermissions).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("assignRoleDataPermission - 应为角色分配数据权限", async () => {
    (service.assignRoleDataPermission as any).mockResolvedValue([]);
    const req = mockReq({ params: { roleId: 1 }, body: { dataPermissionId: 1, scopeValues: [1, 2, 3] } });
    const res = mockRes();
    await assignRoleDataPermission(req as any, res as any, vi.fn());
    expect(service.assignRoleDataPermission).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("assignRoleDataPermission - 无scopeValues", async () => {
    (service.assignRoleDataPermission as any).mockResolvedValue([]);
    const req = mockReq({ params: { roleId: 1 }, body: { dataPermissionId: 1 } });
    const res = mockRes();
    await assignRoleDataPermission(req as any, res as any, vi.fn());
    expect(service.assignRoleDataPermission).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("removeRoleDataPermission - 应移除角色数据权限", async () => {
    (service.removeRoleDataPermission as any).mockResolvedValue([]);
    const req = mockReq({ params: { roleId: 1, dataPermissionId: 1 } });
    const res = mockRes();
    await removeRoleDataPermission(req as any, res as any, vi.fn());
    expect(service.removeRoleDataPermission).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getUserDataPermissions - 应返回用户数据权限", async () => {
    (service.getUserDataPermissions as any).mockResolvedValue([]);
    const req = mockReq({ params: { userId: 1 } });
    const res = mockRes();
    await getUserDataPermissions(req as any, res as any, vi.fn());
    expect(service.getUserDataPermissions).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("checkDataPermission - 应检查数据权限", async () => {
    (service.checkDataPermission as any).mockResolvedValue(true);
    const req = mockReq({ params: { userId: 1 }, body: { dataType: "STORE", targetId: 1 } });
    const res = mockRes();
    await checkDataPermission(req as any, res as any, vi.fn());
    expect(service.checkDataPermission).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("checkDataPermission - 无targetId", async () => {
    (service.checkDataPermission as any).mockResolvedValue(false);
    const req = mockReq({ params: { userId: 1 }, body: { dataType: "STORE" } });
    const res = mockRes();
    await checkDataPermission(req as any, res as any, vi.fn());
    expect(service.checkDataPermission).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
