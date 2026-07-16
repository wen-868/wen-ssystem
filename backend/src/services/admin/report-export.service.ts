import { queryWithTenant } from "../../shared/db";

type ReportType = "sales" | "collection" | "product" | "customer" | "inventory" | "purchase" | "finance" | "staff" | "dashboard";
type ExportFormat = "excel" | "csv";

interface ExportRequest {
  report_type: ReportType;
  format: ExportFormat;
  filters?: Record<string, any>;
  columns?: string[];
}

const reportQueries: Record<ReportType, (filters: Record<string, any>, tenantId: string) => { sql: string; params: unknown[] }> = {
  sales: (filters, tenantId) => {
    const conditions = ["tenant_id = ?", "business_status = 'CREATED'"];
    const params: unknown[] = [tenantId];
    if (filters.startDate) { conditions.push("created_at >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push("created_at <= ?"); params.push(filters.endDate); }
    if (filters.storeId) { conditions.push("store_id = ?"); params.push(filters.storeId); }
    return {
      sql: `SELECT bill_no AS billNo, customer_name AS customerName, customer_mobile AS customerMobile,
                   goods_amount AS goodsAmount, receivable_amount AS receivableAmount,
                   received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
                   collection_status AS collectionStatus, created_at AS createdAt
            FROM t_sale_bill WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    };
  },
  collection: (filters, tenantId) => {
    const conditions = ["tenant_id = ?"];
    const params: unknown[] = [tenantId];
    if (filters.startDate) { conditions.push("created_at >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push("created_at <= ?"); params.push(filters.endDate); }
    if (filters.storeId) { conditions.push("store_id = ?"); params.push(filters.storeId); }
    return {
      sql: `SELECT link_no AS linkNo, source_type AS sourceType, source_no AS sourceNo,
                   amount, paid_amount AS paidAmount, status, share_channel AS shareChannel,
                   expire_at AS expireAt, created_at AS createdAt
            FROM t_collection_link WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    };
  },
  product: (filters, tenantId) => {
    const conditions = ["sbi.tenant_id = ?"];
    const params: unknown[] = [tenantId];
    if (filters.startDate) { conditions.push("sbi.created_at >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push("sbi.created_at <= ?"); params.push(filters.endDate); }
    return {
      sql: `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
                   SUM(sbi.total_bottle_qty) AS totalQty,
                   SUM(sbi.subtotal_amount) AS totalAmount,
                   COUNT(DISTINCT sbi.bill_no) AS orderCount
            FROM t_sale_bill_item sbi
            WHERE ${conditions.join(" AND ")}
            GROUP BY sbi.sku_id, sbi.sku_name ORDER BY totalAmount DESC`,
      params,
    };
  },
  customer: (filters, tenantId) => {
    const conditions = ["sb.tenant_id = ?", "sb.business_status = 'CREATED'"];
    const params: unknown[] = [tenantId];
    if (filters.startDate) { conditions.push("sb.created_at >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push("sb.created_at <= ?"); params.push(filters.endDate); }
    return {
      sql: `SELECT sb.customer_id AS customerId, m.name AS customerName, m.mobile,
                   COUNT(DISTINCT sb.bill_no) AS orderCount,
                   COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
                   AVG(sb.receivable_amount) AS avgOrderValue,
                   MAX(sb.created_at) AS lastOrderDate
            FROM t_sale_bill sb
            LEFT JOIN t_member m ON m.id = sb.customer_id
            WHERE ${conditions.join(" AND ")} AND sb.customer_id IS NOT NULL
            GROUP BY sb.customer_id, m.name, m.mobile
            ORDER BY totalAmount DESC`,
      params,
    };
  },
  inventory: (filters, tenantId) => {
    const conditions = ["ib.tenant_id = ?"];
    const params: unknown[] = [tenantId];
    if (filters.storeId) { conditions.push("ib.store_id = ?"); params.push(filters.storeId); }
    return {
      sql: `SELECT ib.store_id AS storeId, s.name AS storeName, ib.sku_id AS skuId,
                   ps.sku_name AS skuName, ib.stock_type AS stockType,
                   ib.physical_qty AS physicalQty, ib.available_qty AS availableQty,
                   ib.locked_qty AS lockedQty
            FROM t_inventory_balance ib
            LEFT JOIN t_store s ON s.id = ib.store_id
            LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id
            WHERE ${conditions.join(" AND ")}
            ORDER BY ib.store_id, ib.sku_id`,
      params,
    };
  },
  purchase: (filters, tenantId) => {
    const conditions = ["tenant_id = ?", "order_status NOT IN ('VOIDED')"];
    const params: unknown[] = [tenantId];
    if (filters.startDate) { conditions.push("created_at >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push("created_at <= ?"); params.push(filters.endDate); }
    return {
      sql: `SELECT order_no AS orderNo, supplier_name AS supplierName,
                   goods_amount AS goodsAmount, payable_amount AS payableAmount,
                   paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
                   order_status AS orderStatus, created_at AS createdAt
            FROM t_purchase_order WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    };
  },
  finance: (filters, tenantId) => {
    const conditions = ["tenant_id = ?"];
    const params: unknown[] = [tenantId];
    if (filters.startDate) { conditions.push("created_at >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push("created_at <= ?"); params.push(filters.endDate); }
    return {
      sql: `SELECT expense_no AS expenseNo, expense_type AS expenseType, category,
                   amount, payee, payment_method AS paymentMethod,
                   status, expense_date AS expenseDate, created_at AS createdAt
            FROM expense WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    };
  },
  staff: (filters, tenantId) => {
    const conditions = ["sb.tenant_id = ?", "sb.business_status = 'CREATED'", "sb.operator_id IS NOT NULL"];
    const params: unknown[] = [tenantId];
    if (filters.startDate) { conditions.push("sb.created_at >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push("sb.created_at <= ?"); params.push(filters.endDate); }
    return {
      sql: `SELECT sb.operator_id AS staffId, u.real_name AS staffName,
                   COUNT(DISTINCT sb.bill_no) AS orderCount,
                   COALESCE(SUM(sb.receivable_amount), 0) AS totalSales,
                   COALESCE(SUM(sb.received_amount), 0) AS totalReceived
            FROM t_sale_bill sb
            LEFT JOIN t_sys_user u ON u.id = sb.operator_id
            WHERE ${conditions.join(" AND ")}
            GROUP BY sb.operator_id, u.real_name
            ORDER BY totalSales DESC`,
      params,
    };
  },
  dashboard: (_filters, tenantId) => {
    return {
      sql: `SELECT DATE(created_at) AS date,
                   COUNT(DISTINCT bill_no) AS orderCount,
                   COALESCE(SUM(receivable_amount), 0) AS totalSales,
                   COALESCE(SUM(received_amount), 0) AS totalReceived
            FROM t_sale_bill WHERE tenant_id = ? AND business_status = 'CREATED'
            GROUP BY DATE(created_at) ORDER BY date DESC`,
      params: [tenantId],
    };
  },
};

export async function exportReport(req: ExportRequest, tenantId: string) {
  const { report_type, format, filters = {}, columns } = req;
  const queryFactory = reportQueries[report_type];
  if (!queryFactory) throw new Error(`不支持的报表类型: ${report_type}`);
  const { sql, params } = queryFactory(filters, tenantId);
  const rows = await queryWithTenant<any>(sql, params, tenantId);
  if (rows.length > 10000) {
    return { async: true, totalRows: rows.length, message: "数据量超过10000行，将异步生成下载链接", downloadUrl: null };
  }
  if (format === "csv") {
    return generateCsv(rows, columns);
  }
  return generateExcel(rows, columns);
}

function generateCsv(rows: any[], columns?: string[]) {
  if (rows.length === 0) return { format: "csv", data: "", columns: [] };
  const keys = columns || Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows.map((row) => keys.map((k) => {
    const val = row[k] ?? "";
    const str = String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(","));
  const bom = "\uFEFF";
  return { format: "csv", data: bom + [header, ...body].join("\n"), columns: keys, rowCount: rows.length };
}

function generateExcel(rows: any[], columns?: string[]) {
  const keys = columns || (rows.length > 0 ? Object.keys(rows[0]) : []);
  return { format: "excel", data: rows, columns: keys, rowCount: rows.length, message: "Excel导出需由前端处理，后端返回JSON数据" };
}