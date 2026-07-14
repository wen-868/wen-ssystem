/**
 * 套装 service 单元测试
 * 被测文件：src/services/admin/product-bundle.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  listProductBundles,
  getProductBundleDetail,
  createProductBundle,
  updateProductBundle,
  deleteProductBundle,
  publishProductBundle,
  unpublishProductBundle,
  getProductBundleStats,
} from "../../../services/admin/product-bundle.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("TZ20260715000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

const sampleItems = [
  { skuId: 1, skuName: "商品A", barcode: "B001", qty: 2, unitPrice: 100, costPrice: 50 },
  { skuId: 2, skuName: "商品B", barcode: "B002", qty: 1, unitPrice: 200, costPrice: 100 },
];

describe("product-bundle.service - listProductBundles", () => {
  it("无可选筛选条件时只带 tenant_id", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, bundleNo: "TZ001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listProductBundles({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, bundleNo: "TZ001" }] });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("传入全部筛选条件（keyword + status + categoryId）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listProductBundles({
      page: 2, pageSize: 5, tenantId: "t1",
      keyword: "测试", status: 1, categoryId: 3,
    });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listProductBundles({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("product-bundle.service - getProductBundleDetail", () => {
  it("套装存在时返回详情及明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, bundleNo: "TZ001" });
    mocks.queryWithTenant.mockResolvedValue([{ id: 10, skuId: 1 }]);
    const res = await getProductBundleDetail(1, "t1");
    expect(res).toEqual({ id: 1, bundleNo: "TZ001", items: [{ id: 10, skuId: 1 }] });
  });

  it("套装不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getProductBundleDetail(99, "t1")).rejects.toMatchObject({ statusCode: 404, message: "套装不存在" });
  });
});

describe("product-bundle.service - createProductBundle", () => {
  it("明细为空时抛 400", async () => {
    await expect(createProductBundle({
      bundleName: "测试套装", bundlePrice: 300, tenantId: "t1", items: [],
    })).rejects.toMatchObject({ statusCode: 400, message: "套装商品明细不能为空" });
  });

  it("成功创建套装（items 有 barcode，走 ?? 左分支）", async () => {
    mockConn.execute.mockResolvedValueOnce([{ insertId: 100 }]);
    const res = await createProductBundle({
      bundleName: "测试套装",
      categoryId: 1,
      coverImage: "img.jpg",
      description: "描述",
      bundlePrice: 350,
      status: 0,
      sortOrder: 1,
      tenantId: "t1",
      items: sampleItems,
    });
    expect(res).toEqual({ id: 100, bundleNo: "TZ20260715000001" });
    expect(mockConn.execute).toHaveBeenCalledTimes(3); // 主表 + 2条明细
  });

  it("成功创建套装（可选字段均为 undefined，走 ?? null/0 右分支）", async () => {
    mockConn.execute.mockResolvedValueOnce([{ insertId: 101 }]);
    const res = await createProductBundle({
      bundleName: "测试套装2",
      bundlePrice: 100,
      tenantId: "t1",
      items: [{ skuId: 3, skuName: "商品C", qty: 1, unitPrice: 100, costPrice: 50 }],
    });
    expect(res.id).toBe(101);
    // 第2个 execute 是明细插入，barcode 应为 null
    const secondCall = mockConn.execute.mock.calls[1];
    expect(secondCall[1][3]).toBeNull(); // barcode
  });
});

describe("product-bundle.service - updateProductBundle", () => {
  it("套装不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateProductBundle(1, { tenantId: "t1" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("只更新基本字段，不更新明细（updateFields 非空，items 不传）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await updateProductBundle(1, {
      bundleName: "新名称",
      bundlePrice: 400,
      status: 1,
      tenantId: "t1",
    });
    expect(res).toEqual({ id: 1 });
    // 只调用一次 UPDATE，不调用 DELETE/INSERT 明细
    expect(mockConn.execute).toHaveBeenCalledTimes(1);
  });

  it("更新明细（先删后插，重新计算 originalPrice 和 costPrice）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await updateProductBundle(1, {
      bundleName: "新名称",
      tenantId: "t1",
      items: sampleItems,
    });
    expect(res).toEqual({ id: 1 });
    // UPDATE + DELETE + 2条 INSERT = 4次
    expect(mockConn.execute).toHaveBeenCalledTimes(4);
  });

  it("无更新字段时（updateFields 为空，items 也不传）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await updateProductBundle(1, { tenantId: "t1" });
    expect(res).toEqual({ id: 1 });
    expect(mockConn.execute).not.toHaveBeenCalled();
  });

  it("仅传 items 不传其他字段（触发明细更新，也更新 originalPrice/costPrice）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await updateProductBundle(1, {
      tenantId: "t1",
      items: [{ skuId: 1, skuName: "A", qty: 3, unitPrice: 50, costPrice: 25 }],
    });
    expect(res).toEqual({ id: 1 });
    // UPDATE(含original_price, cost_price) + DELETE + INSERT = 3次
    expect(mockConn.execute).toHaveBeenCalledTimes(3);
  });
});

describe("product-bundle.service - deleteProductBundle", () => {
  it("套装不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteProductBundle(1, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("上架状态不能删除，抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 1 });
    await expect(deleteProductBundle(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "上架状态的套装不能删除，请先下架" });
  });

  it("下架状态成功删除（status === 0 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 0 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await deleteProductBundle(1, "t1");
    expect(res).toEqual({ success: true });
    expect(mockConn.execute).toHaveBeenCalledTimes(2); // 删明细 + 删主表
  });
});

describe("product-bundle.service - publishProductBundle", () => {
  it("套装不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(publishProductBundle(1, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("已上架时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 1 });
    await expect(publishProductBundle(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "套装已上架" });
  });

  it("下架状态成功上架（status === 0 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 0 });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await publishProductBundle(1, "t1");
    expect(res).toEqual({ success: true });
  });
});

describe("product-bundle.service - unpublishProductBundle", () => {
  it("套装不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(unpublishProductBundle(1, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("已下架时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 0 });
    await expect(unpublishProductBundle(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "套装已下架" });
  });

  it("上架状态成功下架（status === 1 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 1 });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await unpublishProductBundle(1, "t1");
    expect(res).toEqual({ success: true });
  });
});

describe("product-bundle.service - getProductBundleStats", () => {
  it("无日期筛选时返回统计数据", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      totalBundles: 10, publishedCount: 7, unpublishedCount: 3, totalSales: 100,
    });
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, bundleNo: "TZ001", bundleName: "热销套装", salesCount: 50, bundlePrice: 200 },
    ]);
    const res = await getProductBundleStats({ tenantId: "t1" });
    expect(res.totalBundles).toBe(10);
    expect(res.publishedCount).toBe(7);
    expect(res.unpublishedCount).toBe(3);
    expect(res.totalSales).toBe(100);
    expect(res.topBundles.length).toBe(1);
  });

  it("有日期范围时返回统计数据", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      totalBundles: 5, publishedCount: 3, unpublishedCount: 2, totalSales: 50,
    });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getProductBundleStats({ tenantId: "t1", dateStart: "2026-01-01", dateEnd: "2026-12-31" });
    expect(res.totalBundles).toBe(5);
  });

  it("totalStats 为 null 时全部兜底 0", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getProductBundleStats({ tenantId: "t1" });
    expect(res.totalBundles).toBe(0);
    expect(res.publishedCount).toBe(0);
    expect(res.unpublishedCount).toBe(0);
    expect(res.totalSales).toBe(0);
  });
});
