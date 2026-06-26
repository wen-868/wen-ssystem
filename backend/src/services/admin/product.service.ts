import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";
import { detectChangedFields, syncChangedFields } from "../../shared/field-sync.js";
import { syncProductFullChain, syncProductStatus, syncProductPrice } from "../../shared/product-sync.js";

export async function listProducts(keyword: string, page: number, pageSize: number, tenantId: string) {
  const like = `%${keyword}%`;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT p.id AS spuId, s.id AS skuId, p.name, p.main_image AS mainImage, s.sku_name AS skuName, s.sku_code AS skuCode, s.barcode,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, p.status
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     JOIN product_price pp ON pp.sku_id = s.id
     WHERE p.tenant_id = ? AND (p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
     ORDER BY p.id DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, like, like, like, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     WHERE p.tenant_id = ? AND (p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)`,
    [tenantId, like, like, like],
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function createProduct(body: {
  name: string;
  categoryId: number;
  mainImage?: string;
  saleChannels: string[];
  skus: Array<{
    skuName: string;
    barcode?: string;
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
    const [spuResult] = await conn.query<any>(
      `INSERT INTO product_spu (spu_code, name, category_id, main_image, sale_channels, status, tenant_id)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), 'DRAFT', ?)`,
      [spuCode, body.name, body.categoryId, body.mainImage ?? null, JSON.stringify(body.saleChannels), tenantId]
    );
    const spuId = spuResult.insertId as number;
    let firstSkuId: number | null = null;
    for (const sku of body.skus) {
      const skuCode = makeBizNo("SKU");
      const [skuResult] = await conn.query<any>(
        `INSERT INTO product_sku (spu_id, sku_code, barcode, sku_name, box_ratio, temperature, trace_enabled, warning_threshold, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [spuId, skuCode, sku.barcode ?? null, sku.skuName, sku.boxRatio, sku.temperature, sku.traceEnabled ? 1 : 0, sku.warningThreshold, tenantId]
      );
      const skuId = skuResult.insertId as number;
      firstSkuId ??= skuId;
      await conn.query(
        `INSERT INTO product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [skuId, sku.costPrice, sku.retailPrice, sku.wholesalePrice ?? null, sku.miniappPrice ?? null, sku.storePrice ?? null, tenantId]
      );
      if (rawBody.initialQty !== undefined) {
        await conn.query(
          `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, tenant_id)
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
  const result = await queryWithTenant("UPDATE product_spu SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?", [status, spuId, tenantId], tenantId);
  if (!result || (result as any).affectedRows === 0) {
    return null;
  }

  // M0-11: 状态变更全链路同步
  syncProductStatus(spuId, status, tenantId).catch(err => {
    console.error("[ProductSync] 状态同步异常:", err.message);
  });

  return { spuId, status };
}

