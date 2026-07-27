import { queryWithTenant, queryOneWithTenant, executeWithTenant } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";

export interface QuickEntryData {
  name: string;
  icon: string;
  route: string;
  group?: string;
  enabled?: boolean;
  visibleRoles?: string[];
}

/** 快捷入口行（visible_roles 可能是 JSON 字符串或已解析数组） */
interface QuickEntryRow {
  id: number | string;
  name: string;
  icon: string;
  route: string;
  group: string | null;
  enabled: number | string;
  visibleRoles: string | string[] | null;
  sortOrder: number | string;
  tenantId: string;
}

/** 下一排序值行（COALESCE(MAX(sort_order), 0) + 1） */
interface NextOrderRow {
  nextOrder: number | string;
}

export async function listQuickEntries(tenantId: string, role?: string) {
  const records = await queryWithTenant<QuickEntryRow>(
    `SELECT id, name, icon, route, group_name AS \`group\`, enabled, 
            visible_roles AS visibleRoles, sort_order AS sortOrder, tenant_id AS tenantId
     FROM t_quick_entries
     WHERE tenant_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [tenantId],
    tenantId
  );

  // 按角色过滤：如果指定了角色，只返回该角色可见的入口
  if (role) {
    return records.filter((entry: QuickEntryRow) => {
      if (!entry.visibleRoles) return true;
      let roles: string[] = [];
      if (typeof entry.visibleRoles === "string") {
        try { roles = JSON.parse(entry.visibleRoles); } catch { roles = []; }
      } else if (Array.isArray(entry.visibleRoles)) {
        roles = entry.visibleRoles;
      }
      return roles.length === 0 || roles.includes(role);
    });
  }

  return records;
}

export async function createQuickEntry(tenantId: string, data: QuickEntryData) {
  const sortOrderRow = await queryOneWithTenant<NextOrderRow>(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM t_quick_entries WHERE tenant_id = ?`,
    [tenantId],
    tenantId
  );
  const sortOrder = Number(sortOrderRow?.nextOrder ?? 1);

  const [result] = await queryWithTenant<ResultSetHeader>(
    `INSERT INTO t_quick_entries (name, icon, route, group_name, enabled, visible_roles, sort_order, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.icon,
      data.route,
      data.group ?? "",
      data.enabled !== false ? 1 : 0,
      JSON.stringify(data.visibleRoles ?? []),
      sortOrder,
      tenantId
    ],
    tenantId
  );

  return { id: (result as unknown as Record<string, unknown>)?.insertId };
}

export async function updateQuickEntry(tenantId: string, id: number, data: Partial<QuickEntryData>) {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { sets.push("name = ?"); params.push(data.name); }
  if (data.icon !== undefined) { sets.push("icon = ?"); params.push(data.icon); }
  if (data.route !== undefined) { sets.push("route = ?"); params.push(data.route); }
  if (data.group !== undefined) { sets.push("group_name = ?"); params.push(data.group); }
  if (data.enabled !== undefined) { sets.push("enabled = ?"); params.push(data.enabled ? 1 : 0); }
  if (data.visibleRoles !== undefined) { sets.push("visible_roles = ?"); params.push(JSON.stringify(data.visibleRoles)); }

  if (sets.length === 0) return { updated: false };

  params.push(id, tenantId);

  await executeWithTenant(
    `UPDATE t_quick_entries SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    params,
    tenantId
  );

  return { updated: true };
}

export async function deleteQuickEntry(tenantId: string, id: number) {
  await executeWithTenant(
    `DELETE FROM t_quick_entries WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return { deleted: true };
}

export async function sortQuickEntries(tenantId: string, ids: number[]) {
  for (let i = 0; i < ids.length; i++) {
    await executeWithTenant(
      `UPDATE t_quick_entries SET sort_order = ? WHERE id = ? AND tenant_id = ?`,
      [i, ids[i], tenantId],
      tenantId
    );
  }
  return { sorted: true };
}