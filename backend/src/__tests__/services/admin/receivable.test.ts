/**
 * 管理端应收应付 service 单元测试
 * 被测文件：src/services/admin/receivable.service.ts
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
  listReceivables,
  listPayables,
  getReceivablesAging,
  getPayablesAging,
  getReceivableDetail,
  getPayableDetail,
} from "../../../services/admin/receivable.service";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
});

// ============ listReceivables ============
describe("admin receivable.service - listReceivables", () => {
  it("有 customerId + status + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, customerId: 1, customerName: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listReceivables({ customerId: 1, status: "PENDING", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, customerId: 1, customerName: "张三" }] });
  });

  it("无 customerId + 无 status + total null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listReceivables({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ listPayables ============
describe("admin receivable.service - listPayables", () => {
  it("有 supplierId + status + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, supplierId: 1, supplierName: "供应商A" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listPayables({ supplierId: 1, status: "PENDING", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, supplierId: 1, supplierName: "供应商A" }] });
  });

  it("无 supplierId + 无 status + total null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listPayables({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ getReceivablesAging ============
describe("admin receivable.service - getReceivablesAging", () => {
  it("返回应收账龄分析", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ agingGroup: "0-30天", totalAmount: 5000, cnt: 3 }]);
    const res = await getReceivablesAging("t1");
    expect(res).toEqual([{ agingGroup: "0-30天", totalAmount: 5000, cnt: 3 }]);
  });
});

// ============ getPayablesAging ============
describe("admin receivable.service - getPayablesAging", () => {
  it("返回应付账龄分析", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ agingGroup: "0-30天", totalAmount: 3000, cnt: 2 }]);
    const res = await getPayablesAging("t1");
    expect(res).toEqual([{ agingGroup: "0-30天", totalAmount: 3000, cnt: 2 }]);
  });
});

// ============ getReceivableDetail ============
describe("admin receivable.service - getReceivableDetail", () => {
  it("ar 存在时返回详情+核销记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, customerId: 1, balance: 500 });
    mocks.queryWithTenant.mockResolvedValue([{ writeoffAmount: 500, receiptNo: "SK001" }]);
    const res = await getReceivableDetail(1, "t1");
    expect(res.id).toBe(1);
    expect(res.writeoffs).toEqual([{ writeoffAmount: 500, receiptNo: "SK001" }]);
  });

  it("ar 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getReceivableDetail(99, "t1")).rejects.toThrow("记录不存在");
  });
});

// ============ getPayableDetail ============
describe("admin receivable.service - getPayableDetail", () => {
  it("ap 存在时返回详情+核销记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, supplierId: 1, balance: 300 });
    mocks.queryWithTenant.mockResolvedValue([{ writeoffAmount: 300, paymentNo: "FK001" }]);
    const res = await getPayableDetail(1, "t1");
    expect(res.id).toBe(1);
    expect(res.writeoffs).toEqual([{ writeoffAmount: 300, paymentNo: "FK001" }]);
  });

  it("ap 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getPayableDetail(99, "t1")).rejects.toThrow("记录不存在");
  });
});
