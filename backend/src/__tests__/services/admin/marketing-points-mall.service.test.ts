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
  makeBizNo: () => "JF2026081500001",
}));

import {
  createPointsProduct,
  listPointsProducts,
  getPointsProductDetail,
  updatePointsProduct,
  deletePointsProduct,
  togglePointsProduct,
} from "../../../services/admin/marketing-points-mall.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-points-mall.service - 积分商城", () => {
  it("createPointsProduct 返回新 id 与编码", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 6 }]);
    const res = await createPointsProduct({ name: "保温杯", pointsRequired: 500, stock: 10, sortNo: 1 }, tenantId);
    expect(res).toEqual({ id: 6, product_code: "JF2026081500001" });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_points_product");
    expect(params[0]).toBe("JF2026081500001");
  });

  it("listPointsProducts 带状态筛选分页", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ cnt: 2 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, product_name: "保温杯" }]);
    const res = await listPointsProducts({ tenantId, status: "ON" });
    expect(res.total).toBe(2);
    expect(res.list[0].product_name).toBe("保温杯");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = ?");
  });

  it("getPointsProductDetail 按租户查询", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, product_name: "保温杯" });
    const detail = await getPointsProductDetail(1, tenantId);
    expect(detail?.product_name).toBe("保温杯");
  });

  it("updatePointsProduct 部分字段更新（stock 同步双列）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await updatePointsProduct(1, { name: "新杯", stock: 20 }, tenantId);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("SET product_name = ?, stock_total = ?, stock_available = ?");
    expect(params).toEqual(["新杯", 20, 20, 1, tenantId]);
  });

  it("togglePointsProduct 状态翻转 ON↔OFF", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ status: "ON" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    expect((await togglePointsProduct(1, tenantId)).status).toBe("OFF");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = ?");
  });

  it("deletePointsProduct 按租户删除", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await deletePointsProduct(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_points_product");
  });
});
