import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** COUNT(*) AS cnt 通用返回 */
interface CountCntRow {
  cnt: number;
}

/** t_gift_rule 表行 */
interface GiftRuleRow {
  id: number | string;
  rule_code: string;
  rule_name: string;
  rule_desc: string | null;
  threshold_type: string;
  threshold_amount: number | string | null;
  threshold_quantity: number | string | null;
  applicable_scope: string;
  applicable_ids: string | null;
  start_time: string | Date;
  end_time: string | Date;
  gift_stock_limit: number | string | null;
  remain_gift_stock: number | string;
  is_stock_synced: number | string;
  tenant_id: string;
  created_by: number | string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** t_gift_rule_level 表行 */
interface GiftRuleLevelRow {
  id: number | string;
  rule_id: number | string;
  threshold_amount: number | string | null;
  gift_product_id: number | string;
  gift_sku_id: number | string | null;
  gift_quantity: number | string;
  sort_order: number | string;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 创建赠品规则入参 */
interface CreateGiftRuleBody {
  rule_name: string;
  rule_desc?: string | null;
  threshold_type?: string;
  threshold_amount?: number | string | null;
  threshold_quantity?: number | string | null;
  applicable_scope?: string;
  applicable_ids?: unknown;
  start_time: string;
  end_time: string;
  gift_stock_limit?: number | string | null;
  is_stock_synced?: number | string | boolean;
}

/** 更新赠品规则入参 */
interface UpdateGiftRuleBody {
  rule_name?: string;
  rule_desc?: string | null;
  threshold_type?: string;
  threshold_amount?: number | string | null;
  threshold_quantity?: number | string | null;
  applicable_scope?: string;
  applicable_ids?: unknown;
  start_time?: string;
  end_time?: string;
  gift_stock_limit?: number | string | null;
  is_stock_synced?: number | string | boolean;
}

/** 添加赠品规则层级入参 */
interface AddGiftRuleLevelBody {
  threshold_amount?: number | string | null;
  gift_product_id: number | string;
  gift_sku_id?: number | string | null;
  gift_quantity?: number | string;
  sort_order?: number | string;
}

/** 更新赠品规则层级入参 */
interface UpdateGiftRuleLevelBody {
  threshold_amount?: number | string | null;
  gift_product_id?: number | string;
  gift_sku_id?: number | string | null;
  gift_quantity?: number | string;
  sort_order?: number | string;
}

export async function createGiftRule(data: CreateGiftRuleBody, tenantId: string, userId: number) {
  const code = makeBizNo("MZ");
  const result = await queryWithTenant(
    `INSERT INTO t_gift_rule (rule_code, rule_name, rule_desc, threshold_type, threshold_amount, threshold_quantity, applicable_scope, applicable_ids, start_time, end_time, gift_stock_limit, remain_gift_stock, is_stock_synced, tenant_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, data.rule_name, data.rule_desc ?? null, data.threshold_type ?? "AMOUNT", data.threshold_amount ?? null, data.threshold_quantity ?? null, data.applicable_scope ?? "ALL", data.applicable_ids ? JSON.stringify(data.applicable_ids) : null, data.start_time, data.end_time, data.gift_stock_limit ?? null, data.gift_stock_limit ?? 0, data.is_stock_synced ? 1 : 0, tenantId, userId], tenantId
  );
  // database.ts 将 ResultSetHeader 归一化为数组返回，需从首元素取 insertId
  const raw = result as unknown as Array<{ insertId?: number }> | { insertId?: number } | null;
  const insertId = Array.isArray(raw) ? raw[0]?.insertId : raw?.insertId;
  return { id: insertId ?? 0, rule_code: code };
}

export async function listGiftRules(params: { tenantId: string; status?: string; page?: number; pageSize?: number }) {
  const { tenantId, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_gift_rule ${where}`, values, tenantId);
  const rows = await queryWithTenant<GiftRuleRow>(
    `SELECT * FROM t_gift_rule ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getGiftRuleDetail(id: number, tenantId: string) {
  const rule = await queryOneWithTenant<GiftRuleRow>("SELECT * FROM t_gift_rule WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!rule) return null;
  const levels = await queryWithTenant<GiftRuleLevelRow>("SELECT * FROM t_gift_rule_level WHERE rule_id = ? AND tenant_id = ? ORDER BY sort_order", [id, tenantId], tenantId);
  return { ...rule, levels };
}

export async function updateGiftRule(id: number, data: UpdateGiftRuleBody, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.rule_name !== undefined) { fields.push("rule_name = ?"); values.push(data.rule_name); }
  if (data.rule_desc !== undefined) { fields.push("rule_desc = ?"); values.push(data.rule_desc); }
  if (data.threshold_type !== undefined) { fields.push("threshold_type = ?"); values.push(data.threshold_type); }
  if (data.threshold_amount !== undefined) { fields.push("threshold_amount = ?"); values.push(data.threshold_amount); }
  if (data.threshold_quantity !== undefined) { fields.push("threshold_quantity = ?"); values.push(data.threshold_quantity); }
  if (data.applicable_scope !== undefined) { fields.push("applicable_scope = ?"); values.push(data.applicable_scope); }
  if (data.applicable_ids !== undefined) { fields.push("applicable_ids = ?"); values.push(JSON.stringify(data.applicable_ids)); }
  if (data.start_time !== undefined) { fields.push("start_time = ?"); values.push(data.start_time); }
  if (data.end_time !== undefined) { fields.push("end_time = ?"); values.push(data.end_time); }
  if (data.gift_stock_limit !== undefined) { fields.push("gift_stock_limit = ?"); values.push(data.gift_stock_limit); }
  if (data.is_stock_synced !== undefined) { fields.push("is_stock_synced = ?"); values.push(data.is_stock_synced ? 1 : 0); }
  if (fields.length === 0) return null;
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE t_gift_rule SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteGiftRule(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_gift_rule_level WHERE rule_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("DELETE FROM t_gift_rule WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function activateGiftRule(id: number, tenantId: string) {
  await queryWithTenant("UPDATE t_gift_rule SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function pauseGiftRule(id: number, tenantId: string) {
  await queryWithTenant("UPDATE t_gift_rule SET status = 'PAUSED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function addGiftRuleLevel(ruleId: number, data: AddGiftRuleLevelBody, tenantId: string) {
  await queryWithTenant(
    "INSERT INTO t_gift_rule_level (rule_id, threshold_amount, gift_product_id, gift_sku_id, gift_quantity, sort_order, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [ruleId, data.threshold_amount ?? null, data.gift_product_id, data.gift_sku_id ?? null, data.gift_quantity ?? 1, data.sort_order ?? 0, tenantId], tenantId
  );
}

export async function updateGiftRuleLevel(ruleId: number, levelId: number, data: UpdateGiftRuleLevelBody, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.threshold_amount !== undefined) { fields.push("threshold_amount = ?"); values.push(data.threshold_amount); }
  if (data.gift_product_id !== undefined) { fields.push("gift_product_id = ?"); values.push(data.gift_product_id); }
  if (data.gift_sku_id !== undefined) { fields.push("gift_sku_id = ?"); values.push(data.gift_sku_id); }
  if (data.gift_quantity !== undefined) { fields.push("gift_quantity = ?"); values.push(data.gift_quantity); }
  if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
  if (fields.length === 0) return;
  values.push(levelId, ruleId, tenantId);
  await queryWithTenant(`UPDATE t_gift_rule_level SET ${fields.join(", ")} WHERE id = ? AND rule_id = ? AND tenant_id = ?`, values, tenantId);
}

export async function deleteGiftRuleLevel(ruleId: number, levelId: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_gift_rule_level WHERE id = ? AND rule_id = ? AND tenant_id = ?", [levelId, ruleId, tenantId], tenantId);
}
