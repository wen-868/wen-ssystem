/**
 * 管理端客户合并 service 单元测试
 * 被测文件：src/services/admin/customer-merge.service.ts
 * 覆盖全部 4 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

import {
  detectDuplicates,
  getCustomerRelations,
  mergeCustomers,
  getDuplicateGroups,
} from "../../../services/admin/customer-merge.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
  mockConn.execute.mockResolvedValue([]);
});

// ============ detectDuplicates ============
describe("admin customer-merge.service - detectDuplicates", () => {
  it("type=all + 有 mobile 和 name 重复（两个 || 右分支 + for 有数据）", async () => {
    mocks.query
      .mockResolvedValueOnce([{ mobile: "138", count: 2, customer_ids: "1,2", customer_names: "A,B" }])  // mobileDuplicates
      .mockResolvedValueOnce([{ id: 1, name: "A", mobile: "138" }, { id: 2, name: "B", mobile: "138" }])  // mobile customers
      .mockResolvedValueOnce([{ name: "张三", count: 2, customer_ids: "3,4" }])  // nameDuplicates
      .mockResolvedValueOnce([{ id: 3, name: "张三", mobile: "139" }, { id: 4, name: "张三", mobile: "137" }]);  // name customers
    const res = await detectDuplicates("t1", "all");
    expect(res.total).toBe(2);
    expect(res.duplicates[0].type).toBe("mobile");
    expect(res.duplicates[1].type).toBe("name");
  });

  it("type=mobile + 无重复（第一个 || 左true + 第二个 || 左false+右false + for 无数据）", async () => {
    mocks.query.mockResolvedValueOnce([]);  // mobileDuplicates 空数组
    const res = await detectDuplicates("t1", "mobile");
    expect(res.total).toBe(0);
  });

  it("type=name + 无重复（第一个 || 左false+右false + 第二个 || 左true + for 无数据）", async () => {
    mocks.query.mockResolvedValueOnce([]);  // nameDuplicates 空数组
    const res = await detectDuplicates("t1", "name");
    expect(res.total).toBe(0);
  });
});

// ============ getCustomerRelations ============
describe("admin customer-merge.service - getCustomerRelations", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getCustomerRelations("t1", 99)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("全部有值 + creditInfo 有值（|| 左分支）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138" })
      .mockResolvedValueOnce({ order_count: 10, total_amount: 5000, paid_amount: 3000, unpaid_amount: 2000 })
      .mockResolvedValueOnce({ payment_count: 5, total_received: 3000 })
      .mockResolvedValueOnce({ credit_limit: 10000, credit_used: 2000, credit_available: 8000 })
      .mockResolvedValueOnce({ visit_count: 3 });
    const res = await getCustomerRelations("t1", 1);
    expect(res.customer.name).toBe("张三");
    expect(res.relations.credit).toEqual({ credit_limit: 10000, credit_used: 2000, credit_available: 8000 });
  });

  it("creditInfo 为 null（|| 右分支）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getCustomerRelations("t1", 1);
    expect(res.relations.credit).toEqual({ credit_limit: 0, credit_used: 0, credit_available: 0 });
  });
});

// ============ mergeCustomers ============
describe("admin customer-merge.service - mergeCustomers", () => {
  it("主客户不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(mergeCustomers("t1", { primaryCustomerId: 99, duplicateCustomerIds: [2], mergeName: true, mergeMobile: true, mergeAddress: true, mergeRemark: true }, 1, "user1"))
      .rejects.toMatchObject({ statusCode: 404, message: "主客户不存在" });
  });

  it("重复客户数量不匹配时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, name: "张三", mobile: "138", address: "地址", remark: "备注" });
    mocks.query.mockResolvedValue([]);  // 空数组，length 不匹配
    await expect(mergeCustomers("t1", { primaryCustomerId: 1, duplicateCustomerIds: [2, 3], mergeName: true, mergeMobile: true, mergeAddress: true, mergeRemark: true }, 1, "user1"))
      .rejects.toMatchObject({ statusCode: 400, message: "部分重复客户不存在" });
  });

  it("全合并 + primaryCustomer 全空 + duplicates 有值 + primaryCredit 存在（&& 左true+右true + found + allRemarks 有值 + updates > 0）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1, name: null, mobile: null, address: null, remark: null })  // primaryCustomer
      .mockResolvedValueOnce({ id: 100 })  // primaryCredit (存在)
      .mockResolvedValueOnce({ id: 1, name: "新名", mobile: "139", address: "新地址", remark: "合并后" });  // mergedCustomer
    mocks.query.mockResolvedValue([{ id: 2, name: "重复A", mobile: "139", address: "新地址", remark: "备注A" }]);
    const res = await mergeCustomers("t1", { primaryCustomerId: 1, duplicateCustomerIds: [2], mergeName: true, mergeMobile: true, mergeAddress: true, mergeRemark: true }, 1, "user1");
    expect(res.deletedCount).toBe(1);
    expect(mockConn.execute).toHaveBeenCalled();
  });

  it("全合并 + primaryCustomer 全有值（&& 左true+右false + mergeRemark true + allRemarks 有值）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138", address: "地址", remark: "主备注" })
      .mockResolvedValueOnce({ id: 100 })
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138", address: "地址", remark: "主备注 | 重复备注" });
    mocks.query.mockResolvedValue([{ id: 2, name: "李四", mobile: "139", address: "新地址", remark: "重复备注" }]);
    const res = await mergeCustomers("t1", { primaryCustomerId: 1, duplicateCustomerIds: [2], mergeName: true, mergeMobile: true, mergeAddress: true, mergeRemark: true }, 1, "user1");
    expect(res.deletedCount).toBe(1);
  });

  it("全不合并 + primaryCredit 存在（&& 左false + mergeRemark false + updates === 0）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138", address: "地址", remark: "备注" })
      .mockResolvedValueOnce({ id: 100 })
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138", address: "地址", remark: "备注" });
    mocks.query.mockResolvedValue([{ id: 2, name: "李四", mobile: "139", address: "新地址", remark: "重复" }]);
    const res = await mergeCustomers("t1", { primaryCustomerId: 1, duplicateCustomerIds: [2], mergeName: false, mergeMobile: false, mergeAddress: false, mergeRemark: false }, 1, "user1");
    expect(res.deletedCount).toBe(1);
    // updates.length === 0 时不执行 UPDATE member
    const executeCalls = mockConn.execute.mock.calls.map(c => c[0] as string);
    expect(executeCalls.some((sql: string) => sql.includes("UPDATE member SET"))).toBe(false);
  });

  it("全合并 + primaryCustomer 全空 + duplicates 全空（found false + allRemarks 空）+ primaryCredit 不存在 + firstCredit 存在", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1, name: null, mobile: null, address: null, remark: null })  // primaryCustomer
      .mockResolvedValueOnce(null)  // primaryCredit 不存在
      .mockResolvedValueOnce({ id: 200 })  // firstCredit 存在
      .mockResolvedValueOnce({ id: 1, name: null, mobile: null, address: null, remark: null });
    mocks.query.mockResolvedValue([{ id: 2, name: null, mobile: null, address: null, remark: null }]);
    const res = await mergeCustomers("t1", { primaryCustomerId: 1, duplicateCustomerIds: [2], mergeName: true, mergeMobile: true, mergeAddress: true, mergeRemark: true }, 1, "user1");
    expect(res.deletedCount).toBe(1);
  });

  it("全不合并 + primaryCredit 不存在 + firstCredit 不存在", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138", address: "地址", remark: "备注" })
      .mockResolvedValueOnce(null)  // primaryCredit 不存在
      .mockResolvedValueOnce(null)  // firstCredit 不存在
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138", address: "地址", remark: "备注" });
    mocks.query.mockResolvedValue([{ id: 2, name: "李四", mobile: "139", address: "新地址", remark: "重复" }]);
    const res = await mergeCustomers("t1", { primaryCustomerId: 1, duplicateCustomerIds: [2], mergeName: false, mergeMobile: false, mergeAddress: false, mergeRemark: false }, 1, "user1");
    expect(res.deletedCount).toBe(1);
  });
});

// ============ getDuplicateGroups ============
describe("admin customer-merge.service - getDuplicateGroups", () => {
  it("有重复组（mobileTotal/nameTotal 有 length）", async () => {
    mocks.query
      .mockResolvedValueOnce([{ mobile: "138", count: 2, customer_ids: "1,2", customer_names: "A,B" }])
      .mockResolvedValueOnce([{ name: "张三", count: 2, customer_ids: "3,4" }]);
    mocks.queryOne
      .mockResolvedValueOnce([{ total: 1 }])  // mobileTotal (有 length)
      .mockResolvedValueOnce([{ total: 1 }]);  // nameTotal (有 length)
    const res = await getDuplicateGroups("t1", 1, 10);
    expect(res.mobileGroups.total).toBe(1);
    expect(res.nameGroups.total).toBe(1);
  });

  it("无重复组（mobileTotal/nameTotal 为 null）", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.queryOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getDuplicateGroups("t1", 1, 10);
    expect(res.mobileGroups.total).toBe(0);
    expect(res.nameGroups.total).toBe(0);
  });
});
