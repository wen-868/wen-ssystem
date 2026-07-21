import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export interface CustomerTypeRow {
  id: number;
  name: string;
  code: string;
  sort: number;
  status: number;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * 查询客户类型列表
 * @param params.status 可选，按状态过滤：1=启用，0=禁用
 */
export async function list(params: { status?: number; tenantId: string }) {
  const { status, tenantId } = params;
  let sql = "SELECT id, name, code, sort, status, created_at, updated_at FROM t_customer_type WHERE tenant_id = ?";
  const sqlParams: unknown[] = [tenantId];

  if (status !== undefined) {
    sql += " AND status = ?";
    sqlParams.push(status);
  }
  sql += " ORDER BY sort ASC, id ASC";

  return queryWithTenant<CustomerTypeRow>(sql, sqlParams, tenantId);
}

/** 获取客户类型详情 */
export async function getById(id: number, tenantId: string) {
  return queryOneWithTenant<CustomerTypeRow>(
    "SELECT id, name, code, sort, status, created_at, updated_at FROM t_customer_type WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
}

/** 新增客户类型 */
export async function create(body: {
  name: string;
  code: string;
  sort?: number;
  status?: number;
}, tenantId: string) {
  // 检查编码是否已存在
  const existing = await queryOneWithTenant<CustomerTypeRow>(
    "SELECT id FROM t_customer_type WHERE code = ? AND tenant_id = ?",
    [body.code, tenantId],
    tenantId
  );
  if (existing) {
    throw Object.assign(new Error("类型编码已存在"), { statusCode: 400 });
  }

  const result = await queryWithTenant<{ insertId: number }>(
    `INSERT INTO t_customer_type (name, code, sort, status, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.name, body.code, body.sort ?? 0, body.status ?? 1, tenantId],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

/** 修改客户类型 */
export async function update(id: number, body: {
  name?: string;
  code?: string;
  sort?: number;
  status?: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<CustomerTypeRow>(
    "SELECT id FROM t_customer_type WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("客户类型不存在"), { statusCode: 404 });
  }

  // 如果修改了编码，检查新编码是否与其他记录冲突
  if (body.code !== undefined && body.code !== null) {
    const codeExists = await queryOneWithTenant<CustomerTypeRow>(
      "SELECT id FROM t_customer_type WHERE code = ? AND tenant_id = ? AND id != ?",
      [body.code, tenantId, id],
      tenantId
    );
    if (codeExists) {
      throw Object.assign(new Error("类型编码已存在"), { statusCode: 400 });
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.code !== undefined) { sets.push("code = ?"); params.push(body.code); }
  if (body.sort !== undefined) { sets.push("sort = ?"); params.push(body.sort); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length === 0) return { id };

  params.push(id, tenantId);
  await queryWithTenant(
    `UPDATE t_customer_type SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    params,
    tenantId
  );
  return { id };
}

/** 删除客户类型 */
export async function remove(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<CustomerTypeRow>(
    "SELECT id FROM t_customer_type WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("客户类型不存在"), { statusCode: 404 });
  }

  await queryWithTenant(
    "DELETE FROM t_customer_type WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  return { id };
}
