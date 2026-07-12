import { queryWithTenant, queryOneWithTenant, executeWithTenant } from "../../shared/db";

export interface TodoData {
  title: string;
  type: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate?: string;
  remark?: string;
  source?: string;
}

export async function listTodos(
  tenantId: string,
  page: number,
  pageSize: number,
  type?: string,
  priority?: string,
  status?: string
) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (priority) {
    conditions.push("priority = ?");
    params.push(priority);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<any>(
    `SELECT id, title, type, source, priority, status, due_date AS dueDate,
            remark, tenant_id AS tenantId, created_at AS createdAt
     FROM todos
     ${where}
     ORDER BY 
       CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END,
       created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM todos ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getTodoStats(tenantId: string) {
  const rows = await queryWithTenant<any>(
    `SELECT type, COUNT(*) AS count
     FROM todos
     WHERE tenant_id = ? AND status = 'PENDING'
     GROUP BY type`,
    [tenantId],
    tenantId
  );

  const typeMap: Record<string, string> = {
    inventory_alert: "库存预警",
    order_pending: "订单待处理",
    payment_overdue: "支付逾期",
    purchase_approval: "采购审批",
    return_pending: "退货待处理",
    customer_followup: "客户跟进"
  };

  const stats: Record<string, number> = {};
  for (const key of Object.keys(typeMap)) {
    stats[key] = 0;
  }
  for (const row of rows) {
    stats[row.type] = Number(row.count);
  }

  return Object.entries(typeMap).map(([type, label]) => ({
    type,
    label,
    count: stats[type] ?? 0
  }));
}

export async function createTodo(tenantId: string, data: TodoData) {
  const [result] = await queryWithTenant<any>(
    `INSERT INTO todos (title, type, source, priority, status, due_date, remark, tenant_id, created_at)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, NOW())`,
    [
      data.title,
      data.type,
      data.source ?? "",
      data.priority,
      data.dueDate ?? null,
      data.remark ?? "",
      tenantId
    ],
    tenantId
  );

  return { id: (result as unknown as Record<string, unknown>)?.insertId };
}

export async function completeTodo(tenantId: string, id: number) {
  await executeWithTenant(
    `UPDATE todos SET status = 'COMPLETED' WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return { completed: true };
}

export async function dismissTodo(tenantId: string, id: number) {
  await executeWithTenant(
    `UPDATE todos SET status = 'DISMISSED' WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return { dismissed: true };
}

export async function deleteTodo(tenantId: string, id: number) {
  await executeWithTenant(
    `DELETE FROM todos WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return { deleted: true };
}