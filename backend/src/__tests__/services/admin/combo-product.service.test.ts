/**
 * 组合品 service 单元测试
 * 被测文件：src/services/admin/combo-product.service.ts
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
  listComboProducts,
  getComboProductDetail,
  createComboProduct,
  updateComboProduct,
  deleteComboProduct,
} from "../../../services/admin/combo-product.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("ZH20260715000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

const sampleOptions = [
  { groupName: "主餐", skuId: 1, skuName: "汉堡", barcode: "B001", extraPrice: 0, isRequired: 1, isDefault: 1, sortOrder: 1 },
  { groupName: "小食", skuId: 2, skuName: "薯条", barcode: "B002", extraPrice: 5, isRequired: 0, isDefault: 0, sortOrder: 2 },
];

describe("combo-product.service - listComboProducts", () => {
  it("无可选筛选条件时只带 tenant_id", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, comboNo: "ZH001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listComboProducts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, comboNo: "ZH001" }] });
  });

  it("传入全部筛选条件（keyword + status + comboType）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listComboProducts({
      page: 2, pageSize: 5, tenantId: "t1",
      keyword: "测试", status: 1, comboType: "FIXED",
    });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listComboProducts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("combo-product.service - getComboProductDetail", () => {
  it("组合品存在时返回详情、选项和按组分团结果", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, comboNo: "ZH001", comboType: "FIXED" });
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, comboId: 1, groupName: "主餐", skuId: 1, skuName: "汉堡" },
      { id: 2, comboId: 1, groupName: "小食", skuId: 2, skuName: "薯条" },
    ]);
    const res = await getComboProductDetail(1, "t1");
    expect(res.id).toBe(1);
    expect(res.options.length).toBe(2);
    expect(res.optionsByGroup["主餐"]).toBeDefined();
    expect(res.optionsByGroup["小食"]).toBeDefined();
  });

  it("组合品不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getComboProductDetail(99, "t1")).rejects.toMatchObject({ statusCode: 404, message: "组合品不存在" });
  });
});

describe("combo-product.service - createComboProduct", () => {
  it("选项为空时抛 400", async () => {
    await expect(createComboProduct({
      comboName: "测试组合", comboType: "FIXED", basePrice: 50, tenantId: "t1", options: [],
    })).rejects.toMatchObject({ statusCode: 400, message: "组合品选项不能为空" });
  });

  it("成功创建固定组合（options 有 barcode，走 ?? 左）", async () => {
    mockConn.execute.mockResolvedValueOnce([{ insertId: 100 }]);
    const res = await createComboProduct({
      comboName: "测试组合",
      comboType: "FIXED",
      categoryId: 1,
      coverImage: "img.jpg",
      description: "描述",
      basePrice: 50,
      status: 0,
      sortOrder: 1,
      tenantId: "t1",
      options: sampleOptions,
    });
    expect(res).toEqual({ id: 100, comboNo: "ZH20260715000001" });
    expect(mockConn.execute).toHaveBeenCalledTimes(3); // 主表 + 2条选项
  });

  it("成功创建可选组合（可选字段均 undefined，走 ?? null/0 右）", async () => {
    mockConn.execute.mockResolvedValueOnce([{ insertId: 101 }]);
    const res = await createComboProduct({
      comboName: "可选组合",
      comboType: "OPTIONAL",
      basePrice: 30,
      tenantId: "t1",
      options: [
        { groupName: "选择", skuId: 3, skuName: "商品C", extraPrice: 10 },
      ],
    });
    expect(res.id).toBe(101);
    // 第2个 execute 是选项插入，barcode 应为 null
    const secondCall = mockConn.execute.mock.calls[1];
    expect(secondCall[1][4]).toBeNull(); // barcode
    expect(secondCall[1][6]).toBe(0); // isRequired
    expect(secondCall[1][7]).toBe(0); // isDefault
  });
});

describe("combo-product.service - updateComboProduct", () => {
  it("组合品不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateComboProduct(1, { tenantId: "t1" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("只更新基本字段，不更新选项", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await updateComboProduct(1, {
      comboName: "新名称",
      basePrice: 60,
      status: 1,
      tenantId: "t1",
    });
    expect(res).toEqual({ id: 1 });
    expect(mockConn.execute).toHaveBeenCalledTimes(1);
  });

  it("更新选项（先删后插，重新计算 minPrice/maxPrice）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await updateComboProduct(1, {
      comboName: "新名称",
      tenantId: "t1",
      options: sampleOptions,
    });
    expect(res).toEqual({ id: 1 });
    // UPDATE + DELETE + 2条 INSERT = 4次
    expect(mockConn.execute).toHaveBeenCalledTimes(4);
  });

  it("无更新字段时（不传字段也不传 options）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await updateComboProduct(1, { tenantId: "t1" });
    expect(res).toEqual({ id: 1 });
    expect(mockConn.execute).not.toHaveBeenCalled();
  });

  it("仅传 options 不传其他字段（触发选项更新，也更新 min/max price）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await updateComboProduct(1, {
      tenantId: "t1",
      options: [{ groupName: "选择", skuId: 1, skuName: "A", extraPrice: 5 }],
    });
    expect(res).toEqual({ id: 1 });
    // UPDATE(含min_price, max_price) + DELETE + INSERT = 3次
    expect(mockConn.execute).toHaveBeenCalledTimes(3);
  });
});

describe("combo-product.service - deleteComboProduct", () => {
  it("组合品不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteComboProduct(1, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("启用状态不能删除，抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 1 });
    await expect(deleteComboProduct(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "启用状态的组合品不能删除，请先停用" });
  });

  it("停用状态成功删除（status === 0 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: 0 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    const res = await deleteComboProduct(1, "t1");
    expect(res).toEqual({ success: true });
    expect(mockConn.execute).toHaveBeenCalledTimes(2); // 删选项 + 删主表
  });
});
