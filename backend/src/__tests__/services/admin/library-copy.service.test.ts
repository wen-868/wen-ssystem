/**
 * R101-C6-4-1：租户侧商品库调取（COPY）service 单元测试
 *
 * 被测：src/services/admin/library-copy.service.ts（+ 复用的 src/services/platform/tenant-quota.service.ts getProductQuota）
 * 契约：docs/tasks/cards/R101-C6-4-0-阿坚-立项草案.md §四.2（T3 请求体/result 取值/状态码）
 *        docs/tasks/cards/R101-C6-4-0-凌舟裁定.md Q2（条码降级）/Q3（配额不足 1001）/Q4（软删仍 SKIPPED）/Q6（只写成功）/Q7（方案 B）
 *
 * 覆盖四类语义（派单卡交付物②）：
 *   · 调取成功 ⇒ CREATED + 流水与映射**各 +1**（断言两条 INSERT 语句各出现一次）+ 档案可见（spuId 回传）
 *   · 幂等 ⇒ 映射命中即 SKIPPED，零写入（不建档案、不写流水、不占配额）
 *   · 配额不足 ⇒ REJECTED，零写入（反测①：拒绝且不生成档案、不写流水）
 *   · 未知 id ⇒ AppError 404（不写任何行）
 *   · 条码撞全库唯一键 ⇒ 降级写 NULL + warnings 显式给原因（Q2）
 *
 * 数据库全部打桩（本沙箱无 MySQL）；桩按 SQL 关键字分发，校验的是 service 的真实 SQL 文本与参数。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connQuery: vi.fn(),
  connQueryOne: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
  connQuery: mocks.connQuery,
  connQueryOne: mocks.connQueryOne,
  connExecute: mocks.connExecute,
  executeWithTenant: vi.fn(),
}));

import { copyLibrarySpus, listMyCallLogs, listLibrarySpus } from "../../../services/admin/library-copy.service";

/** 测试用平台 SPU 行（t_library_spu 形状） */
const SOURCE = {
  id: 123,
  spuCode: "SPU20260101001",
  name: "茅台 飞天 53度",
  brandId: 7,
  specs: "500ml×6瓶/箱",
  unit: "瓶",
  mainImage: "https://x/m.jpg",
  imageUrls: '["https://x/1.jpg"]',
  description: "简介",
  detail: "<p>详情</p>",
  suggestedRetailPrice: "1299.00",
};

const SKUS = [
  { id: 5, spuId: 123, skuCode: "LSKU1", barcode: "6901234567890", skuName: "500ml 光瓶", volume: "500ml", packaging: "光瓶", baseUnit: "瓶", boxUnit: "箱", boxRatio: 6, skuImage: "" },
  { id: 6, spuId: 123, skuCode: "LSKU2", barcode: "6901234567891", skuName: "500ml 礼盒", volume: "500ml", packaging: "礼盒", baseUnit: "瓶", boxUnit: "箱", boxRatio: 6, skuImage: "" },
];

/** 每个用例可覆写的桩状态 */
let sources: any[] = [];
let skus: any[] = [];
let brandRows: any[] = [];
let mappingRow: any = null;
let planRow: any = null;
let productCount = 0;
/** true ⇒ 第一次带条码的 SKU INSERT 抛 ER_DUP_ENTRY（模拟撞全库唯一键） */
let duplicateBarcodeOnce = false;
/** 记录所有写语句（INSERT/UPDATE/DELETE）与其参数 */
let writes: { sql: string; params: unknown[] }[] = [];
let insertIdSeq = 9000;

function isWrite(sql: string): boolean {
  return /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql);
}

