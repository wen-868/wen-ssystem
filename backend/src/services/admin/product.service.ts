import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import logger from "../../shared/logger";
import { makeBizNo } from "../../shared/id";
import { detectChangedFields, syncChangedFields } from "../../shared/field-sync";
import { syncProductFullChain, syncProductStatus, syncProductPrice } from "../../shared/product-sync";
import { cacheGet, CacheKeys } from "../../shared/redis-cache";

// ==================== 类型定义 ====================

/** 商品列表行（含SKU、价格、库存） */
interface ProductListRow {
  spuId: number;
  spuCode: string;
  name: string;
  categoryId: number;
  categoryName: string;
  allowOnlineSale: number | string | null;
  brandId: number | null;
  brandName: string | null;
  unit: string | null;
  specs: string | null;
  alcoholContent: number | string | null;
  origin: string | null;
  mainImage: string | null;
  imageUrls: unknown;
  detail: string | null;
  saleChannels: unknown;
  sortNo: number;
  isNew: number;
  isRecommend: number;
  description: string | null;
  marketingTags: unknown;
  status: string;
  skuId: number;
  skuCode: string;
  skuName: string;
  barcode: string | null;
  volume: string | null;
  packaging: string | null;
  baseUnit: string | null;
  boxUnit: string | null;
  boxRatio: number;
  temperature: string;
  traceEnabled: number;
  warningThreshold: number;
  retailPrice: number | string;
  wholesalePrice: number | string | null;
  costPrice: number | string;
  miniappPrice: number | string | null;
  storePrice: number | string | null;
  availableQty: number | string;
}

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

