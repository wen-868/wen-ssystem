import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

/** SKU 阶梯价完整行（关联价格等级，列表/详情/更新返回） */
interface SkuPriceFullRow {
  id: number | string;
  skuId: number | string;
  priceLevelId: number | string;
  levelCode: string;
  levelName: string;
  discountRate: number | string;
  minQty: number | string;
  price: number | string;
  costPrice: number | string;
  suggestedRetailPrice: number | string;
  effectiveStart: string | Date | null;
  effectiveEnd: string | Date | null;
  status: number | string;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

/** SKU 阶梯价简单行（更新前校验，下划线字段名） */
interface SkuPriceSimpleRow {
  id: number | string;
  sku_id: number | string;
  price_level_id: number | string;
  min_qty: number | string;
  price: number | string;
  status: number | string;
}

/** 最优价匹配行（getBestPrice 用） */
interface BestPriceRow {
  id: number | string;
  minQty: number | string;
  price: number | string;
  costPrice: number | string;
  suggestedRetailPrice: number | string;
  levelCode: string;
  levelName: string;
  discountRate: number | string;
}

/** 客户价格绑定完整行（列表/创建返回，部分字段在创建返回中不出现设为可选） */
interface CustomerBindingRow {
  id: number | string;
  customerId: number | string;
  priceLevelId: number | string;
  levelCode: string;
  levelName: string;
  applyReason: string | null;
  status: string;
  approvedBy?: number | string | null;
  approvedAt?: string | Date | null;
  expireAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

/** 客户价格绑定状态行（SELECT id, status） */
interface CustomerBindingStatusRow {
  id: number | string;
  status: string;
}

/** 客户价格绑定审批行（SELECT id, customer_id, status，下划线字段名） */
interface CustomerBindingApproveRow {
  id: number | string;
  customer_id: number | string;
  status: string;
}

/** 客户价格绑定信息行（getBestPrice 中查询绑定，下划线字段名） */
interface CustomerPriceBindingRow {
  price_level_id: number | string;
  level_code: string;
  level_name: string;
  discount_rate: number | string;
}

/** 价格变更日志行 */
interface PriceChangeLogRow {
  id: number | string;
  skuId: number | string;
  priceLevelId: number | string;
  levelCode: string;
  levelName: string;
  oldPrice: number | string;
  newPrice: number | string;
  changeReason: string | null;
  changedBy: number | string | null;
  createdAt: string | Date;
}

/** SELECT id 结果行 */
interface IdRow {
  id: number | string;
}

/** COUNT(*) AS total 结果行 */
interface CountTotalRow {
  total: number;
}

export async function listSkuPrices(skuId: number, tenantId: string) {
  const records = await queryWithTenant<SkuPriceFullRow>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM t_sku_price sp
     JOIN t_price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
     WHERE sp.sku_id = ? AND sp.tenant_id = ?
     ORDER BY pl.sort_order ASC, sp.min_qty ASC`,
    [skuId, tenantId],
    tenantId
  );
  return { total: records.length, records };
}

export async function setSkuPrices(
  skuId: number,
  prices: Array<{
    priceLevelId: number;
    minQty: number;
    price: number;
    costPrice: number;
    suggestedRetailPrice: number;
    effectiveStart: string | null;
    effectiveEnd: string | null;
  }>,
  userId: number,
  tenantId: string
) {
  const levelIds = [...new Set(prices.map(p => p.priceLevelId))];
  const levels = await queryWithTenant<IdRow>(
    "SELECT id FROM t_price_level WHERE id IN (?) AND status = 1 AND tenant_id = ?",
    [levelIds, tenantId],
    tenantId
  );
  if (levels.length !== levelIds.length) {
    return { error: { code: "400", message: "部分价格等级不存在或已停用" } };
  }

  await transaction(async (conn) => {
    for (const item of prices) {
      const existing = await (conn as any).execute(
        "SELECT id, price FROM t_sku_price WHERE sku_id = ? AND price_level_id = ? AND min_qty = ? AND tenant_id = ?",
        [skuId, item.priceLevelId, item.minQty, tenantId]
      ) as [Record<string, unknown>[], unknown];

      if ((existing[0]).length > 0) {
        const oldRecord = (existing[0])[0];
        await (conn as any).execute(
          `UPDATE t_sku_price
           SET price = ?, cost_price = ?, suggested_retail_price = ?,
               effective_start = ?, effective_end = ?, status = 1, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [item.price, item.costPrice, item.suggestedRetailPrice,
          item.effectiveStart, item.effectiveEnd, oldRecord.id, tenantId]
        );
        if (Number(oldRecord.price) !== item.price) {
          await (conn as any).execute(
            `INSERT INTO t_price_change_log (sku_id, price_level_id, old_price, new_price, change_reason, changed_by, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [skuId, item.priceLevelId, oldRecord.price, item.price, "批量更新阶梯价", userId, tenantId]
          );
        }
      } else {
        await (conn as any).execute(
          `INSERT INTO t_sku_price (sku_id, price_level_id, min_qty, price, cost_price, suggested_retail_price, effective_start, effective_end, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [skuId, item.priceLevelId, item.minQty, item.price, item.costPrice, item.suggestedRetailPrice,
            item.effectiveStart, item.effectiveEnd, tenantId]
        );
      }
    }
  });

  const records = await queryWithTenant<SkuPriceFullRow>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM t_sku_price sp
     JOIN t_price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
     WHERE sp.sku_id = ? AND sp.tenant_id = ?
     ORDER BY pl.sort_order ASC, sp.min_qty ASC`,
    [skuId, tenantId],
    tenantId
  );

  return { data: { total: records.length, records } };
}

export async function updateSkuPrice(
  priceId: number,
  body: {
    minQty?: number;
    price?: number;
    costPrice?: number;
    suggestedRetailPrice?: number;
    effectiveStart?: string | null;
    effectiveEnd?: string | null;
    status?: number;
  },
  userId: number,
  tenantId: string
) {
  const existing = await queryOneWithTenant<SkuPriceSimpleRow>(
    `SELECT sp.id, sp.sku_id, sp.price_level_id, sp.min_qty, sp.price, sp.status
     FROM t_sku_price sp WHERE sp.id = ? AND sp.tenant_id = ?`,
    [priceId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "阶梯价格记录不存在" } };
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.minQty !== undefined) { updates.push("min_qty = ?"); params.push(body.minQty); }
  if (body.price !== undefined) { updates.push("price = ?"); params.push(body.price); }
  if (body.costPrice !== undefined) { updates.push("cost_price = ?"); params.push(body.costPrice); }
  if (body.suggestedRetailPrice !== undefined) { updates.push("suggested_retail_price = ?"); params.push(body.suggestedRetailPrice); }
  if (body.effectiveStart !== undefined) { updates.push("effective_start = ?"); params.push(body.effectiveStart); }
  if (body.effectiveEnd !== undefined) { updates.push("effective_end = ?"); params.push(body.effectiveEnd); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    if (body.price !== undefined && body.price !== Number(existing.price)) {
      await queryWithTenant(
        `INSERT INTO t_price_change_log (sku_id, price_level_id, old_price, new_price, change_reason, changed_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [existing.sku_id, existing.price_level_id, existing.price, body.price, "手动修改阶梯价", userId, tenantId],
        tenantId
      );
    }

    await queryWithTenant(
      `UPDATE t_sku_price SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [...params, priceId, tenantId],
      tenantId
    );
  }

  const record = await queryOneWithTenant<SkuPriceFullRow>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM t_sku_price sp
     JOIN t_price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
     WHERE sp.id = ? AND sp.tenant_id = ?`,
    [priceId, tenantId],
    tenantId
  );

  return { data: record };
}

