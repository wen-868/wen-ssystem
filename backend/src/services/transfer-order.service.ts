import { queryWithTenant, queryOneWithTenant, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";

export interface TransferOrderItem {
  skuId: number;
  skuName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateTransferOrderParams {
  tenantId: string;
  userId: number | null;
  fromStoreId: number;
  toStoreId: number;
  expectedDate?: string;
  remark: string;
  items: TransferOrderItem[];
}

export async function createTransferOrder(params: CreateTransferOrderParams) {
  const { tenantId, userId, fromStoreId, toStoreId, expectedDate, remark, items } = params;

  if (fromStoreId === toStoreId) {
    throw new Error("调出门店和调入门店不能相同");
  }

  const transferNo = makeBizNo("DB");

  const result = await transaction(async (conn) => {
    let totalAmount = 0;
    const totalItems = items.length;
    for (const item of items) {
      totalAmount += item.quantity * item.unitPrice;
    }

    const [insertResult] = await conn.execute(
      `INSERT INTO transfer_order (transfer_no, from_store_id, to_store_id, status, expected_date, total_amount, total_items, remark, created_by, tenant_id)
       VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
      [transferNo, fromStoreId, toStoreId, expectedDate ?? null, totalAmount, totalItems, remark, userId ?? null, tenantId] as any[]
    );
    const orderId = (insertResult as any).insertId;

    for (const item of items) {
      const subtotal = item.quantity * item.unitPrice;
      await conn.execute(
        `INSERT INTO transfer_order_item (transfer_order_id, sku_id, sku_name, quantity, unit_price, subtotal, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.skuId, item.skuName, item.quantity, item.unitPrice, subtotal, tenantId] as any[]
      );
    }

    return orderId;
  });

  return { transferOrderId: result, transferNo };
}

export interface ListTransferOrdersParams {
  tenantId: string;
  page: number;
  pageSize: number;
  status?: string;
  storeId?: number;
  dateStart?: string;
  dateEnd?: string;
}

export async function listTransferOrders(params: ListTransferOrdersParams) {
  const { tenantId, page, pageSize, status, storeId, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["to.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (status) {
    conditions.push("to.status = ?");
    values.push(status);
  }
  if (storeId !== undefined) {
    conditions.push("(to.from_store_id = ? OR to.to_store_id = ?)");
    values.push(storeId, storeId);
  }
  if (dateStart) {
    conditions.push("to.created_at >= ?");
    values.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("to.created_at <= ?");
    values.push(dateEnd + " 23:59:59");
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<any>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM transfer_order to
     LEFT JOIN store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE ${where}
     ORDER BY to.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM transfer_order to WHERE ${where}`,
    values,
    tenantId
  );

  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function getTransferStatistics(tenantId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const monthTotal = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS total FROM transfer_order WHERE created_at >= ?",
    [monthStartStr],
    tenantId
  );

  const transitCount = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS total FROM transfer_order WHERE status = 'TRANSIT'",
    [],
    tenantId
  );

  const receivedCount = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS total FROM transfer_order WHERE status = 'RECEIVED'",
    [],
    tenantId
  );

  return {
    monthTotal: monthTotal?.total ?? 0,
    transitCount: transitCount?.total ?? 0,
    receivedCount: receivedCount?.total ?? 0
  };
}

export async function getTransferOrderDetail(id: number, tenantId: string) {
  const order = await queryOneWithTenant<any>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM transfer_order to
     LEFT JOIN store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE to.id = ?`,
    [id],
    tenantId
  );

  if (!order) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }

  const items = await queryWithTenant<any>(
    "SELECT * FROM transfer_order_item WHERE transfer_order_id = ?",
    [id],
    tenantId
  );

  return { ...order, items };
}

export interface UpdateTransferOrderParams {
  expectedDate?: string;
  remark?: string;
  items?: TransferOrderItem[];
}

export async function updateTransferOrder(id: number, tenantId: string, params: UpdateTransferOrderParams) {
  const { expectedDate, remark, items } = params;

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "DRAFT") throw new Error("仅草稿状态可编辑");

    const sets: string[] = [];
    const values: unknown[] = [];
    if (expectedDate !== undefined) { sets.push("expected_date = ?"); values.push(expectedDate); }
    if (remark !== undefined) { sets.push("remark = ?"); values.push(remark); }
    if (sets.length > 0) {
      values.push(id, tenantId);
      await conn.execute(`UPDATE transfer_order SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values as any[]);
    }

    if (items && items.length > 0) {
      await conn.execute("DELETE FROM transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?", [id, tenantId]);
      let totalAmount = 0;
      for (const item of items) {
        const subtotal = item.quantity * item.unitPrice;
        totalAmount += subtotal;
        await conn.execute(
          `INSERT INTO transfer_order_item (transfer_order_id, sku_id, sku_name, quantity, unit_price, subtotal, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, item.skuId, item.skuName, item.quantity, item.unitPrice, subtotal, tenantId] as any[]
        );
      }
      await conn.execute("UPDATE transfer_order SET total_amount = ?, total_items = ? WHERE id = ? AND tenant_id = ?", [totalAmount, items.length, id, tenantId] as any[]);
    }
  });

  return { transferOrderId: id };
}

export async function submitTransferOrder(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "DRAFT") throw new Error("仅草稿状态可提交");

    await conn.execute(
      "UPDATE transfer_order SET status = 'PENDING' WHERE id = ? AND tenant_id = ?",
      [id, tenantId] as any[]
    );
  });

  return { transferOrderId: id };
}

export async function approveTransferOrder(id: number, tenantId: string, userId: number | null) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "PENDING") throw new Error("仅待审核状态可审批");

    await conn.execute(
      "UPDATE transfer_order SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ? AND tenant_id = ?",
      [userId ?? null, id, tenantId] as any[]
    );
  });

  return { transferOrderId: id };
}

export async function rejectTransferOrder(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "PENDING") throw new Error("仅待审核状态可拒绝");

    await conn.execute(
      "UPDATE transfer_order SET status = 'DRAFT', approved_by = NULL, approved_at = NULL WHERE id = ? AND tenant_id = ?",
      [id, tenantId] as any[]
    );
  });

  return { transferOrderId: id };
}
