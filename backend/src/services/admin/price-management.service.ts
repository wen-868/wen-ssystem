import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";

export async function listSkuPrices(skuId: number, tenantId: string) {
  const records = await queryWithTenant<any>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM sku_price sp
     JOIN price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
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
  const levels = await queryWithTenant<any>(
    "SELECT id FROM price_level WHERE id IN (?) AND status = 1 AND tenant_id = ?",
    [levelIds, tenantId],
    tenantId
  );
  if (levels.length !== levelIds.length) {
    return { error: { code: "400", message: "部分价格等级不存在或已停用" } };
  }

  await transaction(async (conn) => {
    for (const item of prices) {
      const existing = await conn.execute(
        "SELECT id, price FROM sku_price WHERE sku_id = ? AND price_level_id = ? AND min_qty = ? AND tenant_id = ?",
        [skuId, item.priceLevelId, item.minQty, tenantId]
      ) as any;

      if ((existing[0] as any[]).length > 0) {
        const oldRecord = (existing[0] as any[])[0];
        await conn.execute(
          `UPDATE sku_price
           SET price = ?, cost_price = ?, suggested_retail_price = ?,
               effective_start = ?, effective_end = ?, status = 1, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [item.price, item.costPrice, item.suggestedRetailPrice,
           item.effectiveStart, item.effectiveEnd, oldRecord.id, tenantId]
        );
        if (Number(oldRecord.price) !== item.price) {
          await conn.execute(
            `INSERT INTO price_change_log (sku_id, price_level_id, old_price, new_price, change_reason, changed_by, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [skuId, item.priceLevelId, oldRecord.price, item.price, "批量更新阶梯价", userId, tenantId]
          );
        }
      } else {
        await conn.execute(
          `INSERT INTO sku_price (sku_id, price_level_id, min_qty, price, cost_price, suggested_retail_price, effective_start, effective_end, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [skuId, item.priceLevelId, item.minQty, item.price, item.costPrice, item.suggestedRetailPrice,
           item.effectiveStart, item.effectiveEnd, tenantId]
        );
      }
    }
  });

  const records = await queryWithTenant<any>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM sku_price sp
     JOIN price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
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
  const existing = await queryOneWithTenant<any>(
    `SELECT sp.id, sp.sku_id, sp.price_level_id, sp.min_qty, sp.price, sp.status
     FROM sku_price sp WHERE sp.id = ? AND sp.tenant_id = ?`,
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
        `INSERT INTO price_change_log (sku_id, price_level_id, old_price, new_price, change_reason, changed_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [existing.sku_id, existing.price_level_id, existing.price, body.price, "手动修改阶梯价", userId, tenantId],
        tenantId
      );
    }

    await queryWithTenant(
      `UPDATE sku_price SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [...params, priceId, tenantId],
      tenantId
    );
  }

  const record = await queryOneWithTenant<any>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM sku_price sp
     JOIN price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
     WHERE sp.id = ? AND sp.tenant_id = ?`,
    [priceId, tenantId],
    tenantId
  );

  return { data: record };
}

export async function deleteSkuPrice(priceId: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM sku_price WHERE id = ? AND tenant_id = ?",
    [priceId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "阶梯价格记录不存在" } };
  }

  await queryWithTenant("DELETE FROM sku_price WHERE id = ? AND tenant_id = ?", [priceId, tenantId], tenantId);
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

  const binding = await queryOneWithTenant<any>(
    `SELECT cpb.price_level_id, pl.level_code, pl.level_name, pl.discount_rate
     FROM customer_price_binding cpb
     JOIN price_level pl ON pl.id = cpb.price_level_id AND pl.tenant_id = cpb.tenant_id
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
    priceLevelId = binding.price_level_id;
    levelCode = binding.level_code;
    levelName = binding.level_name;
    discountRate = Number(binding.discount_rate);
  }

  const retailLevel = await queryOneWithTenant<any>(
    "SELECT id FROM price_level WHERE level_code = 'RETAIL' AND status = 1 AND tenant_id = ? LIMIT 1",
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
      FROM sku_price sp
      JOIN price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
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
      FROM sku_price sp
      JOIN price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
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
    bestPrice = await queryOneWithTenant<any>(matchSql, matchParams, tenantId);
  }

  if (!bestPrice && priceLevelId && retailLevel && retailLevel.id !== priceLevelId) {
    bestPrice = await queryOneWithTenant<any>(
      `SELECT sp.id, sp.min_qty AS minQty, sp.price, sp.cost_price AS costPrice,
              sp.suggested_retail_price AS suggestedRetailPrice,
              pl.level_code AS levelCode, pl.level_name AS levelName,
              pl.discount_rate AS discountRate
       FROM sku_price sp
       JOIN price_level pl ON pl.id = sp.price_level_id AND pl.tenant_id = sp.tenant_id
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

  const records = await queryWithTenant<any>(
    `SELECT cpb.id, cpb.customer_id AS customerId, cpb.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            cpb.apply_reason AS applyReason, cpb.status,
            cpb.approved_by AS approvedBy, cpb.approved_at AS approvedAt,
            cpb.expire_at AS expireAt,
            cpb.created_at AS createdAt, cpb.updated_at AS updatedAt
     FROM customer_price_binding cpb
     JOIN price_level pl ON pl.id = cpb.price_level_id AND pl.tenant_id = cpb.tenant_id
     ${where}
     ORDER BY cpb.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM customer_price_binding cpb ${where}`,
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
  const level = await queryOneWithTenant<any>(
    "SELECT id FROM price_level WHERE id = ? AND status = 1 AND tenant_id = ?",
    [body.priceLevelId, tenantId],
    tenantId
  );
  if (!level) {
    return { error: { code: "400", message: "价格等级不存在或已停用" } };
  }

  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM customer_price_binding WHERE customer_id = ? AND tenant_id = ?",
    [body.customerId, tenantId],
    tenantId
  );
  if (existing && existing.status === "APPROVED") {
    return { error: { code: "400", message: "该客户已有生效的价格等级绑定，请先取消后再申请" } };
  }

  if (existing && (existing.status === "PENDING" || existing.status === "REJECTED")) {
    await queryWithTenant(
      `UPDATE customer_price_binding
       SET price_level_id = ?, apply_reason = ?, status = 'PENDING',
           approved_by = NULL, approved_at = NULL, expire_at = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [body.priceLevelId, body.applyReason, body.expireAt, existing.id, tenantId],
      tenantId
    );
  } else {
    await queryWithTenant(
      `INSERT INTO customer_price_binding (customer_id, price_level_id, apply_reason, expire_at, status, tenant_id)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [body.customerId, body.priceLevelId, body.applyReason, body.expireAt, tenantId],
      tenantId
    );
  }

  const record = await queryOneWithTenant<any>(
    `SELECT cpb.id, cpb.customer_id AS customerId, cpb.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            cpb.apply_reason AS applyReason, cpb.status,
            cpb.created_at AS createdAt
     FROM customer_price_binding cpb
     JOIN price_level pl ON pl.id = cpb.price_level_id AND pl.tenant_id = cpb.tenant_id
     WHERE cpb.customer_id = ? AND cpb.tenant_id = ?
     ORDER BY cpb.id DESC LIMIT 1`,
    [body.customerId, tenantId],
    tenantId
  );

  return { data: record };
}

export async function approveCustomerBinding(bindingId: number, userId: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, customer_id, status FROM customer_price_binding WHERE id = ? AND tenant_id = ?",
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
    `UPDATE customer_price_binding
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
  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM customer_price_binding WHERE id = ? AND tenant_id = ?",
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
    `UPDATE customer_price_binding
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
  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM customer_price_binding WHERE id = ? AND tenant_id = ?",
    [bindingId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "绑定记录不存在" } };
  }

  await queryWithTenant(
    "UPDATE customer_price_binding SET status = 'EXPIRED', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
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

  const records = await queryWithTenant<any>(
    `SELECT pcl.id, pcl.sku_id AS skuId, pcl.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pcl.old_price AS oldPrice, pcl.new_price AS newPrice,
            pcl.change_reason AS changeReason, pcl.changed_by AS changedBy,
            pcl.created_at AS createdAt
     FROM price_change_log pcl
     JOIN price_level pl ON pl.id = pcl.price_level_id AND pl.tenant_id = pcl.tenant_id
     ${where}
     ORDER BY pcl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM price_change_log pcl ${where}`,
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
