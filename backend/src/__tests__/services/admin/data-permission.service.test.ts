/**
 * 管理端数据权限 service 单元测试
 * 被测文件：src/services/admin/data-permission.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

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
} from "../../../services/admin/data-permission.service";

describe("data-permission.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listDataPermissions", () => {
    it("返回数据权限列表", async () => {
      mocks.query.mockResolvedValue([{ id: 1, permissionName: "权限1" }, { id: 2, permissionName: "权限2" }]);
      const res = await listDataPermissions("t1");
      expect(res.length).toBe(2);
    });

    it("返回空数组", async () => {
      mocks.query.mockResolvedValue([]);
      const res = await listDataPermissions("t1");
      expect(res).toEqual([]);
    });
  });

  describe("getDataPermissionDetail", () => {
    it("权限不存在时抛 404", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(getDataPermissionDetail(1, "t1")).rejects.toMatchObject({
        message: "数据权限配置不存在",
        statusCode: 404,
      });
    });

    it("返回权限详情", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1, permissionName: "权限1", permissionCode: "PERM001" });
      const res = await getDataPermissionDetail(1, "t1");
      expect(res.id).toBe(1);
      expect(res.permissionName).toBe("权限1");
    });
  });

  describe("createDataPermission", () => {
    it("权限编码已存在时抛 400", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1 });
      await expect(createDataPermission({ permissionName: "权限1", permissionCode: "PERM001", permissionType: "ALL" }, "t1")).rejects.toMatchObject({
        message: "数据权限编码已存在",
        statusCode: 400,
      });
    });

    it("创建权限并返回", async () => {
      mocks.queryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, permissionName: "权限1", permissionCode: "PERM001" });
      mocks.query.mockResolvedValue(undefined);
      const res = await createDataPermission({ permissionName: "权限1", permissionCode: "PERM001", permissionType: "ALL" }, "t1");
      expect(res.id).toBe(1);
      expect(res.permissionName).toBe("权限1");
    });

    it("带 description, status, sortNo", async () => {
      mocks.queryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2 });
      mocks.query.mockResolvedValue(undefined);
      await createDataPermission({
        permissionName: "权限2",
        permissionCode: "PERM002",
        permissionType: "STORE",
        description: "描述",
        status: 0,
        sortNo: 10,
      }, "t1");
      expect(mocks.query).toHaveBeenCalled();
    });
  });

  describe("updateDataPermission", () => {
    it("权限不存在时抛 404", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(updateDataPermission(1, { permissionName: "新名称" }, "t1")).rejects.toMatchObject({
        message: "数据权限配置不存在",
        statusCode: 404,
      });
    });

    it("无更新字段时直接查询返回", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1, permissionName: "权限1" });
      const res = await updateDataPermission(1, {}, "t1");
      expect(res.id).toBe(1);
      expect(mocks.query).not.toHaveBeenCalled();
    });

    it("更新字段", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1, permissionName: "新名称" });
      mocks.query.mockResolvedValue(undefined);
      const res = await updateDataPermission(1, { permissionName: "新名称", status: 0 }, "t1");
      expect(res.id).toBe(1);
      expect(mocks.query).toHaveBeenCalled();
    });

    it("更新 description 和 sortNo", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 });
      mocks.query.mockResolvedValue(undefined);
      await updateDataPermission(1, { description: "新描述", sortNo: 5 }, "t1");
      expect(mocks.query).toHaveBeenCalled();
    });
  });

  describe("deleteDataPermission", () => {
    it("权限不存在时抛 404", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(deleteDataPermission(1, "t1")).rejects.toMatchObject({
        message: "数据权限配置不存在",
        statusCode: 404,
      });
    });

    it("正常删除", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1 });
      mocks.transaction.mockImplementation(async (callback) => {
        await callback({ execute: vi.fn() });
      });
      const res = await deleteDataPermission(1, "t1");
      expect(res.deleted).toBe(true);
      expect(mocks.transaction).toHaveBeenCalled();
    });
  });

  describe("getRoleDataPermissions", () => {
    it("返回角色数据权限", async () => {
      mocks.query.mockResolvedValue([{ id: 1, roleId: 1, dataPermissionId: 1 }]);
      const res = await getRoleDataPermissions(1, "t1");
      expect(res.length).toBe(1);
    });

    it("返回空数组", async () => {
      mocks.query.mockResolvedValue([]);
      const res = await getRoleDataPermissions(1, "t1");
      expect(res).toEqual([]);
    });
  });

  describe("assignRoleDataPermission", () => {
    it("角色不存在时抛 404", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(assignRoleDataPermission(1, 1, null, "t1")).rejects.toMatchObject({
        message: "角色不存在",
        statusCode: 404,
      });
    });

    it("权限不存在时抛 404", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      await expect(assignRoleDataPermission(1, 1, null, "t1")).rejects.toMatchObject({
        message: "数据权限不存在",
        statusCode: 404,
      });
    });

    it("已有关联时更新 scopeValues", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 });
      mocks.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);
      await assignRoleDataPermission(1, 1, [1, 2], "t1");
      expect(mocks.query).toHaveBeenCalled();
    });

    it("无关联时插入新记录", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      mocks.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);
      await assignRoleDataPermission(1, 1, [1, 2], "t1");
      expect(mocks.query).toHaveBeenCalled();
    });

    it("scopeValues 为 null", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      mocks.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);
      await assignRoleDataPermission(1, 1, null, "t1");
      expect(mocks.query).toHaveBeenCalled();
    });

    it("scopeValues 为空数组", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      mocks.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);
      await assignRoleDataPermission(1, 1, [], "t1");
      expect(mocks.query).toHaveBeenCalled();
    });
  });

  describe("removeRoleDataPermission", () => {
    it("关联不存在时抛 404", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(removeRoleDataPermission(1, 1, "t1")).rejects.toMatchObject({
        message: "角色数据权限关联不存在",
        statusCode: 404,
      });
    });

    it("正常删除关联", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1 });
      mocks.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);
      const res = await removeRoleDataPermission(1, 1, "t1");
      expect(res).toEqual([]);
    });
  });

  describe("getUserDataPermissions", () => {
    it("返回用户数据权限", async () => {
      mocks.query.mockResolvedValue([{ id: 1, permissionName: "权限1" }]);
      const res = await getUserDataPermissions(1, "t1");
      expect(res.length).toBe(1);
    });

    it("返回空数组", async () => {
      mocks.query.mockResolvedValue([]);
      const res = await getUserDataPermissions(1, "t1");
      expect(res).toEqual([]);
    });
  });

  describe("checkDataPermission", () => {
    it("有 ALL 类型权限时返回 true", async () => {
      mocks.query.mockResolvedValue([{ permission_type: "ALL" }]);
      const res = await checkDataPermission(1, "t1", "STORE", 1);
      expect(res).toBe(true);
    });

    it("有权限类型匹配且 scopeValues 包含 targetId", async () => {
      mocks.query.mockResolvedValue([{ permission_type: "STORE", scopeValues: JSON.stringify([1, 2, 3]) }]);
      const res = await checkDataPermission(1, "t1", "STORE", 2);
      expect(res).toBe(true);
    });

    it("有权限类型匹配但 scopeValues 为空数组", async () => {
      mocks.query.mockResolvedValue([{ permission_type: "STORE", scopeValues: JSON.stringify([]) }]);
      const res = await checkDataPermission(1, "t1", "STORE", 1);
      expect(res).toBe(true);
    });

    it("有权限类型匹配但 scopeValues 不包含 targetId", async () => {
      mocks.query.mockResolvedValue([{ permission_type: "STORE", scopeValues: JSON.stringify([1, 2]) }]);
      const res = await checkDataPermission(1, "t1", "STORE", 3);
      expect(res).toBe(false);
    });

    it("权限类型不匹配", async () => {
      mocks.query.mockResolvedValue([{ permission_type: "DEPARTMENT" }]);
      const res = await checkDataPermission(1, "t1", "STORE", 1);
      expect(res).toBe(false);
    });

    it("无权限时返回 false", async () => {
      mocks.query.mockResolvedValue([]);
      const res = await checkDataPermission(1, "t1", "STORE", 1);
      expect(res).toBe(false);
    });

    it("targetId 为 null 时不匹配非 ALL 权限", async () => {
      mocks.query.mockResolvedValue([{ permission_type: "STORE", scopeValues: JSON.stringify([1]) }]);
      const res = await checkDataPermission(1, "t1", "STORE", null);
      expect(res).toBe(false);
    });

    it("scopeValues 为 null", async () => {
      mocks.query.mockResolvedValue([{ permission_type: "STORE", scopeValues: null }]);
      const res = await checkDataPermission(1, "t1", "STORE", 1);
      expect(res).toBe(true);
    });
  });
});