beforeEach(() => {
  vi.clearAllMocks();
  sources = [SOURCE];
  skus = SKUS;
  brandRows = [{ id: 7, name: "贵州茅台" }];
  mappingRow = null;
  planRow = { maxProducts: 100 };
  productCount = 0;
  duplicateBarcodeOnce = false;
  writes = [];
  insertIdSeq = 9000;

  mocks.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (isWrite(sql)) {
      writes.push({ sql, params });
      return [{ insertId: insertIdSeq++, affectedRows: 1 }];
    }
    if (sql.includes("FROM t_library_spu") && sql.includes("id IN (?)")) {
      return sources.filter((row) => (params[0] as number[]).includes(Number(row.id)));
    }
    if (sql.includes("FROM t_library_brand WHERE id IN (?)")) {
      return brandRows.filter((row) => (params[0] as number[]).includes(Number(row.id)));
    }
    if (/COUNT\(\*\) AS total\s+FROM t_library_spu/.test(sql)) return [{ total: sources.length }];
    if (sql.includes("FROM t_library_spu s")) {
      return sources.map((row) => ({
        id: row.id,
        spuCode: row.spuCode,
        name: row.name,
        brandId: row.brandId,
        brandName: "贵州茅台",
        specs: row.specs,
        unit: row.unit,
        mainImage: row.mainImage,
        suggestedRetailPrice: row.suggestedRetailPrice,
        status: "APPROVED",
        createdAt: "2026-10-01T00:00:00.000Z",
        copied: 0,
        copiedSpuId: null,
      }));
    }
    if (sql.includes("COUNT(*) AS total FROM t_library_call_log")) return [{ total: 1 }];
    if (sql.includes("FROM t_library_call_log")) {
      return [
        {
          id: 1,
          librarySpuId: 123,
          librarySpuCode: SOURCE.spuCode,
          librarySpuName: SOURCE.name,
          spuId: 9001,
          skuCount: 2,
          callType: "COPY",
          operatorName: "张三",
          createdAt: "2026-10-01T10:00:00.000Z",
        },
      ];
    }
    throw new Error(`未打桩的 query SQL：${sql}`);
  });

  mocks.queryOne.mockImplementation(async (sql: string) => {
    if (/COUNT\(\*\) AS total\s+FROM t_library_spu/.test(sql)) return { total: sources.length };
    if (sql.includes("COUNT(*) AS total FROM t_library_call_log")) return { total: 1 };
    if (sql.includes("FROM t_tenant_library_copy")) return mappingRow;
    if (sql.includes("FROM t_library_sku")) return skus[0] ?? null;
    throw new Error(`未打桩的 queryOne SQL：${sql}`);
  });

  mocks.transaction.mockImplementation(async (runner: any) => runner({}));

  mocks.connQueryOne.mockImplementation(async (_conn: unknown, sql: string) => {
    if (sql.includes("FROM t_tenant_library_copy")) return mappingRow;
    if (sql.includes("JOIN t_subscription_plan")) return planRow;
    if (sql.includes("COUNT(*) AS total FROM t_product_spu")) return { total: productCount };
    throw new Error(`未打桩的 connQueryOne SQL：${sql}`);
  });

  mocks.connQuery.mockImplementation(async (_conn: unknown, sql: string) => {
    if (sql.includes("FROM t_library_sku")) return skus;
    throw new Error(`未打桩的 connQuery SQL：${sql}`);
  });

  mocks.connExecute.mockImplementation(async (_conn: unknown, sql: string, params: unknown[] = []) => {
    if (sql.includes("INSERT INTO t_product_sku") && duplicateBarcodeOnce && params[2] !== null) {
      duplicateBarcodeOnce = false;
      const err = new Error("Duplicate entry '6901234567890' for key 'uk_product_sku_barcode'") as Error & { code: string; errno: number };
      err.code = "ER_DUP_ENTRY";
      err.errno = 1062;
      throw err;
    }
    writes.push({ sql, params });
    return [{ insertId: sql.includes("INSERT INTO t_product_spu") ? 9001 : insertIdSeq++, affectedRows: 1 }, undefined];
  });
});

/** 取写语句里某一表的 INSERT（断言"流水/映射各 +1"用） */
function writesTo(table: string) {
  return writes.filter((w) => new RegExp(`INSERT INTO ${table}\\b`).test(w.sql));
}

/**
 * 按 INSERT 的**列名列表**解析出"列名 → 参数下标"，避免"按下标猜列"（SQL 列序一改就漂移）。
 * 规则：VALUES 里每个元素的 `?`（含 `CAST(? AS JSON)`）占一个参数；SQL 字面量（`0` / `NULL` / 字符串）不占参数。
 * 例：`t_product_spu` 的 `(…, category_id, brand_id, brand, unit, …)` + `VALUES (?, ?, 0, NULL, ?, ?, …)`
 *     ⇒ category_id / brand_id 不占参数，brand = params[2]、unit = params[3]。
 */
