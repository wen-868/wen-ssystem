import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

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
  const records = await queryWithTenant<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            operator_id AS operatorId, auditor_id AS auditorId,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM t_purchase_order
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_purchase_order ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 采购订单详情（含明细） ==========
export async function getPurchaseOrderDetail(id: number, tenantId: string) {
  const order = await queryOneWithTenant<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM t_purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!order) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  const items = await queryWithTenant<any>(
    `SELECT id, order_no AS orderNo, sku_id AS skuId, sku_name AS skuName, barcode,
            box_qty AS boxQty, bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, tax_rate AS taxRate,
            subtotal_amount AS subtotalAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            in_stocked_qty AS inStockedQty, remark
     FROM t_purchase_order_item WHERE order_no = ?`,
    [order.orderNo],
    tenantId
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
  const supplier = await queryOneWithTenant<any>(
    "SELECT id, name, tax_rate FROM supplier WHERE id = ? AND tenant_id = ?",
    [supplierId, tenantId],
    tenantId
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
      `INSERT INTO t_purchase_order (order_no, supplier_id, supplier_name, store_id, order_status,
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
        `INSERT INTO t_purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty,
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

  const existing = await queryOneWithTenant<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM t_purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
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
      await conn.execute("DELETE FROM t_purchase_order_item WHERE order_no = ?", [existing.orderNo]);
      for (const item of items) {
        const subtotal = item.totalBottleQty * item.unitPrice;
        const tax = subtotal * (item.taxRate || 0);
        const total = subtotal + tax;
        await conn.execute(
          `INSERT INTO t_purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty,
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
      await conn.execute({ sql: `UPDATE t_purchase_order SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, values: updateParams } as { sql: string; values: unknown[] });
    }
  });

  return await queryOneWithTenant<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM t_purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
}

// ========== 取消采购订单 ==========
export async function cancelPurchaseOrder(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM t_purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  if (!["DRAFT", "PENDING"].includes(existing.orderStatus)) {
    throw Object.assign(new Error("当前状态不允许取消"), { statusCode: 400 });
  }
  await queryWithTenant(
    "UPDATE t_purchase_order SET order_status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  return { orderId: id, orderNo: existing.orderNo };
}

// ========== 确认采购订单 ==========
export async function confirmPurchaseOrder(id: number, tenantId: string, auditorId: number) {
  const existing = await queryOneWithTenant<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM t_purchase_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("采购订单不存在"), { statusCode: 404 });
  }
  if (existing.orderStatus !== "DRAFT" && existing.orderStatus !== "PENDING") {
    throw Object.assign(new Error("当前状态不允许确认"), { statusCode: 400 });
  }
  await queryWithTenant(
    `UPDATE t_purchase_order SET order_status = 'APPROVED', auditor_id = ?, audited_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    [auditorId, id, tenantId],
    tenantId
  );
  return { orderId: id, orderNo: existing.orderNo, orderStatus: "APPROVED" };
}