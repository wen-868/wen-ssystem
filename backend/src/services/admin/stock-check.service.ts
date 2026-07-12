import { query, queryOne, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// ==================== Admin 端 ====================

export async function createCheck(params: {
  storeId: number; remark: string; tenantId: string;
}) {
  const { storeId, remark, tenantId } = params;
  const checkNo = makeBizNo("PD");

  const result = await transaction(async (conn) => {
    const [insertResult] = await (conn as any).execute(
      `INSERT INTO stock_check (check_no, store_id, status, remark, tenant_id)
       VALUES (?, ?, 'DRAFT', ?, ?)`,
      [checkNo, storeId, remark, tenantId]
    );
    return (insertResult as unknown as Record<string, unknown>).insertId;
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
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE ${where}
     ORDER BY sc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const totalRow = await queryOne<Record<string, unknown>>(
    `SELECT COUNT(*) AS total FROM stock_check sc WHERE ${where}`,
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
    "SELECT COUNT(*) AS total FROM stock_check WHERE created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffCount = await queryOne<Record<string, unknown>>(
    "SELECT COUNT(*) AS total FROM stock_check WHERE status = 'COMPLETED' AND diff_sku > 0 AND created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffAmount = await queryOne<Record<string, unknown>>(
    "SELECT COALESCE(SUM(diff_amount), 0) AS total FROM stock_check WHERE status = 'COMPLETED' AND created_at >= ? AND tenant_id = ?",
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
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.id = ? AND sc.tenant_id = ?`,
    [id, tenantId]
  );

  if (!check) throw Object.assign(new Error("盘点单不存在"), { statusCode: 404 });

  const items = await query<Record<string, unknown>>(
    "SELECT * FROM stock_check_item WHERE check_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  return { ...check, items };
}

export async function updateCheck(id: number, tenantId: string, body: { remark?: string }) {
  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as unknown as Record<string, unknown>[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可编辑");

    if (body.remark !== undefined) {
      await (conn as any).execute("UPDATE stock_check SET remark = ? WHERE id = ? AND tenant_id = ?", [body.remark, id, tenantId]);
    }
  });

  return { checkId: id };
}

export async function startCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as unknown as Record<string, unknown>[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可开始盘点");

    const [skuRows] = await (conn as any).execute(
      `SELECT ib.sku_id, ps.sku_name, ib.batch_no, ib.quantity
       FROM t_inventory_batch ib
       LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
       WHERE ib.store_id = ? AND ib.quantity > 0 AND ib.tenant_id = ?
       ORDER BY ib.sku_id, ib.batch_no`,
      [check.store_id, tenantId]
    );

    await (conn as any).execute("DELETE FROM stock_check_item WHERE check_id = ? AND tenant_id = ?", [id, tenantId]);

    let totalSku = 0;
    for (const row of skuRows as unknown as Record<string, unknown>[]) {
      await (conn as any).execute(
        `INSERT INTO stock_check_item (check_id, sku_id, sku_name, batch_no, system_qty, actual_qty, diff_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
        [id, row.sku_id, row.sku_name || "", row.batch_no || "", row.quantity, tenantId]
      );
      totalSku++;
    }

    await (conn as any).execute(
      "UPDATE stock_check SET status = 'CHECKING', total_sku = ? WHERE id = ? AND tenant_id = ?",
      [totalSku, id, tenantId]
    );
  });

  return { checkId: id };
}

export async function completeCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as unknown as Record<string, unknown>[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可完成");

    const [summaryRows] = await (conn as any).execute(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = (summaryRows as unknown as Record<string, unknown>[])[0];

    await (conn as any).execute(
      "UPDATE stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId]
    );
  });

  return { checkId: id };
}

