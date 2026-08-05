/**
 * 限时折扣 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/marketing-limited-discount.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  createLimitedDiscount,
  listLimitedDiscounts,
  getLimitedDiscountDetail,
  updateLimitedDiscount,
  deleteLimitedDiscount,
  activateLimitedDiscount,
  pauseLimitedDiscount,
  getDiscountProducts,
  addDiscountProduct,
  removeDiscountProduct,
} from "../../../services/admin/marketing-limited-discount.service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.makeBizNo.mockReturnValue("XS202608060001");
});

describe("marketing-limited-discount.service - createLimitedDiscount", () => {
  it("成功创建，缺省字段用默认值，result 为对象", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 5 });
    const res = await createLimitedDiscount(
      { name: "限时9折", discountValue: 90, startTime: "2026-01-01", endTime: "2026-12-31" },
      "t1",
      1
    );
    expect(res).toEqual({ id: 5, activity_code: "XS202608060001" });
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toContain("PERCENT");
    expect(params).toContain("ALL");
    expect(params).toContain(0);
  });

  it("result 为数组时取首元素 insertId", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 6 }]);
    const res = await createLimitedDiscount(
      { name: "A", discountValue: 80, startTime: "2026-01-01", endTime: "2026-12-31", discountType: "FIXED" },
      "t1",
      1
    );
    expect(res.id).toBe(6);
  });
});

describe("marketing-limited-discount.service - listLimitedDiscounts", () => {
  it("status 筛选与默认分页，total 兜底", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ cnt: 2 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    const res = await listLimitedDiscounts({ tenantId: "t1", status: "ACTIVE" });
    expect(res).toEqual({ list: [{ id: 1 }], total: 2, page: 1, pageSize: 20 });
  });
});

describe("marketing-limited-discount.service - getLimitedDiscountDetail", () => {
  it("不存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getLimitedDiscountDetail(1, "t1");
    expect(res).toBeNull();
  });

  it("存在时附带商品明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, activity_name: "A" });
    mocks.queryWithTenant.mockResolvedValue([{ id: 9 }]);
    const res = await getLimitedDiscountDetail(1, "t1");
    expect(res).toEqual({ id: 1, activity_name: "A", products: [{ id: 9 }] });
  });
});

describe("marketing-limited-discount.service - updateLimitedDiscount", () => {
  it("无字段时返回 null", async () => {
    const res = await updateLimitedDiscount(1, {}, "t1");
    expect(res).toBeNull();
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("部分字段更新成功", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateLimitedDiscount(1, { name: "新名", status: "PAUSED", totalLimit: 100 }, "t1");
    expect(res).toEqual({ id: 1 });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("activity_name = ?");
    expect(sql).toContain("total_stock = ?");
    expect(sql).toContain("status = ?");
  });
});

describe("marketing-limited-discount.service - 删除/启停", () => {
  it("deleteLimitedDiscount 先删商品再删活动", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteLimitedDiscount(1, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_limited_discount_product");
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("DELETE FROM t_limited_discount");
  });

  it("activate/pause 更新状态", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await activateLimitedDiscount(1, "t1");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("'ACTIVE'");
    await pauseLimitedDiscount(1, "t1");
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("'PAUSED'");
  });
});

describe("marketing-limited-discount.service - 折扣商品", () => {
  it("getDiscountProducts 返回商品列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    const res = await getDiscountProducts(1, "t1");
    expect(res).toEqual([{ id: 1 }]);
  });

  it("addDiscountProduct 仅对存在的 SKU 插入，原价兜底 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ spu_id: 3, price: 100 })
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 1 }]);
    await addDiscountProduct(1, { skuIds: [10, 99] }, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toContain(3);
    expect(params).toContain(100);
  });

  it("removeDiscountProduct 删除商品", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await removeDiscountProduct(1, 3, "t1");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual([1, 3, "t1"]);
  });
});
