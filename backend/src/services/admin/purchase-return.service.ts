import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function list(params: {
  page: number; pageSize: number; tenantId: string;
  supplierId?: number; returnStatus?: string; dateStart?: string; dateEnd?: string;
}) {
  const { page, pageSize, tenantId, supplierId, returnStatus, dateStart, dateEnd } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (supplierId !== undefined) {
    conditions.push("supplier_id = ?");
    queryParams.push(supplierId);
  }
  if (returnStatus) {
    conditions.push("return_status = ?");
    queryParams.push(returnStatus);
  }
  if (dateStart) {
    conditions.push("created_at >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("created_at <= ?");
    queryParams.push(dateEnd);
  }

  const whereClause = conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";
  const offset = (page - 1) * pageSize;
  const returns = await queryWithTenant<any>(
    `SELECT * FROM purchase_return WHERE 1=1${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  return returns;
}

export async function getDetail(returnNo: string, tenantId: string) {
  const returnOrder = await queryOneWithTenant<any>(
    "SELECT * FROM purchase_return WHERE return_no = ?",
    [returnNo],
    tenantId
  );
  if (!returnOrder) throw Object.assign(new Error("退货单不存在"), { statusCode: 404 });
  const items = await query<any>(
    "SELECT * FROM purchase_return_item WHERE return_no = ? ORDER BY id ASC",
    [returnNo]
  );
  return { ...returnOrder, items };
}

export async function create(body: {
  order_no?: string; stock_no?: string; supplier_id: number; supplier_name: string;
  store_id: number; remark?: string;
  items: Array<{ sku_id: number; sku_name: string; box_qty?: number; bottle_qty?: number;
    unit_price: number; tax_rate?: number; reason?: string; }>;
}, tenantId: string, userId: number, username: string) {
  const returnNo = makeBizNo("CGTH");
  let goodsAmount = 0;
  let taxAmount = 0;

  const itemsWithAmount = body.items.map(item => {
    const totalBottleQty = (item.box_qty || 0) * 12 + (item.bottle_qty || 0);
    const subtotalAmount = totalBottleQty * item.unit_price;
    const itemTaxAmount = subtotalAmount * (item.tax_rate || 0);
    const totalAmount = subtotalAmount + itemTaxAmount;
    goodsAmount += subtotalAmount;
    taxAmount += itemTaxAmount;
    return { ...item, total_bottle_qty: totalBottleQty, subtotal_amount: subtotalAmount, tax_amount: itemTaxAmount, total_amount: totalAmount };
  });

  const totalAmount = goodsAmount + taxAmount;

  await transaction(async (conn) => {
    await conn.query(
      `INSERT INTO purchase_return (return_no, order_no, stock_no, supplier_id, supplier_name, store_id, return_status,
        goods_amount, tax_amount, total_amount, refund_amount, refunded_amount, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?)`,
      [returnNo, body.order_no || null, body.stock_no || null, body.supplier_id, body.supplier_name, body.store_id,
        goodsAmount, taxAmount, totalAmount, totalAmount, userId, body.remark || null, tenantId]
    );
    for (const item of itemsWithAmount) {
      await conn.query(
        `INSERT INTO purchase_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
          unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnNo, item.sku_id, item.sku_name, item.box_qty || 0, item.bottle_qty || 0, item.total_bottle_qty,
          item.unit_price, item.tax_rate || 0, item.subtotal_amount, item.tax_amount, item.total_amount, item.reason || null]
      );
    }
    await conn.query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_return", "CREATE", returnNo, "purchase_return", userId, username, `创建采购退货单: ${returnNo}`, tenantId]
    );
  });

  return { return_no: returnNo };
}

export async function approve(returnNo: string, tenantId: string, userId: number, username: string) {
  const returnOrder = await queryOneWithTenant<any>(
    "SELECT id, return_status, store_id FROM purchase_return WHERE return_no = ?",
    [returnNo],
    tenantId
  );
  if (!returnOrder) throw Object.assign(new Error("退货单不存在"), { statusCode: 404 });
  if (returnOrder.return_status !== "PENDING") throw Object.assign(new Error("只有待审核状态的退货单可以审核"), { statusCode: 400 });

  await transaction(async (conn) => {
    await conn.query("UPDATE purchase_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE return_no = ?", [userId, returnNo]);
    const [itemRows] = await conn.query("SELECT sku_id, total_bottle_qty FROM purchase_return_item WHERE return_no = ?", [returnNo]);

    for (const item of (itemRows as any[])) {
      const [balanceRows] = await conn.query(
        "SELECT physical_qty FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [returnOrder.store_id, item.sku_id]
      );
      const currentQty = (balanceRows as any[])?.[0]?.physical_qty || 0;
      if (currentQty < item.total_bottle_qty) {
        throw new Error(`库存不足: SKU ${item.sku_id} 当前库存 ${currentQty}, 退货数量 ${item.total_bottle_qty}`);
      }

      await conn.query(
        `UPDATE inventory_balance SET physical_qty = physical_qty - ?, available_qty = available_qty - ?
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'`,
        [item.total_bottle_qty, item.total_bottle_qty, returnOrder.store_id, item.sku_id]
      );

      const [newBalanceRows] = await conn.query(
        "SELECT physical_qty FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [returnOrder.store_id, item.sku_id]
      );
      const afterQty = (newBalanceRows as any[])?.[0]?.physical_qty || 0;
      const beforeQty = afterQty + item.total_bottle_qty;

      const ledgerNo = makeBizNo("LL");
      await conn.query(
        `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
          change_qty, before_qty, after_qty, operator_id, idempotency_key, remark, tenant_id)
         VALUES (?, ?, ?, 'OFFLINE', 'PURCHASE_RETURN', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ledgerNo, returnOrder.store_id, item.sku_id, returnNo, -item.total_bottle_qty, beforeQty, afterQty,
          userId, `${returnNo}_${item.sku_id}`, `采购退货出库: ${returnNo}`, tenantId]
      );
    }
    await conn.query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_return", "APPROVE", returnNo, "purchase_return", userId, username, `审核通过: ${returnNo}`, tenantId]
    );
  });

  return { return_no: returnNo };
}

export async function voidReturn(returnNo: string, tenantId: string, userId: number, username: string) {
  const returnOrder = await queryOneWithTenant<any>(
    "SELECT id, return_status FROM purchase_return WHERE return_no = ?",
    [returnNo],
    tenantId
  );
  if (!returnOrder) throw Object.assign(new Error("退货单不存在"), { statusCode: 404 });
  if (returnOrder.return_status !== "PENDING") throw Object.assign(new Error("只有待审核状态的退货单可以作废"), { statusCode: 400 });

  await queryWithTenant("UPDATE purchase_return SET return_status = 'VOIDED' WHERE return_no = ?", [returnNo], tenantId);
  await queryWithTenant(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase_return", "VOID", returnNo, "purchase_return", userId, username, `作废退货单: ${returnNo}`, tenantId],
    tenantId
  );
  return { return_no: returnNo };
}