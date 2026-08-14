/**
 * 管理端客户 service 单元测试
 * 被测文件：src/services/admin/customer.service.ts
 * 覆盖全部 12 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  syncChangedFields: vi.fn(),
  detectChangedFields: vi.fn(),
  getCustomerLevelCode: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/field-sync", () => ({
  syncChangedFields: mocks.syncChangedFields,
  detectChangedFields: mocks.detectChangedFields,
}));

vi.mock("../../../shared/fulfillment", () => ({
  getCustomerLevelCode: mocks.getCustomerLevelCode,
}));

import {
  listMembers,
  createCustomer,
  getCustomerDetail,
  updateCustomer,
  disableCustomer,
  assignStaffToCustomer,
  getCustomerPriceHistory,
  listCustomerSaleBills,
  listCustomerPayments,
  listCustomerStatements,
  getCustomerPurchaseStats,
  getCustomerStats,
} from "../../../services/admin/customer.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCustomerLevelCode.mockReturnValue("NORMAL");
  mocks.syncChangedFields.mockResolvedValue([]);
  mocks.detectChangedFields.mockReturnValue([]);
});

// 等待微任务完成的辅助函数（用于不 await 的异步调用 .catch）
function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ============ listMembers ============
describe("admin customer.service - listMembers", () => {
  it("有数据 + totalRow 有值（?. 左 + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "张三", contact: "李经理" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listMembers("t1", 1, 10, "张三");
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, name: "张三", contact: "李经理" }] });
  });

  it("无数据 + totalRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listMembers("t1", 1, 10, "");
    expect(res.total).toBe(0);
    expect(res.records).toEqual([]);
  });
});

// ============ createCustomer ============
describe("admin customer.service - createCustomer", () => {
  it("全字段有值（?? 全左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 100 }]);
    const res = await createCustomer("t1", {
      name: "李四", mobile: "13800000000", customerType: "WHOLESALE",
      staffId: 5, address: "地址", settlementType: "ACCOUNT", remark: "备注", contact: "王经理",
    });
    expect(res.memberId).toBe(100);
    expect(res.contact).toBe("王经理");
    expect(res.staffId).toBe(5);
    expect(res.address).toBe("地址");
    expect(res.settlementType).toBe("ACCOUNT");
    expect(res.remark).toBe("备注");
  });

  it("可选字段全部缺省（?? 全右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 101 }]);
    const res = await createCustomer("t1", {
      name: "王五", mobile: "13900000000", customerType: "RETAIL",
    });
    expect(res.memberId).toBe(101);
    expect(res.contact).toBeNull();
    expect(res.staffId).toBeNull();
    expect(res.address).toBeNull();
    expect(res.settlementType).toBe("CASH");
    expect(res.remark).toBeNull();
  });

  it("insertId 不存在时抛错（result[0] 无 insertId）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{}]);
    await expect(createCustomer("t1", { name: "A", mobile: "1", customerType: "RETAIL" }))
      .rejects.toThrow("创建客户失败");
  });

  it("result 为空数组时抛错（result?.[0] 为 undefined）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await expect(createCustomer("t1", { name: "A", mobile: "1", customerType: "RETAIL" }))
      .rejects.toThrow("创建客户失败");
  });
});

// ============ getCustomerDetail ============
describe("admin customer.service - getCustomerDetail", () => {
  it("客户存在时返回详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ memberId: 1, name: "张三", contact: "李经理" });
    const res = await getCustomerDetail("t1", 1);
    expect(res).toEqual({ memberId: 1, name: "张三", contact: "李经理" });
  });

  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getCustomerDetail("t1", 99)).rejects.toMatchObject({ statusCode: 404, message: "客户不存在" });
  });
});

// ============ updateCustomer ============
describe("admin customer.service - updateCustomer", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateCustomer("t1", 99, { name: "新名" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("无字段需要更新时直接返回（sets.length === 0）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "张三", mobile: "138" });
    const res = await updateCustomer("t1", 1, {});
    expect(res).toEqual({ memberId: 1 });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("全字段更新 + changedFields 有值 + sync 成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "旧名", mobile: "138" });
    mocks.detectChangedFields.mockReturnValue(["name", "mobile"]);
    mocks.syncChangedFields.mockResolvedValue([]);
    const res = await updateCustomer("t1", 1, {
      name: "新名", mobile: "139", address: "新地址", customerType: "WHOLESALE",
      levelCode: "VIP", settlementType: "ACCOUNT", remark: "新备注", contact: "赵经理",
    });
    expect(res).toEqual({ memberId: 1 });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
    await flushMicrotasks();
    expect(mocks.syncChangedFields).toHaveBeenCalled();
  });

  it("全字段更新 + changedFields 为空（sync 不调用）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "张三", mobile: "138" });
    mocks.detectChangedFields.mockReturnValue([]);
    const res = await updateCustomer("t1", 1, {
      name: "张三", mobile: "138", address: "地址", customerType: "RETAIL",
      levelCode: "NORMAL", settlementType: "CASH", remark: "备注",
    });
    expect(res).toEqual({ memberId: 1 });
    await flushMicrotasks();
    expect(mocks.syncChangedFields).not.toHaveBeenCalled();
  });

  it("syncChangedFields reject 时 catch 不抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "旧名", mobile: "138" });
    mocks.detectChangedFields.mockReturnValue(["name"]);
    mocks.syncChangedFields.mockRejectedValue(new Error("sync failed"));
    const res = await updateCustomer("t1", 1, { name: "新名" });
    expect(res).toEqual({ memberId: 1 });
    await flushMicrotasks();
    // 不抛错即通过（.catch 已处理）
  });
});

// ============ disableCustomer ============
describe("admin customer.service - disableCustomer", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(disableCustomer("t1", 99)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("客户已停用时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "张三", status: "INACTIVE" });
    await expect(disableCustomer("t1", 1)).rejects.toMatchObject({ statusCode: 400, message: "客户已停用" });
  });

  it("正常停用", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "张三", status: "ACTIVE" });
    const res = await disableCustomer("t1", 1);
    expect(res).toEqual({ memberId: 1, name: "张三" });
  });
});

// ============ assignStaffToCustomer ============
describe("admin customer.service - assignStaffToCustomer", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(assignStaffToCustomer("t1", 99, 5)).rejects.toMatchObject({ statusCode: 404, message: "客户不存在" });
  });

  it("员工不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(assignStaffToCustomer("t1", 1, 99)).rejects.toMatchObject({ statusCode: 404, message: "员工不存在" });
  });

  it("正常分配员工", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 5 });
    const res = await assignStaffToCustomer("t1", 1, 5);
    expect(res).toEqual({ memberId: 1, staffId: 5 });
  });
});

// ============ getCustomerPriceHistory ============
describe("admin customer.service - getCustomerPriceHistory", () => {
  it("无购买记录时返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getCustomerPriceHistory("t1", 1, 10);
    expect(res).toEqual([]);
  });

  it("有多条购买记录时计算价格统计", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { skuId: 10, skuName: "飞天茅台", unitPrice: "1500", billNo: "B001", createdAt: "2026-01-01" },
      { skuId: 10, skuName: "飞天茅台", unitPrice: "1200", billNo: "B002", createdAt: "2026-01-02" },
      { skuId: 10, skuName: "飞天茅台", unitPrice: "1800", billNo: "B003", createdAt: "2026-01-03" },
    ]);
    const res = await getCustomerPriceHistory("t1", 1, 10);
    expect(res).toHaveLength(1);
    expect(res[0].lastPrice).toBe(1500);
    expect(res[0].highestPrice).toBe(1800);
    expect(res[0].lowestPrice).toBe(1200);
    expect(res[0].billCount).toBe(3);
    expect(res[0].lastBillNo).toBe("B001");
  });
});

// ============ listCustomerSaleBills ============
describe("admin customer.service - listCustomerSaleBills", () => {
  it("有数据 + totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ billNo: "B001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listCustomerSaleBills("t1", 1, 1, 10);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ billNo: "B001" }] });
  });

  it("无数据 + totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listCustomerSaleBills("t1", 1, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ listCustomerPayments ============
describe("admin customer.service - listCustomerPayments", () => {
  it("有数据 + totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, receiptNo: "SK001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listCustomerPayments("t1", 1, 1, 10);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, receiptNo: "SK001" }] });
  });

  it("无数据 + totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listCustomerPayments("t1", 1, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ listCustomerStatements ============
describe("admin customer.service - listCustomerStatements", () => {
  it("有数据 + totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, statementNo: "DZ001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listCustomerStatements("t1", 1, 1, 10);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, statementNo: "DZ001" }] });
  });

  it("无数据 + totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listCustomerStatements("t1", 1, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ getCustomerPurchaseStats ============
describe("admin customer.service - getCustomerPurchaseStats", () => {
  it("有统计数据 + lastOrder 有值", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ billCount: 10, totalAmount: 5000, receivedAmount: 3000, unpaidAmount: 2000 });
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, skuName: "茅台", totalQty: 100, totalAmount: 5000 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ lastOrderAt: "2026-07-01" });
    const res = await getCustomerPurchaseStats("t1", 1);
    expect(res.billCount).toBe(10);
    expect(res.totalAmount).toBe(5000);
    expect(res.receivedAmount).toBe(3000);
    expect(res.unpaidAmount).toBe(2000);
    expect(res.lastOrderAt).toBe("2026-07-01");
    expect(res.topProducts).toHaveLength(1);
  });

  it("无统计数据 + lastOrder 为 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    const res = await getCustomerPurchaseStats("t1", 1);
    expect(res.billCount).toBe(0);
    expect(res.totalAmount).toBe(0);
    expect(res.receivedAmount).toBe(0);
    expect(res.unpaidAmount).toBe(0);
    expect(res.lastOrderAt).toBeNull();
  });
});

// ============ getCustomerStats ============
describe("admin customer.service - getCustomerStats", () => {
  it("全部统计有值", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 100 })       // totalRow
      .mockResolvedValueOnce({ cnt: 10 })           // newMonthRow
      .mockResolvedValueOnce({ cnt: 50 })           // activeRow
      .mockResolvedValueOnce({ cnt: 5 })            // debtRow
      .mockResolvedValueOnce({ total: 20000 });     // receivableRow
    const res = await getCustomerStats("t1");
    expect(res).toEqual({ total: 100, newThisMonth: 10, activeCount: 50, debtCount: 5, totalReceivable: 20000 });
  });

  it("全部统计为 null（?. 右 + ?? 右）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getCustomerStats("t1");
    expect(res).toEqual({ total: 0, newThisMonth: 0, activeCount: 0, debtCount: 0, totalReceivable: 0 });
  });
});