export async function deleteSkuPrice(priceId: number, tenantId: string) {
  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_sku_price WHERE id = ? AND tenant_id = ?",
    [priceId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "阶梯价格记录不存在" } };
  }

  await queryWithTenant("DELETE FROM t_sku_price WHERE id = ? AND tenant_id = ?", [priceId, tenantId], tenantId);
  return { data: { priceId, deleted: true } };
}

export async function getBestPrice(
  customerId: number,
  skuId: number,
  quantity: number,
  isAdmin: boolean,
  tenantId: string
) {
  const today = new Date().toISOString().slice(0, 10);

  const binding = await queryOneWithTenant<CustomerPriceBindingRow>(
    `SELECT cpb.price_level_id, pl.level_code, pl.level_name, pl.discount_rate
     FROM t_customer_price_binding cpb
     JOIN t_price_level pl ON pl.id = cpb.price_level_id AND pl.tenant_id = cpb.tenant_id
     WHERE cpb.customer_id = ? AND cpb.status = 'APPROVED'
       AND (cpb.expire_at IS NULL OR cpb.expire_at > NOW())
       AND cpb.tenant_id = ?
     LIMIT 1`,
    [customerId, tenantId],
    tenantId
  );

  let priceLevelId: number | null = null;
  let levelCode = "RETAIL";
  let levelName = "零售价";
  let discountRate = 1.0;

  if (binding) {
    priceLevelId = Number(binding.price_level_id);
    levelCode = binding.level_code;
    levelName = binding.level_name;
    discountRate = Number(binding.discount_rate);
  }

  const retailLevel = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_price_level WHERE level_code = 'RETAIL' AND status = 1 AND tenant_id = ? LIMIT 1",
    [tenantId],
    tenantId
  );

  const matchParams: unknown[] = [];
  let matchSql = "";

  if (priceLevelId) {
    matchSql = `
      SELECT sp.id, sp.min_qty AS minQty, sp.price, sp.cost_price AS costPrice,
             sp.suggested_retail_price AS suggestedRetailPrice,
             pl.level_code AS levelCode, pl.level_name AS levelName,
             pl.discount_rate AS discountRate
      FROM t_sku_price sp
      JOIN t_price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
      WHERE sp.sku_id = ? AND sp.price_level_id = ? AND sp.min_qty <= ? AND sp.status = 1
        AND sp.tenant_id = ?
        AND (sp.effective_start IS NULL OR sp.effective_start <= ?)
        AND (sp.effective_end IS NULL OR sp.effective_end >= ?)
      ORDER BY sp.min_qty DESC
      LIMIT 1`;
    matchParams.push(skuId, priceLevelId, quantity, tenantId, today, today);
  } else if (retailLevel) {
    matchSql = `
      SELECT sp.id, sp.min_qty AS minQty, sp.price, sp.cost_price AS costPrice,
             sp.suggested_retail_price AS suggestedRetailPrice,
             pl.level_code AS levelCode, pl.level_name AS levelName,
             pl.discount_rate AS discountRate
      FROM t_sku_price sp
      JOIN t_price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
      WHERE sp.sku_id = ? AND sp.price_level_id = ? AND sp.min_qty <= ? AND sp.status = 1
        AND sp.tenant_id = ?
        AND (sp.effective_start IS NULL OR sp.effective_start <= ?)
        AND (sp.effective_end IS NULL OR sp.effective_end >= ?)
      ORDER BY sp.min_qty DESC
      LIMIT 1`;
    matchParams.push(skuId, retailLevel.id, quantity, tenantId, today, today);
  }

  let bestPrice: any = null;
  if (matchSql) {
    bestPrice = await queryOneWithTenant<BestPriceRow>(matchSql, matchParams, tenantId);
  }

  if (!bestPrice && priceLevelId && retailLevel && retailLevel.id !== priceLevelId) {
    bestPrice = await queryOneWithTenant<BestPriceRow>(
      `SELECT sp.id, sp.min_qty AS minQty, sp.price, sp.cost_price AS costPrice,
              sp.suggested_retail_price AS suggestedRetailPrice,
              pl.level_code AS levelCode, pl.level_name AS levelName,
              pl.discount_rate AS discountRate
       FROM t_sku_price sp
       JOIN t_price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
       WHERE sp.sku_id = ? AND sp.price_level_id = ? AND sp.min_qty <= ? AND sp.status = 1
         AND sp.tenant_id = ?
         AND (sp.effective_start IS NULL OR sp.effective_start <= ?)
         AND (sp.effective_end IS NULL OR sp.effective_end >= ?)
       ORDER BY sp.min_qty DESC
       LIMIT 1`,
      [skuId, retailLevel.id, quantity, tenantId, today, today],
      tenantId
    );
  }

  if (!bestPrice) {
    return { error: { code: "404", message: "未找到匹配的价格，请先设置SKU阶梯价" } };
  }

  if (!isAdmin) {
    delete bestPrice.costPrice;
  }

  return {
    data: {
      skuId,
      quantity,
      price: bestPrice.price,
      minQty: bestPrice.minQty,
      levelCode: bestPrice.levelCode,
      levelName: bestPrice.levelName,
      discountRate: Number(bestPrice.discountRate),
      suggestedRetailPrice: bestPrice.suggestedRetailPrice,
      costPrice: bestPrice.costPrice,
      totalPrice: Number(bestPrice.price) * quantity
    }
  };
}

