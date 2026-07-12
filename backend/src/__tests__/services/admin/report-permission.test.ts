/**
 * 管理端报表权限 service 单元测试
 * 被测文件：src/services/admin/report-permission.service.ts
 * 覆盖全部 2 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

import { getMatrix, saveMatrix } from "../../../services/admin/report-permission.service";

// transaction 回调接收的 conn 对象，saveMatrix 内部调用 conn.query
const mockConn = { query: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  // transaction 默认执行回调并传入 mockConn
  mocks.transaction.mockImplementation(async (cb: (conn: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ============ getMatrix ============
describe("admin report-permission.service - getMatrix", () => {
  it("返回权限矩阵列表", async () => {
    mocks.query.mockResolvedValue([
      { id: 1, role_id: 2, report_code: "sales", store_scope: "ALL", role_name: "管理员" },
    ]);
    const res = await getMatrix();
    expect(res).toEqual([{ id: 1, role_id: 2, report_code: "sales", store_scope: "ALL", role_name: "管理员" }]);
  });

  it("无数据返回空数组", async () => {
    mocks.query.mockResolvedValue([]);
    const res = await getMatrix();
    expect(res).toEqual([]);
  });
});

// ============ saveMatrix ============
describe("admin report-permission.service - saveMatrix", () => {
  it("空数组只执行 DELETE 不执行 INSERT（for 循环 0 次）", async () => {
    await saveMatrix([]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    // DELETE 执行 1 次，INSERT 执行 0 次
    expect(mockConn.query).toHaveBeenCalledTimes(1);
    expect(mockConn.query.mock.calls[0][0]).toContain("DELETE");
  });

  it("多条数据执行 DELETE + N 次 INSERT（for 循环遍历）", async () => {
    const data = [
      { role_id: 1, report_code: "sales", store_scope: "ALL" },
      { role_id: 2, report_code: "inventory", store_scope: "STORE:1" },
    ];
    await saveMatrix(data);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    // 1 次 DELETE + 2 次 INSERT
    expect(mockConn.query).toHaveBeenCalledTimes(3);
    expect(mockConn.query.mock.calls[0][0]).toContain("DELETE");
    expect(mockConn.query.mock.calls[1][0]).toContain("INSERT");
    expect(mockConn.query.mock.calls[1][1]).toEqual([1, "sales", "ALL"]);
    expect(mockConn.query.mock.calls[2][1]).toEqual([2, "inventory", "STORE:1"]);
  });
});
