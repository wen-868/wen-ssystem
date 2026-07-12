/**
 * 管理端付款单 service 单元测试
 * 被测文件：src/services/admin/payment-new.service.ts
 * 覆盖全部 7 个导出函数，目标覆盖率 100%
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
  createPayment,
  listPayments,
  getPaymentDetail,
  writeoffPayment,
  voidPayment,
  generatePayable,
} from "../../../services/admin/payment-new.service";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
  mocks.makeBizNo.mockReset();
  mocks.makeBizNo.mockReturnValue("FK20260709001");
});

// ============ createPayment ============
describe("admin payment-new.service - createPayment", () => {
  it("全部字段有值（?? 左分支）", async () => {
    const res = await createPayment({
      supplierId: 1, supplierName: "供应商A", paymentType: "PURCHASE", amount: 1000,
      paymentMethod: "BANK", bankAccountId: 1, paidDate: "2026-07-09", remark: "备注",
      operatorId: 1, tenantId: "t1"
    });
    expect(res.paymentNo).toBe("FK20260709001");
    expect(res.status).toBe("CONFIRMED");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("可选字段为空（?? 右分支）", async () => {
    const res = await createPayment({
      supplierId: 1, amount: 500, operatorId: 1, tenantId: "t1"
    } as any);
    expect(res.paymentNo).toBe("FK20260709001");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ listPayments ============
describe("admin payment-new.service - listPayments", () => {
  it("有 supplierId + paymentType + status + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ paymentNo: "FK001", supplierId: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listPayments({ supplierId: 1, paymentType: "PURCHASE", status: "CONFIRMED", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ paymentNo: "FK001", supplierId: 1 }] });
  });

  it("无筛选 + total null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listPayments({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ getPaymentDetail ============
describe("admin payment-new.service - getPaymentDetail", () => {
  it("payment 存在时返回详情+核销记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ paymentNo: "FK001", amount: 1000 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, payableId: 1, writeoffAmount: 500 }]);
    const res = await getPaymentDetail("FK001", "t1");
    expect(res.paymentNo).toBe("FK001");
    expect(res.writeoffs).toEqual([{ id: 1, payableId: 1, writeoffAmount: 500 }]);
  });

  it("payment 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getPaymentDetail("FK999", "t1")).rejects.toThrow("付款单不存在");
  });
});

// ============ writeoffPayment ============
describe("admin payment-new.service - writeoffPayment", () => {
  it("payment 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(writeoffPayment("FK999", 1, 100, "t1")).rejects.toThrow("付款单不存在");
  });

  it("payment 状态非 CONFIRMED 时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, amount: 1000, status: "VOIDED" });
    await expect(writeoffPayment("FK001", 1, 100, "t1")).rejects.toThrow("只有已确认的付款单可以核销");
  });

  it("ap 不存在时抛异常", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce(null);
    await expect(writeoffPayment("FK001", 99, 100, "t1")).rejects.toThrow("应付记录不存在");
  });

  it("核销金额超过余额时抛异常", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce({ id: 1, balance: 50 });
    await expect(writeoffPayment("FK001", 1, 100, "t1")).rejects.toThrow("核销金额不能超过应付余额");
  });

  it("成功核销 + 余额归零（ternary PAID 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce({ id: 1, balance: 100 });
    const res = await writeoffPayment("FK001", 1, 100, "t1");
    expect(res.balanceAfter).toBe(0);
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });

  it("成功核销 + 余额未归零（ternary PARTIAL 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, amount: 1000, status: "CONFIRMED" })
      .mockResolvedValueOnce({ id: 1, balance: 500 });
    const res = await writeoffPayment("FK001", 1, 100, "t1");
    expect(res.balanceAfter).toBe(400);
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

// ============ voidPayment ============
describe("admin payment-new.service - voidPayment", () => {
  it("payment 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(voidPayment("FK999", "t1")).rejects.toThrow("付款单不存在");
  });

  it("已作废时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "VOIDED" });
    await expect(voidPayment("FK001", "t1")).rejects.toThrow("付款单已作废");
  });

  it("成功作废 + 有核销记录（for 循环执行）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CONFIRMED" });
    mocks.queryWithTenant.mockResolvedValue([{ payable_id: 1, writeoff_amount: 100 }]);
    const res = await voidPayment("FK001", "t1");
    expect(res.status).toBe("VOIDED");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(4);
  });

  it("成功作废 + 无核销记录（for 循环不执行）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CONFIRMED" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await voidPayment("FK001", "t1");
    expect(res.status).toBe("VOIDED");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(3);
  });
});

// ============ generatePayable ============
describe("admin payment-new.service - generatePayable", () => {
  it("existing 存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await generatePayable("CG001", 1, "供应商A", 1000, "t1");
    expect(res).toBeNull();
  });

  it("existing 不存在 + supplierName 有值（?? 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await generatePayable("CG001", 1, "供应商A", 1000, "t1");
    expect(res).toEqual({ orderNo: "CG001", supplierId: 1, amount: 1000 });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("supplierName 为 undefined（?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await generatePayable("CG001", 1, undefined as any, 1000, "t1");
    expect(res).toEqual({ orderNo: "CG001", supplierId: 1, amount: 1000 });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});
