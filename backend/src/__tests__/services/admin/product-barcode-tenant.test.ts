/**
 * S3-151 条码撞键语义统一（单位：admin/product.service）
 *
 * 口径（docs/tasks/cards/R101-派单-20261002-S3-151.md 二、范围 / 四、验收标准）：
 *   · 建品撞条码 ⇒ 业务错误 **400 + 中文文案**（修复前无 try/catch，直接落 500）
 *   · 批量导入撞条码 ⇒ 逐行 errors[] 为**中文业务文案**，不得回库报错原文（`Duplicate entry … for key …`）
 *   · 改条码 updateSkuBarcode 维持既有 400（本文件不改它，仅在旁证口径一致）
 *   · 撞键只认"条码"这一列：同一张表的 uk_product_sku_code 撞车不得被误标成条码文案
 *
 * 说明：跨租户同条码"真能落库"由真库装置 backend/scripts/s3-151-barcode-tenant-unique.mjs 证明——
 * 单测数据面是 mock，无法证明 (tenant_id, barcode) 复合键本身；此处只证服务层的语义映射。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  cacheGet: vi.fn(),
  syncProductStatus: vi.fn(),
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
  detectChangedFields: vi.fn(),
  syncChangedFields: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "SPU20261002001"),
}));

vi.mock("../../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createProduct, importProducts, updateSkuBarcode } from "../../../services/admin/product.service";

const BARCODE_MESSAGE = "该条码已被其他商品使用";

/** 回库撞键错误的两种真实形态：MySQL 8 带表名前缀，MariaDB 不带 */
function dupKeyError(key: string, value = "6901234567890") {
  return Object.assign(new Error(`Duplicate entry '${value}' for key '${key}'`), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
  });
}

