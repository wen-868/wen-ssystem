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

// ============ 详情 SQL 别名回归（TOTAL-RECON-DETAIL-SQL-ALIAS-01） ============
// 背景：客户详情 SQL 的 conditions 使用 `r.tenant_id`，但 FROM 子句曾缺失 `r` 别名，
// 导致真实 MySQL 报 Unknown column 'r.tenant_id'（HTTP 500）。以下测试锁定
// "WHERE 前缀列" 与 "FROM 表别名" 必须一致，防止同类回归。
describe("admin reconciliation.service - 详情 SQL 别名回归（TOTAL-RECON-DETAIL-SQL-ALIAS-01）", () => {
  const fetchSqls = () => ({
    summarySql: mocks.queryOneWithTenant.mock.calls[1]?.[0] as string,
    detailSql: mocks.queryWithTenant.mock.calls[0]?.[0] as string,
  });

  it("客户详情：FROM t_receivable 带 r 别名，与 r.tenant_id 条件匹配", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三" })
      .mockResolvedValueOnce({ totalReceivable: 0, totalReceived: 0, balance: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    await getCustomerReconciliationDetail(1, "t1");

    const { summarySql, detailSql } = fetchSqls();
    // conditions 中的 r.tenant_id / r.customer_id 必须有对应 FROM 别名 r
    expect(summarySql).toContain("FROM t_receivable r WHERE r.tenant_id");
    expect(detailSql).toContain("FROM t_receivable r WHERE r.tenant_id");
    // 禁止回归：FROM 无别名却使用 r. 前缀（Unknown column 'r.tenant_id' 复发点）
    expect(summarySql).not.toMatch(/FROM\s+t_receivable(?!\s+r)\s+WHERE\s+r\./);
    expect(detailSql).not.toMatch(/FROM\s+t_receivable(?!\s+r)\s+WHERE\s+r\./);
  });

  it("供应商详情：FROM t_payable 带 p 别名，与 p.tenant_id 条件匹配", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "供应商A" })
      .mockResolvedValueOnce({ totalPayable: 0, totalPaid: 0, balance: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    await getSupplierReconciliationDetail(1, "t1");

    const { summarySql, detailSql } = fetchSqls();
    expect(summarySql).toContain("FROM t_payable p WHERE p.tenant_id");
    expect(detailSql).toContain("FROM t_payable p WHERE p.tenant_id");
    expect(summarySql).not.toMatch(/FROM\s+t_payable(?!\s+p)\s+WHERE\s+p\./);
    expect(detailSql).not.toMatch(/FROM\s+t_payable(?!\s+p)\s+WHERE\s+p\./);
  });

  it("跨租户隔离：租户条件参数绑定（? 占位），tenantId 不拼接进 SQL", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三" })
      .mockResolvedValueOnce({ totalReceivable: 0, totalReceived: 0, balance: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    await getCustomerReconciliationDetail(1, "tenant-A");

    const { summarySql, detailSql } = fetchSqls();
    // 租户条件存在且经 ? 参数绑定，不允许把租户值内插进 SQL 文本
    expect(summarySql).toMatch(/tenant_id\s*=\s*\?/);
    expect(detailSql).toMatch(/tenant_id\s*=\s*\?/);
    expect(summarySql).not.toContain("tenant-A");
    expect(detailSql).not.toContain("tenant-A");
    // 参数首位的 tenantId 与调用传入一致（跨租户不可泄漏的隔离口径）
    expect(mocks.queryOneWithTenant.mock.calls[1][1]).toEqual(["tenant-A", 1]);
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["tenant-A", 1]);
    // 供应商详情同口径
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "供应商A" })
      .mockResolvedValueOnce({ totalPayable: 0, totalPaid: 0, balance: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    await getSupplierReconciliationDetail(1, "tenant-B");
    expect(mocks.queryWithTenant.mock.calls.at(-1)![1]).toEqual(["tenant-B", 1]);
  });
});
