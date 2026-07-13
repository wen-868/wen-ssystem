/**
 * 管理端岗位 controller 单元测试
 * 被测文件：src/controllers/admin/position.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  listPositions: vi.fn(),
  getPosition: vi.fn(),
  createPosition: vi.fn(),
  updatePosition: vi.fn(),
  deletePosition: vi.fn(),
  listAllPositions: vi.fn(),
}));

vi.mock("../../../services/admin/position.service", () => ({
  ...vi.importActual("../../../services/admin/position.service"),
  listPositions: mocks.listPositions,
  getPosition: mocks.getPosition,
  createPosition: mocks.createPosition,
  updatePosition: mocks.updatePosition,
  deletePosition: mocks.deletePosition,
  listAllPositions: mocks.listAllPositions,
}));

import {
  listPositions,
  getPosition,
  createPosition,
  updatePosition,
  deletePosition,
  listAllPositions,
} from "../../../controllers/admin/position.controller";

const mockReq = (overrides: any = {}) => ({
  query: {},
  params: {},
  body: {},
  tenantId: "t1",
  ...overrides,
});

const mockRes = () => ({
  json: vi.fn(),
});

describe("position.controller", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listPositions", () => {
    it("默认参数", async () => {
      mocks.listPositions.mockResolvedValue({ total: 0, records: [] });
      await listPositions(mockReq(), mockRes());
      expect(mocks.listPositions).toHaveBeenCalledWith({
        departmentId: undefined,
        status: undefined,
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      });
    });

    it("带 departmentId 参数", async () => {
      mocks.listPositions.mockResolvedValue({ total: 1, records: [] });
      await listPositions(mockReq({ query: { departmentId: "1", page: 2, pageSize: 10 } }), mockRes());
      expect(mocks.listPositions).toHaveBeenCalledWith({
        departmentId: 1,
        status: undefined,
        page: 2,
        pageSize: 10,
        tenantId: "t1",
      });
    });

    it("带 status 参数", async () => {
      mocks.listPositions.mockResolvedValue({ total: 1, records: [] });
      await listPositions(mockReq({ query: { status: "0" } }), mockRes());
      expect(mocks.listPositions).toHaveBeenCalledWith({
        departmentId: undefined,
        status: 0,
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      });
    });

    it("同时带 departmentId 和 status", async () => {
      mocks.listPositions.mockResolvedValue({ total: 1, records: [] });
      await listPositions(mockReq({ query: { departmentId: "2", status: "1" } }), mockRes());
      expect(mocks.listPositions).toHaveBeenCalledWith({
        departmentId: 2,
        status: 1,
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      });
    });
  });

  describe("getPosition", () => {
    it("获取岗位详情", async () => {
      mocks.getPosition.mockResolvedValue({ id: 1, positionName: "岗位1" });
      await getPosition(mockReq({ params: { id: "1" } }), mockRes());
      expect(mocks.getPosition).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("createPosition", () => {
    it("创建岗位", async () => {
      mocks.createPosition.mockResolvedValue({ id: 1, positionName: "岗位1" });
      await createPosition(mockReq({ body: { positionName: "岗位1", positionCode: "P001" } }), mockRes());
      expect(mocks.createPosition).toHaveBeenCalled();
    });
  });

  describe("updatePosition", () => {
    it("更新岗位", async () => {
      mocks.updatePosition.mockResolvedValue({ id: 1 });
      await updatePosition(mockReq({ params: { id: "1" }, body: { positionName: "新名称" } }), mockRes());
      expect(mocks.updatePosition).toHaveBeenCalled();
    });
  });

  describe("deletePosition", () => {
    it("删除岗位", async () => {
      mocks.deletePosition.mockResolvedValue({ id: 1 });
      await deletePosition(mockReq({ params: { id: "1" } }), mockRes());
      expect(mocks.deletePosition).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("listAllPositions", () => {
    it("获取所有启用岗位", async () => {
      mocks.listAllPositions.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await listAllPositions(mockReq(), mockRes());
      expect(mocks.listAllPositions).toHaveBeenCalledWith("t1");
    });
  });
});