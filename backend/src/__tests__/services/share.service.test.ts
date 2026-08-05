/**
 * 收款分享 service 单元测试（R78-01）
 * 被测文件：src/services/share.service.ts
 * 覆盖：wxNotifyCollection 事务+行锁+支付单幂等、payCollection 支付单复用、getCollectionPage 手机号脱敏
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connQueryOne: vi.fn(),
  connExecute: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
  connQueryOne: mocks.connQueryOne,
  connExecute: mocks.connExecute,
}));

vi.mock("../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { getCollectionPage, wxNotifyCollection, payCollection } from "../../services/share.service";

const mockConn = {};

const linkRow = {
  link_no: "LN001",
  tenant_id: "t1",
  source_no: "XS001",
  amount: 100,
  paid_amount: 0,
  status: "PENDING",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) => cb(mockConn));
  mocks.makeBizNo.mockReturnValue("ZF20260806001");
});

// ============ getCollectionPage：customerMobile 脱敏（R20） ============
describe("share.service - getCollectionPage 手机号脱敏", () => {
  it("11 位手机号对外返回脱敏格式 138****1234", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        linkNo: "LN001", tenantId: "t1", sourceType: "SALE_BILL", sourceNo: "XS001",
        amount: 100, paidAmount: 0, status: "PENDING", expireAt: null,
        taxEnabled: 0, taxRate: 0, taxAmount: 0, shareChannel: null, createdAt: "2026-01-01",
      })
      .mockResolvedValueOnce({
        billNo: "XS001", customerName: "张三", customerMobile: "13812341234", customerType: "RETAIL",
        receivableAmount: 100, receivedAmount: 0, unreceivedAmount: 100, storeId: 1, storeName: "总店",
      });
    mocks.query.mockResolvedValue([]);
    const res = await getCollectionPage("token");
    expect(res.data.customerMobile).toBe("138****1234");
  });

  it("非 11 位手机号保持原样（不改变字段语义）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        linkNo: "LN001", tenantId: "t1", sourceType: "SALE_BILL", sourceNo: "XS001",
        amount: 100, paidAmount: 0, status: "PENDING", expireAt: null,
        taxEnabled: 0, taxRate: 0, taxAmount: 0, shareChannel: null, createdAt: "2026-01-01",
      })
      .mockResolvedValueOnce({
        billNo: "XS001", customerName: "张三", customerMobile: "13812", customerType: "RETAIL",
        receivableAmount: 100, receivedAmount: 0, unreceivedAmount: 100, storeId: 1, storeName: "总店",
      });
    mocks.query.mockResolvedValue([]);
    const res = await getCollectionPage("token");
    expect(res.data.customerMobile).toBe("13812");
  });
});

// ============ wxNotifyCollection：事务 + FOR UPDATE + 支付单幂等（R6） ============
describe("share.service - wxNotifyCollection 幂等", () => {
  it("收款链接不存在 → 返回 404", async () => {
    mocks.connQueryOne.mockResolvedValueOnce(null);
    const res = await wxNotifyCollection("token", {});
    expect(res).toMatchObject({ error: "收款链接不存在", status: 404 });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("链接已 PAID → 返回已支付，不执行任何更新", async () => {
    mocks.connQueryOne.mockResolvedValueOnce({ ...linkRow, status: "PAID" });
    const res = await wxNotifyCollection("token", { payNo: "ZF001" });
    expect(res).toEqual({ data: { message: "已支付，无需重复处理" } });
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("链接已 REVOKED → 返回 400", async () => {
    mocks.connQueryOne.mockResolvedValueOnce({ ...linkRow, status: "REVOKED" });
    const res = await wxNotifyCollection("token", {});
    expect(res).toMatchObject({ error: "收款链接已失效", status: 400 });
  });

  it("链接已 EXPIRED → 返回 400", async () => {
    mocks.connQueryOne.mockResolvedValueOnce({ ...linkRow, status: "EXPIRED" });
    const res = await wxNotifyCollection("token", {});
    expect(res).toMatchObject({ error: "收款链接已失效", status: 400 });
  });

  it("锁行读取使用 FOR UPDATE（防并发重复入账）", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce(linkRow)              // 锁行读取
      .mockResolvedValueOnce({ status: "PENDING" }) // 支付单幂等检查：未处理过
      .mockResolvedValueOnce({ received_amount: 0, receivable_amount: 100 }); // 销售单查询
    mocks.connExecute.mockResolvedValue({});
    await wxNotifyCollection("token", { payNo: "ZF001", transactionId: "tx1", payAmount: 100 });
    const lockSql = mocks.connQueryOne.mock.calls[0][1] as string;
    expect(lockSql).toContain("FOR UPDATE");
  });

  it("全额支付成功 → 累加 paid_amount 并置 PAID", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce(linkRow)
      .mockResolvedValueOnce({ status: "PENDING" })
      .mockResolvedValueOnce({ received_amount: 0, receivable_amount: 100 });
    mocks.connExecute.mockResolvedValue({});
    const res = await wxNotifyCollection("token", { payNo: "ZF001", transactionId: "tx1", payAmount: 100 });
    expect(res.data.status).toBe("PAID");
    expect(res.data.paidAmount).toBe(100);
    const linkUpdate = mocks.connExecute.mock.calls[1][1] as string;
    expect(linkUpdate).toContain("UPDATE t_collection_link");
    const billUpdate = mocks.connExecute.mock.calls[2][1] as string;
    expect(billUpdate).toContain("UPDATE t_sale_bill");
  });

  it("部分支付 → 置 PARTIAL", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce(linkRow)
      .mockResolvedValueOnce({ status: "PENDING" })
      .mockResolvedValueOnce({ received_amount: 0, receivable_amount: 100 });
    mocks.connExecute.mockResolvedValue({});
    const res = await wxNotifyCollection("token", { payNo: "ZF001", payAmount: 40 });
    expect(res.data.status).toBe("PARTIAL");
    expect(res.data.paidAmount).toBe(40);
  });

  it("同一支付单已 SUCCESS → 幂等跳过，不再重复累加", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce(linkRow)
      .mockResolvedValueOnce({ status: "SUCCESS" });
    const res = await wxNotifyCollection("token", { payNo: "ZF001", transactionId: "tx1", payAmount: 100 });
    expect(res).toEqual({ data: { message: "已支付，无需重复处理" } });
    expect(mocks.connExecute).not.toHaveBeenCalled();
    expect(mocks.connQueryOne).toHaveBeenCalledTimes(2);
  });

  it("未传 payNo（模拟支付）→ 不阻塞累加流程", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce(linkRow)
      .mockResolvedValueOnce({ received_amount: 0, receivable_amount: 100 });
    mocks.connExecute.mockResolvedValue({});
    const res = await wxNotifyCollection("token", { payAmount: 100 });
    expect(res.data.status).toBe("PAID");
    expect(mocks.connExecute).toHaveBeenCalledTimes(3);
  });
});

// ============ payCollection：支付单幂等复用（R22/R58） ============
describe("share.service - payCollection 幂等复用", () => {
  it("链接不存在 → 抛 400", async () => {
    mocks.connQueryOne.mockResolvedValueOnce(null);
    await expect(payCollection("token")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("链接已 PAID → 不可支付，抛 400", async () => {
    mocks.connQueryOne.mockResolvedValueOnce({ link_no: "LN001", tenant_id: "t1", amount: 100, status: "PAID" });
    await expect(payCollection("token")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("无已有 PENDING 支付单 → 新建支付单", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce({ link_no: "LN001", tenant_id: "t1", amount: 100, status: "PENDING" })
      .mockResolvedValueOnce(null);
    const res = await payCollection("token");
    expect(res.payNo).toBe("ZF20260806001");
    expect(mocks.connExecute).toHaveBeenCalledOnce();
    const insertSql = mocks.connExecute.mock.calls[0][1] as string;
    expect(insertSql).toContain("INSERT INTO t_payment_order");
  });

  it("已有 PENDING 支付单 → 复用 payNo，不重复建单", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce({ link_no: "LN001", tenant_id: "t1", amount: 100, status: "PENDING" })
      .mockResolvedValueOnce({ pay_no: "ZF20260806001" });
    const res = await payCollection("token");
    expect(res.payNo).toBe("ZF20260806001");
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("锁行读取使用 FOR UPDATE（防并发重复建单）", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce({ link_no: "LN001", tenant_id: "t1", amount: 100, status: "PENDING" })
      .mockResolvedValueOnce(null);
    await payCollection("token");
    const lockSql = mocks.connQueryOne.mock.calls[0][1] as string;
    expect(lockSql).toContain("FOR UPDATE");
    expect(lockSql).toContain("t_collection_link");
  });

  it("复用查询限定 source_type/channel/status=PENDING", async () => {
    mocks.connQueryOne
      .mockResolvedValueOnce({ link_no: "LN001", tenant_id: "t1", amount: 100, status: "PARTIAL" })
      .mockResolvedValueOnce({ pay_no: "ZF20260806001" });
    const res = await payCollection("token");
    expect(res.payNo).toBe("ZF20260806001");
    const reuseSql = mocks.connQueryOne.mock.calls[1][1] as string;
    expect(reuseSql).toContain("source_type = 'COLLECTION_LINK'");
    expect(reuseSql).toContain("channel = 'WECHAT'");
    expect(reuseSql).toContain("status = 'PENDING'");
  });
});
