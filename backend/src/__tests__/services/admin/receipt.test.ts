/**
 * 管理端收款单 service 单元测试
 * 被测文件：src/services/admin/receipt.service.ts
 * 覆盖全部 6 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  createReceipt,
  listReceipts,
  getReceiptDetail,
  writeoffReceipt,
  voidReceipt,
  generateReceivable,
} from "../../../services/admin/receipt.service";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
  mocks.makeBizNo.mockReset();
  mocks.makeBizNo.mockReturnValue("SK20260709001");
});

// ============ createReceipt ============
describe("admin receipt.service - createReceipt", () => {
  it("全部字段有值（?? 左分支）", async () => {
    const res = await createReceipt({
      customerId: 1, customerName: "张三", receiptType: "SALE", amount: 1000,
      paymentMethod: "CASH", bankAccountId: 1, receivedDate: "2026-07-09", remark: "备注",
      operatorId: 1, tenantId: "t1"
    });
    expect(res.receiptNo).toBe("SK20260709001");
    expect(res.status).toBe("CONFIRMED");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("可选字段为空（?? 右分支，不传 receiptType 使其为 undefined）", async () => {
    const res = await createReceipt({
      customerId: 1, amount: 500,
      operatorId: 1, tenantId: "t1"
    } as any);
    expect(res.receiptNo).toBe("SK20260709001");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ listReceipts ============
describe("admin receipt.service - listReceipts", () => {
  it("有 customerId + status + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ receiptNo: "SK001", customerId: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listReceipts({ customerId: 1, status: "CONFIRMED", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ receiptNo: "SK001", customerId: 1 }] });
  });

  it("无 customerId + 无 status + total null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listReceipts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ getReceiptDetail ============
describe("admin receipt.service - getReceiptDetail", () => {
  it("receipt 存在时返回详情+核销记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ receiptNo: "SK001", amount: 1000 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, receivableId: 1, writeoffAmount: 500 }]);
    const res = await getReceiptDetail("SK001", "t1");
    expect(res.receiptNo).toBe("SK001");
    expect(res.writeoffs).toEqual([{ id: 1, receivableId: 1, writeoffAmount: 500 }]);
  });

  it("receipt 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getReceiptDetail("SK999", "t1")).rejects.toThrow("收款单不存在");
  });
});

// ============ writeoffReceipt ============
describe("admin receipt.service - writeoffReceipt", () => {
  it("receipt 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(writeoffReceipt("SK999", 1, 100, "t1")).rejects.toThrow("收款单不存在");
  });

  it("receipt 状态非 CONFIRMED 时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, amount: 1000, status: "VOIDED" });
    await expect(writeoffReceipt("SK001", 1, 100, "t1")).rejects.toThrow("只有已确认的收款单可以核销");
  });

  it("ar 不存在时抛异常", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce(null);
    await expect(writeoffReceipt("SK001", 99, 100, "t1")).rejects.toThrow("应收记录不存在");
  });

  it("核销金额超过余额时抛异常", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce({ id: 1, balance: 50 });
    await expect(writeoffReceipt("SK001", 1, 100, "t1")).rejects.toThrow("核销金额不能超过应收余额");
  });

  it("成功核销 + 余额归零（ternary PAID 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce({ id: 1, balance: 100 });
    const res = await writeoffReceipt("SK001", 1, 100, "t1");
    expect(res.balanceAfter).toBe(0);
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });

  it("成功核销 + 余额未归零（ternary PARTIAL 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce({ id: 1, balance: 500 });
    const res = await writeoffReceipt("SK001", 1, 100, "t1");
    expect(res.balanceAfter).toBe(400);
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

// ============ voidReceipt ============
describe("admin receipt.service - voidReceipt", () => {
  it("receipt 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(voidReceipt("SK999", "t1")).rejects.toThrow("收款单不存在");
  });

  it("receipt 已作废时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "VOIDED" });
    await expect(voidReceipt("SK001", "t1")).rejects.toThrow("收款单已作废");
  });

  it("成功作废 + 有核销记录（for 循环执行）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CONFIRMED" });
    mocks.queryWithTenant.mockResolvedValue([{ receivable_id: 1, writeoff_amount: 100 }]);
    const res = await voidReceipt("SK001", "t1");
    expect(res.status).toBe("VOIDED");
    // SELECT writeoffs + UPDATE in for + DELETE + UPDATE status = 4
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(4);
  });

  it("成功作废 + 无核销记录（for 循环不执行）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CONFIRMED" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await voidReceipt("SK001", "t1");
    expect(res.status).toBe("VOIDED");
    // SELECT writeoffs + DELETE + UPDATE status = 3
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(3);
  });
});

// ============ generateReceivable ============
describe("admin receipt.service - generateReceivable", () => {
  it("existing 存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await generateReceivable("XS001", 1, "张三", 1000, "t1");
    expect(res).toBeNull();
  });

  it("existing 不存在 + customerName 有值（?? 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await generateReceivable("XS001", 1, "张三", 1000, "t1");
    expect(res).toEqual({ billNo: "XS001", customerId: 1, amount: 1000 });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("customerName 为 undefined（?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await generateReceivable("XS001", 1, undefined as any, 1000, "t1");
    expect(res).toEqual({ billNo: "XS001", customerId: 1, amount: 1000 });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});
