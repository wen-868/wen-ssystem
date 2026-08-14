import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

interface UnitGroupRow {
  id: number; name: string; status: number; tenant_id: string;
  created_at: string; updated_at: string;
}

interface UnitGroupItemRow {
  id: number; group_id: number; name: string; level: number;
  conversion_rate: number; status: number;
  created_at: string; updated_at: string;
}

export interface UnitGroupItem {
  id?: number;
  name: string;
  level: number;
  conversionRate: number;
  status: number;
}

export interface UnitGroupData {
  id?: number;
  name: string;
  status: number;
  items: UnitGroupItem[];
}

/** 查询单位组列表（含层级明细） */
export async function listGroups(tenantId: string, params?: { keyword?: string; status?: string }) {
  let sql = "SELECT id, name, status, created_at, updated_at FROM t_unit_group WHERE tenant_id = ?";
  const sqlParams: unknown[] = [tenantId];

  if (params?.keyword) {
    sql += " AND name LIKE ?";
    sqlParams.push(`%${params.keyword}%`);
  }
  if (params?.status === "active") {
    sql += " AND status = 1";
  } else if (params?.status === "inactive") {
    sql += " AND status = 0";
  }

  sql += " ORDER BY id ASC";
  const groups = await queryWithTenant<UnitGroupRow>(sql, sqlParams, tenantId);

  // 加载每个组的明细
  const result: UnitGroupData[] = [];
  for (const g of groups) {
    const items = await queryWithTenant<UnitGroupItemRow>(
      "SELECT id, group_id, name, level, conversion_rate, status, created_at, updated_at FROM t_unit_group_item WHERE group_id = ? ORDER BY level ASC",
      [g.id], tenantId
    );
    result.push({
      id: g.id,
      name: g.name,
      status: g.status,
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        level: i.level,
        conversionRate: Number(i.conversion_rate),
        status: i.status,
      })),
    });
  }
  return result;
}

/** 获取单个单位组 */
export async function getGroup(id: number, tenantId: string) {
  const g = await queryOneWithTenant<UnitGroupRow>(
    "SELECT id, name, status, created_at, updated_at FROM t_unit_group WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!g) throw Object.assign(new Error("单位组不存在"), { statusCode: 404 });

  const items = await queryWithTenant<UnitGroupItemRow>(
    "SELECT id, group_id, name, level, conversion_rate, status, created_at, updated_at FROM t_unit_group_item WHERE group_id = ? ORDER BY level ASC",
    [id], tenantId
  );
  return {
    id: g.id,
    name: g.name,
    status: g.status,
    items: items.map(i => ({
      id: i.id,
      name: i.name,
      level: i.level,
      conversionRate: Number(i.conversion_rate),
      status: i.status,
    })),
  };
}

/** 创建单位组（含层级明细） */
export async function createGroup(body: { name: string; items: UnitGroupItem[] }, tenantId: string) {
  const result = await queryWithTenant<{ insertId: number }>(
    "INSERT INTO t_unit_group (name, tenant_id, status) VALUES (?, ?, 1)",
    [body.name, tenantId], tenantId
  );
  const groupId = (result as unknown as unknown as { insertId: number }).insertId;

  if (body.items && body.items.length > 0) {
    await insertItems(groupId, body.items, tenantId);
  }
  return { id: groupId };
}

/** 更新单位组 */
export async function updateGroup(id: number, body: { name?: string; status?: number; items?: UnitGroupItem[] }, tenantId: string) {
  const g = await queryOneWithTenant<UnitGroupRow>(
    "SELECT id FROM t_unit_group WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!g) throw Object.assign(new Error("单位组不存在"), { statusCode: 404 });

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length > 0) {
    params.push(id, tenantId);
    await queryWithTenant(
      `UPDATE t_unit_group SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
      params, tenantId
    );
  }

  // 更新层级明细：先删后插
  if (body.items !== undefined) {
    await queryWithTenant("DELETE FROM t_unit_group_item WHERE group_id = ?", [id], tenantId);
    await insertItems(id, body.items, tenantId);
  }
  return { id };
}

/** 删除单位组 */
export async function deleteGroup(id: number, tenantId: string) {
  const g = await queryOneWithTenant<UnitGroupRow>(
    "SELECT id FROM t_unit_group WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!g) throw Object.assign(new Error("单位组不存在"), { statusCode: 404 });

  await queryWithTenant("DELETE FROM t_unit_group WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}

/** 批量插入层级明细 */
async function insertItems(groupId: number, items: UnitGroupItem[], tenantId: string) {
  for (const item of items) {
    await queryWithTenant(
      "INSERT INTO t_unit_group_item (group_id, name, level, conversion_rate, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
      [groupId, item.name, item.level, item.conversionRate ?? 1, item.status ?? 1, tenantId],
      tenantId
    );
  }
}