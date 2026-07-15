/**
 * 批量价格调整服务
 *
 * 支持：
 * 1. 按分类 / 品牌 / 供应商 / 价格等级筛选商品
 * 2. 调整方式：固定金额(+/-)、百分比(+/-%)
 * 3. 支持预览模式（不实际修改，只返回调整结果）
 * 4. 支持确认执行
 * 5. 自动记录价格变更日志
 */

import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

// ─── 类型定义 ─────────────────────────────────────────────────

export interface BatchPriceFilter {
  categoryId?: number;
  brand?: string;
  supplierId?: number;
  priceLevelId?: number;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  skuIds?: number[];
}

export interface BatchPriceAdjustment {
  field: "retail_price" | "wholesale_price" | "cost_price" | "miniapp_price" | "store_price";
  method: "FIXED" | "PERCENTAGE";
  value: number;
  direction: "INCREASE" | "DECREASE";
}

export interface BatchPricePreviewItem {
  skuId: number;
  skuName: string;
  skuCode: string;
  oldPrice: number;
  newPrice: number;
  changeAmount: number;
  changePercent: number;
}

export interface BatchPricePreviewResult {
  totalCount: number;
  affectedCount: number;
  skippedCount: number;
  totalOldAmount: number;
  totalNewAmount: number;
  totalChangeAmount: number;
  items: BatchPricePreviewItem[];
}

export interface BatchPriceExecuteResult {
  success: boolean;
  totalCount: number;
  updatedCount: number;
  failedCount: number;
  changeLogs?: number;
  batchNo?: string;
}

// ─── 价格计算工具 ─────────────────────────────────────────────

function calculateNewPrice(
  oldPrice: number,
  adjustment: BatchPriceAdjustment
): { newPrice: number; changeAmount: number; changePercent: number } {
  let newPrice: number;
  const direction = adjustment.direction === "INCREASE" ? 1 : -1;

  if (adjustment.method === "FIXED") {
    newPrice = Number((oldPrice + direction * adjustment.value).toFixed(2));
  } else {
    newPrice = Number((oldPrice * (1 + direction * adjustment.value / 100)).toFixed(2));
  }

  if (newPrice < 0) newPrice = 0;

  const changeAmount = Number((newPrice - oldPrice).toFixed(2));
  const changePercent = oldPrice > 0
    ? Number(((newPrice - oldPrice) / oldPrice * 100).toFixed(2))
    : 0;

  return { newPrice, changeAmount, changePercent };
}

// ─── 批量价格预览 ─────────────────────────────────────────────

/**
 * 批量价格调整预览
 * 不实际修改数据，只返回调整结果
 */
