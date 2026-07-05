import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function list(params: {
  page: number; pageSize: number; tenantId: string;
  supplierId?: number; stockStatus?: string; dateStart?: string; dateEnd?: string;
}) {
  const { page, pageSize, tenantId, supplierId, stockStatus, dateStart, dateEnd } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (supplierId !== undefined) {
    conditions.push("supplier_id = ?");
    queryParams.push(supplierId);
  }
  if (stockStatus) {
    conditions.push("stock_status = ?");
    queryParams.push(stockStatus);
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
  const stocks = await query<any>(
    `SELECT * FROM purchase_in_stock WHERE 1=1${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, ...queryParams, pageSize, offset]
  );
  return stocks;
}

export async function getDetail(stockNo: string, tenantId: string) {
  const stock = await queryOne<any>(
    "SELECT * FROM purchase_in_stock WHERE stock_no = ? AND tenant_id = ?",
    [stockNo, tenantId]
  );
  if (!stock) throw Object.assign(new Error("入库单不存在"), { statusCode: 404 });
  const items = await query<any>(
    "SELECT * FROM purchase_in_stock_item WHERE stock_no = ? ORDER BY id ASC",
    [stockNo]
  );
  return { ...stock, items };
}

export async function create(body: {
  order_no?: string; supplier_id: number; supplier_name: string;
  store_id: number; remark?: string;
  items: Array<{ sku_id: number; sku_name: string; box_qty?: number; bottle_qty?: number;
    unit_price: number; tax_rate?: number; batch_no?: string; production_date?: string;
    expiry_date?: string; remark?: string; }>;
}, tenantId: string, userId: number, username: string) {
  const stockNo = makeBizNo("RK");
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
      `INSERT INTO purchase_in_stock (stock_no, order_no, supplier_id, supplier_name, store_id, stock_status,
        goods_amount, tax_amount, total_amount, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
      [stockNo, body.order_no || null, body.supplier_id, body.supplier_name, body.store_id,
        goodsAmount, taxAmount, totalAmount, userId, body.remark || null, tenantId]
    );
    for (const item of itemsWithAmount) {
      await conn.query(
        `INSERT INTO purchase_in_stock_item (stock_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
          unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, batch_no, production_date, expiry_date, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stockNo, item.sku_id, item.sku_name, item.box_qty || 0, item.bottle_qty || 0, item.total_bottle_qty,
          item.unit_price, item.tax_rate || 0, item.subtotal_amount, item.tax_amount, item.total_amount,
          item.batch_no || null, item.production_date || null, item.expiry_date || null, item.remark || null]
      );
    }
    await conn.query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_in_stock", "CREATE", stockNo, "purchase_in_stock", userId, username, `创建入库单: ${stockNo}`, tenantId]
    );
  });

  return { stock_no: stockNo };
}

export async function approve(stockNo: string, tenantId: string, userId: number, username: string) {
  const stock = await queryOne<any>(
    "SELECT id, stock_status, store_id FROM purchase_in_stock WHERE stock_no = ? AND tenant_id = ?",
    [stockNo, tenantId]
  );
  if (!stock) throw Object.assign(new Error("入库单不存在"), { statusCode: 404 });
  if (stock.stock_status !== "PENDING") throw Object.assign(new Error("只有待审核状态的入库单可以审核"), { statusCode: 400 });

  await transaction(async (conn) => {
    await conn.query("UPDATE purchase_in_stock SET stock_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE stock_no = ? AND tenant_id = ?", [userId, stockNo, tenantId]);
    const [itemRows] = await conn.query("SELECT sku_id, total_bottle_qty, batch_no, production_date, expiry_date FROM purchase_in_stock_item WHERE stock_no = ?", [stockNo]);

    for (const item of (itemRows as Record<string, unknown>[])) {
      await conn.query(
        `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, tenant_id)
         VALUES (?, ?, 'OFFLINE', ?, 0, ?, ?)
         ON DUPLICATE KEY UPDATE physical_qty = physical_qty + ?, available_qty = available_qty + ?`,
        [stock.store_id, item.sku_id, item.total_bottle_qty, item.total_bottle_qty, tenantId,
          item.total_bottle_qty, item.total_bottle_qty]
      );

      const [balanceRows] = await conn.query(
        "SELECT physical_qty FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [stock.store_id, item.sku_id]
      );
      const afterQty = Number((balanceRows as Record<string, unknown>[])?.[0]?.physical_qty) || 0;
      const beforeQty = afterQty - item.total_bottle_qty;

      const ledgerNo = makeBizNo("LL");
      await conn.query(
        `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
          change_qty, before_qty, after_qty, operator_id, idempotency_key, remark, tenant_id)
         VALUES (?, ?, ?, 'OFFLINE', 'PURCHASE_IN', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ledgerNo, stock.store_id, item.sku_id, stockNo, item.total_bottle_qty, beforeQty, afterQty,
          userId, `${stockNo}_${item.sku_id}`, `采购入库: ${stockNo}`, tenantId]
      );

      if (item.batch_no) {
        await conn.query(
          `INSERT INTO inventory_batch (store_id, sku_id, batch_no, quantity, locked_quantity, production_date, expiry_date, supplier_id, inbound_order_id, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
          [stock.store_id, item.sku_id, item.batch_no, item.total_bottle_qty, item.production_date || null, item.expiry_date || null, null, null, tenantId]
        );
      }
    }
    await conn.query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_in_stock", "APPROVE", stockNo, "purchase_in_stock", userId, username, `审核通过: ${stockNo}`, tenantId]
    );
  });

  return { stock_no: stockNo };
}

export async function voidStock(stockNo: string, tenantId: string, userId: number, username: string) {
  const stock = await queryOne<any>(
    "SELECT id, stock_status FROM purchase_in_stock WHERE stock_no = ? AND tenant_id = ?",
    [stockNo, tenantId]
  );
  if (!stock) throw Object.assign(new Error("入库单不存在"), { statusCode: 404 });
  if (stock.stock_status !== "PENDING") throw Object.assign(new Error("只有待审核状态的入库单可以作废"), { statusCode: 400 });

  await query("UPDATE purchase_in_stock SET stock_status = 'VOIDED' WHERE stock_no = ? AND tenant_id = ?", [stockNo, tenantId]);
  await queryWithTenant(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase_in_stock", "VOID", stockNo, "purchase_in_stock", userId, username, `作废入库单: ${stockNo}`, tenantId],
    tenantId
  );
  return { stock_no: stockNo };
}

// ========== 采购入库（含批次信息录入） ==========
export async function purchaseInStock(id: number, params: {
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
    batchNo?: string;
    productionDate?: string;
    expiryDate?: string;
    remark?: string;
  }>;
}) {
  const { tenantId, operatorId, remark, items } = params;

  const order = await queryOneWithTenant<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus
     FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!order) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  if (!["APPROVED", "PARTIAL"].includes(order.orderStatus)) {
    throw Object.assign(new Error("当前状态不允许入库"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    const stockNo = makeBizNo("CGRK");
    let goodsAmount = 0;
    let taxAmount = 0;

    for (const item of items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      goodsAmount += subtotal;
      taxAmount += tax;
    }
    const totalAmount = goodsAmount + taxAmount;

    const [stockResult] = await conn.execute<any>(
      `INSERT INTO purchase_in_stock (stock_no, order_no, supplier_id, supplier_name, store_id,
        stock_status, goods_amount, tax_amount, total_amount, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
      [stockNo, order.orderNo, order.supplierId, order.supplierName, order.storeId,
       goodsAmount, taxAmount, totalAmount, operatorId, remark ?? null, tenantId]
    );

    for (const item of items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      const total = subtotal + tax;
      await conn.execute(
        `INSERT INTO purchase_in_stock_item (stock_no, sku_id, sku_name, box_qty, bottle_qty,
          total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount,
          batch_no, production_date, expiry_date, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stockNo, item.skuId, item.skuName, item.boxQty, item.bottleQty, item.totalBottleQty,
         item.unitPrice, item.taxRate, subtotal, tax, total,
         item.batchNo ?? null, item.productionDate ?? null, item.expiryDate ?? null, item.remark ?? null]
      );

      // 更新采购订单明细的已入库数量
      await conn.execute(
        `UPDATE purchase_order_item SET in_stocked_qty = in_stocked_qty + ? WHERE order_no = ? AND sku_id = ?`,
        [item.totalBottleQty, order.orderNo, item.skuId]
      );

      // 更新库存余额
      await conn.execute(
        `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, available_qty, tenant_id)
         VALUES (?, ?, 'OFFLINE', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           physical_qty = physical_qty + VALUES(physical_qty),
           available_qty = available_qty + VALUES(available_qty),
           updated_at = NOW()`,
        [order.storeId, item.skuId, item.totalBottleQty, item.totalBottleQty, tenantId]
      );
    }

    // 检查采购订单是否全部入库
    const remaining = await conn.execute<any>(
      `SELECT SUM(total_bottle_qty - in_stocked_qty) AS remainingQty
       FROM purchase_order_item WHERE order_no = ?`,
      [order.orderNo]
    );
    const remainingQty = Number((remaining as unknown[][])[0]?.[0]?.remainingQty ?? 0);
    const newStatus = remainingQty <= 0 ? "COMPLETED" : "PARTIAL";
    await conn.execute(
      `UPDATE purchase_order SET order_status = ?, actual_date = CURDATE(), updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [newStatus, id, tenantId]
    );

    return { stockId: stockResult.insertId as number, stockNo, orderStatus: newStatus };
  });
  return result;
}

// ========== 入库单列表 ==========
export async function listPurchaseInStocks(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  supplierId?: number;
  stockStatus?: string;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { page, pageSize, tenantId, supplierId, stockStatus, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (supplierId !== undefined) {
    conditions.push("supplier_id = ?");
    queryParams.push(supplierId);
  }
  if (stockStatus) {
    conditions.push("stock_status = ?");
    queryParams.push(stockStatus);
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
  const records = await query<any>(
    `SELECT id, stock_no AS stockNo, order_no AS orderNo, supplier_id AS supplierId,
            supplier_name AS supplierName, store_id AS storeId, stock_status AS stockStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt
     FROM purchase_in_stock
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM purchase_in_stock ${where}`,
    queryParams
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 入库单详情 ==========
export async function getPurchaseInStockDetail(id: number, tenantId: string) {
  const stock = await queryOneWithTenant<any>(
    `SELECT id, stock_no AS stockNo, order_no AS orderNo, supplier_id AS supplierId,
            supplier_name AS supplierName, store_id AS storeId, stock_status AS stockStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt
     FROM purchase_in_stock WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!stock) {
    throw Object.assign(new Error("入库单不存在"), { statusCode: 404 });
  }
  const items = await query<any>(
    `SELECT id, stock_no AS stockNo, sku_id AS skuId, sku_name AS skuName,
            box_qty AS boxQty, bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, tax_rate AS taxRate,
            subtotal_amount AS subtotalAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            batch_no AS batchNo, production_date AS productionDate, expiry_date AS expiryDate,
            remark
     FROM purchase_in_stock_item WHERE stock_no = ?`,
    [stock.stockNo]
  );
  return { ...stock, items };
}