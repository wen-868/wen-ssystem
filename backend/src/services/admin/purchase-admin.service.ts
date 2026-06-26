import { query, queryOne, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

// ========== 采购订单列表 ==========
export async function listPurchaseOrders(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  supplierId?: number;
  orderStatus?: string;
  operatorId?: number;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { page, pageSize, tenantId, supplierId, orderStatus, operatorId, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (supplierId !== undefined) {
    conditions.push("supplier_id = ?");
    queryParams.push(supplierId);
  }
  if (orderStatus) {
    conditions.push("order_status = ?");
    queryParams.push(orderStatus);
  }
  if (operatorId !== undefined) {
    conditions.push("operator_id = ?");
    queryParams.push(operatorId);
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
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            operator_id AS operatorId, auditor_id AS auditorId,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_order
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM purchase_order ${where}`,
    queryParams
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 采购订单详情（含明细） ==========
export async function getPurchaseOrderDetail(id: number, tenantId: string) {
  const order = await queryOne<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (!order) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  const items = await query<any>(
    `SELECT id, order_no AS orderNo, sku_id AS skuId, sku_name AS skuName, barcode,
            box_qty AS boxQty, bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, tax_rate AS taxRate,
            subtotal_amount AS subtotalAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            in_stocked_qty AS inStockedQty, remark
     FROM purchase_order_item WHERE order_no = ?`,
    [order.orderNo]
  );
  return { ...order, items };
}

// ========== 新建采购订单 ==========
export async function createPurchaseOrder(params: {
  supplierId: number;
  storeId: number;
  tenantId: string;
  operatorId: number;
  expectedDate?: string;
  remark?: string;
  items: Array<{
    skuId: number;
    skuName: string;
    barcode?: string;
    boxQty: number;
    bottleQty: number;
    totalBottleQty: number;
    unitPrice: number;
    taxRate: number;
    remark?: string;
  }>;
}) {
  const { supplierId, storeId, tenantId, operatorId, expectedDate, remark, items } = params;

  // 获取供应商信息
  const supplier = await queryOne<any>(
    "SELECT id, name, tax_rate FROM supplier WHERE id = ? AND tenant_id = ?",
    [supplierId, tenantId]
  );
  if (!supplier) {
    throw Object.assign(new Error("供应商不存在"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    const orderNo = makeBizNo("CG");
    let goodsAmount = 0;
    let taxAmount = 0;

    for (const item of items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      goodsAmount += subtotal;
      taxAmount += tax;
    }

    const payableAmount = goodsAmount + taxAmount;

    const [orderResult] = await conn.execute<any>(
      `INSERT INTO purchase_order (order_no, supplier_id, supplier_name, store_id, order_status,
        goods_amount, tax_amount, discount_amount, payable_amount, paid_amount, unpaid_amount,
        expected_date, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, 0, ?, 0, ?, ?, ?, ?, ?)`,
      [orderNo, supplierId, supplier.name, storeId,
       goodsAmount, taxAmount, payableAmount, payableAmount,
       expectedDate ?? null, operatorId, remark ?? null, tenantId]
    );

    for (const item of items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      const total = subtotal + tax;
      await conn.execute(
        `INSERT INTO purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty,
          total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.barcode ?? null,
         item.boxQty, item.bottleQty, item.totalBottleQty,
         item.unitPrice, item.taxRate, subtotal, tax, total, item.remark ?? null]
      );
    }

    return { orderId: orderResult.insertId as number, orderNo };
  });
  return result;
}