function insertParamIndex(table: string, column: string): number {
  const insert = writesTo(table)[0];
  expect(insert, `未捕获到 ${table} 的 INSERT`).toBeTruthy();
  const sql = insert.sql.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  const head = new RegExp(`^INSERT INTO ${table}\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\(`, "i").exec(sql);
  expect(head, `无法解析 ${table} 的 INSERT 列名：${sql}`).not.toBeNull();
  const columns = head![1].split(",").map((c) => c.trim());
  const valuesPart = sql.slice(head![0].length).replace(/\)\s*[;,]?\s*$/, "");
  let paramIdx = 0;
  const paramIndexOfColumn = valuesPart.split(",").map((token) => {
    const marks = (token.match(/\?/g) ?? []).length;
    if (marks === 0) return null;
    expect(marks, `${table} 的 VALUES 元素占位符数异常，无法定位：${token.trim()}`).toBe(1);
    return paramIdx++;
  });
  expect(
    paramIndexOfColumn.length,
    `${table}：列数 ${columns.length} ≠ VALUES 元素数 ${paramIndexOfColumn.length}`
  ).toBe(columns.length);
  const at = columns.indexOf(column);
  expect(at, `${table} 的 INSERT 缺少列 ${column}（列序：${columns.join(",")}）`).toBeGreaterThanOrEqual(0);
  const idx = paramIndexOfColumn[at];
  expect(idx, `${table}.${column} 在 VALUES 中是 SQL 字面量、不占参数下标`).not.toBeNull();
  return idx as number;
}

/** 取某表 INSERT 中指定**列名**实际写入的值（按列名定位，不按位置猜） */
function writtenValue(table: string, column: string): unknown {
  return writesTo(table)[0].params[insertParamIndex(table, column)];
}

