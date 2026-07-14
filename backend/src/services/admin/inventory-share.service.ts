import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

// ========== 库存共享设置 ==========
export interface InventoryShareSetting {
  id?: number;
  shareEnabled: boolean;
  autoTransfer: boolean;
  autoTransferThreshold: number;
  shareScope: string;
  specifiedStoreIds?: number[] | null;
  tenantId: string;
}

// 获取库存共享设置
export async function getShareSetting(tenantId: string) {
  const setting = await queryOneWithTenant<any>(
    "SELECT * FROM inventory_share_setting WHERE tenant_id = ?",
    [tenantId],
    tenantId
  );

  if (!setting) {
    // 返回默认设置
    return {
      id: 0,
      shareEnabled: false,
      autoTransfer: false,
      autoTransferThreshold: 0,
      shareScope: "ALL",
      specifiedStoreIds: [],
    };
  }

  return {
    id: setting.id,
    shareEnabled: setting.share_enabled === 1,
    autoTransfer: setting.auto_transfer === 1,
    autoTransferThreshold: setting.auto_transfer_threshold ?? 0,
    shareScope: setting.share_scope,
    specifiedStoreIds: setting.specified_store_ids
      ? JSON.parse(setting.specified_store_ids)
      : [],
  };
}

// 更新库存共享设置
export async function updateShareSetting(
  tenantId: string,
  params: {
    shareEnabled?: boolean;
    autoTransfer?: boolean;
    autoTransferThreshold?: number;
    shareScope?: string;
    specifiedStoreIds?: number[];
  }
) {
  const { shareEnabled, autoTransfer, autoTransferThreshold, shareScope, specifiedStoreIds } = params;

  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM inventory_share_setting WHERE tenant_id = ?",
    [tenantId],
    tenantId
  );

  if (!existing) {
    // 插入新记录
    const [result] = await queryWithTenant<any>(
      `INSERT INTO inventory_share_setting (
        share_enabled, auto_transfer, auto_transfer_threshold,
        share_scope, specified_store_ids, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        shareEnabled ? 1 : 0,
        autoTransfer ? 1 : 0,
        autoTransferThreshold ?? 0,
        shareScope ?? "ALL",
        specifiedStoreIds ? JSON.stringify(specifiedStoreIds) : null,
        tenantId,
      ],
      tenantId
    );
    return { id: result.insertId };
  }

  // 更新现有记录
  const sets: string[] = [];
  const values: unknown[] = [];

  if (shareEnabled !== undefined) {
    sets.push("share_enabled = ?");
    values.push(shareEnabled ? 1 : 0);
  }
  if (autoTransfer !== undefined) {
    sets.push("auto_transfer = ?");
    values.push(autoTransfer ? 1 : 0);
  }
  if (autoTransferThreshold !== undefined) {
    sets.push("auto_transfer_threshold = ?");
    values.push(autoTransferThreshold);
  }
  if (shareScope !== undefined) {
    sets.push("share_scope = ?");
    values.push(shareScope);
  }
  if (specifiedStoreIds !== undefined) {
    sets.push("specified_store_ids = ?");
    values.push(specifiedStoreIds.length > 0 ? JSON.stringify(specifiedStoreIds) : null);
  }

  if (sets.length > 0) {
    values.push(existing.id, tenantId);
    await queryWithTenant(
      `UPDATE inventory_share_setting SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
      values,
      tenantId
    );
  }

  return { id: existing.id };
}

