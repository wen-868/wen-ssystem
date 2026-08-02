import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";
import { makeBizNo } from "../../shared/id";

// ==================== 类型定义 ====================

/** 采购退货单列表行 */
interface PurchaseReturnRow {
  id: number;
  returnNo: string;
  orderNo: string | null;
  stockNo: string | null;
  supplierId: number;
  supplierName: string;
  storeId: number;
  returnStatus: string;
  goodsAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  refundAmount: number | string;
  refundedAmount: number | string;
  operatorId: number;
  remark: string | null;
  createdAt: string | Date;
}

/** 采购退货单原始行 */
interface PurchaseReturnRawRow {
  id: number;
  return_no: string;
  order_no: string | null;
  stock_no: string | null;
  supplier_id: number;
  supplier_name: string;
  store_id: number;
  return_status: string;
  goods_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  refund_amount: number | string;
  refunded_amount: number | string;
  operator_id: number;
  auditor_id: number | null;
  audited_at: string | Date | null;
  remark: string | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 采购退货单明细原始行 */
interface PurchaseReturnItemRawRow {
  id: number;
  return_no: string;
  sku_id: number;
  sku_name: string;
  box_qty: number;
  bottle_qty: number;
  total_bottle_qty: number;
  unit_price: number | string;
  tax_rate: number | string;
  subtotal_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  reason: string | null;
}

interface ReturnItemQtyRow {
  sku_id: number;
  total_bottle_qty: number;
}

/** 库存数量行 */
interface InventoryQtyRow {
  physical_qty: number | string | null;
}

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

/** 供应商简要行 */
interface SupplierBriefRow {
  id: number;
  name: string;
}

/** 退货单状态行 */
interface ReturnStatusRow {
  id: number;
  return_status: string;
  store_id: number;
}

/** 退货单状态行（仅状态） */
interface ReturnStatusOnlyRow {
  id: number;
  return_status: string;
}

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

  const whereClause = " AND tenant_id = ?" + (conditions.length > 0 ? " AND " + conditions.join(" AND ") : "");
  const offset = (page - 1) * pageSize;
  const returns = await query<PurchaseReturnRawRow>(
    `SELECT * FROM t_purchase_return WHERE 1=1${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, ...queryParams, pageSize, offset]
  );
  return returns;
}

export async function getDetail(returnNo: string, tenantId: string) {
  const returnOrder = await queryOne<PurchaseReturnRawRow>(
    "SELECT * FROM t_purchase_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );
  if (!returnOrder) throw Object.assign(new Error("退货单不存在"), { statusCode: 404 });
  const items = await query<PurchaseReturnItemRawRow>(
    "SELECT * FROM t_purchase_return_item WHERE return_no = ? ORDER BY id ASC",
    [returnNo]
  );
  return { ...returnOrder, items };
}

export async function create(body: {
  order_no?: string; stock_no?: string; supplier_id: number; supplier_name: string;
  store_id: number; remark?: string;
  items: Array<{
    sku_id: number; sku_name: string; box_qty?: number; bottle_qty?: number;
    unit_price: number; tax_rate?: number; reason?: string;
  }>;
}, tenantId: string, userId: number, username: string) {
  const returnNo = makeBizNo("CGTH");
  let goodsAmount = 0;
  let taxAmount = 0;

  // 读取各 SKU 箱瓶比（box_ratio），避免硬编码 12 导致数量计算错误
  const skuIds = body.items.map((i) => i.sku_id);
  const skuRows = skuIds.length > 0
    ? await queryWithTenant<{ id: number | string; box_ratio: number | string | null }>(
        `SELECT id, box_ratio FROM t_product_sku WHERE id IN (${skuIds.map(() => "?").join(",")}) AND tenant_id = ?`,
        [...skuIds, tenantId],
        tenantId
      )
    : [];
  const boxRatioMap = new Map((skuRows ?? []).map((r) => [Number(r.id), Number(r.box_ratio) || 1]));

  const itemsWithAmount = body.items.map(item => {
    const boxRatio = boxRatioMap.get(Number(item.sku_id)) || 1;
    const totalBottleQty = (item.box_qty || 0) * boxRatio + (item.bottle_qty || 0);
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
      `INSERT INTO t_purchase_return (return_no, order_no, stock_no, supplier_id, supplier_name, store_id, return_status,
        goods_amount, tax_amount, total_amount, refund_amount, refunded_amount, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?)`,
      [returnNo, body.order_no || null, body.stock_no || null, body.supplier_id, body.supplier_name, body.store_id,
        goodsAmount, taxAmount, totalAmount, totalAmount, userId, body.remark || null, tenantId]
    );
    for (const item of itemsWithAmount) {
      await conn.query(
        `INSERT INTO t_purchase_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
          unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnNo, item.sku_id, item.sku_name, item.box_qty || 0, item.bottle_qty || 0, item.total_bottle_qty,
          item.unit_price, item.tax_rate || 0, item.subtotal_amount, item.tax_amount, item.total_amount, item.reason || null]
      );
    }
    await conn.query(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_return", "CREATE", returnNo, "purchase_return", userId, username, `创建采购退货单: ${returnNo}`, tenantId]
    );
  });

  return { return_no: returnNo };
}

