/**
 * S3-142 · 手工建品的「商品配额」校验（单位：admin/product.service.createProduct）
 *
 * 口径（派单卡「二、范围 ②」+「四、验收标准（硬）」②③④；与 C6-4-1 COPY 调取完全一致）：
 *   · limit === null（无订阅 / 未配上限）⇒ **不拦**，正常落库；
 *   · limit !== null && used >= limit ⇒ 拒绝（ProductQuotaExceededError：400 + 业务码 1001，
 *     文案带"已用 x 个 / 上限 y 个"），且**不落库**（未执行任何 INSERT）；
 *   · used < limit ⇒ 放行，`used` 由 COUNT(t_product_spu) **自然 +1**（本文件用内存行数充当该 COUNT）；
 *   · 计数与写入落在**同一事务**（getProductQuota(tenantId, conn) 收的是事务连接）。
 *
 * 保真度说明：数据库面是 mock（内存行数充当 COUNT / INSERT），服务层与配额函数（真实
 * getProductQuota）都是原件；"真库上 200 且 COUNT +1"由 backend/scripts/s3-142-admin-product-guard.mjs
 * 装置给出原始输出（沙箱内 vitest 起不来，见派单卡执行须知 B）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  /** getProductQuota 在事务内调用（plan 行 / COUNT 行都由它出） */
  connQueryOne: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  queryOne: mocks.queryOne,
  connQueryOne: mocks.connQueryOne,
}));

vi.mock("../../../shared/redis-cache", () => ({
  cacheGet: vi.fn(),
  CacheKeys: { PRODUCT_DETAIL: "product:detail" },
}));

vi.mock("../../../shared/product-sync", () => ({
  syncProductFullChain: vi.fn(),
  syncProductStatus: vi.fn(),
  syncProductPrice: vi.fn(),
}));

vi.mock("../../../shared/field-sync", () => ({
  detectChangedFields: vi.fn(),
  syncChangedFields: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "SPU20261002001"),
}));

vi.mock("../../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createProduct, ProductQuotaExceededError } from "../../../services/admin/product.service";

/** 内存迷你库：t_product_spu 的行集合（COUNT 与 INSERT 都基于它） */
const store = { spuRows: [] as { id: number; tenant_id: string }[] };
let seq = 500;

function createBody() {
  return {
    name: "S3-142 配额用例商品",
    categoryId: 1,
    saleChannels: ["STORE", "MINIAPP"],
    skus: [
      {
        skuName: "500ml",
        boxRatio: 1,
        temperature: "NORMAL" as const,
        traceEnabled: false,
        warningThreshold: 0,
        costPrice: 10,
        retailPrice: 20,
      },
    ],
  };
}

/** 按 limit（null = 无订阅/未配）与内存行数接线，返回事务连接 */
function wireDb(limit: number | null) {
  mocks.connQueryOne.mockImplementation(async (_conn: unknown, sql: string) => {
    if (String(sql).includes("t_subscription_plan")) return limit === null ? null : { maxProducts: limit };
    if (String(sql).includes("COUNT(*) AS total FROM t_product_spu")) return { total: store.spuRows.length };
    return null;
  });
  const conn = {
    query: vi.fn(async (sql: string) => {
      if (String(sql).includes("INSERT INTO t_product_spu")) {
        const row = { id: seq++, tenant_id: "t-s3142" };
        store.spuRows.push(row);
        return [{ insertId: row.id }];
      }
      return [{ insertId: seq++ }];
    }),
  };
  mocks.transaction.mockImplementation(async (runner: (c: unknown) => unknown) => runner(conn));
  return conn;
}

beforeEach(() => {
  vi.resetAllMocks();
  store.spuRows = [];
  seq = 500;
});

describe("S3-142 建品配额 · 配额满 ⇒ 400 + 业务码 1001 且不落库", () => {
  it("limit=2 / used=2 ⇒ 抛 ProductQuotaExceededError（statusCode 400 + businessCode 1001 + 文案带已用/上限），零 INSERT", async () => {
    store.spuRows = [
      { id: 1, tenant_id: "t-s3142" },
      { id: 2, tenant_id: "t-s3142" },
    ];
    const conn = wireDb(2);

    const err = await createProduct(createBody(), "t-s3142", {}).then(
      () => null,
      (e: unknown) => e
    );

    expect(err).toBeInstanceOf(ProductQuotaExceededError);
    expect(err).toMatchObject({ statusCode: 400, businessCode: "1001" });
    expect((err as Error).message).toBe("商品配额不足（已用 2 个 / 上限 2 个），请升级套餐或清理已有商品后重试");
    // 不落库：没有任何 INSERT；行数不变
    expect(conn.query).not.toHaveBeenCalled();
    expect(store.spuRows.length).toBe(2);
  });

  it("used > limit（历史超配）同样拒绝，读数按真实 COUNT 回显", async () => {
    store.spuRows = [
      { id: 1, tenant_id: "t-s3142" },
      { id: 2, tenant_id: "t-s3142" },
      { id: 3, tenant_id: "t-s3142" },
    ];
    const conn = wireDb(2);

    await expect(createProduct(createBody(), "t-s3142", {})).rejects.toMatchObject({
      businessCode: "1001",
      message: "商品配额不足（已用 3 个 / 上限 2 个），请升级套餐或清理已有商品后重试",
    });
    expect(conn.query).not.toHaveBeenCalled();
  });

  it("计数与写入同一事务：配额读数取自事务连接（getProductQuota(tenantId, conn)）", async () => {
    store.spuRows = [];
    const conn = wireDb(5);
    await createProduct(createBody(), "t-s3142", {});
    expect(mocks.connQueryOne).toHaveBeenCalled();
    for (const call of mocks.connQueryOne.mock.calls) {
      expect(call[0]).toBe(conn); // 每一次配额读数都挂在事务连接上
    }
  });
});

describe("S3-142 建品配额 · 未满 / 无上限 ⇒ 放行", () => {
  it("used < limit（0/5）⇒ 成功，且 COUNT 自然 +1（0 ⇒ 1）", async () => {
    store.spuRows = [];
    wireDb(5);
    const before = store.spuRows.length;

    const result = await createProduct(createBody(), "t-s3142", {});

    expect(result).toMatchObject({ spuId: expect.any(Number), spuCode: "SPU20261002001" });
    expect(store.spuRows.length).toBe(before + 1); // COUNT 由 0 ⇒ 1
  });

  it("建满后同一口径再次建品 ⇒ 被拒（证明上一次的 +1 真实反映到 COUNT 上）", async () => {
    store.spuRows = [];
    wireDb(1);
    await createProduct(createBody(), "t-s3142", {});
    expect(store.spuRows.length).toBe(1);

    await expect(createProduct(createBody(), "t-s3142", {})).rejects.toMatchObject({ businessCode: "1001" });
    expect(store.spuRows.length).toBe(1); // 被拒那次零落库
  });

  it("limit === null（无订阅 / 未配上限）⇒ 不拦，正常落库", async () => {
    store.spuRows = [];
    const conn = wireDb(null);

    const result = await createProduct(createBody(), "t-s3142", {});

    expect(result).toMatchObject({ spuCode: "SPU20261002001" });
    expect(conn.query).toHaveBeenCalled(); // 走了 INSERT 路径
    expect(store.spuRows.length).toBe(1);
  });
});
