/**
 * 报表权限V2 service 单元测试
 * 被测文件：src/services/admin/report-permission-v2.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import {
  getPermissionMatrix,
  savePermissionMatrix,
  getDataScopeConfig,
  updateDataScopeConfig,
  getUserPermissions,
  assignUserPermissions,
  getMyPermissions,
  checkReportPermission,
  getAuditLogs,
} from "../../../services/admin/report-permission-v2.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ========== getPermissionMatrix ==========
describe("report-permission-v2.service - getPermissionMatrix", () => {
  it("正常返回权限矩阵列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, roleId: 1, roleName: "管理员", reportCode: "sales_report", storeScope: "ALL", canView: 1, canExport: 1, storeIds: "[1,2]" },
      { id: 2, roleId: 1, roleName: "管理员", reportCode: "inventory_report", storeScope: "SELF", canView: 1, canExport: 0, storeIds: null },
    ]);
    const res = await getPermissionMatrix("t1");
    expect(res.length).toBe(2);
    expect(res[0].canView).toBe(true);
    expect(res[0].canExport).toBe(true);
    expect(res[0].storeIds).toEqual([1, 2]);
    expect(res[1].canExport).toBe(false);
    expect(res[1].storeIds).toEqual([]);
  });

  it("storeIds 为 null 时返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, roleId: 1, roleName: "角色", reportCode: "r1", storeScope: "SELF", canView: 1, canExport: 0, storeIds: null },
    ]);
    const res = await getPermissionMatrix("t1");
    expect(res[0].storeIds).toEqual([]);
  });

  it("无数据时返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getPermissionMatrix("t1");
    expect(res).toEqual([]);
  });
});

// ========== savePermissionMatrix ==========
describe("report-permission-v2.service - savePermissionMatrix", () => {
  it("保存权限矩阵成功", async () => {
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await savePermissionMatrix(
      "t1",
      [
        { roleId: 1, reportCode: "sales", storeScope: "ALL", canView: true, canExport: true, storeIds: [1, 2] },
        { roleId: 1, reportCode: "inventory", storeScope: "SELF", canView: true, canExport: false, storeIds: [] },
      ],
      { operatorId: 1, operatorName: "管理员" }
    );
    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
  });

  it("空权限数组也成功（0条）", async () => {
    mockConn.execute.mockResolvedValue([{ affectedRows: 0 }]);
    const res = await savePermissionMatrix("t1", [], { operatorId: 1 });
    expect(res.success).toBe(true);
    expect(res.count).toBe(0);
  });
});

// ========== getDataScopeConfig ==========
describe("report-permission-v2.service - getDataScopeConfig", () => {
  it("正常返回数据权限配置", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { roleId: 1, roleName: "管理员", storeScope: "ALL", storeIds: "[1,2]" },
      { roleId: 2, roleName: "店员", storeScope: "SELF", storeIds: null },
    ]);
    const res = await getDataScopeConfig("t1");
    expect(res.length).toBe(2);
    expect(res[0].storeIds).toEqual([1, 2]);
    expect(res[1].storeIds).toEqual([]);
  });

  it("无数据时返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getDataScopeConfig("t1");
    expect(res).toEqual([]);
  });
});

// ========== updateDataScopeConfig ==========
describe("report-permission-v2.service - updateDataScopeConfig", () => {
  it("更新数据权限配置成功", async () => {
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateDataScopeConfig(
      "t1",
      [
        { roleId: 1, storeScope: "ALL", storeIds: [1, 2] },
        { roleId: 2, storeScope: "SPECIFIED", storeIds: [] },
      ],
      { operatorId: 1, operatorName: "管理员" }
    );
    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
  });
});

// ========== getUserPermissions ==========
describe("report-permission-v2.service - getUserPermissions", () => {
  it("用户无角色时返回空报表列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getUserPermissions(1, "t1");
    expect(res.reports).toEqual([]);
  });

  it("用户有角色时返回合并后的报表权限", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 1 }, { roleId: 2 }]) // userRoles
      .mockResolvedValueOnce([
        { reportCode: "sales", canView: 1, canExport: 1, storeScopes: "ALL,SELF" },
        { reportCode: "inventory", canView: 1, canExport: 0, storeScopes: "SELF" },
      ]);
    const res = await getUserPermissions(1, "t1");
    expect(res.userId).toBe(1);
    expect(res.reports.length).toBe(2);
    expect(res.reports[0].reportCode).toBe("sales");
    expect(res.reports[0].canView).toBe(true);
    expect(res.reports[0].canExport).toBe(true);
    expect(res.reports[0].storeScope).toBe("ALL");
  });

  it("storeScopes 包含 CHILDREN 时返回 CHILDREN", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 1 }])
      .mockResolvedValueOnce([
        { reportCode: "sales", canView: 1, canExport: 0, storeScopes: "CHILDREN,SELF" },
      ]);
    const res = await getUserPermissions(1, "t1");
    expect(res.reports[0].storeScope).toBe("CHILDREN");
  });

  it("storeScopes 只有 SELF 时返回 SELF", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 1 }])
      .mockResolvedValueOnce([
        { reportCode: "sales", canView: 1, canExport: 0, storeScopes: "SELF" },
      ]);
    const res = await getUserPermissions(1, "t1");
    expect(res.reports[0].storeScope).toBe("SELF");
  });
});

// ========== assignUserPermissions ==========
describe("report-permission-v2.service - assignUserPermissions", () => {
  it("分配用户权限成功", async () => {
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await assignUserPermissions(
      2,
      "t1",
      [
        { reportCode: "sales", storeScope: "ALL", canView: true, canExport: false },
      ],
      { operatorId: 1, operatorName: "管理员" }
    );
    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
  });
});

// ========== getMyPermissions ==========
describe("report-permission-v2.service - getMyPermissions", () => {
  it("返回当前用户权限", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 1 }])
      .mockResolvedValueOnce([
        { reportCode: "sales", canView: 1, canExport: 1, storeScopes: "ALL" },
      ]);
    const res = await getMyPermissions(1, "t1");
    expect(res.userId).toBe(1);
    expect(res.reports.length).toBe(1);
  });
});

// ========== checkReportPermission ==========
describe("report-permission-v2.service - checkReportPermission", () => {
  it("报表有权限时返回对应权限", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 1 }])
      .mockResolvedValueOnce([
        { reportCode: "sales", canView: 1, canExport: 1, storeScopes: "ALL" },
      ]);
    const res = await checkReportPermission(1, "t1", "sales");
    expect(res.canView).toBe(true);
    expect(res.canExport).toBe(true);
    expect(res.storeScope).toBe("ALL");
  });

  it("报表无权限时返回 false", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 1 }])
      .mockResolvedValueOnce([
        { reportCode: "sales", canView: 1, canExport: 0, storeScopes: "SELF" },
      ]);
    const res = await checkReportPermission(1, "t1", "inventory");
    expect(res.canView).toBe(false);
    expect(res.canExport).toBe(false);
  });
});

// ========== getAuditLogs ==========
describe("report-permission-v2.service - getAuditLogs", () => {
  it("无筛选条件时返回日志列表", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 1, action: "GRANT", targetType: "ROLE" }])
      .mockResolvedValueOnce([{ total: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await getAuditLogs({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(1);
    expect(res.records.length).toBe(1);
  });

  it("带全部筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await getAuditLogs({
      page: 1, pageSize: 10, tenantId: "t1",
      action: "GRANT", targetType: "ROLE", operatorId: 1,
      dateStart: "2026-01-01", dateEnd: "2026-12-31",
    });
    expect(mocks.queryWithTenant).toHaveBeenCalled();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getAuditLogs({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});