export async function previewBatchPriceAdjustment(
  filter: BatchPriceFilter,
  adjustment: BatchPriceAdjustment,
  tenantId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<BatchPricePreviewResult> {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["pp.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (filter.categoryId) {
    conditions.push("s.category_id = ?");
    params.push(filter.categoryId);
  }
  if (filter.brand) {
    conditions.push("s.brand = ?");
    params.push(filter.brand);
  }
  if (filter.supplierId) {
    conditions.push("s.supplier_id = ?");
    params.push(filter.supplierId);
  }
  if (filter.priceLevelId) {
    conditions.push("pp.price_level_id = ?");
    params.push(filter.priceLevelId);
  }
  if (filter.keyword) {
    conditions.push("(s.name LIKE ? OR sku.sku_name LIKE ? OR sku.barcode LIKE ?)");
    const like = `%${filter.keyword}%`;
    params.push(like, like, like);
  }
  if (filter.minPrice !== undefined) {
    conditions.push(`pp.${adjustment.field} >= ?`);
    params.push(filter.minPrice);
  }
  if (filter.maxPrice !== undefined) {
    conditions.push(`pp.${adjustment.field} <= ?`);
    params.push(filter.maxPrice);
  }
  if (filter.skuIds && filter.skuIds.length > 0) {
    conditions.push("sku.id IN (?)");
    params.push(filter.skuIds);
  }

  const where = conditions.join(" AND ");

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total
     FROM t_product_price pp
     JOIN t_product_sku sku ON sku.id = pp.sku_id AND sku.tenant_id = pp.tenant_id
     JOIN t_product_spu s ON s.id = sku.spu_id AND s.tenant_id = sku.tenant_id
     WHERE ${where}`,
    params,
    tenantId
  );

  const totalCount = Number(totalRow?.total ?? 0);
  const items: BatchPricePreviewItem[] = [];
  let totalOldAmount = 0;
  let totalNewAmount = 0;
  let skippedCount = 0;

  if (totalCount > 0) {
    const rows = await queryWithTenant<any>(
      `SELECT sku.id AS skuId, sku.sku_name AS skuName, sku.sku_code AS skuCode,
              pp.${adjustment.field} AS price
       FROM t_product_price pp
       JOIN t_product_sku sku ON sku.id = pp.sku_id AND sku.tenant_id = pp.tenant_id
       JOIN t_product_spu s ON s.id = sku.spu_id AND s.tenant_id = sku.tenant_id
       WHERE ${where}
       ORDER BY sku.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
      tenantId
    );

    for (const row of rows) {
      const oldPrice = Number(row.price ?? 0);
      const { newPrice, changeAmount, changePercent } = calculateNewPrice(oldPrice, adjustment);

      if (oldPrice === newPrice) {
        skippedCount++;
        continue;
      }

      items.push({
        skuId: row.skuId,
        skuName: row.skuName,
        skuCode: row.skuCode,
        oldPrice,
        newPrice,
        changeAmount,
        changePercent
      });

      totalOldAmount += oldPrice;
      totalNewAmount += newPrice;
    }
  }

  return {
    totalCount,
    affectedCount: items.length,
    skippedCount,
    totalOldAmount: Number(totalOldAmount.toFixed(2)),
    totalNewAmount: Number(totalNewAmount.toFixed(2)),
    totalChangeAmount: Number((totalNewAmount - totalOldAmount).toFixed(2)),
    items
  };
}

// ─── 批量价格执行 ─────────────────────────────────────────────

/**
 * 执行批量价格调整
 */
