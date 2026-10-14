import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  cacheGet: vi.fn(),
  syncProductStatus: vi.fn(),
  syncChangedFields: vi.fn(),
  detectChangedFields: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/redis-cache", () => ({
  cacheGet: mocks.cacheGet,
  CacheKeys: { PRODUCT_DETAIL: "product:detail" },
}));

vi.mock("../../../shared/product-sync", () => ({
  syncProductFullChain: vi.fn(),
  syncProductStatus: mocks.syncProductStatus,
  syncProductPrice: vi.fn(),
}));

vi.mock("../../../shared/field-sync", () => ({
  detectChangedFields: mocks.detectChangedFields,
  syncChangedFields: mocks.syncChangedFields,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "SPU20260815001"),
}));

vi.mock("../../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  listProducts,
  getProductDetail,
  updateProductStatus,
  getProductPriceHistory,
  updateProductPrice
} from "../../../services/admin/product.service";

describe("admin/product.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listProducts：带关键词直查商品列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ spuId: 1, name: "飞天茅台" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listProducts("茅台", 1, 20, "t1");
    expect(result.total).toBe(1);
    expect(result.records[0].name).toBe("飞天茅台");
  });

  it("getProductDetail：返回商品详情含 SKU", async () => {
    mocks.cacheGet.mockImplementationOnce(async (_k: string, fn: () => unknown) => fn());
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, name: "飞天茅台", status: "ON_SALE" });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 1, skuName: "500ml" }]) // skus
      .mockResolvedValueOnce([]); // 多单位
    const detail = await getProductDetail(1, "t1");
    expect(detail?.name).toBe("飞天茅台");
    expect(detail?.skus).toHaveLength(1);
  });

  it("updateProductStatus：更新商品状态并触发同步", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.syncProductStatus.mockResolvedValueOnce(undefined);
    const result = await updateProductStatus(1, "OFF_SALE", "t1");
    expect(result?.status).toBe("OFF_SALE");
    expect(mocks.syncProductStatus).toHaveBeenCalled();
  });
});

// ============ S3-204：价格历史读接口（需求 2.2）============
describe("admin/product.service - getProductPriceHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("缺省参数：SQL 带租户条件 + LIMIT 50，并给出 date/priceLevel/price 归一化字段", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 9,
        skuId: 1,
        priceType: "RETAIL",
        oldPrice: "100.00",
        newPrice: "120.00",
        actionType: "UPDATE",
        operatorId: 3,
        operatorName: "默认店长",
        source: "admin",
        createdAt: "2026-10-15T02:30:00.000Z"
      }
    ]);

    const res = await getProductPriceHistory(1, "t1");

    const [sql, params, tenant] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("WHERE ppl.sku_id = ? AND ppl.tenant_id = ?");
    expect(sql).toContain("LEFT JOIN t_sys_user u ON u.id = ppl.operator_id AND u.tenant_id = ppl.tenant_id");
    expect(sql).toContain("ORDER BY ppl.id DESC");
    expect(params).toEqual([1, "t1", 50]);
    expect(tenant).toBe("t1");

    expect(res.records).toHaveLength(1);
    const row = res.records[0] as any;
    expect(row.priceLevel).toBe("RETAIL");
    expect(row.price).toBe(120);
    expect(row.source).toBe("admin");
    expect(row.operatorName).toBe("默认店长");
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // 既有字段保持原样（老调用方零影响）
    expect(row.priceType).toBe("RETAIL");
    expect(row.newPrice).toBe("120.00");
  });

  it("筛选参数：priceLevel / dateStart / dateEnd / limit 依次进入 WHERE 与参数表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);

    await getProductPriceHistory(1, "t1", {
      priceLevel: "WHOLESALE",
      dateStart: "2026-01-01",
      dateEnd: "2026-12-31",
      limit: 300
    });

    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("ppl.price_type = ?");
    expect(sql).toContain("DATE(ppl.created_at) >= ?");
    expect(sql).toContain("DATE(ppl.created_at) <= ?");
    expect(params).toEqual([1, "t1", "WHOLESALE", "2026-01-01", "2026-12-31", 300]);
  });

  it("limit 越界收敛：9999 → 500；0 / 负数 → 1；无数据返回空 records", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);

    const over = await getProductPriceHistory(1, "t1", { limit: 9999 });
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual([1, "t1", 500]);
    expect(over.records).toEqual([]);

    await getProductPriceHistory(1, "t1", { limit: 0 });
    expect(mocks.queryWithTenant.mock.calls[1][1]).toEqual([1, "t1", 1]);

    await getProductPriceHistory(1, "t1", { limit: -5 });
    expect(mocks.queryWithTenant.mock.calls[2][1]).toEqual([1, "t1", 1]);
  });

  it("newPrice 为空（清空价格）：price 归一化为 null 且不抛错", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 1,
        skuId: 1,
        priceType: "MINIAPP",
        oldPrice: "88.00",
        newPrice: null,
        actionType: "CLEAR",
        operatorId: 1,
        operatorName: null,
        source: "ai",
        createdAt: "2026-10-15 10:00:00"
      }
    ]);

    const res = await getProductPriceHistory(1, "t1", { priceLevel: "MINIAPP" });
    expect((res.records[0] as any).price).toBeNull();
    expect((res.records[0] as any).date).toBe("2026-10-15 10:00:00");
  });
});

// ============ S3-204：改价落库的来源标记（需求 2.1）============
describe("admin/product.service - updateProductPrice 来源标记", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /** 造一个事务连接：SELECT 老价 → UPDATE → 逐档位 INSERT 日志 */
  function mockTransactionConn() {
    const conn = {
      query: vi.fn(async (sql: string) => {
        if (typeof sql === "string" && sql.startsWith("SELECT * FROM t_product_price")) {
          return [[{ cost_price: 10, retail_price: 100, wholesale_price: 90, miniapp_price: 95, store_price: null }]];
        }
        return [{ affectedRows: 1 }];
      })
    };
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    return conn;
  }

  it("未传 source：日志 INSERT 落默认 'admin'", async () => {
    const conn = mockTransactionConn();
    await updateProductPrice(1, { retailPrice: 120 }, "t1", 7);

    const insert = conn.query.mock.calls.find((c: any[]) =>
      String(c[0]).includes("INSERT INTO t_product_price_log")
    ) as any[];
    expect(insert[0]).toContain("source");
    expect(insert[1]).toEqual([1, 7, "RETAIL", 100, 120, "admin", "t1"]);
  });

  it("传 source='ai'：日志 INSERT 落 'ai'（AI 底座改价可区分）", async () => {
    const conn = mockTransactionConn();
    await updateProductPrice(1, { wholesalePrice: 1000, source: "ai" }, "t1", 7);

    const insert = conn.query.mock.calls.find((c: any[]) =>
      String(c[0]).includes("INSERT INTO t_product_price_log")
    ) as any[];
    expect(insert[1]).toEqual([1, 7, "WHOLESALE", 90, 1000, "ai", "t1"]);
  });

  it("价格未变化：不写日志（既有口径不变）", async () => {
    const conn = mockTransactionConn();
    await updateProductPrice(1, { retailPrice: 100 }, "t1", 7);

    const insert = conn.query.mock.calls.find((c: any[]) =>
      String(c[0]).includes("INSERT INTO t_product_price_log")
    );
    expect(insert).toBeUndefined();
  });
});
