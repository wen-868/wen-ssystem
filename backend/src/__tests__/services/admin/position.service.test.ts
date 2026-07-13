/**
 * 管理端岗位 service 单元测试
 * 被测文件：src/services/admin/position.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import {
  listPositions,
  getPosition,
  createPosition,
  updatePosition,
  deletePosition,
  listAllPositions,
} from "../../../services/admin/position.service";

describe("position.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listPositions", () => {
    it("返回岗位列表含 total", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, positionName: "岗位1" }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 5 });
      const res = await listPositions({ page: 1, pageSize: 10, tenantId: "t1" });
      expect(res.total).toBe(5);
      expect(res.records.length).toBe(1);
    });

    it("带 departmentId 筛选", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await listPositions({ departmentId: 1, page: 1, pageSize: 20, tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("带 status 筛选", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await listPositions({ status: 1, page: 1, pageSize: 20, tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("同时带 departmentId 和 status", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await listPositions({ departmentId: 1, status: 0, page: 1, pageSize: 20, tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("total 为 null 时返回 0", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await listPositions({ page: 1, pageSize: 10, tenantId: "t1" });
      expect(res.total).toBe(0);
    });
  });

  describe("getPosition", () => {
    it("岗位不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(getPosition(1, "t1")).rejects.toMatchObject({
        message: "岗位不存在",
        statusCode: 404,
      });
    });

    it("返回岗位信息", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, positionName: "岗位1", positionCode: "P001" });
      const res = await getPosition(1, "t1");
      expect(res.id).toBe(1);
      expect(res.positionName).toBe("岗位1");
    });
  });

  describe("createPosition", () => {
    it("创建岗位并返回 id", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });
      const res = await createPosition({ positionName: "岗位1", tenantId: "t1" });
      expect(res.id).toBe(1);
      expect(res.positionName).toBe("岗位1");
    });

    it("使用默认参数", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 2 });
      await createPosition({ positionName: "岗位2", tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("传入所有参数", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 3 });
      await createPosition({
        positionName: "岗位3",
        positionCode: "P003",
        departmentId: 1,
        sortOrder: 10,
        status: 1,
        remark: "备注",
        tenantId: "t1",
      });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("status 为 0", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 4 });
      await createPosition({ positionName: "岗位4", status: 0, tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });
  });

  describe("updatePosition", () => {
    it("无字段更新时抛 400", async () => {
      await expect(updatePosition(1, { tenantId: "t1" })).rejects.toMatchObject({
        message: "没有需要更新的字段",
        statusCode: 400,
      });
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("更新字段时执行 UPDATE", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updatePosition(1, { positionName: "新名称", status: 0, tenantId: "t1" });
      expect(res.id).toBe(1);
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("position_name = ?");
      expect(sql).toContain("status = ?");
    });

    it("更新 departmentId 和 remark", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      await updatePosition(1, { departmentId: 2, remark: "新备注", tenantId: "t1" });
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("department_id = ?");
      expect(sql).toContain("remark = ?");
    });

    it("更新 sortOrder", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      await updatePosition(1, { sortOrder: 5, tenantId: "t1" });
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("sort_order = ?");
    });
  });

  describe("deletePosition", () => {
    it("岗位不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(deletePosition(1, "t1")).rejects.toMatchObject({
        message: "岗位不存在",
        statusCode: 404,
      });
    });

    it("正常删除岗位", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await deletePosition(1, "t1");
      expect(res.id).toBe(1);
    });
  });

  describe("listAllPositions", () => {
    it("返回所有启用岗位", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, positionName: "岗位1" }, { id: 2, positionName: "岗位2" }]);
      const res = await listAllPositions("t1");
      expect(res.length).toBe(2);
    });

    it("返回空数组", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      const res = await listAllPositions("t1");
      expect(res).toEqual([]);
    });
  });
});