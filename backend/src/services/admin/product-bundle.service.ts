import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { ResultSetHeader } from "mysql2/promise";

/** 套装行（列表/详情，description 仅详情查询返回设为可选） */
interface ProductBundleRow {
  id: number | string;
  bundleNo: string;
  bundleName: string;
  categoryId: number | string | null;
  categoryName: string | null;
  itemCount: number | string;
  coverImage: string | null;
  description?: string | null;
  originalPrice: number | string;
  bundlePrice: number | string;
  costPrice: number | string;
  status: number | string;
  sortOrder: number | string;
  salesCount: number | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** 套装明细行 */
interface ProductBundleItemRow {
  id: number | string;
  bundleId: number | string;
  skuId: number | string;
  skuName: string;
  barcode: string | null;
  qty: number | string;
  unitPrice: number | string;
  subtotalPrice: number | string;
  costPrice: number | string;
}

/** 套装状态行（SELECT id, status，用于删除/上下架校验） */
interface ProductBundleStatusRow {
  id: number | string;
  status: number | string;
}

/** 套装统计行（COUNT/SUM 聚合） */
interface ProductBundleStatsRow {
  totalBundles: number | string;
  publishedCount: number | string | null;
  unpublishedCount: number | string | null;
  totalSales: number | string | null;
  totalSalesAmount: number | string | null;
  totalDiscountAmount: number | string | null;
}

/** 套装销量TOP行 */
interface ProductBundleTopRow {
  id: number | string;
  bundleNo: string;
  bundleName: string;
  salesCount: number | string;
  bundlePrice: number | string;
}

/** SELECT id 结果行 */
interface IdRow {
  id: number | string;
}

/** COUNT(*) AS total 结果行 */
interface CountTotalRow {
  total: number;
}

// ========== 套装列表 ==========
export async function listProductBundles(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  keyword?: string;
  status?: number;
  categoryId?: number;
}) {
  const { page, pageSize, tenantId, keyword, status, categoryId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["b.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (keyword) {
    conditions.push("(b.bundle_name LIKE ? OR b.bundle_no LIKE ?)");
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (status !== undefined) {
    conditions.push("b.status = ?");
    queryParams.push(status);
  }
  if (categoryId !== undefined) {
    conditions.push("b.category_id = ?");
    queryParams.push(categoryId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<ProductBundleRow>(
    `SELECT b.id, b.bundle_no AS bundleNo, b.bundle_name AS bundleName,
            b.category_id AS categoryId, c.name AS categoryName,
            (SELECT COUNT(*) FROM t_product_bundle_item bi WHERE bi.bundle_id = b.id) AS itemCount,
            b.cover_image AS coverImage,
            b.original_price AS originalPrice, b.bundle_price AS bundlePrice,
            b.cost_price AS costPrice, b.status, b.sort_order AS sortOrder,
            b.sales_count AS salesCount, b.created_at AS createdAt,
            b.updated_at AS updatedAt
     FROM t_product_bundle b
     LEFT JOIN t_product_category c ON c.id = b.category_id
     ${where}
     ORDER BY b.sort_order ASC, b.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_product_bundle b ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 套装详情 ==========
export async function getProductBundleDetail(id: number, tenantId: string) {
  const bundle = await queryOneWithTenant<ProductBundleRow>(
    `SELECT id, bundle_no AS bundleNo, bundle_name AS bundleName,
            category_id AS categoryId, cover_image AS coverImage,
            description, original_price AS originalPrice,
            bundle_price AS bundlePrice, cost_price AS costPrice,
            status, sort_order AS sortOrder, sales_count AS salesCount,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_product_bundle WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!bundle) {
    throw Object.assign(new Error("套装不存在"), { statusCode: 404 });
  }
  const items = await queryWithTenant<ProductBundleItemRow>(
    `SELECT id, bundle_id AS bundleId, sku_id AS skuId, sku_name AS skuName,
            barcode, qty, unit_price AS unitPrice,
            subtotal_price AS subtotalPrice, cost_price AS costPrice
     FROM t_product_bundle_item WHERE bundle_id = ?`,
    [id],
    tenantId
  );
  return { ...bundle, items };
}

// ========== 创建套装 ==========
export async function createProductBundle(params: {
  bundleName: string;
  categoryId?: number;
  coverImage?: string;
  description?: string;
  bundlePrice: number;
  status?: number;
  sortOrder?: number;
  tenantId: string;
  items: Array<{
    skuId: number;
    skuName: string;
    barcode?: string;
    qty: number;
    unitPrice: number;
    costPrice: number;
  }>;
}) {
  const { bundleName, categoryId, coverImage, description, bundlePrice, status, sortOrder, tenantId, items } = params;

  if (!items || items.length === 0) {
    throw Object.assign(new Error("套装商品明细不能为空"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    const bundleNo = makeBizNo("TZ");
    let originalPrice = 0;
    let costPrice = 0;

    // 计算原价和成本价
    for (const item of items) {
      const subtotal = item.qty * item.unitPrice;
      originalPrice += subtotal;
      costPrice += item.qty * item.costPrice;
    }

    // 插入套装主表
    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO t_product_bundle (bundle_no, bundle_name, category_id, cover_image, description,
        original_price, bundle_price, cost_price, status, sort_order, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bundleNo, bundleName, categoryId ?? null, coverImage ?? null, description ?? null,
        originalPrice, bundlePrice, costPrice, status ?? 0, sortOrder ?? 0, tenantId]
    );
    const bundleId = insertResult.insertId as number;

    // 插入套装明细
    for (const item of items) {
      const subtotalPrice = item.qty * item.unitPrice;
      await conn.execute(
        `INSERT INTO t_product_bundle_item (bundle_id, sku_id, sku_name, barcode, qty,
          unit_price, subtotal_price, cost_price, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bundleId, item.skuId, item.skuName, item.barcode ?? null, item.qty,
          item.unitPrice, subtotalPrice, item.costPrice, tenantId]
      );
    }

    return { id: bundleId, bundleNo };
  });

  return result;
}

// ========== 更新套装 ==========
export async function updateProductBundle(
  id: number,
  params: {
    bundleName?: string;
    categoryId?: number;
    coverImage?: string;
    description?: string;
    bundlePrice?: number;
    status?: number;
    sortOrder?: number;
    tenantId: string;
    items?: Array<{
      skuId: number;
      skuName: string;
      barcode?: string;
      qty: number;
      unitPrice: number;
      costPrice: number;
    }>;
  }
) {
  const { bundleName, categoryId, coverImage, description, bundlePrice, status, sortOrder, tenantId, items } = params;

  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_product_bundle WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("套装不存在"), { statusCode: 404 });
  }

  const result = await transaction(async (conn) => {
    const updateFields: string[] = [];
    const updateParams: unknown[] = [];

    if (bundleName !== undefined) { updateFields.push("bundle_name = ?"); updateParams.push(bundleName); }
    if (categoryId !== undefined) { updateFields.push("category_id = ?"); updateParams.push(categoryId); }
    if (coverImage !== undefined) { updateFields.push("cover_image = ?"); updateParams.push(coverImage); }
    if (description !== undefined) { updateFields.push("description = ?"); updateParams.push(description); }
    if (bundlePrice !== undefined) { updateFields.push("bundle_price = ?"); updateParams.push(bundlePrice); }
    if (status !== undefined) { updateFields.push("status = ?"); updateParams.push(status); }
    if (sortOrder !== undefined) { updateFields.push("sort_order = ?"); updateParams.push(sortOrder); }

    let originalPrice: number | undefined;
    let costPrice: number | undefined;

    // 如果更新了明细，重新计算原价和成本价
    if (items && items.length > 0) {
      originalPrice = 0;
      costPrice = 0;
      for (const item of items) {
        originalPrice += item.qty * item.unitPrice;
        costPrice += item.qty * item.costPrice;
      }
      updateFields.push("original_price = ?");
      updateParams.push(originalPrice);
      updateFields.push("cost_price = ?");
      updateParams.push(costPrice);
    }

    if (updateFields.length > 0) {
      updateParams.push(id, tenantId);
      await conn.execute(
        { sql: `UPDATE t_product_bundle SET ${updateFields.join(", ")} WHERE id = ? AND tenant_id = ?`, values: updateParams } as { sql: string; values: unknown[] }
      );
    }

    // 更新明细：先删后插
    if (items && items.length > 0) {
      await conn.execute("DELETE FROM t_product_bundle_item WHERE bundle_id = ? AND tenant_id = ?", [id, tenantId]);
      for (const item of items) {
        const subtotalPrice = item.qty * item.unitPrice;
        await conn.execute(
          `INSERT INTO t_product_bundle_item (bundle_id, sku_id, sku_name, barcode, qty,
            unit_price, subtotal_price, cost_price, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, item.skuId, item.skuName, item.barcode ?? null, item.qty,
            item.unitPrice, subtotalPrice, item.costPrice, tenantId]
        );
      }
    }

    return { id };
  });

  return result;
}

// ========== 删除套装 ==========
export async function deleteProductBundle(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<ProductBundleStatusRow>(
    "SELECT id, status FROM t_product_bundle WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("套装不存在"), { statusCode: 404 });
  }
  if (existing.status === 1) {
    throw Object.assign(new Error("上架状态的套装不能删除，请先下架"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    await conn.execute("DELETE FROM t_product_bundle_item WHERE bundle_id = ? AND tenant_id = ?", [id, tenantId]);
    await conn.execute("DELETE FROM t_product_bundle WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  });

  return { success: true };
}

// ========== 上架套装 ==========
export async function publishProductBundle(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<ProductBundleStatusRow>(
    "SELECT id, status FROM t_product_bundle WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("套装不存在"), { statusCode: 404 });
  }
  if (existing.status === 1) {
    throw Object.assign(new Error("套装已上架"), { statusCode: 400 });
  }

  await queryWithTenant(
    "UPDATE t_product_bundle SET status = 1 WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );

  return { success: true };
}

// ========== 下架套装 ==========
export async function unpublishProductBundle(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<ProductBundleStatusRow>(
    "SELECT id, status FROM t_product_bundle WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("套装不存在"), { statusCode: 404 });
  }
  if (existing.status === 0) {
    throw Object.assign(new Error("套装已下架"), { statusCode: 400 });
  }

  await queryWithTenant(
    "UPDATE t_product_bundle SET status = 0 WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );

  return { success: true };
}

// ========== 套装销售统计 ==========
export async function getProductBundleStats(params: {
  tenantId: string;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { tenantId, dateStart, dateEnd } = params;
  const conditions: string[] = ["b.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (dateStart) {
    conditions.push("DATE(b.created_at) >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(b.created_at) <= ?");
    queryParams.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  // 总套装数、上架数、下架数
  const totalStats = await queryOneWithTenant<ProductBundleStatsRow>(
    `SELECT
       COUNT(*) AS totalBundles,
       SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS publishedCount,
       SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS unpublishedCount,
       SUM(sales_count) AS totalSales,
       SUM(sales_count * bundle_price) AS totalSalesAmount,
       SUM(sales_count * (original_price - bundle_price)) AS totalDiscountAmount
     FROM t_product_bundle b
     ${where}`,
    queryParams,
    tenantId
  );

  // 销量TOP10套装
  const topBundles = await queryWithTenant<ProductBundleTopRow>(
    `SELECT id, bundle_no AS bundleNo, bundle_name AS bundleName,
            sales_count AS salesCount, bundle_price AS bundlePrice
     FROM t_product_bundle b
     ${where}
     ORDER BY sales_count DESC
     LIMIT 10`,
    queryParams,
    tenantId
  );

  return {
    totalBundles: totalStats?.totalBundles ?? 0,
    publishedCount: totalStats?.publishedCount ?? 0,
    unpublishedCount: totalStats?.unpublishedCount ?? 0,
    totalSales: totalStats?.totalSales ?? 0,
    totalSalesAmount: totalStats?.totalSalesAmount ?? 0,
    totalDiscountAmount: totalStats?.totalDiscountAmount ?? 0,
    topBundles,
  };
}
