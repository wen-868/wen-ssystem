import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));
vi.mock("../../../shared/id", () => ({
  makeBizNo: () => "COUPON2026081500001",
}));

import {
  listCouponTemplates,
  getCouponTemplate,
  createCouponTemplate,
} from "../../../services/admin/marketing-new-coupon.service";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

function mockTemplateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    templateCode: "COUPON001",
    templateName: "满100减20",
    couponType: "AMOUNT",
    couponValue: 20,
    minPurchase: 100,
    maxDiscount: null,
    applicableScope: "ALL",
    applicableIds: null,
    totalQuantity: 1000,
    issuedQuantity: 0,
    usedQuantity: 0,
    perLimit: 1,
    validType: "FIXED",
    validStart: "2026-01-01",
    validEnd: "2026-12-31",
    validDays: null,
    status: "DRAFT",
    description: null,
    createdAt: "2026-08-15",
    updatedAt: "2026-08-15",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("marketing-new-coupon.service - 优惠券模板", () => {
  it("listCouponTemplates 无筛选返回全量分页", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([mockTemplateRow()]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const res = await listCouponTemplates(1, 20, tenantId);
    expect(res.total).toBe(1);
    expect(res.records[0].templateName).toBe("满100减20");
    expect(mocks.queryWithTenant.mock.calls[0][0]).toContain("ORDER BY created_at DESC");
  });

  it("listCouponTemplates 带状态/类型筛选", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });
    await listCouponTemplates(2, 10, tenantId, "ACTIVE", "DISCOUNT");
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("status = ?");
    expect(sql).toContain("coupon_type = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toContain(10); // LIMIT
  });

  it("getCouponTemplate 存在返回模板", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(mockTemplateRow());
    const res = await getCouponTemplate(1, tenantId);
    expect(res.templateName).toBe("满100减20");
  });

  it("getCouponTemplate 不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(getCouponTemplate(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "优惠券模板不存在" });
  });

  it("createCouponTemplate 事务内插入模板与操作日志", async () => {
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await createCouponTemplate({
      templateName: "满100减20",
      couponType: "AMOUNT",
      couponValue: 20,
      minPurchase: 100,
      applicableScope: "ALL",
      totalQuantity: 1000,
      perLimit: 1,
      validType: "FIXED",
      validStart: "2026-01-01",
      validEnd: "2026-12-31",
    }, tenantId, 9, "管理员");
    expect(res).toEqual({ template_code: "COUPON2026081500001" });
    expect(mocks.transaction).toHaveBeenCalled();
    const insertCalls = mockConn.execute.mock.calls;
    expect(insertCalls[0][0]).toContain("INSERT INTO t_coupon_template");
    expect(insertCalls[1][0]).toContain("INSERT INTO t_marketing_operation_log");
    expect(insertCalls[1][1].join(" ")).toContain("创建优惠券模板: COUPON2026081500001");
  });
});