describe("library-copy.service · copyLibrarySpus（T3）", () => {
  it("调取成功 ⇒ CREATED + 流水与映射各 +1 + 返回 spuId/skuCount（反测②的正向）", async () => {
    const result = await copyLibrarySpus({
      tenantId: "t-001",
      operatorId: 7,
      operatorName: "张三",
      librarySpuIds: [123],
    });

    expect(result.summary).toEqual({ created: 1, skipped: 0, rejected: 0 });
    expect(result.items[0]).toMatchObject({ librarySpuId: 123, result: "CREATED", spuId: 9001, skuCount: 2 });

    // 档案三张表 + 映射 + 流水
    expect(writesTo("t_product_spu")).toHaveLength(1);
    expect(writesTo("t_product_sku")).toHaveLength(2);
    expect(writesTo("t_product_price")).toHaveLength(2);
    expect(writesTo("t_tenant_library_copy")).toHaveLength(1);
    const callLog = writesTo("t_library_call_log");
    expect(callLog).toHaveLength(1);
    // 流水逐列：tenants/spu 快照/sku_count/call_type/操作人（快照口径）
    expect(callLog[0].params).toEqual(["t-001", 123, "SPU20260101001", "茅台 飞天 53度", 9001, 2, "COPY", 7, "张三"]);
    // 租户私有 SPU 落库状态与既有建品一致（草稿，商家确认价格后再上架）
    expect(writtenValue("t_product_spu", "status")).toBe("DRAFT");
    // 平台品牌不跨域写 id（平台 t_library_brand.id ≠ 租户 t_brand.id），只带名称快照
    // 品牌/单位快照按列名定位（不按下标猜）：category_id / brand_id 是 SQL 字面量不占参数，
    // 故 brand = params[2]、unit = params[3]（= source.unit）；改 SQL 列序也不会写错断言
    expect(() => writtenValue("t_product_spu", "category_id")).toThrow();
    expect(() => writtenValue("t_product_spu", "brand_id")).toThrow();
    expect(writtenValue("t_product_spu", "brand")).toBe("贵州茅台");
    expect(writtenValue("t_product_spu", "unit")).toBe("瓶");
    expect(writesTo("t_product_spu")[0].sql).toContain("category_id");
  });

  it("幂等（方案 B 唯一键命中）⇒ SKIPPED + 回既有 spuId + **零写入**（Q4：软删后同样 SKIPPED）", async () => {
    mappingRow = { id: 11, spu_id: 777 };
    // 即便配额已经用满，SKIPPED 也不应被配额拦下（不占配额）
    productCount = 5;
    planRow = { maxProducts: 5 };

    const result = await copyLibrarySpus({
      tenantId: "t-001",
      operatorId: 7,
      operatorName: "张三",
      librarySpuIds: [123],
    });

    expect(result.items[0]).toMatchObject({ librarySpuId: 123, result: "SKIPPED", spuId: 777, reason: "已调取过" });
    expect(result.summary).toEqual({ created: 0, skipped: 1, rejected: 0 });
    expect(writes).toHaveLength(0);
  });

  it("配额不足 ⇒ REJECTED 且不生成档案、不写流水、不占配额（反测①）", async () => {
    productCount = 3;
    planRow = { maxProducts: 3 };

    const result = await copyLibrarySpus({
      tenantId: "t-001",
      operatorId: 7,
      operatorName: "张三",
      librarySpuIds: [123],
    });

    expect(result.items[0].result).toBe("REJECTED");
    expect(result.items[0].reason).toContain("商品配额不足");
    expect(result.items[0].reason).toContain("已用 3 个 / 上限 3 个");
    expect(result.summary).toEqual({ created: 0, skipped: 0, rejected: 1 });
    expect(writes).toHaveLength(0);
  });

  it("无套餐上限（max_products 为 NULL）⇒ 不拦截，正常 CREATED", async () => {
    productCount = 999999;
    planRow = { maxProducts: null };

    const result = await copyLibrarySpus({
      tenantId: "t-001",
      operatorId: null,
      operatorName: null,
      librarySpuIds: [123],
    });
    expect(result.items[0].result).toBe("CREATED");
  });

  it("条码撞全库唯一键 ⇒ 降级写 NULL + warnings 显式给原因（Q2 裁定②）", async () => {
    duplicateBarcodeOnce = true;

    const result = await copyLibrarySpus({
      tenantId: "t-001",
      operatorId: 7,
      operatorName: "张三",
      librarySpuIds: [123],
    });

    expect(result.items[0].result).toBe("CREATED");
    expect(result.items[0].warnings).toHaveLength(1);
    expect(result.items[0].warnings?.[0]).toContain("降级为不带条码");
    const skuInserts = writesTo("t_product_sku");
    expect(skuInserts).toHaveLength(2);
    // 第一条（撞键重试）barcode = NULL，第二条仍带原条码
    expect(skuInserts[0].params[2]).toBeNull();
    expect(skuInserts[1].params[2]).toBe("6901234567891");
  });

  it("未知 id / 非 APPROVED ⇒ AppError 404 且零写入", async () => {
    sources = [];

    await expect(
      copyLibrarySpus({ tenantId: "t-001", operatorId: 7, operatorName: "张三", librarySpuIds: [999] })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(writes).toHaveLength(0);
  });

  it("批量（>1 个 SPU）⇒ call_type = BATCH_COPY，逐条给结果", async () => {
    const second = { ...SOURCE, id: 124, spuCode: "SPU20260101002", name: "五粮液 普五" };
    sources = [SOURCE, second];

    const result = await copyLibrarySpus({
      tenantId: "t-001",
      operatorId: 7,
      operatorName: "张三",
      librarySpuIds: [123, 124],
    });

    expect(result.summary).toEqual({ created: 2, skipped: 0, rejected: 0 });
    const callLogs = writesTo("t_library_call_log");
    expect(callLogs).toHaveLength(2);
    expect(callLogs.every((w) => w.params[6] === "BATCH_COPY")).toBe(true);
  });

  it("skuSelection 只调所选的 SKU（未选的 SKU 不落库）", async () => {
    const result = await copyLibrarySpus({
      tenantId: "t-001",
      operatorId: 7,
      operatorName: "张三",
      librarySpuIds: [123],
      skuSelection: { "123": [6] },
    });

    expect(result.items[0].skuCount).toBe(1);
    expect(writesTo("t_product_sku")).toHaveLength(1);
    expect(writesTo("t_product_sku")[0].params[3]).toBe("500ml 礼盒");
  });
});

describe("library-copy.service · 只读端点（T1/T4）", () => {
  it("T4 我的调取记录：SQL 带 tenant_id 过滤（可见范围 = 当前令牌租户）", async () => {
    const result = await listMyCallLogs({ tenantId: "t-001", page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.records[0]).toMatchObject({ librarySpuId: 123, spuId: 9001, skuCount: 2 });
    const listSql = mocks.query.mock.calls.map((c) => String(c[0])).filter((sql) => sql.includes("FROM t_library_call_log"));
    expect(listSql).toHaveLength(1);
    expect(listSql[0]).toContain("WHERE tenant_id = ?");
    expect(mocks.query.mock.calls.find((c) => String(c[0]).includes("FROM t_library_call_log"))?.[1]).toEqual(["t-001", 20, 0]);
  });

  it("T1 检索：只返回 APPROVED，且左连 t_tenant_library_copy 带当前租户（copied 不靠猜）", async () => {
    const result = await listLibrarySpus({ tenantId: "t-001", page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.records[0]).toMatchObject({ id: 123, copied: false, copiedSpuId: null });
    const listSql = mocks.query.mock.calls.map((c) => String(c[0])).find((sql) => sql.includes("FROM t_library_spu s"))!;
    expect(listSql).toContain("s.status = 'APPROVED'");
    expect(listSql).toContain("LEFT JOIN t_tenant_library_copy c ON c.library_spu_id = s.id AND c.tenant_id = ?");
    expect(listSql).not.toContain("hit_count");
  });
});
