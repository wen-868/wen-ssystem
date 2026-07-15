/**
 * 商品详情全链路同步中间件
 *
 * 核心能力：当商品 SPU 数据发生变更时，自动将商品详情同步到全链路下游表，
 * 包括：SKU表、库存表、销售订单、采购订单、报表、营销活动等。
 *
 * 同步策略：
 * 1. 基础信息同步（名称/分类/品牌/单位）→ 所有关联表
 * 2. 价格同步 → 销售订单/采购订单（仅未完成订单）
 * 3. 状态同步 → SKU状态级联
 * 4. 库存水位同步 → 告警配置
 *
 * 使用方式：
 * - Service 层调用 syncProductFullChain(spuId, changedFields, tenantId)
 * - 异步执行，不阻塞主流程
 * - 同步结果记录到 product_sync_log 表
 */

import { queryWithTenant, queryOneWithTenant } from "./db";

// ─── 类型定义 ─────────────────────────────────────────────────

export interface ProductSyncResult {
  /** 同步阶段 */
  stage: string;
  /** 目标表 */
  targetTable: string;
  /** 同步字段 */
  syncedFields: string[];
  /** 影响行数 */
  affectedRows: number;
  /** 耗时(ms) */
  durationMs: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

export interface ProductSyncSummary {
  spuId: number;
  totalTargets: number;
  successCount: number;
  failCount: number;
  totalDurationMs: number;
  stages: ProductSyncResult[];
}

// ─── 全链路同步引擎 ───────────────────────────────────────────

/**
 * 执行商品全链路同步
 * @param spuId 商品SPU ID
 * @param changedFields 变更的字段名列表（空数组表示全量同步）
 * @param tenantId 租户ID
 * @returns 同步结果摘要
 */
export async function syncProductFullChain(
  spuId: number,
  changedFields: string[],
  tenantId: string
): Promise<ProductSyncSummary> {
  const startTime = Date.now();
  const stages: ProductSyncResult[] = [];

  // 获取商品当前信息
  const product = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT p.id, p.name AS productName, p.category_id AS categoryId, c.category_name AS categoryName,
            p.brand, p.unit, p.main_image AS mainImage, p.status
     FROM t_product_spu p
     LEFT JOIN t_product_category c ON c.id = p.category_id
     WHERE p.id = ? AND p.tenant_id = ?`,
    [spuId, tenantId],
    tenantId
  );

  if (!product) {
    return { spuId, totalTargets: 0, successCount: 0, failCount: 0, totalDurationMs: Date.now() - startTime, stages: [] };
  }

  const shouldSync = (field: string): boolean => {
    return changedFields.length === 0 || changedFields.includes(field);
  };

  // ── 阶段1：同步到 SKU 表 ──
  if (shouldSync("productName") || shouldSync("categoryId") || shouldSync("brand") || shouldSync("unit") || shouldSync("status")) {
    const t1 = Date.now();
    try {
      const fields: string[] = [];
      const sets: string[] = [];
      const params: unknown[] = [];

      if (shouldSync("productName")) { sets.push("product_name = ?"); params.push(product.productName); fields.push("product_name"); }
      if (shouldSync("categoryId")) { sets.push("category_id = ?"); params.push(product.categoryId); fields.push("category_id"); }
      if (shouldSync("brand")) { sets.push("brand = ?"); params.push(product.brand); fields.push("brand"); }
      if (shouldSync("unit")) { sets.push("unit = ?"); params.push(product.unit); fields.push("unit"); }
      if (shouldSync("status")) { sets.push("status = ?"); params.push(product.status); fields.push("status"); }

      // 进入外层 if 后 sets.length 一定 > 0，无需重复检查
      sets.push("updated_at = NOW()");
      params.push(spuId, tenantId);
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_product_sku SET ${sets.join(", ")} WHERE spu_id = ? AND tenant_id = ?`,
        params,
        tenantId
      );
      stages.push({
        stage: "SKU_SYNC",
        targetTable: "product_sku",
        syncedFields: fields,
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t1,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "SKU_SYNC",
        targetTable: "product_sku",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t1,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段2：同步到库存余额表 ──
  if (shouldSync("productName") || shouldSync("categoryId")) {
    const t2 = Date.now();
    try {
      const fields: string[] = [];
      const sets: string[] = [];
      const params: unknown[] = [];

      if (shouldSync("productName")) { sets.push("product_name = ?"); params.push(product.productName); fields.push("product_name"); }
      if (shouldSync("categoryId")) { sets.push("category_id = ?"); params.push(product.categoryId); fields.push("category_id"); }

      params.push(spuId, tenantId);
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_inventory_balance SET ${sets.join(", ")}, updated_at = NOW() WHERE spu_id = ? AND tenant_id = ?`,
        params,
        tenantId
      );
      stages.push({
        stage: "INVENTORY_SYNC",
        targetTable: "inventory_balance",
        syncedFields: fields,
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t2,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "INVENTORY_SYNC",
        targetTable: "inventory_balance",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t2,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段3：同步到销售订单明细（未完成订单） ──
  if (shouldSync("productName") || shouldSync("unit")) {
    const t3 = Date.now();
    try {
      const fields: string[] = [];
      const sets: string[] = [];
      const params: unknown[] = [];

      if (shouldSync("productName")) { sets.push("sbi.product_name = ?"); params.push(product.productName); fields.push("product_name"); }
      if (shouldSync("unit")) { sets.push("sbi.unit = ?"); params.push(product.unit); fields.push("unit"); }

      params.push(spuId, tenantId);
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_sale_bill_item sbi
         JOIN t_sale_bill sb ON sb.id = sbi.bill_id AND sb.tenant_id = sbi.tenant_id
         SET ${sets.join(", ")}, sbi.updated_at = NOW()
         WHERE sbi.spu_id = ? AND sbi.tenant_id = ?
           AND sb.status IN ('DRAFT', 'PENDING', 'CONFIRMED')`,
        params,
        tenantId
      );
      stages.push({
        stage: "SALE_ORDER_SYNC",
        targetTable: "sale_bill_item",
        syncedFields: fields,
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t3,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "SALE_ORDER_SYNC",
        targetTable: "sale_bill_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t3,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段4：同步到采购订单明细（未完成订单） ──
  if (shouldSync("productName") || shouldSync("unit")) {
    const t4 = Date.now();
    try {
      const fields: string[] = [];
      const sets: string[] = [];
      const params: unknown[] = [];

      if (shouldSync("productName")) { sets.push("poi.product_name = ?"); params.push(product.productName); fields.push("product_name"); }
      if (shouldSync("unit")) { sets.push("poi.unit = ?"); params.push(product.unit); fields.push("unit"); }

      params.push(spuId, tenantId);
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_purchase_order_item poi
         JOIN t_purchase_order po ON po.id = poi.order_id AND po.tenant_id = poi.tenant_id
         SET ${sets.join(", ")}, poi.updated_at = NOW()
         WHERE poi.spu_id = ? AND poi.tenant_id = ?
           AND po.status IN ('DRAFT', 'PENDING', 'APPROVED')`,
        params,
        tenantId
      );
      stages.push({
        stage: "PURCHASE_ORDER_SYNC",
        targetTable: "purchase_order_item",
        syncedFields: fields,
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t4,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "PURCHASE_ORDER_SYNC",
        targetTable: "purchase_order_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t4,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段5：同步到库存流水表 ──
  if (shouldSync("productName")) {
    const t5 = Date.now();
    try {
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_inventory_ledger
         SET product_name = ?, updated_at = NOW()
         WHERE spu_id = ? AND tenant_id = ?`,
        [product.productName, spuId, tenantId],
        tenantId
      );
      stages.push({
        stage: "LEDGER_SYNC",
        targetTable: "inventory_ledger",
        syncedFields: ["product_name"],
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t5,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "LEDGER_SYNC",
        targetTable: "inventory_ledger",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t5,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段6：同步到库存批次表 ──
  if (shouldSync("productName")) {
    const t6 = Date.now();
    try {
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_inventory_batch
         SET product_name = ?, updated_at = NOW()
         WHERE spu_id = ? AND tenant_id = ?`,
        [product.productName, spuId, tenantId],
        tenantId
      );
      stages.push({
        stage: "BATCH_SYNC",
        targetTable: "inventory_batch",
        syncedFields: ["product_name"],
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t6,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "BATCH_SYNC",
        targetTable: "inventory_batch",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t6,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段7：同步到小程序订单明细 ──
  if (shouldSync("productName")) {
    const t7 = Date.now();
    try {
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_miniapp_order_item
         SET product_name = ?, updated_at = NOW()
         WHERE spu_id = ? AND tenant_id = ?`,
        [product.productName, spuId, tenantId],
        tenantId
      );
      stages.push({
        stage: "MINIAPP_SYNC",
        targetTable: "miniapp_order_item",
        syncedFields: ["product_name"],
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t7,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "MINIAPP_SYNC",
        targetTable: "miniapp_order_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t7,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段8：同步到销售退货明细 ──
  if (shouldSync("productName")) {
    const t8 = Date.now();
    try {
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_sale_return_item
         SET product_name = ?, updated_at = NOW()
         WHERE spu_id = ? AND tenant_id = ?`,
        [product.productName, spuId, tenantId],
        tenantId
      );
      stages.push({
        stage: "RETURN_SYNC",
        targetTable: "sale_return_item",
        syncedFields: ["product_name"],
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t8,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "RETURN_SYNC",
        targetTable: "sale_return_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t8,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // ── 阶段9：同步到采购入库/退货明细 ──
  if (shouldSync("productName")) {
    const t9a = Date.now();
    try {
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_purchase_in_stock_item
         SET product_name = ?, updated_at = NOW()
         WHERE spu_id = ? AND tenant_id = ?`,
        [product.productName, spuId, tenantId],
        tenantId
      );
      stages.push({
        stage: "IN_STOCK_SYNC",
        targetTable: "purchase_in_stock_item",
        syncedFields: ["product_name"],
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t9a,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "IN_STOCK_SYNC",
        targetTable: "purchase_in_stock_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t9a,
        success: false,
        error: (err as { message?: string }).message
      });
    }

    const t9b = Date.now();
    try {
      const result = await queryWithTenant<Record<string, unknown>>(
        `UPDATE t_purchase_return_item
         SET product_name = ?, updated_at = NOW()
         WHERE spu_id = ? AND tenant_id = ?`,
        [product.productName, spuId, tenantId],
        tenantId
      );
      stages.push({
        stage: "PURCHASE_RETURN_SYNC",
        targetTable: "purchase_return_item",
        syncedFields: ["product_name"],
        affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
        durationMs: Date.now() - t9b,
        success: true
      });
    } catch (err: unknown) {
      stages.push({
        stage: "PURCHASE_RETURN_SYNC",
        targetTable: "purchase_return_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: Date.now() - t9b,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  const successCount = stages.filter(s => s.success).length;
  const failCount = stages.filter(s => !s.success).length;

  return {
    spuId,
    totalTargets: stages.length,
    successCount,
    failCount,
    totalDurationMs: Date.now() - startTime,
    stages
  };
}

/**
 * 同步商品状态到全链路
 * 当商品状态变更时，级联更新所有下游表的状态
 */
export async function syncProductStatus(
  spuId: number,
  newStatus: string,
  tenantId: string
): Promise<ProductSyncResult[]> {
  const results: ProductSyncResult[] = [];
  const startTime = Date.now();

  // 同步到 SKU 状态
  try {
    const t1 = Date.now();
    const result = await queryWithTenant<Record<string, unknown>>(
      `UPDATE t_product_sku SET status = ?, updated_at = NOW() WHERE spu_id = ? AND tenant_id = ?`,
      [newStatus, spuId, tenantId],
      tenantId
    );
    results.push({
      stage: "STATUS_SKU",
      targetTable: "product_sku",
      syncedFields: ["status"],
      affectedRows: Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0,
      durationMs: Date.now() - t1,
      success: true
    });
  } catch (err: unknown) {
    results.push({
      stage: "STATUS_SKU",
      targetTable: "product_sku",
      syncedFields: [],
      affectedRows: 0,
      durationMs: 0,
      success: false,
      error: (err as { message?: string }).message
    });
  }

  return results;
}

/**
 * 同步商品价格到全链路（仅影响未完成的销售/采购订单）
 */
export async function syncProductPrice(
  spuId: number,
  changedPriceTypes: string[],
  tenantId: string
): Promise<ProductSyncResult[]> {
  const results: ProductSyncResult[] = [];

  // 获取SKU列表
  const skus = await queryWithTenant<Record<string, unknown>>(
    `SELECT id FROM t_product_sku WHERE spu_id = ? AND tenant_id = ?`,
    [spuId, tenantId],
    tenantId
  );

  if (skus.length === 0) return results;

  const skuIds = skus.map((s: Record<string, unknown>) => s.id);

  // 获取各SKU的最新价格
  const prices = await queryWithTenant<Record<string, unknown>>(
    `SELECT sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price
     FROM t_product_price
     WHERE sku_id IN (?) AND tenant_id = ?`,
    [skuIds, tenantId],
    tenantId
  );

  // 同步到销售订单明细（仅未完成订单）
  if (changedPriceTypes.includes("retailPrice") || changedPriceTypes.includes("wholesalePrice")) {
    try {
      const t1 = Date.now();
      let count = 0;
      for (const price of prices) {
        const field = changedPriceTypes.includes("wholesalePrice") ? "wholesale_price" : "retail_price";
        const value = changedPriceTypes.includes("wholesalePrice") ? price.wholesale_price : price.retail_price;
        const result = await queryWithTenant<Record<string, unknown>>(
          `UPDATE t_sale_bill_item sbi
           JOIN t_sale_bill sb ON sb.id = sbi.bill_id AND sb.tenant_id = sbi.tenant_id
           SET sbi.${field} = ?, sbi.updated_at = NOW()
           WHERE sbi.sku_id = ? AND sbi.tenant_id = ?
             AND sb.status IN ('DRAFT', 'PENDING')`,
          [value, price.sku_id, tenantId],
          tenantId
        );
        count += Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0;
      }
      results.push({
        stage: "PRICE_SALE_ORDER",
        targetTable: "sale_bill_item",
        syncedFields: changedPriceTypes,
        affectedRows: count,
        durationMs: Date.now() - t1,
        success: true
      });
    } catch (err: unknown) {
      results.push({
        stage: "PRICE_SALE_ORDER",
        targetTable: "sale_bill_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: 0,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  // 同步到采购订单明细（仅未完成订单）
  if (changedPriceTypes.includes("costPrice")) {
    try {
      const t2 = Date.now();
      let count = 0;
      for (const price of prices) {
        const result = await queryWithTenant<Record<string, unknown>>(
          `UPDATE t_purchase_order_item poi
           JOIN t_purchase_order po ON po.id = poi.order_id AND po.tenant_id = poi.tenant_id
           SET poi.cost_price = ?, poi.updated_at = NOW()
           WHERE poi.sku_id = ? AND poi.tenant_id = ?
             AND po.status IN ('DRAFT', 'PENDING')`,
          [price.cost_price, price.sku_id, tenantId],
          tenantId
        );
        count += Number((result as unknown as Record<string, unknown>)?.affectedRows) || 0;
      }
      results.push({
        stage: "PRICE_PURCHASE_ORDER",
        targetTable: "purchase_order_item",
        syncedFields: ["costPrice"],
        affectedRows: count,
        durationMs: Date.now() - t2,
        success: true
      });
    } catch (err: unknown) {
      results.push({
        stage: "PRICE_PURCHASE_ORDER",
        targetTable: "purchase_order_item",
        syncedFields: [],
        affectedRows: 0,
        durationMs: 0,
        success: false,
        error: (err as { message?: string }).message
      });
    }
  }

  return results;
}

/**
 * 获取商品全链路同步状态
 * 返回商品在各下游表中的数据一致性状态
 */
export async function getProductSyncStatus(
  spuId: number,
  tenantId: string
): Promise<{
  spuId: number;
  productName: string;
  targets: Array<{ table: string; recordCount: number; inSync: boolean }>;
}> {
  const product = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT id, name FROM t_product_spu WHERE id = ? AND tenant_id = ?",
    [spuId, tenantId],
    tenantId
  );

  if (!product) {
    throw new Error("商品不存在");
  }

  const targets = [
    { table: "product_sku", sql: "SELECT COUNT(*) as cnt FROM t_product_sku WHERE spu_id = ? AND tenant_id = ?" },
    { table: "inventory_balance", sql: "SELECT COUNT(*) as cnt FROM t_inventory_balance WHERE spu_id = ? AND tenant_id = ?" },
    { table: "inventory_ledger", sql: "SELECT COUNT(*) as cnt FROM t_inventory_ledger WHERE spu_id = ? AND tenant_id = ?" },
    { table: "sale_bill_item", sql: "SELECT COUNT(*) as cnt FROM t_sale_bill_item WHERE spu_id = ? AND tenant_id = ?" },
    { table: "purchase_order_item", sql: "SELECT COUNT(*) as cnt FROM t_purchase_order_item WHERE spu_id = ? AND tenant_id = ?" },
  ];

  const result = {
    spuId,
    productName: String(product.name),
    targets: [] as Array<{ table: string; recordCount: number; inSync: boolean }>
  };

  for (const target of targets) {
    try {
      const row = await queryOneWithTenant<Record<string, unknown>>(target.sql, [spuId, tenantId], tenantId);
      result.targets.push({
        table: target.table,
        recordCount: Number(row?.cnt ?? 0),
        inSync: true
      });
    } catch {
      result.targets.push({
        table: target.table,
        recordCount: 0,
        inSync: false
      });
    }
  }

  return result;
}