export async function listCustomerBindings(
  page: number,
  pageSize: number,
  status: string | undefined,
  customerId: number | undefined,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["cpb.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (status) {
    conditions.push("cpb.status = ?");
    params.push(status);
  }
  if (customerId) {
    conditions.push("cpb.customer_id = ?");
    params.push(customerId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<CustomerBindingRow>(
    `SELECT cpb.id, cpb.customer_id AS customerId, cpb.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            cpb.apply_reason AS applyReason, cpb.status,
            cpb.approved_by AS approvedBy, cpb.approved_at AS approvedAt,
            cpb.expire_at AS expireAt,
            cpb.created_at AS createdAt, cpb.updated_at AS updatedAt
     FROM t_customer_price_binding cpb
     JOIN t_price_level pl ON pl.id = cpb.price_level_id AND pl.tenant_id = cpb.tenant_id
     ${where}
     ORDER BY cpb.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_customer_price_binding cpb ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function createCustomerBinding(
  body: {
    customerId: number;
    priceLevelId: number;
    applyReason: string;
    expireAt: string | null;
  },
  tenantId: string
) {
  const level = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_price_level WHERE id = ? AND status = 1 AND tenant_id = ?",
    [body.priceLevelId, tenantId],
    tenantId
  );
  if (!level) {
    return { error: { code: "400", message: "价格等级不存在或已停用" } };
  }

  const existing = await queryOneWithTenant<CustomerBindingStatusRow>(
    "SELECT id, status FROM t_customer_price_binding WHERE customer_id = ? AND tenant_id = ?",
    [body.customerId, tenantId],
    tenantId
  );
  if (existing && existing.status === "APPROVED") {
    return { error: { code: "400", message: "该客户已有生效的价格等级绑定，请先取消后再申请" } };
  }

  if (existing && (existing.status === "PENDING" || existing.status === "REJECTED")) {
    await queryWithTenant(
      `UPDATE t_customer_price_binding
       SET price_level_id = ?, apply_reason = ?, status = 'PENDING',
           approved_by = NULL, approved_at = NULL, expire_at = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [body.priceLevelId, body.applyReason, body.expireAt, existing.id, tenantId],
      tenantId
    );
  } else {
    await queryWithTenant(
      `INSERT INTO t_customer_price_binding (customer_id, price_level_id, apply_reason, expire_at, status, tenant_id)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [body.customerId, body.priceLevelId, body.applyReason, body.expireAt, tenantId],
      tenantId
    );
  }

  const record = await queryOneWithTenant<CustomerBindingRow>(
    `SELECT cpb.id, cpb.customer_id AS customerId, cpb.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            cpb.apply_reason AS applyReason, cpb.status,
            cpb.created_at AS createdAt
     FROM t_customer_price_binding cpb
     JOIN t_price_level pl ON pl.id = cpb.price_level_id AND pl.tenant_id = cpb.tenant_id
     WHERE cpb.customer_id = ? AND cpb.tenant_id = ?
     ORDER BY cpb.id DESC LIMIT 1`,
    [body.customerId, tenantId],
    tenantId
  );

  return { data: record };
}

export async function approveCustomerBinding(bindingId: number, userId: number, tenantId: string) {
  const existing = await queryOneWithTenant<CustomerBindingApproveRow>(
    "SELECT id, customer_id, status FROM t_customer_price_binding WHERE id = ? AND tenant_id = ?",
    [bindingId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "绑定记录不存在" } };
  }
  if (existing.status !== "PENDING") {
    return { error: { code: "400", message: "仅待审批的记录可以审批" } };
  }

  await queryWithTenant(
    `UPDATE t_customer_price_binding
     SET status = 'APPROVED', approved_by = ?, approved_at = NOW(), updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [userId, bindingId, tenantId],
    tenantId
  );

  return {
    data: {
      bindingId,
      status: "APPROVED",
      approvedBy: userId,
      approvedAt: new Date().toISOString()
    }
  };
}

export async function rejectCustomerBinding(bindingId: number, userId: number, tenantId: string) {
  const existing = await queryOneWithTenant<CustomerBindingStatusRow>(
    "SELECT id, status FROM t_customer_price_binding WHERE id = ? AND tenant_id = ?",
    [bindingId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "绑定记录不存在" } };
  }
  if (existing.status !== "PENDING") {
    return { error: { code: "400", message: "仅待审批的记录可以拒绝" } };
  }

  await queryWithTenant(
    `UPDATE t_customer_price_binding
     SET status = 'REJECTED', approved_by = ?, approved_at = NOW(), updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [userId, bindingId, tenantId],
    tenantId
  );

  return {
    data: {
      bindingId,
      status: "REJECTED",
      approvedBy: userId,
      approvedAt: new Date().toISOString()
    }
  };
}

export async function cancelCustomerBinding(bindingId: number, tenantId: string) {
  const existing = await queryOneWithTenant<CustomerBindingStatusRow>(
    "SELECT id, status FROM t_customer_price_binding WHERE id = ? AND tenant_id = ?",
    [bindingId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "绑定记录不存在" } };
  }

  await queryWithTenant(
    "UPDATE t_customer_price_binding SET status = 'EXPIRED', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [bindingId, tenantId],
    tenantId
  );

  return { data: { bindingId, status: "EXPIRED" } };
}

export async function listChangeLogs(
  page: number,
  pageSize: number,
  skuId: number | undefined,
  priceLevelId: number | undefined,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["pcl.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (skuId) {
    conditions.push("pcl.sku_id = ?");
    params.push(skuId);
  }
  if (priceLevelId) {
    conditions.push("pcl.price_level_id = ?");
    params.push(priceLevelId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<PriceChangeLogRow>(
    `SELECT pcl.id, pcl.sku_id AS skuId, pcl.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pcl.old_price AS oldPrice, pcl.new_price AS newPrice,
            pcl.change_reason AS changeReason, pcl.changed_by AS changedBy,
            pcl.created_at AS createdAt
     FROM t_price_change_log pcl
     JOIN t_price_level pl ON pl.id = pcl.price_level_id AND pl.tenant_id = pcl.tenant_id
     ${where}
     ORDER BY pcl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_price_change_log pcl ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}
