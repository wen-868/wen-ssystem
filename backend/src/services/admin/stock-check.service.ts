import { query, queryOne, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

// ==================== Admin 盘点 ====================

export interface CreateStockCheckBody {
  storeId: number;
  remark?: string;
}

export async function createStockCheck(body: CreateStockCheckBody, tenantId: string) {
  const checkNo = makeBizNo("PD");

  const result = await transaction(async (conn) => {
    const [insertResult] = await conn.execute(
      `INSERT INTO stock_check (check_no, store_id, status, remark, tenant_id)
       VALUES (?, ?, 'DRAFT', ?, ?)`,
      [checkNo, body.storeId, body.remark ?? "", tenantId] as any[]
    );
    return (insertResult as any).insertId;
  });

  return { checkId: result, checkNo };
}

export interface ListStockChecksParams {
  page: number;
  pageSize: number;
  tenantId: string;
  storeId?: number;
  status?: "DRAFT" | "CHECKING" | "COMPLETED" | "CANCELLED";
}

export async function listStockChecks(params: ListStockChecksParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["sc.tenant_id = ?"];
  const values: unknown[] = [params.tenantId];

  if (params.storeId) {
    conditions.push("sc.store_id = ?");
    values.push(params.storeId);
  }
  if (params.status) {
    conditions.push("sc.status = ?");
    values.push(params.status);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE ${where}
     ORDER BY sc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM stock_check sc WHERE ${where}`,
    values
  );

  return { total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records };
}

export async function getStockCheckStatistics(tenantId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const monthTotal = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM stock_check WHERE created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffCount = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM stock_check WHERE status = 'COMPLETED' AND diff_sku > 0 AND created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffAmount = await queryOne<any>(
    "SELECT COALESCE(SUM(diff_amount), 0) AS total FROM stock_check WHERE status = 'COMPLETED' AND created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  return {
    monthTotal: monthTotal?.total ?? 0,
    diffCount: diffCount?.total ?? 0,
    diffAmount: Number(diffAmount?.total ?? 0)
  };
}

export async function getStockCheckDetail(id: number, tenantId: string) {
  const check = await queryOne<any>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.id = ? AND sc.tenant_id = ?`,
    [id, tenantId]
  );

  if (!check) return null;

  const items = await query<any>(
    "SELECT * FROM stock_check_item WHERE check_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  return { ...check, items };
}

export interface UpdateStockCheckBody {
  remark?: string;
}

export async function updateStockCheck(id: number, body: UpdateStockCheckBody, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可编辑");

    if (body.remark !== undefined) {
      await conn.execute(
        "UPDATE stock_check SET remark = ? WHERE id = ? AND tenant_id = ?",
        [body.remark, id, tenantId] as any[]
      );
    }
  });

  return { checkId: id };
}

export async function startStockCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可开始盘点");

    const [skuRows] = await conn.execute<any[]>(
      `SELECT ib.sku_id, ps.sku_name, ib.batch_no, ib.quantity
       FROM inventory_batch ib
       LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
       WHERE ib.store_id = ? AND ib.quantity > 0 AND ib.tenant_id = ?
       ORDER BY ib.sku_id, ib.batch_no`,
      [check.store_id, tenantId]
    );

    await conn.execute("DELETE FROM stock_check_item WHERE check_id = ? AND tenant_id = ?", [id, tenantId]);

    let totalSku = 0;
    for (const row of skuRows as any[]) {
      await conn.execute(
        `INSERT INTO stock_check_item (check_id, sku_id, sku_name, batch_no, system_qty, actual_qty, diff_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
        [id, row.sku_id, row.sku_name || "", row.batch_no || "", row.quantity, tenantId] as any[]
      );
      totalSku++;
    }

    await conn.execute(
      "UPDATE stock_check SET status = 'CHECKING', total_sku = ? WHERE id = ? AND tenant_id = ?",
      [totalSku, id, tenantId] as any[]
    );
  });

  return { checkId: id };
}

export async function completeStockCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可完成");

    const [summaryRows] = await conn.execute<any[]>(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = (summaryRows as any[])[0];

    await conn.execute(
      "UPDATE stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId] as any[]
    );
  });

  return { checkId: id };
}

export async function cancelStockCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT" && check.status !== "CHECKING") {
      throw new Error("仅草稿或盘点中状态可取消");
    }

    await conn.execute(
      "UPDATE stock_check SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  return { checkId: id };
}

export interface HandleDiffBody {
  itemId: number;
}

export async function handleDiff(id: number, body: HandleDiffBody, tenantId: string, userId: number) {
  await transaction(async (conn) => {
    const [checkRows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (checkRows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "COMPLETED") throw new Error("仅已完成状态可处理差异");

    const [itemRows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [body.itemId, id, tenantId]
    );
    const item = (itemRows as any[])[0];
    if (!item) throw new Error("明细不存在");
    if (item.handled) throw new Error("该差异已处理");
    if (item.diff_qty === 0) throw new Error("无差异需要处理");

    const diffQty = item.diff_qty;
    const [invRows] = await conn.execute<any[]>(
      "SELECT * FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
      [check.store_id, item.sku_id, tenantId]
    );
    const inv = (invRows as any[])[0];

    if (inv) {
      await conn.execute(
        "UPDATE inventory_balance SET available_qty = available_qty + ? WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
        [diffQty, check.store_id, item.sku_id, tenantId] as any[]
      );
    } else {
      if (diffQty > 0) {
        await conn.execute(
          `INSERT INTO inventory_balance (store_id, sku_id, sku_name, available_qty, locked_qty, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [check.store_id, item.sku_id, item.sku_name, diffQty, tenantId] as any[]
        );
      }
    }

    const changeType = diffQty > 0 ? "STOCK_CHECK_IN" : "STOCK_CHECK_OUT";
    await conn.execute(
      `INSERT INTO inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, ref_no, operator_id, created_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [check.store_id, item.sku_id, item.sku_name, changeType, Math.abs(diffQty), check.check_no, userId ?? null, tenantId] as any[]
    );

    await conn.execute(
      "UPDATE stock_check_item SET handled = 1 WHERE id = ? AND tenant_id = ?",
      [body.itemId, tenantId] as any[]
    );
  });

  return { checkId: id };
}

// ==================== Store 盘点 ====================

export async function getMyStockChecks(storeId: number, tenantId: string) {
  return query<any>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.store_id = ? AND sc.tenant_id = ?
     ORDER BY sc.created_at DESC`,
    [storeId, tenantId]
  );
}

export interface UpdateItemBody {
  actualQty: number;
}

export async function updateItem(checkId: number, itemId: number, body: UpdateItemBody, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [checkId, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可录入");

    const [itemRows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [itemId, checkId, tenantId]
    );
    const item = (itemRows as any[])[0];
    if (!item) throw new Error("明细不存在");

    const [skuRows] = await conn.execute<any[]>(
      "SELECT cost_price FROM product_sku WHERE id = ? AND tenant_id = ?",
      [item.sku_id, tenantId]
    );
    const unitPrice = (skuRows as any[])[0]?.cost_price ?? 0;
    const diffQty = body.actualQty - item.system_qty;
    const diffAmount = Math.abs(diffQty) * Number(unitPrice);

    await conn.execute(
      "UPDATE stock_check_item SET actual_qty = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [body.actualQty, diffAmount, itemId, tenantId] as any[]
    );
  });

  return { checkId, itemId };
}

export async function submitStockCheck(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可提交");

    const [summaryRows] = await conn.execute<any[]>(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = (summaryRows as any[])[0];

    await conn.execute(
      "UPDATE stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId] as any[]
    );
  });

  return { checkId: id };
}