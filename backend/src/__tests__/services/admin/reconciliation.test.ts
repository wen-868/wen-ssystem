/**
 * 管理端对账 service 单元测试
 * 被测文件：src/services/admin/reconciliation.service.ts
 * 覆盖全部 6 个导出函数，目标覆盖率 100%
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
  transaction: vi.fn(),
}));

import {
  getCustomerReconciliation,
  getCustomerReconciliationDetail,
  confirmCustomerReconciliation,
  getSupplierReconciliation,
  getSupplierReconciliationDetail,
  confirmSupplierReconciliation,
} from "../../../services/admin/reconciliation.service";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
});

// ============ getCustomerReconciliation ============
describe("admin reconciliation.service - getCustomerReconciliation", () => {
  it("有 startDate + endDate（if 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ customerId: 1, customerName: "张三", totalReceivable: 5000, totalReceived: 2000, balance: 3000 }]);
    const res = await getCustomerReconciliation("t1", "2026-01-01", "2026-07-01");
    expect(res).toEqual([{ customerId: 1, customerName: "张三", totalReceivable: 5000, totalReceived: 2000, balance: 3000 }]);
  });

  it("无 startDate + 无 endDate（if 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getCustomerReconciliation("t1");
    expect(res).toEqual([]);
  });
});

// ============ getCustomerReconciliationDetail ============
describe("admin reconciliation.service - getCustomerReconciliationDetail", () => {
  it("customer 存在 + 有日期（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三" })  // customer
      .mockResolvedValueOnce({ totalReceivable: 5000, totalReceived: 2000, balance: 3000 });  // summary
    mocks.queryWithTenant.mockResolvedValue([{ sourceNo: "XS001", balance: 3000 }]);
    const res = await getCustomerReconciliationDetail(1, "t1", "2026-01-01", "2026-07-01");
    expect(res.customerName).toBe("张三");
    expect(res.balance).toBe(3000);
  });

  it("customer null + 无日期（?? 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)  // customer → null
      .mockResolvedValueOnce({ totalReceivable: 0, totalReceived: 0, balance: 0 });  // summary
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getCustomerReconciliationDetail(1, "t1");
    expect(res.customerName).toBe("");
  });
});

// ============ confirmCustomerReconciliation ============
describe("admin reconciliation.service - confirmCustomerReconciliation", () => {
  it("确认客户对账", async () => {
    const res = await confirmCustomerReconciliation(1, "t1");
    expect(res).toEqual({ customerId: 1, status: "CONFIRMED" });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ getSupplierReconciliation ============
describe("admin reconciliation.service - getSupplierReconciliation", () => {
  it("有 startDate + endDate（if 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ supplierId: 1, supplierName: "供应商A", totalPayable: 3000, totalPaid: 1000, balance: 2000 }]);
    const res = await getSupplierReconciliation("t1", "2026-01-01", "2026-07-01");
    expect(res).toEqual([{ supplierId: 1, supplierName: "供应商A", totalPayable: 3000, totalPaid: 1000, balance: 2000 }]);
  });

  it("无 startDate + 无 endDate（if 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getSupplierReconciliation("t1");
    expect(res).toEqual([]);
  });
});

// ============ getSupplierReconciliationDetail ============
describe("admin reconciliation.service - getSupplierReconciliationDetail", () => {
  it("supplier 存在 + 有日期（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "供应商A" })  // supplier
      .mockResolvedValueOnce({ totalPayable: 3000, totalPaid: 1000, balance: 2000 });  // summary
    mocks.queryWithTenant.mockResolvedValue([{ sourceNo: "CG001", balance: 2000 }]);
    const res = await getSupplierReconciliationDetail(1, "t1", "2026-01-01", "2026-07-01");
    expect(res.supplierName).toBe("供应商A");
    expect(res.balance).toBe(2000);
  });

  it("supplier null + 无日期（?? 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)  // supplier → null
      .mockResolvedValueOnce({ totalPayable: 0, totalPaid: 0, balance: 0 });  // summary
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getSupplierReconciliationDetail(1, "t1");
    expect(res.supplierName).toBe("");
  });
});

// ============ confirmSupplierReconciliation ============
describe("admin reconciliation.service - confirmSupplierReconciliation", () => {
  it("确认供应商对账", async () => {
    const res = await confirmSupplierReconciliation(1, "t1");
    expect(res).toEqual({ supplierId: 1, status: "CONFIRMED" });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});