/** 商品SPU详情行 */
interface ProductSpuRow {
  id: number;
  spuCode: string;
  name: string;
  categoryId: number;
  categoryName: string;
  allowOnlineSale: number | string | null;
  brandId: number | null;
  brandName: string | null;
  unit: string | null;
  specs: string | null;
  alcoholContent: number | string | null;
  origin: string | null;
  mainImage: string | null;
  imageUrls: unknown;
  detail: string | null;
  saleChannels: unknown;
  sortNo: number;
  isNew: number;
  isRecommend: number;
  description: string | null;
  marketingTags: unknown;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** 商品SKU详情行 */
interface ProductSkuRow {
  id: number;
  skuCode: string;
  skuName: string;
  barcode: string | null;
  volume: string | null;
  packaging: string | null;
  baseUnit: string | null;
  boxUnit: string | null;
  boxRatio: number;
  temperature: string;
  traceEnabled: number;
  warningThreshold: number;
  costPrice: number | string;
  retailPrice: number | string;
  wholesalePrice: number | string | null;
  miniappPrice: number | string | null;
  storePrice: number | string | null;
  availableQty: number | string;
}

/** 商品SPU全部字段行（用于 update 对比） */
interface ProductSpuFullRow {
  id: number;
  name: string;
  category_id: number;
  brand_id: number | null;
  unit: string | null;
  status: string;
  [key: string]: unknown;
}

/** 商品SPU状态行 */
interface ProductSpuStatusRow {
  id: number;
  name: string;
  status: string;
}

/** 价格历史行 */
interface PriceHistoryRow {
  id: number;
  skuId: number;
  priceType: string;
  oldPrice: number | string | null;
  newPrice: number | string;
  actionType: string;
  operatorId: number;
  createdAt: string | Date;
}

/** SKU SPU ID 行 */
interface SkuSpuIdRow {
  spu_id: number;
}

/** INSERT 结果行（mysql2 OkPacket） */
interface InsertOkPacket {
  insertId: number;
  affectedRows: number;
}

/** 商品价格行 */
interface ProductPriceRow {
  id: number;
  sku_id: number;
  cost_price: number | string;
  retail_price: number | string;
  wholesale_price: number | string | null;
  miniapp_price: number | string | null;
  store_price: number | string | null;
  tenant_id: string;
  [key: string]: unknown;
}

export async function listProducts(keyword: string, page: number, pageSize: number, tenantId: string) {
  // 有搜索关键词时不使用缓存
  if (keyword) {
    const like = `%${keyword}%`;
    const offset = (page - 1) * pageSize;
    const records = await queryWithTenant<ProductListRow>(
      `SELECT p.id AS spuId, p.spu_code AS spuCode, p.name, p.category_id AS categoryId,
              pc.name AS categoryName, pc.allow_online_sale AS allowOnlineSale,
              p.brand_id AS brandId, b.name AS brandName, p.unit, p.specs,
              p.alcohol_content AS alcoholContent, p.origin, p.main_image AS mainImage,
              p.image_urls AS imageUrls, p.detail, p.sale_channels AS saleChannels,
              p.sort_no AS sortNo, p.is_new AS isNew, p.is_recommend AS isRecommend,
              p.description, p.marketing_tags AS marketingTags, p.status,
              s.id AS skuId, s.sku_code AS skuCode, s.sku_name AS skuName, s.barcode,
              s.volume, s.packaging, s.base_unit AS baseUnit, s.box_unit AS boxUnit,
              s.box_ratio AS boxRatio, s.temperature, s.trace_enabled AS traceEnabled,
              s.warning_threshold AS warningThreshold,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice,
              pp.cost_price AS costPrice, pp.miniapp_price AS miniappPrice,
              pp.store_price AS storePrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM t_product_sku s
       JOIN t_product_spu p ON p.id = s.spu_id
       JOIN t_product_price pp ON pp.sku_id = s.id
       LEFT JOIN t_product_category pc ON pc.id = p.category_id
       LEFT JOIN t_brand b ON b.id = p.brand_id
       LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'OFFLINE'
       WHERE p.tenant_id = ? AND (p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
       ORDER BY p.id DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [tenantId, like, like, like, pageSize, offset],
      tenantId
    );
    const totalRow = await queryOneWithTenant<CountTotalRow>(
      `SELECT COUNT(*) AS total
       FROM t_product_sku s
       JOIN t_product_spu p ON p.id = s.spu_id
       WHERE p.tenant_id = ? AND (p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)`,
      [tenantId, like, like, like],
      tenantId
    );
    return { total: totalRow?.total ?? 0, page, pageSize, records };
  }

  // 无搜索关键词时使用缓存
  return cacheGet(CacheKeys.products(Number(tenantId), page, pageSize), async () => {
    const offset = (page - 1) * pageSize;
    const records = await queryWithTenant<ProductListRow>(
      `SELECT p.id AS spuId, p.spu_code AS spuCode, p.name, p.category_id AS categoryId,
              pc.name AS categoryName, pc.allow_online_sale AS allowOnlineSale,
              p.brand_id AS brandId, b.name AS brandName, p.unit, p.specs,
              p.alcohol_content AS alcoholContent, p.origin, p.main_image AS mainImage,
              p.image_urls AS imageUrls, p.detail, p.sale_channels AS saleChannels,
              p.sort_no AS sortNo, p.is_new AS isNew, p.is_recommend AS isRecommend,
              p.description, p.marketing_tags AS marketingTags, p.status,
              s.id AS skuId, s.sku_code AS skuCode, s.sku_name AS skuName, s.barcode,
              s.volume, s.packaging, s.base_unit AS baseUnit, s.box_unit AS boxUnit,
              s.box_ratio AS boxRatio, s.temperature, s.trace_enabled AS traceEnabled,
              s.warning_threshold AS warningThreshold,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice,
              pp.cost_price AS costPrice, pp.miniapp_price AS miniappPrice,
              pp.store_price AS storePrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM t_product_sku s
       JOIN t_product_spu p ON p.id = s.spu_id
       JOIN t_product_price pp ON pp.sku_id = s.id
       LEFT JOIN t_product_category pc ON pc.id = p.category_id
       LEFT JOIN t_brand b ON b.id = p.brand_id
       LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'OFFLINE'
       WHERE p.tenant_id = ?
       ORDER BY p.id DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [tenantId, pageSize, offset],
      tenantId
    );
    const totalRow = await queryOneWithTenant<CountTotalRow>(
      `SELECT COUNT(*) AS total FROM t_product_sku s JOIN t_product_spu p ON p.id = s.spu_id WHERE p.tenant_id = ?`,
      [tenantId],
      tenantId
    );
    return { total: totalRow?.total ?? 0, page, pageSize, records };
  }, 300);
}