export async function executeBatchPriceAdjustment(
  filter: BatchPriceFilter,
  adjustment: BatchPriceAdjustment,
  reason: string,
  operatorId: number,
  tenantId: string
): Promise<BatchPriceExecuteResult> {
  const conditions: string[] = ["pp.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (filter.categoryId) {
    conditions.push("s.category_id = ?");
    params.push(filter.categoryId);
  }
  if (filter.brand) {
    conditions.push("s.brand = ?");
    params.push(filter.brand);
  }
  if (filter.supplierId) {
    conditions.push("s.supplier_id = ?");
    params.push(filter.supplierId);
  }
  if (filter.priceLevelId) {
    conditions.push("pp.price_level_id = ?");
    params.push(filter.priceLevelId);
  }
  if (filter.keyword) {
    conditions.push("(s.name LIKE ? OR sku.sku_name LIKE ? OR sku.barcode LIKE ?)");
    const like = `%${filter.keyword}%`;
    params.push(like, like, like);
  }
  if (filter.minPrice !== undefined) {
    conditions.push(`pp.${adjustment.field} >= ?`);
    params.push(filter.minPrice);
  }
  if (filter.maxPrice !== undefined) {
    conditions.push(`pp.${adjustment.field} <= ?`);
    params.push(filter.maxPrice);
  }
  if (filter.skuIds && filter.skuIds.length > 0) {
    conditions.push("sku.id IN (?)");
    params.push(filter.skuIds);
  }

  const where = conditions.join(" AND ");

  const result = await transaction(async (conn) => {
    const [priceRows] = await conn.query<any[]>(
      `SELECT pp.id AS priceId, pp.sku_id AS skuId, pp.${adjustment.field} AS oldPrice,
              pp.price_level_id AS priceLevelId
       FROM t_product_price pp
       JOIN t_product_sku sku ON sku.id = pp.sku_id AND sku.tenant_id = pp.tenant_id
       JOIN t_product_spu s ON s.id = sku.spu_id AND s.tenant_id = sku.tenant_id
       WHERE ${where}
       FOR UPDATE`,
      params
    );

    const batchNo = "BATCH_" + Date.now();
    let updatedCount = 0;
    let failedCount = 0;
    let logCount = 0;

    for (const row of priceRows) {
      const oldPrice = Number(row.oldPrice ?? 0);
      const { newPrice, changeAmount } = calculateNewPrice(oldPrice, adjustment);

      if (oldPrice === newPrice) {
        failedCount++;
        continue;
      }

      const [updateResult] = await conn.query<any>(
        `UPDATE t_product_price
         SET ${adjustment.field} = ?, updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [newPrice, row.priceId, tenantId]
      );

      if ((updateResult as unknown as { affectedRows: number }).affectedRows > 0) {
        updatedCount++;

        // 记录价格变更日志
        const priceTypeMap: Record<string, string> = {
          retail_price: "RETAIL",
          wholesale_price: "WHOLESALE",
          cost_price: "COST",
          miniapp_price: "MINIAPP",
          store_price: "STORE"
        };

        await conn.query(
          `INSERT INTO t_product_price_log
           (sku_id, operator_id, price_type, old_price, new_price, action_type, change_reason, batch_no, tenant_id)
           VALUES (?, ?, ?, ?, ?, 'BATCH_UPDATE', ?, ?, ?)`,
          [
            row.skuId,
            operatorId,
            priceTypeMap[adjustment.field] || adjustment.field,
            oldPrice,
            newPrice,
            reason || "批量价格调整",
            batchNo,
            tenantId
          ]
        );
        logCount++;
      } else {
        failedCount++;
      }
    }

    return { batchNo, updatedCount, failedCount, logCount, totalCount: priceRows.length };
  });

  return {
    success: true,
    totalCount: result.totalCount,
    updatedCount: result.updatedCount,
    failedCount: result.failedCount,
    changeLogs: result.logCount,
    batchNo: result.batchNo
  };
}

// ─── 批量价格调整记录 ─────────────────────────────────────────

/**
 * 查询批量价格调整记录
 */
export async function listBatchPriceLogs(
  page: number,
  pageSize: number,
  tenantId: string,
  filters?: {
    batchNo?: string;
    priceType?: string;
    operatorId?: number;
    startDate?: string;
    endDate?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["batch_no IS NOT NULL", "tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (filters?.batchNo) {
    conditions.push("batch_no = ?");
    params.push(filters.batchNo);
  }
  if (filters?.priceType) {
    conditions.push("price_type = ?");
    params.push(filters.priceType);
  }
  if (filters?.operatorId) {
    conditions.push("operator_id = ?");
    params.push(filters.operatorId);
  }
  if (filters?.startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(filters.endDate);
  }

  const where = conditions.join(" AND ");

  const rows = await queryWithTenant<any>(
    `SELECT batch_no AS batchNo, price_type AS priceType,
            COUNT(*) AS skuCount,
            SUM(CASE WHEN old_price > new_price THEN old_price - new_price ELSE 0 END) AS totalDecrease,
            SUM(CASE WHEN new_price > old_price THEN new_price - old_price ELSE 0 END) AS totalIncrease,
            MAX(created_at) AS createdAt,
            MAX(change_reason) AS reason,
            MAX(operator_id) AS operatorId
     FROM t_product_price_log
     WHERE ${where}
     GROUP BY batch_no, price_type
     ORDER BY createdAt DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(DISTINCT batch_no) AS total
     FROM t_product_price_log
     WHERE ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}

/**
 * 批量价格调整详情（某个批次的全部SKU调整明细）
 */
export async function getBatchPriceDetail(
  batchNo: string,
  tenantId: string,
  page: number = 1,
  pageSize: number = 50
) {
  const offset = (page - 1) * pageSize;

  const rows = await queryWithTenant<any>(
    `SELECT ppl.id, ppl.sku_id AS skuId, s.sku_name AS skuName,
            ppl.price_type AS priceType, ppl.old_price AS oldPrice,
            ppl.new_price AS newPrice,
            (ppl.new_price - ppl.old_price) AS changeAmount,
            ppl.change_reason AS reason, ppl.created_at AS createdAt
     FROM t_product_price_log ppl
     JOIN t_product_sku s ON s.id = ppl.sku_id AND s.tenant_id = ppl.tenant_id
     WHERE ppl.batch_no = ? AND ppl.tenant_id = ?
     ORDER BY ppl.id DESC
     LIMIT ? OFFSET ?`,
    [batchNo, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS total FROM t_product_price_log WHERE batch_no = ? AND tenant_id = ?",
    [batchNo, tenantId],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}
