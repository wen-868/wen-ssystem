/**
 * 管理端报表权限V2 controller 单元测试
 * 被测文件：src/controllers/admin/report-permission-v2.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  getPermissionMatrix: vi.fn(),
  savePermissionMatrix: vi.fn(),
  getDataScopeConfig: vi.fn(),
  updateDataScopeConfig: vi.fn(),
  getUserPermissions: vi.fn(),
  assignUserPermissions: vi.fn(),
  getMyPermissions: vi.fn(),
  getAuditLogs: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/report-permission-v2.service", () => ({
  getPermissionMatrix: mocks.getPermissionMatrix,
  savePermissionMatrix: mocks.savePermissionMatrix,
  getDataScopeConfig: mocks.getDataScopeConfig,
  updateDataScopeConfig: mocks.updateDataScopeConfig,
  getUserPermissions: mocks.getUserPermissions,
  assignUserPermissions: mocks.assignUserPermissions,
  getMyPermissions: mocks.getMyPermissions,
  getAuditLogs: mocks.getAuditLogs,
}));

import {
  getPermissionMatrix,
  updatePermissionMatrix,
  getDataScopeConfig,
  updateDataScopeConfig,
  getUserPermissions,
  assignUserPermissions,
  getMyPermissions,
  getAuditLogs,
} from "../../../controllers/admin/report-permission-v2.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPermissionMatrix.mockResolvedValue([]);
  mocks.savePermissionMatrix.mockResolvedValue({ success: true, count: 0 });
  mocks.getDataScopeConfig.mockResolvedValue([]);
  mocks.updateDataScopeConfig.mockResolvedValue({ success: true, count: 0 });
  mocks.getUserPermissions.mockResolvedValue({ userId: 2, reports: [] });
  mocks.assignUserPermissions.mockResolvedValue({ success: true, count: 0 });
  mocks.getMyPermissions.mockResolvedValue({ userId: 1, reports: [] });
  mocks.getAuditLogs.mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 20 });
});

describe("admin report-permission-v2.controller", () => {
  describe("getPermissionMatrix", () => {
    it("正确调用 service", async () => {
      const req = mockReq();
      const res = mockRes();
      await getPermissionMatrix(req, res, vi.fn());
      expect(mocks.getPermissionMatrix).toHaveBeenCalledWith("t1");
      expect(mocks.ok).toHaveBeenCalled();
    });
  });

  describe("updatePermissionMatrix", () => {
    it("正确调用 service", async () => {
      const permissions = [
        { roleId: 1, reportCode: "sales", storeScope: "ALL", canView: true, canExport: true },
      ];
      const req = mockReq({ body: { permissions, operatorName: "管理员" } });
      const res = mockRes();
      await updatePermissionMatrix(req, res, vi.fn());
      expect(mocks.savePermissionMatrix).toHaveBeenCalledWith("t1", permissions, {
        operatorId: 1,
        operatorName: "管理员",
      });
    });

    it("permissions 为 undefined 时传空数组", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await updatePermissionMatrix(req, res, vi.fn());
      expect(mocks.savePermissionMatrix).toHaveBeenCalledWith("t1", [], {
        operatorId: 1,
        operatorName: undefined,
      });
    });
  });

  describe("getDataScopeConfig", () => {
    it("正确调用 service", async () => {
      const req = mockReq();
      const res = mockRes();
      await getDataScopeConfig(req, res, vi.fn());
      expect(mocks.getDataScopeConfig).toHaveBeenCalledWith("t1");
      expect(mocks.ok).toHaveBeenCalled();
    });
  });

  describe("updateDataScopeConfig", () => {
    it("正确调用 service", async () => {
      const configs = [{ roleId: 1, storeScope: "ALL", storeIds: [1, 2] }];
      const req = mockReq({ body: { configs, operatorName: "管理员" } });
      const res = mockRes();
      await updateDataScopeConfig(req, res, vi.fn());
      expect(mocks.updateDataScopeConfig).toHaveBeenCalledWith("t1", configs, {
        operatorId: 1,
        operatorName: "管理员",
      });
    });

    it("configs 为 undefined 时传空数组", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await updateDataScopeConfig(req, res, vi.fn());
      expect(mocks.updateDataScopeConfig).toHaveBeenCalledWith("t1", [], {
        operatorId: 1,
        operatorName: undefined,
      });
    });
  });

  describe("getUserPermissions", () => {
    it("正确调用 service", async () => {
      const req = mockReq({ params: { userId: "2" } });
      const res = mockRes();
      await getUserPermissions(req, res, vi.fn());
      expect(mocks.getUserPermissions).toHaveBeenCalledWith(2, "t1");
      expect(mocks.ok).toHaveBeenCalled();
    });
  });

  describe("assignUserPermissions", () => {
    it("正确调用 service", async () => {
      const permissions = [{ reportCode: "sales", storeScope: "ALL", canView: true, canExport: false }];
      const req = mockReq({
        params: { userId: "2" },
        body: { permissions, operatorName: "管理员" },
      });
      const res = mockRes();
      await assignUserPermissions(req, res, vi.fn());
      expect(mocks.assignUserPermissions).toHaveBeenCalledWith(2, "t1", permissions, {
        operatorId: 1,
        operatorName: "管理员",
      });
    });

    it("permissions 为 undefined 时传空数组", async () => {
      const req = mockReq({ params: { userId: "2" }, body: {} });
      const res = mockRes();
      await assignUserPermissions(req, res, vi.fn());
      expect(mocks.assignUserPermissions).toHaveBeenCalledWith(2, "t1", [], {
        operatorId: 1,
        operatorName: undefined,
      });
    });
  });

  describe("getMyPermissions", () => {
    it("正确调用 service", async () => {
      const req = mockReq();
      const res = mockRes();
      await getMyPermissions(req, res, vi.fn());
      expect(mocks.getMyPermissions).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalled();
    });
  });

  describe("getAuditLogs", () => {
    it("默认分页参数", async () => {
      const req = mockReq();
      const res = mockRes();
      await getAuditLogs(req, res, vi.fn());
      expect(mocks.getAuditLogs).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        action: undefined,
        targetType: undefined,
        operatorId: undefined,
        dateStart: undefined,
        dateEnd: undefined,
        tenantId: "t1",
      });
    });

    it("带查询参数", async () => {
      const req = mockReq({
        query: {
          page: "2",
          pageSize: "10",
          action: "GRANT",
          targetType: "ROLE",
          operatorId: "1",
          dateStart: "2026-01-01",
          dateEnd: "2026-12-31",
        },
      });
      const res = mockRes();
      await getAuditLogs(req, res, vi.fn());
      const arg = mocks.getAuditLogs.mock.calls[0][0];
      expect(arg.page).toBe(2);
      expect(arg.pageSize).toBe(10);
      expect(arg.action).toBe("GRANT");
      expect(arg.targetType).toBe("ROLE");
      expect(arg.operatorId).toBe(1);
    });
  });
});
