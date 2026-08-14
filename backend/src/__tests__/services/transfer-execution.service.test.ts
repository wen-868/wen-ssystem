import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import {
  getInTransitOrders,
  getMyShipments,
  cancelTransferOrder,
} from "../../services/transfer-execution.service";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
  mocks.connExecute.mockImplementation(async (conn: typeof mockConn, sql: string, params: unknown[]) => conn.execute(sql, params));
});

describe("transfer-execution.service - 调拨执行（查询与取消）", () => {
  it("getInTransitOrders 查询入站在途单", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, transfer_no: "DB1", status: "TRANSIT" }]);
    const res = await getInTransitOrders(2, tenantId);
    expect(res).toHaveLength(1);
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("to_store_id = ?");
    expect(sql).toContain("status IN ('APPROVED', 'TRANSIT')");
  });

  it("getMyShipments 查询本店出库单", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 2, transfer_no: "DB2", status: "RECEIVED" }]);
    const res = await getMyShipments(1, tenantId);
    expect(res[0].transfer_no).toBe("DB2");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("from_store_id = ?");
  });

  it("cancelTransferOrder 草稿/待审核可取消", async () => {
    mockConn.execute.mockResolvedValueOnce([[{ id: 1, status: "DRAFT" }]]);
    mockConn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await cancelTransferOrder(1, tenantId);
    expect(res).toEqual({ transferOrderId: 1 });
    const updateCall = mockConn.execute.mock.calls[1];
    expect(String(updateCall[0])).toContain("SET status = 'CANCELLED'");
  });

  it("cancelTransferOrder 非草稿/待审核状态抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[{ id: 1, status: "TRANSIT" }]]);
    await expect(cancelTransferOrder(1, tenantId))
      .rejects.toThrow("仅草稿或待审核状态可取消");
  });

  it("cancelTransferOrder 单不存在抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[]]);
    await expect(cancelTransferOrder(99, tenantId))
      .rejects.toThrow("调拨单不存在");
  });
});