// ========== 共享商品列表 ==========
export async function listShareProducts(params: {
  tenantId: string;
  page: number;
  pageSize: number;
  status?: number;
  categoryId?: number;
  keyword?: string;
}) {
  const { tenantId, page, pageSize, status, categoryId, keyword } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["isp.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (status !== undefined) {
    conditions.push("isp.status = ?");
    queryParams.push(status);
  }
  if (categoryId !== undefined) {
    conditions.push("p.category_id = ?");
    queryParams.push(categoryId);
  }
  if (keyword) {
    conditions.push("(isp.spu_name LIKE ? OR isp.sku_name LIKE ? OR isp.barcode LIKE ?)");
    queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<any>(
    `SELECT isp.id, isp.spu_id AS spuId, isp.spu_name AS spuName,
            isp.sku_id AS skuId, isp.sku_name AS skuName, isp.barcode,
            isp.share_qty AS shareQty, isp.min_keep_qty AS minKeepQty, isp.status,
            isp.created_at AS createdAt, isp.updated_at AS updatedAt
     FROM inventory_share_product isp
     LEFT JOIN t_product_spu p ON p.id = isp.spu_id
     ${where}
     ORDER BY isp.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM inventory_share_product isp
     LEFT JOIN t_product_spu p ON p.id = isp.spu_id
     ${where}`,
    queryParams,
    tenantId
  );

  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 添加共享商品 ==========
export async function addShareProduct(
  tenantId: string,
  params: {
    spuId: number;
    spuName: string;
    skuId?: number;
    skuName?: string;
    barcode?: string;
    shareQty?: number;
    minKeepQty?: number;
  }
) {
  const { spuId, spuName, skuId, skuName, barcode, shareQty, minKeepQty } = params;

  // 检查是否已存在
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM inventory_share_product WHERE tenant_id = ? AND spu_id = ? AND sku_id <=> ?",
    [tenantId, spuId, skuId ?? null],
    tenantId
  );
  if (existing) {
    throw Object.assign(new Error("该商品已在共享列表中"), { statusCode: 400 });
  }

  const [result] = await queryWithTenant<any>(
    `INSERT INTO inventory_share_product (
      spu_id, spu_name, sku_id, sku_name, barcode,
      share_qty, min_keep_qty, status, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      spuId,
      spuName,
      skuId ?? null,
      skuName ?? null,
      barcode ?? null,
      shareQty ?? 0,
      minKeepQty ?? 0,
      tenantId,
    ],
    tenantId
  );

  return { id: result.insertId };
}

// ========== 批量添加共享商品 ==========
export async function batchAddShareProducts(
  tenantId: string,
  products: Array<{
    spuId: number;
    spuName: string;
    skuId?: number;
    skuName?: string;
    barcode?: string;
    shareQty?: number;
    minKeepQty?: number;
  }>
) {
  if (!products || products.length === 0) {
    throw Object.assign(new Error("商品列表不能为空"), { statusCode: 400 });
  }

  let addedCount = 0;

  await transaction(async (conn) => {
    for (const product of products) {
      // 检查是否已存在
      const [rows] = await conn.execute<any>(
        "SELECT id FROM inventory_share_product WHERE tenant_id = ? AND spu_id = ? AND sku_id <=> ?",
        [tenantId, product.spuId, product.skuId ?? null]
      );
      if (rows.length > 0) continue;

      await conn.execute(
        `INSERT INTO inventory_share_product (
          spu_id, spu_name, sku_id, sku_name, barcode,
          share_qty, min_keep_qty, status, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          product.spuId,
          product.spuName,
          product.skuId ?? null,
          product.skuName ?? null,
          product.barcode ?? null,
          product.shareQty ?? 0,
          product.minKeepQty ?? 0,
          tenantId,
        ]
      );
      addedCount++;
    }
  });

  return { addedCount, totalCount: products.length };
}

// ========== 更新共享商品 ==========
export async function updateShareProduct(
  id: number,
  tenantId: string,
  params: {
    shareQty?: number;
    minKeepQty?: number;
    status?: number;
  }
) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM inventory_share_product WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("共享商品不存在"), { statusCode: 404 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (params.shareQty !== undefined) {
    sets.push("share_qty = ?");
    values.push(params.shareQty);
  }
  if (params.minKeepQty !== undefined) {
    sets.push("min_keep_qty = ?");
    values.push(params.minKeepQty);
  }
  if (params.status !== undefined) {
    sets.push("status = ?");
    values.push(params.status);
  }

  if (sets.length > 0) {
    values.push(id, tenantId);
    await queryWithTenant(
      `UPDATE inventory_share_product SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
      values,
      tenantId
    );
  }

  return { id };
}

// ========== 移除共享商品 ==========
export async function removeShareProduct(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM inventory_share_product WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("共享商品不存在"), { statusCode: 404 });
  }

  await queryWithTenant(
    "DELETE FROM inventory_share_product WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );

  return { success: true };
}

// ========== 批量移除共享商品 ==========
export async function batchRemoveShareProducts(ids: number[], tenantId: string) {
  if (!ids || ids.length === 0) {
    throw Object.assign(new Error("ID列表不能为空"), { statusCode: 400 });
  }

  const placeholders = ids.map(() => "?").join(", ");
  const result = await queryWithTenant<any>(
    `DELETE FROM inventory_share_product WHERE id IN (${placeholders}) AND tenant_id = ?`,
    [...ids, tenantId],
    tenantId
  );

  const affectedRows = (result as unknown as { affectedRows?: number }).affectedRows;
  return { deletedCount: affectedRows ?? ids.length };
}