export async function cancelCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as unknown as Record<string, unknown>[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT" && check.status !== "CHECKING") {
      throw new Error("仅草稿或盘点中状态可取消");
    }

    await (conn as any).execute(
      "UPDATE stock_check SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?",
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
    const [checkRows] = await (conn as any).execute(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [checkId, tenantId]
    );
    const check = (checkRows as unknown as Record<string, unknown>[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "COMPLETED") throw new Error("仅已完成状态可处理差异");

    const [itemRows] = await (conn as any).execute(
      "SELECT * FROM stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [itemId, checkId, tenantId]
    );
    const item = (itemRows as unknown as Record<string, unknown>[])[0];
    if (!item) throw new Error("明细不存在");
    if (item.handled) throw new Error("该差异已处理");
    if (item.diff_qty === 0) throw new Error("无差异需要处理");

    const diffQty = Number(item.diff_qty);

    const [invRows] = await (conn as any).execute(
      "SELECT * FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
      [check.store_id, item.sku_id, tenantId]
    );
    const inv = (invRows as unknown as Record<string, unknown>[])[0];

    if (inv) {
      await (conn as any).execute(
        "UPDATE t_inventory_balance SET available_qty = available_qty + ? WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
        [diffQty, check.store_id, item.sku_id, tenantId]
      );
    } else {
      if (diffQty > 0) {
        await (conn as any).execute(
          `INSERT INTO t_inventory_balance (store_id, sku_id, sku_name, available_qty, locked_qty, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [check.store_id, item.sku_id, item.sku_name, diffQty, tenantId]
        );
      }
    }

    const changeType = diffQty > 0 ? "STOCK_CHECK_IN" : "STOCK_CHECK_OUT";
    await (conn as any).execute(
      `INSERT INTO t_inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, ref_no, operator_id, created_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [check.store_id, item.sku_id, item.sku_name, changeType, Math.abs(diffQty), check.check_no, userId ?? null, tenantId]
    );

    await (conn as any).execute(
      "UPDATE stock_check_item SET handled = 1 WHERE id = ? AND tenant_id = ?",
      [itemId, tenantId]
    );
  });

  return { checkId };
}

// ==================== Store 端 ====================

export async function listMyChecks(storeId: number, tenantId: string) {
  const records = await query<Record<string, unknown>>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.store_id = ? AND sc.tenant_id = ?
     ORDER BY sc.created_at DESC`,
    [storeId, tenantId]
  );

  return records;
}

export async function getMyCheckDetail(id: number, tenantId: string) {
  const check = await queryOne<Record<string, unknown>>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.id = ? AND sc.tenant_id = ?`,
    [id, tenantId]
  );

  if (!check) throw Object.assign(new Error("盘点单不存在"), { statusCode: 404 });

  const items = await query<Record<string, unknown>>(
    "SELECT * FROM stock_check_item WHERE check_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  return { ...check, items };
}

export async function updateItemQty(params: {
  checkId: number; itemId: number; actualQty: number; tenantId: string;
}) {
  const { checkId, itemId, actualQty, tenantId } = params;

  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [checkId, tenantId]
    );
    const check = (rows as unknown as Record<string, unknown>[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可录入");

    const [itemRows] = await (conn as any).execute(
      "SELECT * FROM stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [itemId, checkId, tenantId]
    );
    const item = (itemRows as unknown as Record<string, unknown>[])[0];
    if (!item) throw new Error("明细不存在");

    const [skuRows] = await (conn as any).execute(
      "SELECT cost_price FROM t_product_sku WHERE id = ? AND tenant_id = ?",
      [item.sku_id, tenantId]
    );
    const unitPrice = (skuRows as unknown as Record<string, unknown>[])[0]?.cost_price ?? 0;
    const diffQty = actualQty - Number(item.system_qty);
    const diffAmount = Math.abs(diffQty) * Number(unitPrice);

    await (conn as any).execute(
      "UPDATE stock_check_item SET actual_qty = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [actualQty, diffAmount, itemId, tenantId]
    );
  });

  return { checkId, itemId };
}

export async function submitCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as unknown as Record<string, unknown>[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可提交");

    const [summaryRows] = await (conn as any).execute(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = (summaryRows as unknown as Record<string, unknown>[])[0];

    await (conn as any).execute(
      "UPDATE stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId]
    );
  });

  return { checkId: id };
}