/**
 * 管理端授信额度 service 单元测试
 * 被测文件：src/services/admin/credit-limit.service.ts
 * 覆盖全部 8 个导出函数，目标覆盖率 100%
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
  getCreditList,
  getCreditDetail,
  initCredit,
  checkCredit,
  occupyCredit,
  releaseCredit,
  freezeCredit,
  unfreezeCredit,
} from "../../../services/admin/credit-limit.service";

const ctx = { tenantId: "t1", userId: 1, username: "admin" };
const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ============ getCreditList ============
describe("admin credit-limit.service - getCreditList", () => {
  it("有 status + keyword + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, customerId: 1, customerName: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await getCreditList("ACTIVE", "张", 1, 10, ctx);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, customerId: 1, customerName: "张三" }] });
  });

  it("无 status + 无 keyword + totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCreditList(undefined, undefined, 1, 10, ctx);
    expect(res.total).toBe(0);
  });
});

// ============ getCreditDetail ============
describe("admin credit-limit.service - getCreditDetail", () => {
  it("找到授信记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, customerId: 1, customerName: "张三", creditLimit: 100000 });
    const res = await getCreditDetail(1, ctx);
    expect(res).toEqual({ id: 1, customerId: 1, customerName: "张三", creditLimit: 100000 });
  });

  it("未找到授信记录时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCreditDetail(99, ctx);
    expect(res).toBeNull();
  });
});

// ============ initCredit ============
describe("admin credit-limit.service - initCredit", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(initCredit(99, {
      creditLimit: 100000, paymentTerm: "NET_30", lateFeeRate: 0.0005,
      maxLateFeeRate: 0.3, warningThreshold: 0.8, overdueFreezeDays: 15,
    }, ctx)).rejects.toMatchObject({ statusCode: 404, message: "客户不存在" });
  });

  it("已有授信记录时抛 400", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三" })  // customer found
      .mockResolvedValueOnce({ id: 1, status: "ACTIVE" });  // existing credit
    await expect(initCredit(1, {
      creditLimit: 100000, paymentTerm: "NET_30", lateFeeRate: 0.0005,
      maxLateFeeRate: 0.3, warningThreshold: 0.8, overdueFreezeDays: 15,
    }, ctx)).rejects.toMatchObject({ statusCode: 400, message: "该客户已有授信记录，请使用调整接口" });
  });

  it("成功初始化授信", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三" })  // customer found
      .mockResolvedValueOnce(null)  // no existing credit
      .mockResolvedValueOnce({ id: 1, customerId: 1, creditLimit: 100000, creditUsed: 0, creditAvailable: 100000, status: "ACTIVE", version: 1 });  // record
    mocks.queryWithTenant.mockResolvedValue({});  // INSERT + INSERT log
    const res = await initCredit(1, {
      creditLimit: 100000, paymentTerm: "NET_30", lateFeeRate: 0.0005,
      maxLateFeeRate: 0.3, warningThreshold: 0.8, overdueFreezeDays: 15,
    }, ctx);
    expect(res!.creditLimit).toBe(100000);
  });
});

// ============ checkCredit ============
describe("admin credit-limit.service - checkCredit", () => {
  it("授信不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(checkCredit(99, 5000, ctx)).rejects.toMatchObject({ statusCode: 404, message: "该客户尚未开通授信" });
  });

  it("warning_threshold > 0 + 达到预警线（isWarning = true）+ 额度充足", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 85000, credit_frozen: 0, credit_available: 15000,
      status: "ACTIVE", warning_threshold: 0.8, payment_term: "NET_30",
    });
    const res = await checkCredit(1, 10000, ctx);
    expect(res.isWarning).toBe(true);
    expect(res.sufficient).toBe(true);
  });

  it("warning_threshold > 0 + 未达预警线（isWarning = false）+ 额度不足", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 50000, credit_frozen: 0, credit_available: 50000,
      status: "ACTIVE", warning_threshold: 0.8, payment_term: "NET_30",
    });
    const res = await checkCredit(1, 60000, ctx);
    expect(res.isWarning).toBe(false);
    expect(res.sufficient).toBe(false);
  });

  it("warning_threshold = 0（三元 false 分支）+ amount <= 0（|| 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 50000, credit_frozen: 0, credit_available: 50000,
      status: "ACTIVE", warning_threshold: 0, payment_term: "NET_30",
    });
    const res = await checkCredit(1, 0, ctx);
    expect(res.isWarning).toBe(false);
    expect(res.sufficient).toBe(true);
  });
});

// ============ occupyCredit ============
describe("admin credit-limit.service - occupyCredit", () => {
  it("授信不存在或非 ACTIVE 时抛 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[], {}]);  // SELECT 返回空
    await expect(occupyCredit(99, { amount: 5000, orderNo: "ORD001" }, ctx))
      .rejects.toMatchObject({ statusCode: 404, message: "授信记录不存在或非ACTIVE状态" });
  });

  it("可用额度不足时抛 400", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      credit_limit: 100000, credit_used: 90000, credit_frozen: 0, credit_available: 10000,
      status: "ACTIVE", version: 1,
    }], {}]);
    await expect(occupyCredit(1, { amount: 50000, orderNo: "ORD002" }, ctx))
      .rejects.toMatchObject({ statusCode: 400, message: "可用额度不足，当前可用: 10000，需要: 50000" });
  });

  it("成功占用额度", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        credit_limit: 100000, credit_used: 50000, credit_frozen: 0, credit_available: 50000,
        status: "ACTIVE", version: 1,
      }], {}])  // SELECT
      .mockResolvedValueOnce([{}, {}])  // UPDATE
      .mockResolvedValueOnce([{}, {}]);  // INSERT log
    mocks.queryOneWithTenant.mockResolvedValue({
      creditLimit: 100000, creditUsed: 55000, creditFrozen: 0, creditAvailable: 45000,
      status: "ACTIVE", version: 2,
    });
    const res = await occupyCredit(1, { amount: 5000, orderNo: "ORD003" }, ctx);
    expect(res.occupiedAmount).toBe(5000);
    expect(res.orderNo).toBe("ORD003");
  });
});

// ============ releaseCredit ============
describe("admin credit-limit.service - releaseCredit", () => {
  it("授信不存在时抛 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[], {}]);  // SELECT 返回空
    await expect(releaseCredit(99, { amount: 5000, orderNo: "ORD001", remark: "取消订单" }, ctx))
      .rejects.toMatchObject({ statusCode: 404, message: "授信记录不存在" });
  });

  it("成功释放额度", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        credit_limit: 100000, credit_used: 50000, credit_frozen: 0, credit_available: 50000,
        status: "ACTIVE", version: 1,
      }], {}])  // SELECT
      .mockResolvedValueOnce([{}, {}])  // UPDATE
      .mockResolvedValueOnce([{}, {}]);  // INSERT log
    mocks.queryOneWithTenant.mockResolvedValue({
      creditLimit: 100000, creditUsed: 45000, creditFrozen: 0, creditAvailable: 55000,
      status: "ACTIVE", version: 2,
    });
    const res = await releaseCredit(1, { amount: 5000, orderNo: "ORD003", remark: "订单取消" }, ctx);
    expect(res.releasedAmount).toBe(5000);
  });
});

// ============ freezeCredit ============
describe("admin credit-limit.service - freezeCredit", () => {
  it("授信不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(freezeCredit(99, { freezeAmount: 10000, reason: "逾期" }, ctx))
      .rejects.toMatchObject({ statusCode: 404, message: "授信记录不存在" });
  });

  it("授信已冻结时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "FROZEN", credit_available: 50000, version: 1 });
    await expect(freezeCredit(1, { freezeAmount: 10000, reason: "逾期" }, ctx))
      .rejects.toMatchObject({ statusCode: 400, message: "授信已处于冻结状态" });
  });

  it("授信已关闭时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CLOSED", credit_available: 0, version: 1 });
    await expect(freezeCredit(1, { freezeAmount: 10000, reason: "逾期" }, ctx))
      .rejects.toMatchObject({ statusCode: 400, message: "授信已关闭，无法冻结" });
  });

  it("成功冻结 + afterCredit 存在（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "ACTIVE", credit_available: 50000, version: 1 })  // existing
      .mockResolvedValueOnce({ credit_available: 40000 });  // afterCredit
    mocks.queryWithTenant.mockResolvedValue({});  // UPDATE + INSERT log
    const res = await freezeCredit(1, { freezeAmount: 10000, reason: "逾期冻结" }, ctx);
    expect(res.status).toBe("FROZEN");
    expect(res.frozenAmount).toBe(10000);
  });

  it("成功冻结 + afterCredit 为 null（?? 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "ACTIVE", credit_available: 50000, version: 1 })  // existing
      .mockResolvedValueOnce(null);  // afterCredit null
    mocks.queryWithTenant.mockResolvedValue({});
    const res = await freezeCredit(1, { freezeAmount: 10000, reason: "逾期冻结" }, ctx);
    expect(res.status).toBe("FROZEN");
  });
});

// ============ unfreezeCredit ============
describe("admin credit-limit.service - unfreezeCredit", () => {
  it("授信不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(unfreezeCredit(99, { unfreezeAmount: 10000, reason: "解冻" }, ctx))
      .rejects.toMatchObject({ statusCode: 404, message: "授信记录不存在" });
  });

  it("授信未冻结时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "ACTIVE", credit_available: 50000, credit_frozen: 0, version: 1 });
    await expect(unfreezeCredit(1, { unfreezeAmount: 10000, reason: "解冻" }, ctx))
      .rejects.toMatchObject({ statusCode: 400, message: "授信未处于冻结状态" });
  });

  it("成功解冻 + afterCredit 存在（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "FROZEN", credit_available: 40000, credit_frozen: 10000, version: 1 })  // existing
      .mockResolvedValueOnce({ credit_available: 50000 });  // afterCredit
    mocks.queryWithTenant.mockResolvedValue({});  // UPDATE + INSERT log
    const res = await unfreezeCredit(1, { unfreezeAmount: 10000, reason: "还款解冻" }, ctx);
    expect(res.status).toBe("ACTIVE");
    expect(res.unfrozenAmount).toBe(10000);
  });

  it("成功解冻 + afterCredit 为 null（?? 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "FROZEN", credit_available: 40000, credit_frozen: 10000, version: 1 })  // existing
      .mockResolvedValueOnce(null);  // afterCredit null
    mocks.queryWithTenant.mockResolvedValue({});
    const res = await unfreezeCredit(1, { unfreezeAmount: 10000, reason: "还款解冻" }, ctx);
    expect(res.status).toBe("ACTIVE");
  });
});