// ========== 修改采购订单 ==========
export async function updatePurchaseOrder(id: number, params: {
  tenantId: string;
  expectedDate?: string;
  remark?: string;
  items?: Array<{
    skuId: number;
    skuName: string;
    barcode?: string;
    boxQty: number;
    bottleQty: number;
    totalBottleQty: number;
    unitPrice: number;
    taxRate: number;
    remark?: string;
  }>;
}) {
  const { tenantId, expectedDate, remark, items } = params;

  const existing = await queryOne<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  if (!["DRAFT", "PENDING"].includes(existing.orderStatus)) {
    throw Object.assign(new Error("当前状态不允许修改"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    const updates: string[] = [];
    const updateParams: unknown[] = [];

    if (expectedDate !== undefined) {
      updates.push("expected_date = ?");
      updateParams.push(expectedDate);
    }
    if (remark !== undefined) {
      updates.push("remark = ?");
      updateParams.push(remark);
    }

    // 如果传了items则重新计算金额
    if (items && items.length > 0) {
      let goodsAmount = 0;
      let taxAmount = 0;
      for (const item of items) {
        const subtotal = item.totalBottleQty * item.unitPrice;
        const tax = subtotal * (item.taxRate || 0);
        goodsAmount += subtotal;
        taxAmount += tax;
      }
      const payableAmount = goodsAmount + taxAmount;
      updates.push("goods_amount = ?", "tax_amount = ?", "payable_amount = ?", "unpaid_amount = ?");
      updateParams.push(goodsAmount, taxAmount, payableAmount, payableAmount);

      // 删除旧明细，重新插入
      await conn.execute("DELETE FROM purchase_order_item WHERE order_no = ?", [existing.orderNo]);
      for (const item of items) {
        const subtotal = item.totalBottleQty * item.unitPrice;
        const tax = subtotal * (item.taxRate || 0);
        const total = subtotal + tax;
        await conn.execute(
          `INSERT INTO purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty,
            total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [existing.orderNo, item.skuId, item.skuName, item.barcode ?? null,
           item.boxQty, item.bottleQty, item.totalBottleQty,
           item.unitPrice, item.taxRate, subtotal, tax, total, item.remark ?? null]
        );
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = NOW()");
      updateParams.push(id, tenantId);
      await conn.execute({ sql: `UPDATE purchase_order SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, values: updateParams } as any);
    }
  });

  return await queryOne<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
}

// ========== 取消采购订单 ==========
export async function cancelPurchaseOrder(id: number, tenantId: string) {
  const existing = await queryOne<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  if (!["DRAFT", "PENDING"].includes(existing.orderStatus)) {
    throw Object.assign(new Error("当前状态不允许取消"), { statusCode: 400 });
  }
  await query(
    "UPDATE purchase_order SET order_status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  return { orderId: id, orderNo: existing.orderNo };
}

// ========== 确认采购订单 ==========
export async function confirmPurchaseOrder(id: number, tenantId: string, auditorId: number) {
  const existing = await queryOne<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  if (existing.orderStatus !== "DRAFT" && existing.orderStatus !== "PENDING") {
    throw Object.assign(new Error("当前状态不允许确认"), { statusCode: 400 });
  }
  await query(
    `UPDATE purchase_order SET order_status = 'APPROVED', auditor_id = ?, audited_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    [auditorId, id, tenantId]
  );
  return { orderId: id, orderNo: existing.orderNo, orderStatus: "APPROVED" };
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

  const order = await queryOne<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus
     FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
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
    const remainingQty = Number((remaining as any)[0]?.[0]?.remainingQty ?? 0);
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
  const stock = await queryOne<any>(
    `SELECT id, stock_no AS stockNo, order_no AS orderNo, supplier_id AS supplierId,
            supplier_name AS supplierName, store_id AS storeId, stock_status AS stockStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt
     FROM purchase_in_stock WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
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

  const supplier = await queryOne<any>(
    "SELECT id, name FROM supplier WHERE id = ? AND tenant_id = ?",
    [supplierId, tenantId]
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

    const [returnResult] = await conn.execute<any>(
      `INSERT INTO purchase_return (return_no, order_no, stock_no, supplier_id, supplier_name, store_id,
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
        `INSERT INTO purchase_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty,
          total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnNo, item.skuId, item.skuName, item.boxQty, item.bottleQty, item.totalBottleQty,
         item.unitPrice, item.taxRate, subtotal, tax, total, item.reason ?? null]
      );

      // 扣减库存
      await conn.execute(
        `UPDATE inventory_balance
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
  const records = await query<any>(
    `SELECT id, return_no AS returnNo, order_no AS orderNo, stock_no AS stockNo,
            supplier_id AS supplierId, supplier_name AS supplierName, store_id AS storeId,
            return_status AS returnStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            refund_amount AS refundAmount, refunded_amount AS refundedAmount,
            operator_id AS operatorId, remark, created_at AS createdAt
     FROM purchase_return
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM purchase_return ${where}`,
    queryParams
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}