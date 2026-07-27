import { query, queryOne, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { RowDataPacket } from "mysql2";
import type { ResultSetHeader } from "mysql2/promise";

// ==================== 类型定义 ====================

/** 盘点单行（SELECT * FROM t_stock_check） */
interface StockCheckRow extends RowDataPacket {
  id: number | string;
  check_no: string;
  store_id: number | string;
  status: string;
  remark: string | null;
  total_sku: number | string | null;
  diff_sku: number | string | null;
  diff_amount: number | string | null;
  completed_at: string | Date | null;
  created_at: string | Date;
  tenant_id: string;
  store_name?: string;
}

/** 盘点单明细行（SELECT * FROM t_stock_check_item） */
interface StockCheckItemRow extends RowDataPacket {
  id: number | string;
  check_id: number | string;
  sku_id: number | string;
  sku_name: string;
  batch_no: string;
  system_qty: number | string;
  actual_qty: number | string;
  diff_qty: number | string;
  diff_amount: number | string;
  handled: number | boolean;
  tenant_id: string;
}

/** 盘点批次来源行（库存批次 JOIN 商品 SKU） */
interface StockCheckBatchRow extends RowDataPacket {
  sku_id: number | string;
  sku_name: string | null;
  batch_no: string | null;
  quantity: number | string;
}

/** 盘点单汇总行（COUNT/SUM 聚合） */
interface StockCheckSummaryRow extends RowDataPacket {
  total_sku: number | string | null;
  diff_sku: number | string | null;
  diff_amount: number | string | null;
}

/** 库存余额行（用于差异处理时锁行） */
interface InventoryBalanceRow extends RowDataPacket {
  id: number | string;
  available_qty: number | string;
}

/** SKU 成本价行 */
interface SkuCostPriceRow extends RowDataPacket {
  cost_price: number | string | null;
}

// ==================== Admin 端 ====================

export async function createCheck(params: {
  storeId: number; remark: string; tenantId: string;
}) {
  const { storeId, remark, tenantId } = params;
  const checkNo = makeBizNo("PD");

  const result = await transaction(async (conn) => {
    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO t_stock_check (check_no, store_id, status, remark, tenant_id)
       VALUES (?, ?, 'DRAFT', ?, ?)`,
      [checkNo, storeId, remark, tenantId]
    );
    return insertResult.insertId;
  });

  return { checkId: result, checkNo };
}

export async function listChecks(params: {
  page: number; pageSize: number; tenantId: string;
  storeId?: number; status?: string;
}) {
  const { page, pageSize, tenantId, storeId, status } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["sc.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (storeId !== undefined) {
    conditions.push("sc.store_id = ?");
    values.push(storeId);
  }
  if (status) {
    conditions.push("sc.status = ?");
    values.push(status);
  }

  const where = conditions.join(" AND ");

  const records = await query<Record<string, unknown>>(
    `SELECT sc.*, s.name AS store_name
     FROM t_stock_check sc
     LEFT JOIN t_store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE ${where}
     ORDER BY sc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const totalRow = await queryOne<Record<string, unknown>>(
    `SELECT COUNT(*) AS total FROM t_stock_check sc WHERE ${where}`,
    values
  );

  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function getStatistics(tenantId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const monthTotal = await queryOne<Record<string, unknown>>(
    "SELECT COUNT(*) AS total FROM t_stock_check WHERE created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffCount = await queryOne<Record<string, unknown>>(
    "SELECT COUNT(*) AS total FROM t_stock_check WHERE status = 'COMPLETED' AND diff_sku > 0 AND created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffAmount = await queryOne<Record<string, unknown>>(
    "SELECT COALESCE(SUM(diff_amount), 0) AS total FROM t_stock_check WHERE status = 'COMPLETED' AND created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  return {
    monthTotal: monthTotal?.total ?? 0,
    diffCount: diffCount?.total ?? 0,
    diffAmount: Number(diffAmount?.total ?? 0)
  };
}

export async function getCheckDetail(id: number, tenantId: string) {
  const check = await queryOne<Record<string, unknown>>(
    `SELECT sc.*, s.name AS store_name
     FROM t_stock_check sc
     LEFT JOIN t_store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.id = ? AND sc.tenant_id = ?`,
    [id, tenantId]
  );

  if (!check) throw Object.assign(new Error("盘点单不存在"), { statusCode: 404 });

  const items = await query<Record<string, unknown>>(
    "SELECT * FROM t_stock_check_item WHERE check_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  return { ...check, items };
}

export async function updateCheck(id: number, tenantId: string, body: { remark?: string }) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = rows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可编辑");

    if (body.remark !== undefined) {
      await conn.execute<ResultSetHeader>("UPDATE t_stock_check SET remark = ? WHERE id = ? AND tenant_id = ?", [body.remark, id, tenantId]);
    }
  });

  return { checkId: id };
}

export async function startCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = rows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可开始盘点");

    const [skuRows] = await conn.execute<StockCheckBatchRow[]>(
      `SELECT ib.sku_id, ps.sku_name, ib.batch_no, ib.quantity
       FROM t_inventory_batch ib
       LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
       WHERE ib.store_id = ? AND ib.quantity > 0 AND ib.tenant_id = ?
       ORDER BY ib.sku_id, ib.batch_no`,
      [check.store_id, tenantId]
    );

    await conn.execute<ResultSetHeader>("DELETE FROM t_stock_check_item WHERE check_id = ? AND tenant_id = ?", [id, tenantId]);

    let totalSku = 0;
    for (const row of skuRows) {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO t_stock_check_item (check_id, sku_id, sku_name, batch_no, system_qty, actual_qty, diff_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
        [id, row.sku_id, row.sku_name || "", row.batch_no || "", row.quantity, tenantId]
      );
      totalSku++;
    }

    await conn.execute<ResultSetHeader>(
      "UPDATE t_stock_check SET status = 'CHECKING', total_sku = ? WHERE id = ? AND tenant_id = ?",
      [totalSku, id, tenantId]
    );
  });

  return { checkId: id };
}

