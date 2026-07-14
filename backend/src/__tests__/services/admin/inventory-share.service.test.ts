/**
 * 库存共享 service 单元测试
 * 被测文件：src/services/admin/inventory-share.service.ts
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
  getShareSetting,
  updateShareSetting,
  listShareProducts,
  addShareProduct,
  batchAddShareProducts,
  updateShareProduct,
  removeShareProduct,
  batchRemoveShareProducts,
} from "../../../services/admin/inventory-share.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ========== getShareSetting ==========
describe("inventory-share.service - getShareSetting", () => {
  it("设置存在时返回设置", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1,
      share_enabled: 1,
      auto_transfer: 0,
      auto_transfer_threshold: 10,
      share_scope: "ALL",
      specified_store_ids: "[1,2,3]",
    });
    const res = await getShareSetting("t1");
    expect(res.shareEnabled).toBe(true);
    expect(res.autoTransfer).toBe(false);
    expect(res.autoTransferThreshold).toBe(10);
    expect(res.shareScope).toBe("ALL");
    expect(res.specifiedStoreIds).toEqual([1, 2, 3]);
  });

  it("设置不存在时返回默认设置", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getShareSetting("t1");
    expect(res.id).toBe(0);
    expect(res.shareEnabled).toBe(false);
    expect(res.autoTransfer).toBe(false);
    expect(res.shareScope).toBe("ALL");
    expect(res.specifiedStoreIds).toEqual([]);
  });

  it("specified_store_ids 为 null 时返回空数组", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1,
      share_enabled: 0,
      auto_transfer: 0,
      auto_transfer_threshold: 0,
      share_scope: "ALL",
      specified_store_ids: null,
    });
    const res = await getShareSetting("t1");
    expect(res.specifiedStoreIds).toEqual([]);
  });
});

// ========== updateShareSetting ==========
describe("inventory-share.service - updateShareSetting", () => {
  it("设置不存在时插入新记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 1 }]);
    const res = await updateShareSetting("t1", { shareEnabled: true });
    expect(res.id).toBe(1);
  });

  it("设置存在时更新记录（全字段）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateShareSetting("t1", {
      shareEnabled: true,
      autoTransfer: true,
      autoTransferThreshold: 20,
      shareScope: "SPECIFIED",
      specifiedStoreIds: [1, 2],
    });
    expect(res.id).toBe(1);
  });

  it("设置存在时更新记录（specifiedStoreIds 为空数组）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateShareSetting("t1", {
      specifiedStoreIds: [],
    });
    expect(res.id).toBe(1);
  });

  it("设置存在但无更新字段时不执行UPDATE", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await updateShareSetting("t1", {});
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });
});

// ========== listShareProducts ==========
describe("inventory-share.service - listShareProducts", () => {
  it("无筛选条件时返回列表", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 1, spuId: 1, spuName: "商品A" }]) // records
      .mockResolvedValueOnce([{ total: 1 }]); // total
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listShareProducts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(1);
    expect(res.records.length).toBe(1);
  });

  it("带全部筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listShareProducts({
      page: 1, pageSize: 10, tenantId: "t1",
      status: 1, categoryId: 2, keyword: "测试",
    });
    expect(mocks.queryWithTenant).toHaveBeenCalled();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listShareProducts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ========== addShareProduct ==========
describe("inventory-share.service - addShareProduct", () => {
  it("商品已存在时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    await expect(addShareProduct("t1", { spuId: 1, spuName: "商品A" }))
      .rejects.toMatchObject({ statusCode: 400, message: "该商品已在共享列表中" });
  });

  it("商品不存在时添加成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 100 }]);
    const res = await addShareProduct("t1", {
      spuId: 1, spuName: "商品A", skuId: 2, skuName: "规格B", barcode: "B001",
      shareQty: 100, minKeepQty: 10,
    });
    expect(res.id).toBe(100);
  });

  it("skuId 为 undefined 时传 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 100 }]);
    const res = await addShareProduct("t1", { spuId: 1, spuName: "商品A" });
    expect(res.id).toBe(100);
  });
});

// ========== batchAddShareProducts ==========
describe("inventory-share.service - batchAddShareProducts", () => {
  it("商品列表为空时抛 400", async () => {
    await expect(batchAddShareProducts("t1", []))
      .rejects.toMatchObject({ statusCode: 400, message: "商品列表不能为空" });
  });

  it("批量添加成功（部分已存在则跳过）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ id: 1 }], undefined]) // 第一个已存在
      .mockResolvedValueOnce([{ insertId: 100 }, undefined]) // 第二个不存在，INSERT成功
    const res = await batchAddShareProducts("t1", [
      { spuId: 1, spuName: "商品A" },
      { spuId: 2, spuName: "商品B" },
    ]);
    expect(res.addedCount).toBe(1);
    expect(res.totalCount).toBe(2);
  });
});

// ========== updateShareProduct ==========
describe("inventory-share.service - updateShareProduct", () => {
  it("商品不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateShareProduct(99, "t1", { shareQty: 10 }))
      .rejects.toMatchObject({ statusCode: 404, message: "共享商品不存在" });
  });

  it("更新所有字段", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateShareProduct(1, "t1", { shareQty: 50, minKeepQty: 5, status: 0 });
    expect(res.id).toBe(1);
  });

  it("无更新字段时不执行UPDATE", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await updateShareProduct(1, "t1", {});
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });
});

// ========== removeShareProduct ==========
describe("inventory-share.service - removeShareProduct", () => {
  it("商品不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(removeShareProduct(99, "t1"))
      .rejects.toMatchObject({ statusCode: 404, message: "共享商品不存在" });
  });

  it("删除成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await removeShareProduct(1, "t1");
    expect(res.success).toBe(true);
  });
});

// ========== batchRemoveShareProducts ==========
describe("inventory-share.service - batchRemoveShareProducts", () => {
  it("ID列表为空时抛 400", async () => {
    await expect(batchRemoveShareProducts([], "t1"))
      .rejects.toMatchObject({ statusCode: 400, message: "ID列表不能为空" });
  });

  it("批量删除成功", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 3 } as any);
    const res = await batchRemoveShareProducts([1, 2, 3], "t1");
    expect(res.deletedCount).toBe(3);
  });
});
