import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import { getPermissionMatrix, savePermissionMatrix } from "../../../services/admin/report-permission-v2.service";

describe("admin/report-permission-v2.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getPermissionMatrix：返回报表权限矩阵（联角色名）", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 1, roleId: 2, roleName: "店长", reportCode: "SALES", storeScope: "SELF", canView: 1, canExport: 0, storeIds: null },
    ]);
    const result = await getPermissionMatrix("t1");
    expect(result[0].roleName).toBe("店长");
    expect(result[0].canView).toBe(true);
    expect(result[0].canExport).toBe(false);
  });

  it("savePermissionMatrix：全量替换权限矩阵", async () => {
    const conn = { execute: vi.fn() };
    conn.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // DELETE
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // 审计日志
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));

    const result = await savePermissionMatrix("t1", [
      { roleId: 2, reportCode: "SALES", storeScope: "SELF", canView: true, canExport: false, storeIds: [] },
    ], { operatorId: 1, operatorName: "管理员" });
    expect(result).not.toBeNull();
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_report_permission_matrix"),
      ["t1"]
    );
  });
});
