/**
 * 管理端信用调整 service 单元测试
 * 被测文件：src/services/admin/credit-adjust.service.ts
 * 覆盖 CreditAdjustService 全部 3 个方法，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import { creditAdjustService } from "../../../services/admin/credit-adjust.service.js";

const ctx = { tenantId: "t1", userId: 1, username: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ adjustLimit ============
describe("admin credit-adjust.service - adjustLimit", () => {
  it("affectedRows 为 0 时抛 404", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 0 });
    await expect(creditAdjustService.adjustLimit(99, { creditLimit: 100000, reason: "测试" }, ctx))
      .rejects.toMatchObject({ statusCode: 404, message: "授信记录不存在或已关闭" });
  });

  it("成功调整 + credit 存在（?? 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ credit_available: 50000 })  // SELECT credit_available
      .mockResolvedValueOnce({ id: 1, customerId: 1, creditLimit: 100000, creditUsed: 50000, creditAvailable: 50000, status: "ACTIVE", version: 2 });  // SELECT record
    const res = await creditAdjustService.adjustLimit(1, { creditLimit: 100000, reason: "提额" }, ctx);
    expect(res.creditLimit).toBe(100000);
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);  // UPDATE + INSERT log
  });

  it("成功调整 + credit 为 null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)  // SELECT credit_available → null
      .mockResolvedValueOnce(null);  // SELECT record → null
    const res = await creditAdjustService.adjustLimit(1, { creditLimit: 200000, reason: "提额" }, ctx);
    expect(res).toBeNull();
  });
});

// ============ adjustTerm ============
describe("admin credit-adjust.service - adjustTerm", () => {
  it("授信记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(creditAdjustService.adjustTerm(99, { paymentTerm: "NET_30", reason: "测试" }, ctx))
      .rejects.toMatchObject({ statusCode: 404, message: "授信记录不存在" });
  });

  it("授信已关闭时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, payment_term: "NET_7", status: "CLOSED" });
    await expect(creditAdjustService.adjustTerm(1, { paymentTerm: "NET_30", reason: "测试" }, ctx))
      .rejects.toMatchObject({ statusCode: 400, message: "授信已关闭，无法调整账期" });
  });

  it("成功调整账期", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, payment_term: "NET_7", status: "ACTIVE" })  // SELECT existing
      .mockResolvedValueOnce({ id: 1, customerId: 1, creditLimit: 100000, creditAvailable: 50000, paymentTerm: "NET_30", status: "ACTIVE", version: 2 });  // SELECT record
    const res = await creditAdjustService.adjustTerm(1, { paymentTerm: "NET_30", reason: "延长账期" }, ctx);
    expect(res.paymentTerm).toBe("NET_30");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);  // UPDATE + INSERT log
  });
});

// ============ getOperationLogs ============
describe("admin credit-adjust.service - getOperationLogs", () => {
  it("total 有值时返回正确总数", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, operationType: "ADJUST_LIMIT", amount: 100000 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await creditAdjustService.getOperationLogs(1, 1, 10, ctx);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, operationType: "ADJUST_LIMIT", amount: 100000 }] });
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await creditAdjustService.getOperationLogs(1, 1, 10, ctx);
    expect(res.total).toBe(0);
  });
});