export async function updateProduct(spuId: number, body: {
  name?: string;
  barcode?: string;
  category?: string;
  brand?: string;
  unit?: string;
  boxRatio?: number;
  specs?: string;
  status?: "DRAFT" | "ON_SALE" | "OFF_SALE";
}, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id FROM product_spu WHERE id = ? AND tenant_id = ?", [spuId, tenantId], tenantId);
  if (!existing) {
    return null;
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.category !== undefined) { sets.push("category_id = ?"); params.push(body.category); }
  if (body.brand !== undefined) { sets.push("brand = ?"); params.push(body.brand); }
  if (body.unit !== undefined) { sets.push("unit = ?"); params.push(body.unit); }
  if (body.specs !== undefined) { sets.push("specs = ?"); params.push(body.specs); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length === 0) { return { spuId }; }
  sets.push("updated_at = NOW()");
  params.push(spuId, tenantId);
  await queryWithTenant(`UPDATE product_spu SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, params, tenantId);

  if (body.barcode !== undefined) {
    await queryWithTenant("UPDATE product_sku SET barcode = ? WHERE spu_id = ? AND tenant_id = ?", [body.barcode, spuId, tenantId], tenantId);
  }
  if (body.boxRatio !== undefined) {
    await queryWithTenant("UPDATE product_sku SET box_ratio = ? WHERE spu_id = ? AND tenant_id = ?", [body.boxRatio, spuId, tenantId], tenantId);
  }

  // 分字段定向同步：只同步变更的字段到下游关联表
  const changedFields = detectChangedFields(body, {
    name: existing.name,
    category: existing.category_id,
    brand: existing.brand,
    unit: existing.unit,
    status: existing.status
  });
  if (changedFields.length > 0) {
    // M0-10: 分字段定向同步
    syncChangedFields("product_spu", spuId, changedFields, tenantId).catch(err => {
      console.error("[FieldSync] 商品字段同步异常:", err.message);
    });

    // M0-11: 商品全链路同步
    syncProductFullChain(spuId, changedFields, tenantId).then(summary => {
      if (summary.failCount > 0) {
        console.warn(`[ProductSync] 全链路同步部分失败: ${summary.failCount}/${summary.totalTargets}`, summary.stages.filter(s => !s.success));
      }
    }).catch(err => {
      console.error("[ProductSync] 全链路同步异常:", err.message);
    });
  }

  return { spuId };
}

export async function disableProduct(spuId: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, name, status FROM product_spu WHERE id = ? AND tenant_id = ?", [spuId, tenantId], tenantId);
  if (!existing) {
    return { code: "404", message: "商品不存在" };
  }
  if (existing.status === "OFF_SALE") {
    return { code: "400", message: "商品已停售" };
  }
  await queryWithTenant("UPDATE product_spu SET status = 'OFF_SALE', updated_at = NOW() WHERE id = ? AND tenant_id = ?", [spuId, tenantId], tenantId);
  return { spuId, name: existing.name };
}

export async function getProductPriceHistory(skuId: number, tenantId: string) {
  const records = await queryWithTenant<any>(
    `SELECT id, sku_id AS skuId, price_type AS priceType, old_price AS oldPrice,
            new_price AS newPrice, action_type AS actionType, operator_id AS operatorId, created_at AS createdAt
     FROM product_price_log
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
    const [oldRows] = await conn.query<any[]>("SELECT * FROM product_price WHERE sku_id = ? AND tenant_id = ?", [skuId, tenantId]);
    const oldPrice = oldRows[0];
    if (!oldPrice) throw Object.assign(new Error("SKU价格不存在"), { statusCode: 404 });
    const changes = [
      ["COST", oldPrice.cost_price, body.costPrice],
      ["RETAIL", oldPrice.retail_price, body.retailPrice],
      ["WHOLESALE", oldPrice.wholesale_price, body.wholesalePrice],
      ["MINIAPP", oldPrice.miniapp_price, body.miniappPrice],
      ["STORE", oldPrice.store_price, body.storePrice]
    ].filter(([, oldValue, newValue]) => newValue !== undefined && Number(oldValue ?? 0) !== Number(newValue ?? 0));
    await conn.query(
      `UPDATE product_price
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
        `INSERT INTO product_price_log (sku_id, operator_id, price_type, old_price, new_price, action_type, tenant_id)
         VALUES (?, ?, ?, ?, ?, 'UPDATE', ?)`,
        [skuId, userId, priceType, oldValue ?? null, newValue ?? null, tenantId]
      );
    }
    return { skuId };
  });

  // M0-11: 价格变更全链路同步（异步，不阻塞响应）
  if (body.costPrice !== undefined || body.retailPrice !== undefined || body.wholesalePrice !== undefined) {
    const changedTypes: string[] = [];
    if (body.costPrice !== undefined) changedTypes.push("costPrice");
    if (body.retailPrice !== undefined) changedTypes.push("retailPrice");
    if (body.wholesalePrice !== undefined) changedTypes.push("wholesalePrice");

    // 获取 SKU 对应的 SPU ID
    const skuInfo = await queryOneWithTenant<any>(
      "SELECT spu_id FROM product_sku WHERE id = ? AND tenant_id = ?",
      [skuId, tenantId],
      tenantId
    );

    if (skuInfo?.spu_id) {
      syncProductPrice(skuInfo.spu_id, changedTypes, tenantId).catch(err => {
        console.error("[ProductSync] 价格同步异常:", err.message);
      });
    }
  }

  return result;
}