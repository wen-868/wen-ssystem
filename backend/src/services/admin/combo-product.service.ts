import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { ResultSetHeader } from "mysql2/promise";

/** t_combo_product 列表行（queryWithTenant 用，驼峰别名） */
interface ComboProductRow {
  id: number | string;
  comboNo: string;
  comboName: string;
  comboType: string;
  categoryId: number | string | null;
  coverImage: string | null;
  basePrice: number | string;
  minPrice: number | string;
  maxPrice: number | string;
  status: number | string;
  sortOrder: number | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** t_combo_product 详情行（queryOneWithTenant 用，含 description） */
interface ComboProductDetailRow {
  id: number | string;
  comboNo: string;
  comboName: string;
  comboType: string;
  categoryId: number | string | null;
  coverImage: string | null;
  description: string | null;
  basePrice: number | string;
  minPrice: number | string;
  maxPrice: number | string;
  status: number | string;
  sortOrder: number | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** t_combo_product_option 选项行（queryWithTenant 用，驼峰别名） */
interface ComboProductOptionRow {
  id: number | string;
  comboId: number | string;
  groupName: string | null;
  skuId: number | string;
  skuName: string;
  barcode: string | null;
  extraPrice: number | string;
  isRequired: number | string;
  isDefault: number | string;
  sortOrder: number | string;
}

/** t_combo_product ID 校验行 */
interface ComboProductIdRow {
  id: number | string;
}

/** t_combo_product 状态校验行 */
interface ComboProductStatusRow {
  id: number | string;
  status: number | string;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

// ========== 组合品列表 ==========
export async function listComboProducts(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  keyword?: string;
  status?: number;
  comboType?: string;
}) {
  const { page, pageSize, tenantId, keyword, status, comboType } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["c.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (keyword) {
    conditions.push("(c.combo_name LIKE ? OR c.combo_no LIKE ?)");
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (status !== undefined) {
    conditions.push("c.status = ?");
    queryParams.push(status);
  }
  if (comboType) {
    conditions.push("c.combo_type = ?");
    queryParams.push(comboType);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<ComboProductRow>(
    `SELECT c.id, c.combo_no AS comboNo, c.combo_name AS comboName,
            c.combo_type AS comboType, c.category_id AS categoryId,
            c.cover_image AS coverImage, c.base_price AS basePrice,
            c.min_price AS minPrice, c.max_price AS maxPrice,
            c.status, c.sort_order AS sortOrder, c.created_at AS createdAt,
            c.updated_at AS updatedAt
     FROM t_combo_product c
     ${where}
     ORDER BY c.sort_order ASC, c.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_combo_product c ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 组合品详情 ==========
export async function getComboProductDetail(id: number, tenantId: string) {
  const combo = await queryOneWithTenant<ComboProductDetailRow>(
    `SELECT id, combo_no AS comboNo, combo_name AS comboName,
            combo_type AS comboType, category_id AS categoryId,
            cover_image AS coverImage, description,
            base_price AS basePrice, min_price AS minPrice,
            max_price AS maxPrice, status, sort_order AS sortOrder,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_combo_product WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!combo) {
    throw Object.assign(new Error("组合品不存在"), { statusCode: 404 });
  }
  const options = await queryWithTenant<ComboProductOptionRow>(
    `SELECT id, combo_id AS comboId, group_name AS groupName,
            sku_id AS skuId, sku_name AS skuName, barcode,
            extra_price AS extraPrice, is_required AS isRequired,
            is_default AS isDefault, sort_order AS sortOrder
     FROM t_combo_product_option WHERE combo_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [id],
    tenantId
  );

  // 按 groupName 分组
  const optionsByGroup: Record<string, any[]> = {};
  for (const opt of options) {
    const group = opt.groupName || "默认组";
    if (!optionsByGroup[group]) {
      optionsByGroup[group] = [];
    }
    optionsByGroup[group].push(opt);
  }

  return { ...combo, options, optionsByGroup };
}

// ========== 创建组合品 ==========
export async function createComboProduct(params: {
  comboName: string;
  comboType: string;
  categoryId?: number;
  coverImage?: string;
  description?: string;
  basePrice: number;
  status?: number;
  sortOrder?: number;
  tenantId: string;
  options: Array<{
    groupName: string;
    skuId: number;
    skuName: string;
    barcode?: string;
    extraPrice: number;
    isRequired?: number;
    isDefault?: number;
    sortOrder?: number;
  }>;
}) {
  const { comboName, comboType, categoryId, coverImage, description, basePrice, status, sortOrder, tenantId, options } = params;

  if (!options || options.length === 0) {
    throw Object.assign(new Error("组合品选项不能为空"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    const comboNo = makeBizNo("ZH");

    // 计算最低/最高价格
    let minExtra = Infinity;
    let maxExtra = -Infinity;
    for (const opt of options) {
      if (opt.extraPrice < minExtra) minExtra = opt.extraPrice;
      if (opt.extraPrice > maxExtra) maxExtra = opt.extraPrice;
    }
    const minPrice = basePrice + (minExtra === Infinity ? 0 : minExtra);
    const maxPrice = basePrice + (maxExtra === -Infinity ? 0 : maxExtra);

    // 插入组合品主表
    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO t_combo_product (combo_no, combo_name, combo_type, category_id, cover_image,
        description, base_price, min_price, max_price, status, sort_order, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [comboNo, comboName, comboType, categoryId ?? null, coverImage ?? null,
        description ?? null, basePrice, minPrice, maxPrice,
        status ?? 0, sortOrder ?? 0, tenantId]
    );
    const comboId = insertResult.insertId as number;

    // 插入组合品选项
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      await conn.execute(
        `INSERT INTO t_combo_product_option (combo_id, group_name, sku_id, sku_name, barcode,
          extra_price, is_required, is_default, sort_order, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [comboId, opt.groupName, opt.skuId, opt.skuName, opt.barcode ?? null,
          opt.extraPrice, opt.isRequired ?? 0, opt.isDefault ?? 0,
          opt.sortOrder ?? i, tenantId]
      );
    }

    return { id: comboId, comboNo };
  });

  return result;
}

// ========== 更新组合品 ==========
export async function updateComboProduct(
  id: number,
  params: {
    comboName?: string;
    comboType?: string;
    categoryId?: number;
    coverImage?: string;
    description?: string;
    basePrice?: number;
    status?: number;
    sortOrder?: number;
    tenantId: string;
    options?: Array<{
      groupName: string;
      skuId: number;
      skuName: string;
      barcode?: string;
      extraPrice: number;
      isRequired?: number;
      isDefault?: number;
      sortOrder?: number;
    }>;
  }
) {
  const { comboName, comboType, categoryId, coverImage, description, basePrice, status, sortOrder, tenantId, options } = params;

  const existing = await queryOneWithTenant<ComboProductIdRow>(
    "SELECT id FROM t_combo_product WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("组合品不存在"), { statusCode: 404 });
  }

  const result = await transaction(async (conn) => {
    const updateFields: string[] = [];
    const updateParams: unknown[] = [];

    if (comboName !== undefined) { updateFields.push("combo_name = ?"); updateParams.push(comboName); }
    if (comboType !== undefined) { updateFields.push("combo_type = ?"); updateParams.push(comboType); }
    if (categoryId !== undefined) { updateFields.push("category_id = ?"); updateParams.push(categoryId); }
    if (coverImage !== undefined) { updateFields.push("cover_image = ?"); updateParams.push(coverImage); }
    if (description !== undefined) { updateFields.push("description = ?"); updateParams.push(description); }
    if (basePrice !== undefined) { updateFields.push("base_price = ?"); updateParams.push(basePrice); }
    if (status !== undefined) { updateFields.push("status = ?"); updateParams.push(status); }
    if (sortOrder !== undefined) { updateFields.push("sort_order = ?"); updateParams.push(sortOrder); }

    // 如果更新了选项或基础价，重新计算 min/max price
    if (options && options.length > 0) {
      let minExtra = Infinity;
      let maxExtra = -Infinity;
      for (const opt of options) {
        if (opt.extraPrice < minExtra) minExtra = opt.extraPrice;
        if (opt.extraPrice > maxExtra) maxExtra = opt.extraPrice;
      }
      const effectiveBasePrice = basePrice ?? 0;
      const minPrice = effectiveBasePrice + (minExtra === Infinity ? 0 : minExtra);
      const maxPrice = effectiveBasePrice + (maxExtra === -Infinity ? 0 : maxExtra);

      if (!updateFields.some(f => f.startsWith("min_price"))) {
        updateFields.push("min_price = ?");
        updateParams.push(minPrice);
      }
      if (!updateFields.some(f => f.startsWith("max_price"))) {
        updateFields.push("max_price = ?");
        updateParams.push(maxPrice);
      }
    }

    if (updateFields.length > 0) {
      updateParams.push(id, tenantId);
      await conn.execute(
        { sql: `UPDATE t_combo_product SET ${updateFields.join(", ")} WHERE id = ? AND tenant_id = ?`, values: updateParams } as { sql: string; values: unknown[] }
      );
    }

    // 更新选项：先删后插
    if (options && options.length > 0) {
      await conn.execute("DELETE FROM t_combo_product_option WHERE combo_id = ? AND tenant_id = ?", [id, tenantId]);
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        await conn.execute(
          `INSERT INTO t_combo_product_option (combo_id, group_name, sku_id, sku_name, barcode,
            extra_price, is_required, is_default, sort_order, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, opt.groupName, opt.skuId, opt.skuName, opt.barcode ?? null,
            opt.extraPrice, opt.isRequired ?? 0, opt.isDefault ?? 0,
            opt.sortOrder ?? i, tenantId]
        );
      }
    }

    return { id };
  });

  return result;
}

// ========== 删除组合品 ==========
export async function deleteComboProduct(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<ComboProductStatusRow>(
    "SELECT id, status FROM t_combo_product WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("组合品不存在"), { statusCode: 404 });
  }
  if (existing.status === 1) {
    throw Object.assign(new Error("启用状态的组合品不能删除，请先停用"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    await conn.execute("DELETE FROM t_combo_product_option WHERE combo_id = ? AND tenant_id = ?", [id, tenantId]);
    await conn.execute("DELETE FROM t_combo_product WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  });

  return { success: true };
}
