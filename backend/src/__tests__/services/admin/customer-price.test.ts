/**
 * 管理端客户专属价格 service 单元测试
 * 被测文件：src/services/admin/customer-price.service.ts
 * 覆盖全部 5 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import {
  listCustomerPrices,
  createCustomerPrice,
  updateCustomerPrice,
  deleteCustomerPrice,
  getCustomerPrice,
} from "../../../services/admin/customer-price.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ listCustomerPrices ============
describe("admin customer-price.service - listCustomerPrices", () => {
  it("全部筛选条件有值 + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, customerId: 1, skuId: 10 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listCustomerPrices({ customerId: 1, skuId: 10, page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, customerId: 1, skuId: 10 }] });
  });

  it("无筛选条件 + total 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listCustomerPrices({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ createCustomerPrice ============
describe("admin customer-price.service - createCustomerPrice", () => {
  it("已存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    await expect(createCustomerPrice({ customerId: 1, skuId: 10, customPrice: 100, tenantId: "t1" }))
      .rejects.toThrow("该客户已存在此SKU的价格记录");
  });

  it("成功创建（有有效期，?? 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue({ insertId: 10 });
    const res = await createCustomerPrice({ customerId: 1, skuId: 10, customPrice: 100, effectiveStart: "2026-01-01", effectiveEnd: "2026-12-31", tenantId: "t1" });
    expect(res.id).toBe(10);
    expect(res.effectiveStart).toBe("2026-01-01");
    expect(res.effectiveEnd).toBe("2026-12-31");
  });

  it("成功创建（无有效期，?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue({ insertId: 11 });
    const res = await createCustomerPrice({ customerId: 2, skuId: 20, customPrice: 200, tenantId: "t1" });
    expect(res.id).toBe(11);
  });
});

// ============ updateCustomerPrice ============
describe("admin customer-price.service - updateCustomerPrice", () => {
  it("价格记录不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateCustomerPrice(99, { customPrice: 100, tenantId: "t1" })).rejects.toThrow("价格记录不存在");
  });

  it("全字段更新", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await updateCustomerPrice(1, { customPrice: 150, effectiveStart: "2026-02-01", effectiveEnd: "2026-11-30", status: 1, tenantId: "t1" });
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("无字段更新时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    await expect(updateCustomerPrice(1, { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
  });
});

// ============ deleteCustomerPrice ============
describe("admin customer-price.service - deleteCustomerPrice", () => {
  it("价格记录不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteCustomerPrice(99, "t1")).rejects.toThrow("价格记录不存在");
  });

  it("成功删除", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await deleteCustomerPrice(1, "t1");
    expect(res).toEqual({ id: 1 });
  });
});

// ============ getCustomerPrice ============
describe("admin customer-price.service - getCustomerPrice", () => {
  it("有有效价格时返回", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ customPrice: 150 });
    const res = await getCustomerPrice(1, 10, "t1");
    expect(res).toEqual({ customPrice: 150 });
  });

  it("无有效价格时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCustomerPrice(1, 10, "t1");
    expect(res).toBeNull();
  });
});
