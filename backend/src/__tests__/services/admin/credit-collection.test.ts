/**
 * 管理端催收管理 service 单元测试
 * 被测文件：src/services/admin/credit-collection.service.ts
 * 覆盖全部 6 个导出函数，目标覆盖率 100%
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

import {
  getCollectionList,
  createCollection,
  updateCollection,
  getOverdueCustomers,
  batchRemind,
  getCollectionStatistics,
} from "../../../services/admin/credit-collection.service.js";

const ctx = { tenantId: "t1", userId: 1, username: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ getCollectionList ============
describe("admin credit-collection.service - getCollectionList", () => {
  it("全部筛选条件有值 + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, customerId: 1, customerName: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await getCollectionList("LIGHT", "1", "PROMISED", "2026-01-01", "2026-12-31", 1, 10, ctx);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, customerId: 1, customerName: "张三" }] });
  });

  it("无筛选条件 + totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCollectionList(undefined, undefined, undefined, undefined, undefined, 1, 10, ctx);
    expect(res.total).toBe(0);
  });
});

// ============ createCollection ============
describe("admin credit-collection.service - createCollection", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(createCollection({
      customerId: 99, overdueDays: 10, overdueAmount: 5000,
      collectionLevel: "LIGHT", collectionMethod: "PHONE", contactPerson: "李四",
    }, ctx)).rejects.toMatchObject({ statusCode: 404, message: "客户不存在" });
  });

  it("全字段有值（?? null 全左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三" })  // customer
      .mockResolvedValueOnce({ id: 10, customerId: 1, customerName: "张三" });  // record
    const res = await createCollection({
      customerId: 1, receivableNo: "YS001", overdueDays: 10, overdueAmount: 5000,
      collectionLevel: "LIGHT", collectionMethod: "PHONE", collectionContent: "电话催收",
      contactPerson: "李四", contactResult: "PROMISED", promisedAmount: 3000,
      promisedDate: "2026-07-15", nextFollowUpDate: "2026-07-12",
    }, ctx);
    expect(res.id).toBe(10);
  });

  it("可选字段缺省（?? null 全右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 2, name: "李四" })  // customer
      .mockResolvedValueOnce({ id: 11, customerId: 2, customerName: "李四" });  // record
    const res = await createCollection({
      customerId: 2, overdueDays: 5, overdueAmount: 2000,
      collectionLevel: "REMIND", collectionMethod: "SMS", contactPerson: "王五",
    }, ctx);
    expect(res.id).toBe(11);
  });
});

// ============ updateCollection ============
describe("admin credit-collection.service - updateCollection", () => {
  it("催收记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateCollection(99, { contactResult: "PROMISED" }, ctx))
      .rejects.toMatchObject({ statusCode: 404, message: "催收记录不存在" });
  });

  it("有更新字段时执行 UPDATE（updates.length > 0）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })  // existing
      .mockResolvedValueOnce({ id: 1, contactResult: "PROMISED" });  // record
    const res = await updateCollection(1, {
      contactResult: "PROMISED", promisedAmount: 3000, promisedDate: "2026-07-15",
      nextFollowUpDate: "2026-07-12", collectionContent: "已承诺还款",
    }, ctx);
    expect(res.contactResult).toBe("PROMISED");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();  // UPDATE
  });

  it("无更新字段时跳过 UPDATE（updates.length === 0）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })  // existing
      .mockResolvedValueOnce({ id: 1, contactResult: null });  // record
    const res = await updateCollection(1, {}, ctx);
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();  // 不执行 UPDATE
  });
});

// ============ getOverdueCustomers ============
describe("admin credit-collection.service - getOverdueCustomers", () => {
  it("返回逾期客户列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ customerId: 1, customerName: "张三", estimatedOverdueDays: 10 }]);
    const res = await getOverdueCustomers(ctx);
    expect(res).toEqual({ total: 1, records: [{ customerId: 1, customerName: "张三", estimatedOverdueDays: 10 }] });
  });

  it("无逾期客户时返回空列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getOverdueCustomers(ctx);
    expect(res).toEqual({ total: 0, records: [] });
  });
});

// ============ batchRemind ============
describe("admin credit-collection.service - batchRemind", () => {
  it("全部成功 + credit 存在（?? 左分支）+ 无错误（errors 为 undefined）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "13800000001" })  // customer 1
      .mockResolvedValueOnce({ credit_used: 5000, credit_limit: 10000 })  // credit 1
      .mockResolvedValueOnce({ id: 2, name: "李四", mobile: "13800000002" })  // customer 2
      .mockResolvedValueOnce({ credit_used: 3000, credit_limit: 8000 });  // credit 2
    const res = await batchRemind({
      customerIds: [1, 2], method: "SMS", content: "请尽快还款", collectionLevel: "REMIND",
    }, ctx);
    expect(res.successCount).toBe(2);
    expect(res.failCount).toBe(0);
    expect(res.errors).toBeUndefined();
  });

  it("客户不存在 + credit 不存在（?? 右分支）+ 有错误（errors 为数组）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)  // customer 1 不存在
      .mockResolvedValueOnce({ id: 2, name: "李四", mobile: "13800000002" })  // customer 2
      .mockResolvedValueOnce(null);  // credit 2 不存在 → credit?.credit_used ?? 0
    const res = await batchRemind({
      customerIds: [1, 2], method: "PHONE", content: "催收", collectionLevel: "LIGHT",
    }, ctx);
    expect(res.successCount).toBe(1);  // 只有 customer 2 成功
    expect(res.failCount).toBe(1);
    expect(res.errors).toEqual(["客户1不存在"]);
  });

  it("queryOneWithTenant 抛异常时走 catch 分支", async () => {
    mocks.queryOneWithTenant.mockRejectedValueOnce(new Error("数据库连接失败"));
    const res = await batchRemind({
      customerIds: [1], method: "SMS", content: "提醒", collectionLevel: "REMIND",
    }, ctx);
    expect(res.successCount).toBe(0);
    expect(res.failCount).toBe(1);
    expect(res.errors).toEqual(["客户1处理失败: 数据库连接失败"]);
  });
});

// ============ getCollectionStatistics ============
describe("admin credit-collection.service - getCollectionStatistics", () => {
  it("全部统计数据有值 + levelStats/resultStats 有数据", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ collectionLevel: "REMIND", count: 5 }, { collectionLevel: "LIGHT", count: 3 }])  // levelStats
      .mockResolvedValueOnce([{ contactResult: "PROMISED", count: 2 }]);  // resultStats
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 10 })  // totalCount
      .mockResolvedValueOnce({ total: 5000 })  // promisedTotal
      .mockResolvedValueOnce({ count: 3 })  // monthCount
      .mockResolvedValueOnce({ count: 1 });  // followUpCount
    const res = await getCollectionStatistics(ctx);
    expect(res.totalCollections).toBe(10);
    expect(res.monthCollections).toBe(3);
    expect(res.totalPromisedAmount).toBe(5000);
    expect(res.pendingFollowUps).toBe(1);
    expect(res.byLevel).toEqual({ REMIND: 5, LIGHT: 3 });
    expect(res.byResult).toEqual({ PROMISED: 2 });
  });

  it("全部统计数据为 null + levelStats/resultStats 为空（?? 全右分支）", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([])  // levelStats 空
      .mockResolvedValueOnce([]);  // resultStats 空
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)  // totalCount
      .mockResolvedValueOnce(null)  // promisedTotal
      .mockResolvedValueOnce(null)  // monthCount
      .mockResolvedValueOnce(null);  // followUpCount
    const res = await getCollectionStatistics(ctx);
    expect(res.totalCollections).toBe(0);
    expect(res.monthCollections).toBe(0);
    expect(res.totalPromisedAmount).toBe(0);
    expect(res.pendingFollowUps).toBe(0);
    expect(res.byLevel).toEqual({});
    expect(res.byResult).toEqual({});
  });
});