export async function completeCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = rows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可完成");

    const [summaryRows] = await conn.execute<StockCheckSummaryRow[]>(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM t_stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = summaryRows[0];

    await conn.execute<ResultSetHeader>(
      "UPDATE t_stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId]
    );
  });

  return { checkId: id };
}

export async function cancelCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = rows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT" && check.status !== "CHECKING") {
      throw new Error("仅草稿或盘点中状态可取消");
    }

    await conn.execute<ResultSetHeader>(
      "UPDATE t_stock_check SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  return { checkId: id };
}

export async function handleDiff(params: {
  checkId: number; itemId: number; tenantId: string; userId: number;
}) {
  const { checkId, itemId, tenantId, userId } = params;

  await transaction(async (conn) => {
    const [checkRows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [checkId, tenantId]
    );
    const check = checkRows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "COMPLETED") throw new Error("仅已完成状态可处理差异");

    const [itemRows] = await conn.execute<StockCheckItemRow[]>(
      "SELECT * FROM t_stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [itemId, checkId, tenantId]
    );
    const item = itemRows[0];
    if (!item) throw new Error("明细不存在");
    if (item.handled) throw new Error("该差异已处理");
    if (item.diff_qty === 0) throw new Error("无差异需要处理");

    const diffQty = Number(item.diff_qty);

    const [invRows] = await conn.execute<InventoryBalanceRow[]>(
      "SELECT * FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
      [check.store_id, item.sku_id, tenantId]
    );
    const inv = invRows[0];

    if (inv) {
      await conn.execute<ResultSetHeader>(
        "UPDATE t_inventory_balance SET available_qty = available_qty + ? WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
        [diffQty, check.store_id, item.sku_id, tenantId]
      );
    } else {
      if (diffQty > 0) {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO t_inventory_balance (store_id, sku_id, sku_name, available_qty, locked_qty, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [check.store_id, item.sku_id, item.sku_name, diffQty, tenantId]
        );
      }
    }

    const changeType = diffQty > 0 ? "STOCK_CHECK_IN" : "STOCK_CHECK_OUT";
    await conn.execute<ResultSetHeader>(
      `INSERT INTO t_inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, ref_no, operator_id, created_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [check.store_id, item.sku_id, item.sku_name, changeType, Math.abs(diffQty), check.check_no, userId ?? null, tenantId]
    );

    await conn.execute<ResultSetHeader>(
      "UPDATE t_stock_check_item SET handled = 1 WHERE id = ? AND tenant_id = ?",
      [itemId, tenantId]
    );
  });

  return { checkId };
}

// ==================== Store 端 ====================

export async function listMyChecks(storeId: number, tenantId: string) {
  const records = await query<Record<string, unknown>>(
    `SELECT sc.*, s.name AS store_name
     FROM t_stock_check sc
     LEFT JOIN t_store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.store_id = ? AND sc.tenant_id = ?
     ORDER BY sc.created_at DESC`,
    [storeId, tenantId]
  );

  return records;
}

export async function getMyCheckDetail(id: number, tenantId: string) {
  const check = await queryOne<Record<string, unknown>>(
    `SELECT sc.*, s.name AS store_name
     FROM t_stock_check sc
     LEFT JOIN t_store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.id = ? AND sc.tenant_id = ?`,
    [id, tenantId]
  );

  if (!check) throw Object.assign(new Error("盘点单不存在"), { statusCode: 404 });

  const items = await query<Record<string, unknown>>(
    "SELECT * FROM t_stock_check_item WHERE check_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  return { ...check, items };
}

export async function updateItemQty(params: {
  checkId: number; itemId: number; actualQty: number; tenantId: string;
}) {
  const { checkId, itemId, actualQty, tenantId } = params;

  await transaction(async (conn) => {
    const [rows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [checkId, tenantId]
    );
    const check = rows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可录入");

    const [itemRows] = await conn.execute<StockCheckItemRow[]>(
      "SELECT * FROM t_stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [itemId, checkId, tenantId]
    );
    const item = itemRows[0];
    if (!item) throw new Error("明细不存在");

    const [skuRows] = await conn.execute<SkuCostPriceRow[]>(
      "SELECT cost_price FROM t_product_sku WHERE id = ? AND tenant_id = ?",
      [item.sku_id, tenantId]
    );
    const unitPrice = skuRows[0]?.cost_price ?? 0;
    const diffQty = actualQty - Number(item.system_qty);
    const diffAmount = Math.abs(diffQty) * Number(unitPrice);

    await conn.execute<ResultSetHeader>(
      "UPDATE t_stock_check_item SET actual_qty = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [actualQty, diffAmount, itemId, tenantId]
    );
  });

  return { checkId, itemId };
}

// 批量录入盘点结果
export async function recordItems(params: {
  checkId: number; items: { itemId: number; actualQty: number }[]; tenantId: string;
}) {
  const { checkId, items, tenantId } = params;

  await transaction(async (conn) => {
    const [rows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [checkId, tenantId]
    );
    const check = rows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可录入");

    for (const item of items) {
      const [itemRows] = await conn.execute<StockCheckItemRow[]>(
        "SELECT * FROM t_stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
        [item.itemId, checkId, tenantId]
      );
      const checkItem = itemRows[0];
      if (!checkItem) throw new Error(`明细${item.itemId}不存在`);

      const [skuRows] = await conn.execute<SkuCostPriceRow[]>(
        "SELECT cost_price FROM t_product_sku WHERE id = ? AND tenant_id = ?",
        [checkItem.sku_id, tenantId]
      );
      const unitPrice = skuRows[0]?.cost_price ?? 0;
      const diffQty = item.actualQty - Number(checkItem.system_qty);
      const diffAmount = Math.abs(diffQty) * Number(unitPrice);

      await conn.execute<ResultSetHeader>(
        "UPDATE t_stock_check_item SET actual_qty = ?, diff_qty = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
        [item.actualQty, diffQty, diffAmount, item.itemId, tenantId]
      );
    }
  });

  return { checkId, recordedCount: items.length };
}

export async function submitCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<StockCheckRow[]>(
      "SELECT * FROM t_stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = rows[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可提交");

    const [summaryRows] = await conn.execute<StockCheckSummaryRow[]>(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM t_stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = summaryRows[0];

    await conn.execute<ResultSetHeader>(
      "UPDATE t_stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId]
    );
  });

  return { checkId: id };
}