function createBody(barcode?: string): Parameters<typeof createProduct>[0] {
  return {
  name: "S3-151 测试商品",
  categoryId: 1,
  saleChannels: ["STORE", "MINIAPP"],
  skus: [
    {
      skuName: "500ml",
      barcode,
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

function makeConn() {
  const conn = { query: vi.fn() };
  mocks.transaction.mockImplementation(async (runner: (c: unknown) => unknown) => runner(conn));
  return conn;
}

describe("S3-151 建品撞条码 ⇒ 400 + 中文（修复前 500）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("跨租户同条码：服务层不拦、不预查全库条码，直接走 INSERT 成功路径", async () => {
    const conn = makeConn();
    conn.query
      .mockResolvedValueOnce([{ insertId: 101 }]) // SPU
      .mockResolvedValueOnce([{ insertId: 201 }]) // SKU（租户乙，条码同租户甲）
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // 价格

    const result = await createProduct(createBody("6901234567890"), "t151-b", {});

    expect(result).toEqual({ id: 101, spuId: 101, skuId: 201, spuCode: "SPU20261002001" });
    // 服务层不得新增"条码是否已被占用"的全局预查（那正是修复前跨租户互相挡的来源）
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    expect(mocks.queryOneWithTenant).not.toHaveBeenCalled();
    const skuInsert = conn.query.mock.calls[1];
    expect(String(skuInsert[0])).toContain("INSERT INTO t_product_sku");
    expect(skuInsert[1][12]).toBe("t151-b"); // tenant_id 随行写入
  });

  it("同租户同条码：SKU INSERT 撞 (tenant_id, barcode) ⇒ 抛 400 + 中文，不外泄 Duplicate entry", async () => {
    const conn = makeConn();
    conn.query
      .mockResolvedValueOnce([{ insertId: 101 }])
      .mockRejectedValueOnce(dupKeyError("uk_product_sku_tenant_barcode"))

    await expect(createProduct(createBody("6901234567890"), "t151-a", {})).rejects.toMatchObject({
      message: BARCODE_MESSAGE,
      statusCode: 400,
    });
  });

  it("MySQL 8 形态（key 带表名前缀 t_product_sku.uk_product_sku_tenant_barcode）同样识别为条码撞键", async () => {
    const conn = makeConn();
    conn.query
      .mockResolvedValueOnce([{ insertId: 101 }])
      .mockRejectedValueOnce(dupKeyError("t_product_sku.uk_product_sku_tenant_barcode"));

    await expect(createProduct(createBody("6901234567890"), "t151-a", {})).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("撞的是 sku_code 而不是条码 ⇒ 原样抛出（不得被误标成条码文案）", async () => {
    const conn = makeConn();
    const skuCodeDup = dupKeyError("uk_product_sku_code", "SKU20261002001");
    conn.query.mockResolvedValueOnce([{ insertId: 101 }]).mockRejectedValueOnce(skuCodeDup);

    await expect(createProduct(createBody("6901234567890"), "t151-a", {})).rejects.toBe(skuCodeDup);
  });

  it("非撞键错误原样上抛（不被包装成 400）", async () => {
    const conn = makeConn();
    const boom = new Error("connect ETIMEDOUT");
    conn.query.mockRejectedValueOnce(boom);

    await expect(createProduct(createBody("6901234567890"), "t151-a", {})).rejects.toBe(boom);
  });
});

describe("S3-151 批量导入撞条码 ⇒ errors[] 中文化", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: (c: unknown) => unknown) =>
      runner({ query: vi.fn().mockResolvedValue([{ insertId: 1 }]) })
    );
  });

  it("重复条码行：errors[0].message 为中文业务文案，且不含 Duplicate entry", async () => {
    mockSkuInsertRejections([null, dupKeyError("uk_product_sku_tenant_barcode")]);

    const result = await importProducts(
      [
        { name: "商品甲", skuName: "500ml", barcode: "6901234567890" },
        { name: "商品乙", skuName: "500ml", barcode: "6901234567890" },
      ],
      "t151-a"
    );

    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ row: 2, message: BARCODE_MESSAGE });
    expect(result.errors[0].message).not.toMatch(/Duplicate entry/i);
    expect(JSON.stringify(result.errors)).not.toContain("Duplicate entry");
  });

  it("两条都撞（同一租户重复条码）：逐行都是中文文案，原始报错原文 0 命中", async () => {
    mockSkuInsertRejections([
      dupKeyError("uk_product_sku_tenant_barcode"),
      dupKeyError("uk_product_sku_tenant_barcode"),
    ]);

    const result = await importProducts(
      [
        { name: "商品甲", skuName: "500ml", barcode: "6901234567890" },
        { name: "商品乙", skuName: "500ml", barcode: "6901234567890" },
      ],
      "t151-a"
    );

    expect(result.successCount).toBe(0);
    expect(result.errors.map((e) => e.message)).toEqual([BARCODE_MESSAGE, BARCODE_MESSAGE]);
    expect(JSON.stringify(result.errors)).not.toContain("Duplicate entry");
  });

  it("撞的是商品编码 ⇒ 也是中文（不得把回库报错原文写进 errors）", async () => {
    mockSkuInsertRejections([dupKeyError("uk_product_sku_code", "SKU1")]);

    const result = await importProducts([{ name: "商品甲", skuName: "500ml" }], "t151-a");

    expect(result.errors[0].message).toBe("商品编码重复，请检查后重试");
    expect(JSON.stringify(result.errors)).not.toContain("Duplicate entry");
  });

  it("必填缺失仍为既有中文校验文案（未被本次改动影响）", async () => {
    const result = await importProducts([{ name: "", skuName: "" }], "t151-a");
    expect(result.errors[0]).toEqual({ row: 1, message: "商品名称和SKU名称为必填项" });
  });
});

describe("S3-151 改条码撞键语义保持 400 + 同一句文案", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("updateSkuBarcode 撞 (tenant_id, barcode) ⇒ 400 + 中文（与建品/导入同一句）", async () => {
    mocks.queryWithTenant.mockRejectedValueOnce(dupKeyError("uk_product_sku_tenant_barcode"));
    await expect(updateSkuBarcode(9, "6901234567890", "t151-a")).rejects.toMatchObject({
      statusCode: 400,
      message: BARCODE_MESSAGE,
    });
  });
});

/** 让 importProducts 循环里第 n 次 SKU INSERT 抛第 n 个错误（null = 该行成功） */
function mockSkuInsertRejections(errors: Array<Error | null>) {
  let rowIndex = 0;
  mocks.transaction.mockImplementation(async (runner: (c: unknown) => unknown) => {
    const err = errors[rowIndex++];
    const query = vi.fn(async (sql: string) => {
      if (String(sql).includes("INSERT INTO t_product_sku")) {
        if (err) throw err;
        return [{ insertId: rowIndex }];
      }
      return [{ insertId: rowIndex }];
    });
    return runner({ query });
  });
}
