import { query, queryOneWithTenant, queryWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/**
 * 核价与价格异常服务（R100 商用化）：
 * - 建议核价：门店/管理员提交核价单，等待审批
 * - 价格异常：基于真实成本价/售价核算售价异常商品（售价低于成本 / 售价为 0）
 */

interface SkuPriceRow {
  skuId: number;
  spuId: number;
  productName: string;
  skuName: string | null;
  spec: string | null;
  barcode: string | null;
  costPrice: number | string;
  retailPrice: number | string;
  storePrice: number | string | null;
  miniappPrice: number | string | null;
  wholesalePrice: number | string | null;
  status: number;
}

/** 价格异常类型 */
export type PriceAnomalyType = "BELOW_COST" | "ZERO_PRICE";

function toNum(v: number | string | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return Number(v);
}

/** 判断异常类型：全部售价为 0 → ZERO_PRICE，否则售价低于成本 → BELOW_COST */
function resolveAnomalyType(row: SkuPriceRow): PriceAnomalyType {
  const cost = toNum(row.costPrice);
  const retail = toNum(row.retailPrice);
  const store = toNum(row.storePrice);
  const miniapp = toNum(row.miniappPrice);
  const wholesale = toNum(row.wholesalePrice);
  const allZero = retail <= 0 && store <= 0 && miniapp <= 0 && wholesale <= 0;
  if (allZero) return "ZERO_PRICE";
  return "BELOW_COST";
}

/**
 * 价格异常列表：成本价 > 0 且（任一售价低于成本价，或全部售价为 0）
 */
export async function listPriceAnomalies(tenantId: string, params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  anomalyType?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;
  const where: string[] = [
    "p.cost_price > 0",
    "sku.status = 1",
    "spu.status <> 'DRAFT'",
    `(
      p.retail_price < p.cost_price
      OR p.store_price < p.cost_price
      OR p.miniapp_price < p.cost_price
      OR (p.wholesale_price IS NOT NULL AND p.wholesale_price < p.cost_price)
      OR (
        p.retail_price <= 0
        AND (p.store_price IS NULL OR p.store_price <= 0)
        AND (p.miniapp_price IS NULL OR p.miniapp_price <= 0)
        AND (p.wholesale_price IS NULL OR p.wholesale_price <= 0)
      )
    )`,
  ];
  const args: unknown[] = [];
  if (params.keyword) {
    where.push("(spu.name LIKE ? OR sku.sku_name LIKE ? OR sku.barcode LIKE ?)");
    const kw = `%${params.keyword}%`;
    args.push(kw, kw, kw);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const totalRow = await queryWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM t_product_price p
     JOIN t_product_sku sku ON sku.id = p.sku_id
     JOIN t_product_spu spu ON spu.id = sku.spu_id
     ${whereSql}`,
    args,
    tenantId
  );
  const rows = await queryWithTenant<SkuPriceRow>(
    `SELECT sku.id AS skuId, spu.id AS spuId, spu.name AS productName, sku.sku_name AS skuName,
            spu.specs AS spec, sku.barcode AS barcode,
            p.cost_price AS costPrice, p.retail_price AS retailPrice, p.store_price AS storePrice,
            p.miniapp_price AS miniappPrice, p.wholesale_price AS wholesalePrice, sku.status AS status
     FROM t_product_price p
     JOIN t_product_sku sku ON sku.id = p.sku_id
     JOIN t_product_spu spu ON spu.id = sku.spu_id
     ${whereSql}
     ORDER BY spu.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, offset],
    tenantId
  );
  const records = rows
    .map((r) => {
      const anomalyType = resolveAnomalyType(r);
      if (params.anomalyType && anomalyType !== params.anomalyType) return null;
      return {
        skuId: r.skuId,
        spuId: r.spuId,
        productName: r.productName,
        skuName: r.skuName || "",
        spec: r.spec || "",
        barcode: r.barcode || "",
        costPrice: toNum(r.costPrice),
        retailPrice: toNum(r.retailPrice),
        storePrice: toNum(r.storePrice),
        miniappPrice: toNum(r.miniappPrice),
        wholesalePrice: toNum(r.wholesalePrice),
        anomalyType,
        anomalyTypeLabel: anomalyType === "BELOW_COST" ? "售价低于成本价" : "售价为 0",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return { records, total: totalRow?.[0]?.total ?? 0, page, pageSize };
}

interface SubmitReviewBody {
  skuId: number;
  suggestedPrice: number;
  /** 核价价格档位：COST/RETAIL/WHOLESALE/MINIAPP/STORE，默认 RETAIL（零售价） */
  priceType?: "COST" | "RETAIL" | "WHOLESALE" | "MINIAPP" | "STORE";
  reason?: string;
}

/** priceType → t_product_price 价格列名 */
const PRICE_COLUMN: Record<NonNullable<SubmitReviewBody["priceType"]>, string> = {
  COST: "cost_price",
  RETAIL: "retail_price",
  WHOLESALE: "wholesale_price",
  MINIAPP: "miniapp_price",
  STORE: "store_price",
};

/**
 * 提交建议核价单：校验商品存在与建议价合法，按 priceType 记录对应档位的当前价
 */
export async function submitPriceReview(tenantId: string, user: { id?: number; name?: string }, body: SubmitReviewBody) {
  if (!body.skuId) throw new Error("请选择商品");
  const price = Number(body.suggestedPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("建议售价必须大于 0");
  }
  const priceType = body.priceType ?? "RETAIL";
  const priceColumn = PRICE_COLUMN[priceType] ?? "retail_price";
  const row = await queryOneWithTenant<{
    skuId: number;
    spuId: number;
    productName: string;
    skuName: string | null;
    spec: string | null;
    currentPrice: number | string;
  }>(
    `SELECT sku.id AS skuId, spu.id AS spuId, spu.name AS productName, sku.sku_name AS skuName,
            spu.specs AS spec, p.${priceColumn} AS currentPrice
     FROM t_product_sku sku
     JOIN t_product_spu spu ON spu.id = sku.spu_id
     LEFT JOIN t_product_price p ON p.sku_id = sku.id
     WHERE sku.id = ?`,
    [body.skuId],
    tenantId
  );
  if (!row) {
    throw Object.assign(new Error("商品不存在"), { statusCode: 404 });
  }
  const reviewNo = makeBizNo("PR");
  const insert = (await query(
    `INSERT INTO t_price_review
      (tenant_id, review_no, sku_id, spu_id, product_name, sku_name, spec, price_type, current_price, suggested_price, reason, created_by, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      reviewNo,
      body.skuId,
      row.spuId,
      row.productName,
      row.skuName || null,
      row.spec || null,
      priceType,
      toNum(row.currentPrice),
      price,
      body.reason || null,
      user.id ?? null,
      user.name || null,
    ]
  )) as unknown as { insertId: number };
  return { id: insert.insertId, reviewNo, status: "PENDING" };
}
