import { query, queryOne } from "../../shared/db.js";

export async function getAllConfigs(tenantId: string) {
  const records = await query<any>(
    `SELECT id, config_key AS configKey, config_value AS configValue,
            config_group AS configGroup, description, updated_at AS updatedAt
     FROM t_sys_config
     WHERE tenant_id = ?
     ORDER BY config_group, id`,
    [tenantId]
  );
  const grouped: Record<string, any[]> = {};
  for (const r of records) {
    const group = r.configGroup || "other";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(r);
  }
  return { all: records, grouped };
}

export async function getConfigByGroup(group: string, tenantId: string) {
  const records = await query<any>(
    `SELECT id, config_key AS configKey, config_value AS configValue,
            config_group AS configGroup, description, updated_at AS updatedAt
     FROM t_sys_config
     WHERE config_group = ? AND tenant_id = ?
     ORDER BY id`,
    [group, tenantId]
  );
  return records;
}

export async function batchUpdateConfigs(items: Array<{ config_key: string; config_value: string }>, tenantId: string) {
  for (const item of items) {
    const existing = await queryOne<any>(
      "SELECT id FROM t_sys_config WHERE config_key = ? AND tenant_id = ?",
      [item.config_key, tenantId]
    );
    if (existing) {
      await query(
        `UPDATE t_sys_config SET config_value = ? WHERE config_key = ? AND tenant_id = ?`,
        [item.config_value, item.config_key, tenantId]
      );
    } else {
      await query(
        `INSERT INTO t_sys_config (config_key, config_value, config_group, description, tenant_id)
         VALUES (?, ?, 'other', '', ?)`,
        [item.config_key, item.config_value, tenantId]
      );
    }
  }
  return { updated: items.length };
}

export async function createConfig(body: {
  config_key: string;
  config_value: string;
  config_group: string;
  description: string;
}, tenantId: string) {
  await query(
    `INSERT INTO t_sys_config (config_key, config_value, config_group, description, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.config_key, body.config_value, body.config_group, body.description, tenantId]
  );
  return { configKey: body.config_key };
}