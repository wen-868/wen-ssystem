import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

export async function createFlashSale(body: {
  name: string;
  productId: number;
  skuId: number;
  flashPrice: number;
  originalPrice: number;
  totalStock: number;
  limitPerUser: number;
  startTime: string;
  endTime: string;
}, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO t_flash_sale (name, product_id, sku_id, flash_price, original_price,
        total_stock, limit_per_user, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.name, body.productId, body.skuId, body.flashPrice, body.originalPrice,
      body.totalStock, body.limitPerUser, body.startTime, body.endTime
    ],
    tenantId
  );

  const record = await queryOneWithTenant<any>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            flash_price AS flashPrice, original_price AS originalPrice,
            total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
            start_time AS startTime, end_time AS endTime, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_flash_sale ORDER BY id DESC LIMIT 1`,
    [],
    tenantId
  );

  return record;
}

export async function listFlashSales(
  page: number,
  pageSize: number,
  tenantId: string,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            flash_price AS flashPrice, original_price AS originalPrice,
            total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
            start_time AS startTime, end_time AS endTime, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_flash_sale
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_flash_sale ${where}`,
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

export async function getFlashSale(id: number, tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            flash_price AS flashPrice, original_price AS originalPrice,
            total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
            start_time AS startTime, end_time AS endTime, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_flash_sale WHERE id = ?`,
    [id],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }
  return record;
}

export async function updateFlashSale(id: number, body: {
  name?: string;
  productId?: number;
  skuId?: number;
  flashPrice?: number;
  originalPrice?: number;
  totalStock?: number;
  limitPerUser?: number;
  startTime?: string;
  endTime?: string;
}, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM t_flash_sale WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.productId !== undefined) { updates.push("product_id = ?"); params.push(body.productId); }
  if (body.skuId !== undefined) { updates.push("sku_id = ?"); params.push(body.skuId); }
  if (body.flashPrice !== undefined) { updates.push("flash_price = ?"); params.push(body.flashPrice); }
  if (body.originalPrice !== undefined) { updates.push("original_price = ?"); params.push(body.originalPrice); }
  if (body.totalStock !== undefined) { updates.push("total_stock = ?"); params.push(body.totalStock); }
  if (body.limitPerUser !== undefined) { updates.push("limit_per_user = ?"); params.push(body.limitPerUser); }
  if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
  if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }

  if (updates.length > 0) {
    params.push(id);
    await queryWithTenant(`UPDATE t_flash_sale SET ${updates.join(", ")} WHERE id = ?`, params, tenantId);
  }

  const record = await queryOneWithTenant<any>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            flash_price AS flashPrice, original_price AS originalPrice,
            total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
            start_time AS startTime, end_time AS endTime, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_flash_sale WHERE id = ?`,
    [id],
    tenantId
  );

  return record;
}

export async function deleteFlashSale(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM t_flash_sale WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT") {
    throw Object.assign(new Error("仅草稿状态的秒杀活动可删除"), { statusCode: 400 });
  }

  await queryWithTenant("DELETE FROM t_flash_sale WHERE id = ?", [id], tenantId);
  return { id, deleted: true };
}

export async function activateFlashSale(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM t_flash_sale WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }
  if (!["DRAFT", "PAUSED"].includes(existing.status)) {
    throw Object.assign(new Error("仅草稿或暂停状态的活动可激活"), { statusCode: 400 });
  }

  await queryWithTenant("UPDATE t_flash_sale SET status = 'ACTIVE' WHERE id = ?", [id], tenantId);
  return { id, status: "ACTIVE" };
}

export async function pauseFlashSale(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM t_flash_sale WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "ACTIVE") {
    throw Object.assign(new Error("仅激活状态的活动可暂停"), { statusCode: 400 });
  }

  await queryWithTenant("UPDATE t_flash_sale SET status = 'PAUSED' WHERE id = ?", [id], tenantId);
  return { id, status: "PAUSED" };
}

