import { describe, it, expect, vi, beforeEach } from "vitest";
import logger from "../../shared/logger";
import { seedData } from "../../shared/seed-data";

function buildConn(opts: {
  allEmpty?: boolean;
  dupTable?: string;
  errorTable?: string;
  throwTable?: string;
}) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    const s = String(sql).toUpperCase();
    if (s.includes("COUNT(*) AS CNT")) {
      if (opts.throwTable && s.includes(opts.throwTable.toUpperCase())) {
        throw Object.assign(new Error("no such table"), { code: "ER_NO_SUCH_TABLE" });
      }
      const m = sql.match(/FROM\s+`?(\w+)`?/);
      const table = m ? m[1] : "";
      const cnt = opts.allEmpty ? 0 : 5;
      return [[{ cnt }]];
    }
    if (s.includes("FROM T_STORE WHERE STORE_CODE")) return [[{ id: 1 }]];
    if (s.includes("SELECT ID, CODE FROM T_PRODUCT_CATEGORY"))
      return [[{ id: 1, code: "CAT_BAIJIU" }, { id: 2, code: "CAT_BEER" }, { id: 3, code: "CAT_WINE" }, { id: 4, code: "CAT_SPIRITS" }, { id: 5, code: "CAT_OTHER" }]];
    if (s.includes("SELECT ID, SPU_CODE, NAME FROM T_PRODUCT_SPU"))
      return [[{ id: 1, spu_code: "SPU_MT_53", name: "茅台" }, { id: 2, spu_code: "SPU_WH_500", name: "五粮液" }]];
    if (s.includes("SELECT ID, SKU_CODE, SKU_NAME FROM T_PRODUCT_SKU"))
      return [[{ id: 1, sku_code: "SKU_MT_500", sku_name: "茅台500ml" }, { id: 2, sku_code: "SKU_WH_500", sku_name: "五粮液500ml" }]];
    if (s.includes("FROM T_MEMBER ORDER BY ID LIMIT 3")) return [[{ id: 1 }, { id: 2 }, { id: 3 }]];
    if (s.includes("SELECT ID, NAME FROM T_SUPPLIER")) return [[{ id: 1, name: "默认供应商" }, { id: 2, name: "备用供应商" }]];
    if (s.includes("USERNAME = 'ADMIN'")) return [[{ id: 1 }]];
    if (s.includes("RETAIL_PRICE, WHOLESALE_PRICE FROM T_PRODUCT_PRICE"))
      return [[{ sku_id: 1, retail_price: 1199, wholesale_price: 1000 }, { sku_id: 2, retail_price: 899, wholesale_price: 800 }]];
    if (s.includes("COST_PRICE FROM T_PRODUCT_PRICE"))
      return [[{ sku_id: 1, cost_price: 800 }, { sku_id: 2, cost_price: 600 }]];
    if (opts.dupTable && s.includes(`INTO ${opts.dupTable.toUpperCase()}`))
      throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
    if (opts.errorTable && s.includes(`INTO ${opts.errorTable.toUpperCase()}`))
      throw Object.assign(new Error("boom"), { code: "ER_BAD_DB_ERROR" });
    return [[{ affectedRows: 1, insertId: 1 }]];
  });
  return { query };
}

function countInserts(conn: any) {
  return (conn.query as any).mock.calls.filter((c: any[]) => String(c[0]).toUpperCase().includes("INSERT INTO")).length;
}

describe("shared/seed-data - seedData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("全表为空时插入全部种子数据", async () => {
    const conn = buildConn({ allEmpty: true });
    await seedData(conn as any);
    expect(conn.query).toHaveBeenCalled();
    expect(countInserts(conn)).toBeGreaterThan(5);
  });

  it("表已有数据则跳过插入（走 else 分支）", async () => {
    const conn = buildConn({ allEmpty: false });
    await seedData(conn as any);
    expect(countInserts(conn)).toBe(0);
  });

  it("safeInsert 遇重复主键静默跳过（不抛错）", async () => {
    const conn = buildConn({ allEmpty: true, dupTable: "t_store" });
    await expect(seedData(conn as any)).resolves.toBeUndefined();
  });

  it("safeInsert 其他数据库错误记录日志（不抛错）", async () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const conn = buildConn({ allEmpty: true, errorTable: "t_product_category" });
    await expect(seedData(conn as any)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("isTableEmpty 表不存在时返回 false（catch 分支）", async () => {
    const conn = buildConn({ allEmpty: true, throwTable: "t_supplier" });
    await expect(seedData(conn as any)).resolves.toBeUndefined();
  });
});