export async function getProductDetail(spuId: number, tenantId: string) {
  const spu = await queryOneWithTenant<ProductSpuRow>(
    `SELECT p.id, p.spu_code AS spuCode, p.name, p.category_id AS categoryId,
            pc.name AS categoryName, pc.allow_online_sale AS allowOnlineSale,
            p.brand_id AS brandId, b.name AS brandName, p.unit, p.specs,
            p.alcohol_content AS alcoholContent, p.origin,
            p.main_image AS mainImage, p.image_urls AS imageUrls, p.detail,
            p.sale_channels AS saleChannels, p.sort_no AS sortNo,
            p.is_new AS isNew, p.is_recommend AS isRecommend,
            p.description, p.marketing_tags AS marketingTags, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt
     FROM t_product_spu p
     LEFT JOIN t_product_category pc ON pc.id = p.category_id
     LEFT JOIN t_brand b ON b.id = p.brand_id
     WHERE p.id = ? AND p.tenant_id = ?`,
    [spuId, tenantId], tenantId
  );
  if (!spu) throw Object.assign(new Error("商品不存在"), { statusCode: 404 });

  const skus = await queryWithTenant<ProductSkuRow>(
    `SELECT s.id, s.sku_code AS skuCode, s.sku_name AS skuName, s.barcode,
            s.volume, s.packaging, s.base_unit AS baseUnit, s.box_unit AS boxUnit,
            s.box_ratio AS boxRatio, s.temperature, s.trace_enabled AS traceEnabled,
            s.warning_threshold AS warningThreshold,
            pp.cost_price AS costPrice, pp.retail_price AS retailPrice,
            pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
            pp.store_price AS storePrice,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM t_product_sku s
     LEFT JOIN t_product_price pp ON pp.sku_id = s.id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'OFFLINE'
     WHERE s.spu_id = ? AND s.tenant_id = ?
     ORDER BY s.id ASC`,
    [spuId, tenantId], tenantId
  );

  return { ...spu, skus };
}