export async function getFlashSaleStatistics(tenantId: string) {
  const stats = await queryWithTenant<any>(
    `SELECT fs.id, fs.name, fs.flash_price AS flashPrice, fs.original_price AS originalPrice,
            fs.total_stock AS totalStock, fs.sold_count AS soldCount, fs.status,
            COUNT(fsr.id) AS orderCount, SUM(fsr.quantity) AS totalQuantity,
            SUM(fsr.price * fsr.quantity) AS totalAmount
     FROM t_flash_sale fs
     LEFT JOIN flash_sale_record fsr ON fsr.flash_sale_id = fs.id
     GROUP BY fs.id
     ORDER BY fs.created_at DESC`,
    [],
    tenantId
  );

  const overall = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS totalActivities, SUM(total_stock) AS totalStock,
            SUM(sold_count) AS totalSold
     FROM t_flash_sale`,
    [],
    tenantId
  );

  return {
    overall: {
      totalActivities: Number(overall?.totalActivities ?? 0),
      totalStock: Number(overall?.totalStock ?? 0),
      totalSold: Number(overall?.totalSold ?? 0),
      sellThroughRate: Number(overall?.totalStock) > 0
        ? (Number(overall?.totalSold) / Number(overall?.totalStock) * 100).toFixed(2) + "%"
        : "0%"
    },
    details: stats.map((r: any) => ({
      id: r.id,
      name: r.name,
      flashPrice: Number(r.flashPrice),
      originalPrice: Number(r.originalPrice),
      totalStock: Number(r.totalStock),
      soldCount: Number(r.soldCount),
      orderCount: Number(r.orderCount),
      totalQuantity: Number(r.totalQuantity),
      totalAmount: Number(r.totalAmount),
      sellThroughRate: Number(r.totalStock) > 0
        ? (Number(r.soldCount) / Number(r.totalStock) * 100).toFixed(2) + "%"
        : "0%",
      status: r.status
    }))
  };
}

export async function listActiveFlashSales(tenantId: string) {
  const now = new Date().toISOString();
  const records = await queryWithTenant<any>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            flash_price AS flashPrice, original_price AS originalPrice,
            total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
            start_time AS startTime, end_time AS endTime
     FROM t_flash_sale
     WHERE status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
     ORDER BY start_time ASC`,
    [now, now],
    tenantId
  );

  return { total: records.length, records };
}

export async function buyFlashSale(
  flashSaleId: number,
  userId: number,
  quantity: number,
  tenantId: string
) {
  const now = new Date().toISOString();

  await transaction(async (conn) => {
    const [flashRows] = await (conn as any).execute(
      `SELECT id, flash_price, total_stock, sold_count, limit_per_user, status,
              start_time, end_time
       FROM t_flash_sale
       WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       FOR UPDATE`,
      [flashSaleId, tenantId, now, now]
    ) as unknown as Record<string, unknown>[];

    const flash = (flashRows as unknown as Record<string, unknown>[])[0];
    if (!flash) {
      throw Object.assign(new Error("秒杀活动不存在或已结束"), { statusCode: 404 });
    }

    const remaining = Number(flash.total_stock) - Number(flash.sold_count);
    if (remaining < quantity) {
      throw Object.assign(new Error("秒杀库存不足"), { statusCode: 400 });
    }

    const [purchaseRows] = await (conn as any).execute(
      `SELECT COALESCE(SUM(quantity), 0) AS totalQty
       FROM t_flash_sale_record fsr
       JOIN flash_sale fs ON fs.id = fsr.flash_sale_id AND fs.tenant_id = ?
       WHERE fsr.flash_sale_id = ? AND fsr.user_id = ?`,
      [tenantId, flashSaleId, userId]
    ) as unknown as Record<string, unknown>[];

    const purchased = Number((purchaseRows as unknown as Record<string, unknown>[])[0]?.totalQty || 0);
    if (purchased + quantity > Number(flash.limit_per_user)) {
      throw Object.assign(
        new Error(`每人限购${flash.limit_per_user}件，您已购买${purchased}件`),
        { statusCode: 400 }
      );
    }

    await (conn as any).execute(
      `UPDATE t_flash_sale SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
      [quantity, flashSaleId, tenantId]
    );

    await (conn as any).execute(
      `INSERT INTO t_flash_sale_record (flash_sale_id, user_id, quantity, price, tenant_id)
       VALUES (?, ?, ?, ?, ?)`,
      [flashSaleId, userId, quantity, flash.flash_price, tenantId]
    );
  });

  return {
    flashSaleId,
    userId,
    quantity,
    message: "秒杀下单成功"
  };
}
