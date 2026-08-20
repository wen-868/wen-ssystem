import { query } from "../../shared/db";

/**
 * 历史单据统一查询（单据管理）：
 * 销售单 / 销售订单 / 采购订单 / 采购入库单，按日期与类型筛选查看已完成单据。
 */
export interface HistoryBillRow {
  billType: string;
  billNo: string;
  partyName: string;
  amount: number;
  status: string;
  createdAt: Date | string;
}

export const BILL_TYPE_LABELS: Record<string, string> = {
  sale_bill: "销售单",
  sale_order: "销售订单",
  purchase_order: "采购订单",
  purchase_in_stock: "采购入库",
};

export async function listHistoryBills(params: {
  tenantId: string;
  billType?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}): Promise<{ records: HistoryBillRow[]; total: number; page: number; pageSize: number }> {
  const { tenantId, billType, startDate, endDate, keyword, page, pageSize } = params;
  const start = startDate ? `${startDate} 00:00:00` : null;
  const end = endDate ? `${endDate} 23:59:59` : null;

  // 每支子查询统一追加租户 + 日期条件（4 个参数：tenant, start, start, end, end 的 ? IS NULL 写法）
  const dateCond =
    " AND (? IS NULL OR created_at >= ?) AND (? IS NULL OR created_at <= ?)";
  const dateArgs = (): unknown[] => [start, start, end, end];

  const parts: string[] = [];
  const args: unknown[] = [];

  const pushPart = (type: string, sql: string, extraArgs: unknown[]) => {
    parts.push(sql);
    args.push(...extraArgs);
  };

  if (!billType || billType === "sale_bill") {
    // 销售单：已开出且未作废（CREATED 为有效状态）
    pushPart(
      "sale_bill",
      `SELECT 'sale_bill' AS billType, bill_no AS billNo, customer_name AS partyName,
              receivable_amount AS amount, collection_status AS status, created_at AS createdAt
       FROM t_sale_bill
       WHERE tenant_id = ? AND business_status = 'CREATED'${dateCond}`,
      [tenantId, ...dateArgs()]
    );
  }

  if (!billType || billType === "sale_order") {
    // 销售订单：已完成订单
    pushPart(
      "sale_order",
      `SELECT 'sale_order' AS billType, order_no AS billNo, receiver_name AS partyName,
              payable_amount AS amount, order_status AS status, created_at AS createdAt
       FROM t_miniapp_order
       WHERE tenant_id = ? AND order_status = 'COMPLETED'${dateCond}`,
      [tenantId, ...dateArgs()]
    );
  }

  if (!billType || billType === "purchase_order") {
    // 采购订单：已确认（含部分/完成），排除草稿与取消
    pushPart(
      "purchase_order",
      `SELECT 'purchase_order' AS billType, order_no AS billNo, supplier_name AS partyName,
              payable_amount AS amount, order_status AS status, created_at AS createdAt
       FROM t_purchase_order
       WHERE tenant_id = ? AND order_status NOT IN ('DRAFT', 'CANCELLED')${dateCond}`,
      [tenantId, ...dateArgs()]
    );
  }

  if (!billType || billType === "purchase_in_stock") {
    // 采购入库：已完成入库
    pushPart(
      "purchase_in_stock",
      `SELECT 'purchase_in_stock' AS billType, stock_no AS billNo, supplier_name AS partyName,
              total_amount AS amount, stock_status AS status, created_at AS createdAt
       FROM t_purchase_in_stock
       WHERE tenant_id = ? AND stock_status = 'COMPLETED'${dateCond}`,
      [tenantId, ...dateArgs()]
    );
  }

  if (parts.length === 0) {
    return { records: [], total: 0, page, pageSize };
  }

  const unionSql = parts.join("\nUNION ALL\n");
  const kw = keyword ? `%${keyword}%` : "";
  const kwCond = "WHERE (? = '' OR billNo LIKE ? OR partyName LIKE ?)";

  const totalRow = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM (${unionSql}) t ${kwCond}`,
    [...args, kw, kw, kw]
  );
  const total = Number(totalRow?.[0]?.total ?? 0);

  const offset = (page - 1) * pageSize;
  const rows = await query<HistoryBillRow>(
    `SELECT billType, billNo, partyName, amount, status, createdAt
     FROM (${unionSql}) t ${kwCond}
     ORDER BY createdAt DESC, billNo DESC
     LIMIT ? OFFSET ?`,
    [...args, kw, kw, kw, pageSize, offset]
  );

  return {
    records: rows.map((r) => ({
      ...r,
      amount: Number(r.amount ?? 0),
    })),
    total,
    page,
    pageSize,
  };
}
