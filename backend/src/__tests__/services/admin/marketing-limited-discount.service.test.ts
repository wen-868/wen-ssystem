import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));
vi.mock("../../../shared/id", () => ({
  makeBizNo: () => "XS2026081500001",
}));

import {
  createLimitedDiscount,
  listLimitedDiscounts,
  getLimitedDiscountDetail,
  updateLimitedDiscount,
  deleteLimitedDiscount,
  activateLimitedDiscount,
} from "../../../services/admin/marketing-limited-discount.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-limited-discount.service - 限时折扣", () => {
  it("createLimitedDiscount 返回新 id 与编码", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 4 }]);
    const res = await createLimitedDiscount({
      name: "8折周", discountType: "PERCENT", discountValue: 0.8,
      applicableScope: "ALL", startTime: "2026-08-01", endTime: "2026-08-31",
      totalLimit: 100, limitPerUser: 3,
    }, tenantId, 9);
    expect(res).toEqual({ id: 4, activity_code: "XS2026081500001" });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_limited_discount");
    expect(params[0]).toBe("XS2026081500001");
  });

  it("listLimitedDiscounts 带状态筛选分页", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ cnt: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, activity_name: "8折周" }]);
    const res = await listLimitedDiscounts({ tenantId, status: "ACTIVE" });
    expect(res.total).toBe(1);
    expect(res.list[0].activity_name).toBe("8折周");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = ?");
  });

  it("getLimitedDiscountDetail 返回活动与商品，不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, activity_name: "8折周" });
    mocks.queryWithTenant.mockResolvedValueOnce([{ product_id: 10 }]);
    const detail = await getLimitedDiscountDetail(1, tenantId);
    expect(detail?.products).toHaveLength(1);

    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await getLimitedDiscountDetail(99, tenantId)).toBeNull();
  });

  it("updateLimitedDiscount 部分字段更新", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await updateLimitedDiscount(1, { name: "新活动", discountValue: 0.9 }, tenantId);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("SET activity_name = ?, discount_value = ?");
    expect(params).toEqual(["新活动", 0.9, 1, tenantId]);
  });

  it("deleteLimitedDiscount 级联删除商品与活动", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteLimitedDiscount(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_limited_discount_product");
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("DELETE FROM t_limited_discount");
  });

  it("activateLimitedDiscount 更新状态", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await activateLimitedDiscount(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = 'ACTIVE'");
  });
});
