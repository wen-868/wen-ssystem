/**
 * 管理端部门 service 单元测试
 * 被测文件：src/services/admin/department.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import {
  getDepartments,
  getDepartmentTree,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../../../services/admin/department.service";

describe("department.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("getDepartments", () => {
    it("无 storeId 时返回全部部门", async () => {
      mocks.query.mockResolvedValue([{ id: 1, name: "总店" }]);
      const res = await getDepartments("t1");
      expect(res.records.length).toBe(1);
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("WHERE 1=1");
      expect(params).toEqual([]);
    });

    it("带 storeId 时拼接 store_id 条件", async () => {
      mocks.query.mockResolvedValue([]);
      await getDepartments("t1", { storeId: 5 });
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("AND store_id = ?");
      expect(params).toEqual([5]);
    });
  });

  describe("getDepartmentTree", () => {
    it("构建树形结构（含子节点）", async () => {
      mocks.query.mockResolvedValue([
        { id: 1, parent_id: null, name: "总部" },
        { id: 2, parent_id: 1, name: "销售部" },
        { id: 3, parent_id: 1, name: "财务部" },
        { id: 4, parent_id: 2, name: "销售一组" },
      ]);
      const tree = await getDepartmentTree("t1");
      expect(tree.length).toBe(1);
      expect(tree[0].name).toBe("总部");
      expect(tree[0].children.length).toBe(2);
      expect(tree[0].children[0].children.length).toBe(1);
      expect(tree[0].children[0].children[0].name).toBe("销售一组");
    });

    it("空数据时返回空数组", async () => {
      mocks.query.mockResolvedValue([]);
      const tree = await getDepartmentTree("t1");
      expect(tree).toEqual([]);
    });
  });

  describe("createDepartment", () => {
    it("插入部门并返回 id（使用默认值）", async () => {
      mocks.query.mockResolvedValue({ insertId: 100 });
      const res = await createDepartment({ parentId: null, name: "新部门", storeId: 1 });
      expect(res).toEqual({ id: 100 });
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO sys_department");
      expect(params).toEqual([null, "新部门", 1, 0, 1]);
    });

    it("自定义 sortOrder 和 status", async () => {
      mocks.query.mockResolvedValue({ insertId: 101 });
      await createDepartment({ name: "X", parentId: 1, storeId: 2, sortOrder: 5, status: 0 });
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual([1, "X", 2, 5, 0]);
    });
  });

  describe("updateDepartment", () => {
    it("更新部门返回 success", async () => {
      mocks.query.mockResolvedValue(undefined);
      const res = await updateDepartment(9, { name: "改名", parentId: 2, storeId: 3, sortOrder: 1, status: 1 });
      expect(res).toEqual({ success: true });
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("UPDATE sys_department SET");
      expect(params).toEqual([2, "改名", 3, 1, 1, 9]);
    });
  });

  describe("deleteDepartment", () => {
    it("删除部门返回 success", async () => {
      mocks.query.mockResolvedValue(undefined);
      const res = await deleteDepartment(7);
      expect(res).toEqual({ success: true });
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("DELETE FROM sys_department WHERE id=?");
      expect(params).toEqual([7]);
    });
  });
});
