import { query, queryOne } from "../../shared/db.js";

export async function listOrders(
  page: number,
  pageSize: number,
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const like = `%${keyword}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(like, like, like);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM miniapp_order ${where}`,
    params
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function exportOrdersCsv(
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const like = `%${keyword}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(like, like, like);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT 1000`,
    params
  );
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["订单号", "门店ID", "客户类型", "履约方式", "订单状态", "支付状态", "金额", "收货人", "手机号", "创建时间"];
  const rows = records.map((row: any) => [
    row.orderNo,
    row.storeId,
    row.customerType,
    row.fulfillmentType,
    row.orderStatus,
    row.payStatus,
    row.payableAmount,
    row.receiverName,
    row.receiverMobile,
    row.createdAt
  ]);
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  return { csv, filename: `orders-${new Date().toISOString().slice(0, 10)}.csv` };
}

export async function getOrderDetail(orderNo: string, tenantId: string) {
  const order = await queryOne<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, created_at AS createdAt
     FROM miniapp_order WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId]
  );
  if (!order) return null;
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, qty AS quantity, unit_price AS unitPrice,
            subtotal_amount AS subtotalAmount
     FROM miniapp_order_item WHERE order_no = ?`,
    [orderNo]
  );
  return { ...order, items };
}

export async function getOrderStatusStats(tenantId: string) {
  const records = await query<any>(
    `SELECT order_status AS status, COUNT(*) AS count
     FROM miniapp_order
     WHERE tenant_id = ?
     GROUP BY order_status`,
    [tenantId]
  );
  return records;
}

export async function listSaleBills(
  page: number,
  pageSize: number,
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (keyword) {
    const like = `%${keyword}%`;
    conditions.push("(bill_no LIKE ? OR customer_name LIKE ?)");
    params.push(like, like);
  }
  if (status) {
    conditions.push("collection_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM sale_bill
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(`SELECT COUNT(*) AS total FROM sale_bill ${where}`, params);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function exportSaleBillsCsv(
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (keyword) {
    const like = `%${keyword}%`;
    conditions.push("(bill_no LIKE ? OR customer_name LIKE ?)");
    params.push(like, like);
  }
  if (status) {
    conditions.push("collection_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM sale_bill
     ${where}
     ORDER BY created_at DESC
     LIMIT 5000`,
    params
  );
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["销售单号", "门店ID", "客户名称", "客户手机", "应收金额", "已收金额", "未收金额", "收款状态", "业务状态", "创建时间"];
  const rows = records.map((row: any) => [
    row.billNo, row.storeId, row.customerName, row.customerMobile,
    row.receivableAmount, row.receivedAmount, row.unreceivedAmount,
    row.collectionStatus, row.businessStatus, row.createdAt
  ]);
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  return { csv, filename: `sale-bills-${new Date().toISOString().slice(0, 10)}.csv` };
}