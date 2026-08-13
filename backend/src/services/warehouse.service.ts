/**
 * 仓库管理服务
 * 仓库与门店同表（t_store），通过 store_type = 'WAREHOUSE' 区分。
 */
import { query, queryOne } from "../shared/db";
import { AppError } from "../shared/app-error";
import { makeBizNo } from "../shared/id";

interface WarehouseRow {
  id: number;
  storeCode: string;
  name: string;
  address: string | null;
  contact: string | null;
  phone: string | null;
  status: number | string;
}

export async function listWarehouses(tenantId: string): Promise<WarehouseRow[]> {
  return query<WarehouseRow>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, status
     FROM t_store
     WHERE tenant_id = ? AND store_type = 'WAREHOUSE'
     ORDER BY id ASC`,
    [tenantId]
  );
}

export async function createWarehouse(body: {
  name: string;
  address?: string;
  contact?: string;
  phone?: string;
}, tenantId: string): Promise<{ id: number }> {
  if (!body.name) {
    throw new AppError("仓库名称不能为空", 400);
  }
  const storeCode = makeBizNo("WH");
  const result = await query<{ insertId: number }>(
    `INSERT INTO t_store (tenant_id, store_code, store_name, store_type, name, address, contact, phone, status, is_default)
     VALUES (?, ?, ?, 'WAREHOUSE', ?, ?, ?, ?, 1, 0)`,
    [tenantId, storeCode, body.name, body.name, body.address || "", body.contact || "", body.phone || ""]
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

export async function updateWarehouse(id: number, body: {
  name?: string;
  address?: string;
  contact?: string;
  phone?: string;
  status?: number;
}, tenantId: string): Promise<void> {
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM t_store WHERE id = ? AND tenant_id = ? AND store_type = 'WAREHOUSE'",
    [id, tenantId]
  );
  if (!existing) {
    throw new AppError("仓库不存在", 404);
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?", "store_name = ?"); params.push(body.name, body.name); }
  if (body.address !== undefined) { sets.push("address = ?"); params.push(body.address); }
  if (body.contact !== undefined) { sets.push("contact = ?"); params.push(body.contact); }
  if (body.phone !== undefined) { sets.push("phone = ?"); params.push(body.phone); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE t_store SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, tenantId]);
}

export async function deleteWarehouse(id: number, tenantId: string): Promise<void> {
  await query(
    "DELETE FROM t_store WHERE id = ? AND tenant_id = ? AND store_type = 'WAREHOUSE'",
    [id, tenantId]
  );
}
