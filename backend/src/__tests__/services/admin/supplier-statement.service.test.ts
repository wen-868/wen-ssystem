import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));

import {
  generateSupplierStatement,
  listSupplierStatements,
  getSupplierStatementDetail,
  confirmSupplierStatement,
  disputeSupplierStatement,
} from "../../../services/admin/supplier-statement.service";

const tenantId = "t1";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("DZ-TEST");
});

describe("supplier-statement.service", () => {
  it("generateSupplierStatement 计算余额并写明细", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ purchaseAmount: 1000, orderCount: 3 })
      .mockResolvedValueOnce({ paidAmount: 600 })
      .mockResolvedValueOnce({ returnAmount: 100, returnCount: 1 });
    mocks.queryWithTenant.mockImplementation(async (sql: string) => {
      if (String(sql).includes("INSERT INTO t_supplier_statement ")) return [];
      if (String(sql).includes("FROM t_purchase_order")) return [{ orderNo: "P1", goodsAmount: 1000, orderStatus: "APPROVED" }];
      if (String(sql).includes("t_supplier_payment")) return [{ paymentNo: "PAY1", amount: 600 }];
      if (String(sql).includes("t_purchase_return")) return [{ returnNo: "R1", returnAmount: 100, status: "DONE" }];
      return [];
    });
    const res = await generateSupplierStatement({ supplierId: 9, startDate: "2026-01-01", endDate: "2026-01-31", tenantId });
    expect(res.statementNo).toBe("DZ-TEST");
    expect(res.purchaseAmount).toBe(1000);
    expect(res.paidAmount).toBe(600);
    expect(res.returnAmount).toBe(100);
    expect(res.balance).toBe(300); // 1000 - 600 - 100
    expect(res.orderCount).toBe(3);
    const insertCall = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_supplier_statement "))!;
    expect(insertCall[1]).toEqual([res.statementNo, 9, "2026-01-01", "2026-01-31", 1000, 600, 100, 300, tenantId]);
    const itemInserts = mocks.queryWithTenant.mock.calls.filter((c) => String(c[0]).includes("INSERT INTO t_supplier_statement_item"));
    expect(itemInserts.length).toBeGreaterThanOrEqual(2);
  });

  it("listSupplierStatements 筛选+分页", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ statementNo: "DZ1" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const res = await listSupplierStatements({ supplierId: 9, status: "GENERATED", page: 1, pageSize: 20, tenantId });
    expect(res.total).toBe(1);
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("supplier_id = ?");
    expect(sql).toContain("statement_status = ?");
  });

  it("getSupplierStatementDetail 存在 → 返回明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ statementNo: "DZ1", supplierName: "S" });
    mocks.queryWithTenant.mockResolvedValueOnce([{ itemType: "PURCHASE" }]);
    const res = await getSupplierStatementDetail("DZ1", tenantId);
    expect(res.statementNo).toBe("DZ1");
    expect(res.items[0].itemType).toBe("PURCHASE");
  });

  it("getSupplierStatementDetail 不存在 → 抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(getSupplierStatementDetail("X", tenantId)).rejects.toThrow("对账单不存在");
  });

  it("confirmSupplierStatement GENERATED → CONFIRMED", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ statement_no: "DZ1", statement_status: "GENERATED" });
    const res = await confirmSupplierStatement("DZ1", tenantId);
    expect(res.status).toBe("CONFIRMED");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("statement_status = 'CONFIRMED'");
  });

  it("confirmSupplierStatement 非 GENERATED → 抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ statement_no: "DZ1", statement_status: "CONFIRMED" });
    await expect(confirmSupplierStatement("DZ1", tenantId)).rejects.toThrow("只有待确认的对账单可以确认");
  });

  it("confirmSupplierStatement 不存在 → 抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(confirmSupplierStatement("X", tenantId)).rejects.toThrow("对账单不存在");
  });

  it("disputeSupplierStatement GENERATED → DISPUTED", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ statement_no: "DZ1", statement_status: "GENERATED" });
    const res = await disputeSupplierStatement("DZ1", "金额不符", tenantId);
    expect(res.status).toBe("DISPUTED");
    const upd = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("DISPUTED"))!;
    expect(upd[1]).toContain("金额不符");
  });

  it("disputeSupplierStatement 非 GENERATED → 抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ statement_no: "DZ1", statement_status: "CONFIRMED" });
    await expect(disputeSupplierStatement("DZ1", "x", tenantId)).rejects.toThrow("只有待确认的对账单可以标记争议");
  });
});