export async function approve(returnNo: string, tenantId: string, userId: number, username: string) {
  const returnOrder = await queryOne<ReturnStatusRow>(
    "SELECT id, return_status, store_id FROM t_purchase_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );
  if (!returnOrder) throw Object.assign(new Error("退货单不存在"), { statusCode: 404 });
  if (returnOrder.return_status !== "PENDING") throw Object.assign(new Error("只有待审核状态的退货单可以审核"), { statusCode: 400 });

  await transaction(async (conn) => {
    await conn.query("UPDATE t_purchase_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE return_no = ? AND tenant_id = ?", [userId, returnNo, tenantId]);
    const [itemRows] = await conn.query("SELECT sku_id, total_bottle_qty FROM t_purchase_return_item WHERE return_no = ?", [returnNo]);

    for (const item of (itemRows as ReturnItemQtyRow[])) {
      const [balanceRows] = await conn.query(
        "SELECT physical_qty FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [returnOrder.store_id, item.sku_id]
      );
      const currentQty = Number((balanceRows as InventoryQtyRow[])?.[0]?.physical_qty) || 0;
      if (currentQty < item.total_bottle_qty) {
        throw new Error(`库存不足: SKU ${item.sku_id} 当前库存 ${currentQty}, 退货数量 ${item.total_bottle_qty}`);
      }

      await conn.query(
        `UPDATE t_inventory_balance SET physical_qty = physical_qty - ?, available_qty = available_qty - ?
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'`,
        [item.total_bottle_qty, item.total_bottle_qty, returnOrder.store_id, item.sku_id]
      );

      const [newBalanceRows] = await conn.query(
        "SELECT physical_qty FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [returnOrder.store_id, item.sku_id]
      );
      const afterQty = Number((newBalanceRows as InventoryQtyRow[])?.[0]?.physical_qty) || 0;
      const beforeQty = afterQty + item.total_bottle_qty;

      const ledgerNo = makeBizNo("LL");
      await conn.query(
        `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
          change_qty, before_qty, after_qty, operator_id, idempotency_key, remark, tenant_id)
         VALUES (?, ?, ?, 'OFFLINE', 'PURCHASE_RETURN', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ledgerNo, returnOrder.store_id, item.sku_id, returnNo, -item.total_bottle_qty, beforeQty, afterQty,
          userId, `${returnNo}_${item.sku_id}`, `采购退货出库: ${returnNo}`, tenantId]
      );
    }
    await conn.query(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_return", "APPROVE", returnNo, "purchase_return", userId, username, `审核通过: ${returnNo}`, tenantId]
    );
  });

  return { return_no: returnNo };
}

export async function voidReturn(returnNo: string, tenantId: string, userId: number, username: string) {
  const returnOrder = await queryOne<ReturnStatusOnlyRow>(
    "SELECT id, return_status FROM t_purchase_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );
  if (!returnOrder) throw Object.assign(new Error("退货单不存在"), { statusCode: 404 });
  if (returnOrder.return_status !== "PENDING") throw Object.assign(new Error("只有待审核状态的退货单可以作废"), { statusCode: 400 });

  await query("UPDATE t_purchase_return SET return_status = 'VOIDED' WHERE return_no = ? AND tenant_id = ?", [returnNo, tenantId]);
  await queryWithTenant(
    "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase_return", "VOID", returnNo, "purchase_return", userId, username, `作废退货单: ${returnNo}`, tenantId],
    tenantId
  );
  return { return_no: returnNo };
}

// ========== 采购退货 ==========
export async function purchaseReturn(params: {
  orderNo?: string;
  stockNo?: string;
  supplierId: number;
  storeId: number;
  tenantId: string;
  operatorId: number;
  remark?: string;
  items: Array<{
    skuId: number;
    skuName: string;
    boxQty: number;
    bottleQty: number;
    totalBottleQty: number;
    unitPrice: number;
    taxRate: number;
    reason?: string;
  }>;
}) {
  const { orderNo, stockNo, supplierId, storeId, tenantId, operatorId, remark, items } = params;

  const supplier = await queryOneWithTenant<SupplierBriefRow>(
    "SELECT id, name FROM t_supplier WHERE id = ? AND tenant_id = ?",
    [supplierId, tenantId],
    tenantId
  );
  if (!supplier) {
    throw Object.assign(new Error("供应商不存在"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    const returnNo = makeBizNo("CGTH");
    let goodsAmount = 0;
    let taxAmount = 0;

    for (const item of items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      goodsAmount += subtotal;
      taxAmount += tax;
    }
    const totalAmount = goodsAmount + taxAmount;

    const [returnResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO t_purchase_return (return_no, order_no, stock_no, supplier_id, supplier_name, store_id,
        return_status, goods_amount, tax_amount, total_amount, refund_amount, refunded_amount,
        operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?)`,
      [returnNo, orderNo ?? null, stockNo ?? null, supplierId, supplier.name,
        storeId, goodsAmount, taxAmount, totalAmount, totalAmount,
        operatorId, remark ?? null, tenantId]
    );

    for (const item of items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      const total = subtotal + tax;
      await conn.execute(
        `INSERT INTO t_purchase_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty,
          total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnNo, item.skuId, item.skuName, item.boxQty, item.bottleQty, item.totalBottleQty,
          item.unitPrice, item.taxRate, subtotal, tax, total, item.reason ?? null]
      );

      // 扣减库存
      await conn.execute(
        `UPDATE t_inventory_balance
         SET physical_qty = GREATEST(physical_qty - ?, 0),
             available_qty = GREATEST(available_qty - ?, 0),
             updated_at = NOW()
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' AND tenant_id = ?`,
        [item.totalBottleQty, item.totalBottleQty, storeId, item.skuId, tenantId]
      );
    }

    return { returnId: returnResult.insertId as number, returnNo };
  });
  return result;
}

// ========== 采购退货列表 ==========
export async function listPurchaseReturns(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  supplierId?: number;
  returnStatus?: string;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { page, pageSize, tenantId, supplierId, returnStatus, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (supplierId !== undefined) {
    conditions.push("supplier_id = ?");
    queryParams.push(supplierId);
  }
  if (returnStatus) {
    conditions.push("return_status = ?");
    queryParams.push(returnStatus);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    queryParams.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<PurchaseReturnRow>(
    `SELECT id, return_no AS returnNo, order_no AS orderNo, stock_no AS stockNo,
            supplier_id AS supplierId, supplier_name AS supplierName, store_id AS storeId,
            return_status AS returnStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            refund_amount AS refundAmount, refunded_amount AS refundedAmount,
            operator_id AS operatorId, remark, created_at AS createdAt
     FROM t_purchase_return
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  const totalRow = await queryOne<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_purchase_return ${where}`,
    queryParams
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}