export async function createProduct(body: {
  name: string;
  categoryId: number;
  brandId?: number;
  unit?: string;
  specs?: string;
  mainImage?: string;
  saleChannels: string[];
  alcoholContent?: number;
  origin?: string;
  sortNo?: number;
  isNew?: boolean;
  isRecommend?: boolean;
  description?: string;
  skus: Array<{
    skuName: string;
    barcode?: string;
    volume?: string;
    packaging?: string;
    baseUnit?: string;
    boxUnit?: string;
    boxRatio: number;
    temperature: "NORMAL" | "CHILLED";
    traceEnabled: boolean;
    warningThreshold: number;
    costPrice: number;
    retailPrice: number;
    wholesalePrice?: number | null;
    miniappPrice?: number | null;
    storePrice?: number | null;
  }>;
}, tenantId: string, rawBody: Record<string, unknown>) {
  const result = await transaction(async (conn) => {
    const spuCode = makeBizNo("SPU");
    const [spuResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO t_product_spu (spu_code, name, category_id, brand_id, unit, specs,
       main_image, sale_channels, alcohol_content, origin, sort_no, is_new, is_recommend,
       description, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [spuCode, body.name, body.categoryId,
        body.brandId ?? null, body.unit ?? null, body.specs ?? null,
        body.mainImage ?? null, JSON.stringify(body.saleChannels),
        body.alcoholContent ?? null, body.origin ?? null,
        body.sortNo ?? 0, body.isNew ? 1 : 0, body.isRecommend ? 1 : 0,
        body.description ?? null, tenantId]
    );
    const spuId = spuResult.insertId as number;
    let firstSkuId: number | null = null;
    for (const sku of body.skus) {
      const skuCode = makeBizNo("SKU");
      const [skuResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO t_product_sku (spu_id, sku_code, barcode, sku_name, volume, packaging,
         base_unit, box_unit, box_ratio, temperature, trace_enabled, warning_threshold, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [spuId, skuCode, sku.barcode ?? null, sku.skuName,
          sku.volume ?? null, sku.packaging ?? null,
          sku.baseUnit ?? '瓶', sku.boxUnit ?? '箱',
          sku.boxRatio, sku.temperature, sku.traceEnabled ? 1 : 0, sku.warningThreshold, tenantId]
      );
      const skuId = skuResult.insertId as number;
      firstSkuId ??= skuId;
      await conn.query(
        `INSERT INTO t_product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [skuId, sku.costPrice, sku.retailPrice, sku.wholesalePrice ?? null, sku.miniappPrice ?? null, sku.storePrice ?? null, tenantId]
      );
      if (rawBody.initialQty !== undefined) {
        await conn.query(
          `INSERT INTO t_inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, tenant_id)
           VALUES (1, ?, ?, ?, 0, ?, ?)
           ON DUPLICATE KEY UPDATE physical_qty = VALUES(physical_qty), available_qty = VALUES(available_qty), updated_at = NOW()`,
          [skuId, rawBody.stockType ?? "OFFLINE", rawBody.initialQty, rawBody.initialQty, tenantId]
        );
      }
    }
    return { id: spuId, spuId, skuId: firstSkuId, spuCode };
  });
  return result;
}

export async function updateProductStatus(spuId: number, status: string, tenantId: string) {
  const result = await queryWithTenant("UPDATE t_product_spu SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?", [status, spuId, tenantId], tenantId);
  if (!result || (result as unknown as { affectedRows: number }).affectedRows === 0) {
    return null;
  }

  syncProductStatus(spuId, status, tenantId).catch(err => {
    logger.error("[ProductSync] 状态同步异常:", err.message);
  });

  return { spuId, status };
}

export async function updateProduct(spuId: number, body: {
  name?: string;
  barcode?: string;
  category?: string;
  brandId?: number;
  unit?: string;
  boxRatio?: number;
  specs?: string;
  status?: "DRAFT" | "ON_SALE" | "OFF_SALE";
  sortNo?: number;
  isNew?: boolean;
  isRecommend?: boolean;
  description?: string;
}, tenantId: string) {
  const existing = await queryOneWithTenant<ProductSpuFullRow>("SELECT * FROM t_product_spu WHERE id = ? AND tenant_id = ?", [spuId, tenantId], tenantId);
  if (!existing) {
    return null;
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.category !== undefined) { sets.push("category_id = ?"); params.push(body.category); }
  if (body.brandId !== undefined) { sets.push("brand_id = ?"); params.push(body.brandId); }
  if (body.unit !== undefined) { sets.push("unit = ?"); params.push(body.unit); }
  if (body.specs !== undefined) { sets.push("specs = ?"); params.push(body.specs); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (body.sortNo !== undefined) { sets.push("sort_no = ?"); params.push(body.sortNo); }
  if (body.isNew !== undefined) { sets.push("is_new = ?"); params.push(body.isNew ? 1 : 0); }
  if (body.isRecommend !== undefined) { sets.push("is_recommend = ?"); params.push(body.isRecommend ? 1 : 0); }
  if (body.description !== undefined) { sets.push("description = ?"); params.push(body.description); }
  if (sets.length === 0) { return { spuId }; }
  sets.push("updated_at = NOW()");
  params.push(spuId, tenantId);
  await queryWithTenant(`UPDATE t_product_spu SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, params, tenantId);

  if (body.barcode !== undefined) {
    await queryWithTenant("UPDATE t_product_sku SET barcode = ? WHERE spu_id = ? AND tenant_id = ?", [body.barcode, spuId, tenantId], tenantId);
  }
  if (body.boxRatio !== undefined) {
    await queryWithTenant("UPDATE t_product_sku SET box_ratio = ? WHERE spu_id = ? AND tenant_id = ?", [body.boxRatio, spuId, tenantId], tenantId);
  }

  const changedFields = detectChangedFields<Record<string, unknown>>(body, {
    name: existing.name,
    category: existing.category_id,
    brandId: existing.brand_id,
    unit: existing.unit,
    status: existing.status
  });
  if (changedFields.length > 0) {
    syncChangedFields("product_spu", spuId, changedFields, tenantId).catch(err => {
      logger.error("[FieldSync] 商品字段同步异常:", err.message);
    });

    syncProductFullChain(spuId, changedFields, tenantId).then(summary => {
      if (summary.failCount > 0) {
        logger.warn(`[ProductSync] 全链路同步部分失败: ${summary.failCount}/${summary.totalTargets}`, summary.stages.filter(s => !s.success));
      }
    }).catch(err => {
      logger.error("[ProductSync] 全链路同步异常:", err.message);
    });
  }

  return { spuId };
}

export async function disableProduct(spuId: number, tenantId: string) {
  const existing = await queryOneWithTenant<ProductSpuStatusRow>("SELECT id, name, status FROM t_product_spu WHERE id = ? AND tenant_id = ?", [spuId, tenantId], tenantId);
  if (!existing) {
    throw Object.assign(new Error("商品不存在"), { statusCode: 404 });
  }
  if (existing.status === "OFF_SALE") {
    throw Object.assign(new Error("商品已停售"), { statusCode: 400 });
  }
  await queryWithTenant("UPDATE t_product_spu SET status = 'OFF_SALE', updated_at = NOW() WHERE id = ? AND tenant_id = ?", [spuId, tenantId], tenantId);
  return { spuId, name: existing.name };
}

export async function getProductPriceHistory(skuId: number, tenantId: string) {
  const records = await queryWithTenant<PriceHistoryRow>(
    `SELECT id, sku_id AS skuId, price_type AS priceType, old_price AS oldPrice,
            new_price AS newPrice, action_type AS actionType, operator_id AS operatorId, created_at AS createdAt
     FROM t_product_price_log
     WHERE sku_id = ? AND tenant_id = ?
     ORDER BY id DESC
     LIMIT 50`,
    [skuId, tenantId],
    tenantId
  );
  return { records };
}

export async function updateProductPrice(skuId: number, body: {
  costPrice?: number;
  retailPrice?: number;
  wholesalePrice?: number | null;
  miniappPrice?: number | null;
  storePrice?: number | null;
}, tenantId: string, userId: number) {
  const result = await transaction(async (conn) => {
    const [oldRows] = await conn.query<RowDataPacket[]>("SELECT * FROM t_product_price WHERE sku_id = ? AND tenant_id = ?", [skuId, tenantId]);
    const oldPrice = oldRows[0] as ProductPriceRow;
    if (!oldPrice) throw Object.assign(new Error("SKU价格不存在"), { statusCode: 404 });
    const changes = [
      ["COST", oldPrice.cost_price, body.costPrice],
      ["RETAIL", oldPrice.retail_price, body.retailPrice],
      ["WHOLESALE", oldPrice.wholesale_price, body.wholesalePrice],
      ["MINIAPP", oldPrice.miniapp_price, body.miniappPrice],
      ["STORE", oldPrice.store_price, body.storePrice]
    ].filter(([, oldValue, newValue]) => newValue !== undefined && Number(oldValue ?? 0) !== Number(newValue ?? 0));
    await conn.query(
      `UPDATE t_product_price
       SET cost_price = COALESCE(?, cost_price),
           retail_price = COALESCE(?, retail_price),
           wholesale_price = ?,
           miniapp_price = ?,
           store_price = ?
       WHERE sku_id = ? AND tenant_id = ?`,
      [
        body.costPrice ?? null,
        body.retailPrice ?? null,
        body.wholesalePrice === undefined ? oldPrice.wholesale_price : body.wholesalePrice,
        body.miniappPrice === undefined ? oldPrice.miniapp_price : body.miniappPrice,
        body.storePrice === undefined ? oldPrice.store_price : body.storePrice,
        skuId,
        tenantId
      ]
    );
    for (const [priceType, oldValue, newValue] of changes) {
      await conn.query(
        `INSERT INTO t_product_price_log (sku_id, operator_id, price_type, old_price, new_price, action_type, tenant_id)
         VALUES (?, ?, ?, ?, ?, 'UPDATE', ?)`,
        [skuId, userId, priceType, oldValue ?? null, newValue ?? null, tenantId]
      );
    }
    return { skuId };
  });

  if (body.costPrice !== undefined || body.retailPrice !== undefined || body.wholesalePrice !== undefined) {
    const changedTypes: string[] = [];
    if (body.costPrice !== undefined) changedTypes.push("costPrice");
    if (body.retailPrice !== undefined) changedTypes.push("retailPrice");
    if (body.wholesalePrice !== undefined) changedTypes.push("wholesalePrice");

    const skuInfo = await queryOneWithTenant<SkuSpuIdRow>(
      "SELECT spu_id FROM t_product_sku WHERE id = ? AND tenant_id = ?",
      [skuId, tenantId],
      tenantId
    );

    if (skuInfo?.spu_id) {
      syncProductPrice(skuInfo.spu_id, changedTypes, tenantId).catch(err => {
        logger.error("[ProductSync] 价格同步异常:", err.message);
      });
    }
  }

  return result;
}

/**
 * 更新 SKU 条码（商品档案维护：每个 SKU 可录入/修改条码）
 * 注意：t_product_sku.barcode 有唯一约束，重复条码需提示
 */
export async function updateSkuBarcode(
  skuId: number,
  barcode: string,
  tenantId: string,
) {
  const trimmed = (barcode || "").trim();
  try {
    const result = await queryWithTenant(
      `UPDATE t_product_sku SET barcode = ?, updated_at = NOW() WHERE id = ?`,
      [trimmed || null, skuId],
      tenantId,
    );
    if ((result as { affectedRows?: number }).affectedRows === 0) {
      throw Object.assign(new Error("SKU 不存在"), { statusCode: 404 });
    }
    return { skuId, barcode: trimmed || null };
  } catch (e: any) {
    // 唯一键冲突：条码已存在
    if (e?.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("该条码已被其他商品使用"), {
        statusCode: 400,
      });
    }
    throw e;
  }
}

// 商品导入
export async function importProducts(
  rows: Array<Record<string, string>>,
  tenantId: string
) {
  const errors: Array<{ row: number; message: string }> = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    try {
      if (!row.name || !row.skuName) {
        errors.push({ row: rowNum, message: "商品名称和SKU名称为必填项" });
        continue;
      }
      await transaction(async (conn) => {
        const spuCode = makeBizNo("SPU");
        const [spuResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO t_product_spu (spu_code, name, category_id, brand_id, unit, specs,
           main_image, sale_channels, alcohol_content, origin, sort_no, is_new, is_recommend,
           description, status, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
          [spuCode, row.name, Number(row.categoryId) || 1,
            row.brandId ? Number(row.brandId) : null, row.unit ?? null, row.specs ?? null,
            row.mainImage ?? null, JSON.stringify(["STORE", "MINIAPP"]),
            row.alcoholContent ? Number(row.alcoholContent) : null, row.origin ?? null,
            Number(row.sortNo) || 0, row.isNew === '1' ? 1 : 0, row.isRecommend === '1' ? 1 : 0,
            row.description ?? null, tenantId]
        );
        const spuId = spuResult.insertId as number;
        const skuCode = makeBizNo("SKU");
        const [skuResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO t_product_sku (spu_id, sku_code, barcode, sku_name, volume, packaging,
           base_unit, box_unit, box_ratio, temperature, trace_enabled, warning_threshold, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [spuId, skuCode, row.barcode ?? null, row.skuName,
            row.volume ?? null, row.packaging ?? null,
            row.baseUnit ?? '瓶', row.boxUnit ?? '箱',
            Number(row.boxRatio) || 1, row.temperature || 'NORMAL',
            row.traceEnabled === '1' ? 1 : 0, Number(row.warningThreshold) || 0, tenantId]
        );
        const skuId = skuResult.insertId as number;
        await conn.query(
          `INSERT INTO t_product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [skuId, Number(row.costPrice) || 0, Number(row.retailPrice) || 0,
            row.wholesalePrice ? Number(row.wholesalePrice) : null,
            row.miniappPrice ? Number(row.miniappPrice) : null,
            row.storePrice ? Number(row.storePrice) : null, tenantId]
        );
      });
      successCount++;
    } catch (err: unknown) {
      errors.push({ row: rowNum, message: (err as Error).message || "导入失败" });
    }
  }
  return { successCount, failCount: errors.length, errors };
}

// 营销标签设置
export async function setMarketingTags(spuId: number, tags: string[], tenantId: string) {
  await queryWithTenant(
    "UPDATE t_product_spu SET marketing_tags = ? WHERE id = ? AND tenant_id = ?",
    [JSON.stringify(tags), spuId, tenantId],
    tenantId
  );
  return { spuId, marketingTags: tags };
}
