import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

/** SELECT id 通用返回 */
interface IdRow {
  id: number | string;
}

/** t_promo_stack_rule 表行（带别名） */
interface PromoStackRuleRow {
  id: number | string;
  name: string;
  typeCombination: string;
  maxTotalDiscountRate: number | string;
  priority: number | string;
  enabled: number | string;
  createdAt: string | Date;
}

export async function createStackRule(body: {
  name: string;
  typeCombination: string[][];
  maxTotalDiscountRate: number;
  priority: number;
  enabled: boolean;
}, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO t_promo_stack_rule (name, type_combination, max_total_discount_rate, priority, enabled)
       VALUES (?, ?, ?, ?, ?)`,
    [
      body.name, JSON.stringify(body.typeCombination),
      body.maxTotalDiscountRate, body.priority, body.enabled ? 1 : 0
    ],
    tenantId
  );

  const record = await queryOneWithTenant<PromoStackRuleRow>(
    `SELECT id, name, type_combination AS typeCombination,
            max_total_discount_rate AS maxTotalDiscountRate,
            priority, enabled, created_at AS createdAt
     FROM t_promo_stack_rule ORDER BY id DESC LIMIT 1`,
    [],
    tenantId
  );

  return record;
}

export async function listStackRules(tenantId: string) {
  const records = await queryWithTenant<PromoStackRuleRow>(
    `SELECT id, name, type_combination AS typeCombination,
            max_total_discount_rate AS maxTotalDiscountRate,
            priority, enabled, created_at AS createdAt
     FROM t_promo_stack_rule
     ORDER BY priority DESC, id ASC`,
    [],
    tenantId
  );

  return { total: records.length, records };
}

export async function updateStackRule(id: number, body: {
  name?: string;
  typeCombination?: string[][];
  maxTotalDiscountRate?: number;
  priority?: number;
  enabled?: boolean;
}, tenantId: string) {
  const existing = await queryOneWithTenant<IdRow>("SELECT id FROM t_promo_stack_rule WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("叠加规则不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.typeCombination !== undefined) { updates.push("type_combination = ?"); params.push(JSON.stringify(body.typeCombination)); }
  if (body.maxTotalDiscountRate !== undefined) { updates.push("max_total_discount_rate = ?"); params.push(body.maxTotalDiscountRate); }
  if (body.priority !== undefined) { updates.push("priority = ?"); params.push(body.priority); }
  if (body.enabled !== undefined) { updates.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }

  if (updates.length > 0) {
    params.push(id);
    await queryWithTenant(`UPDATE t_promo_stack_rule SET ${updates.join(", ")} WHERE id = ?`, params, tenantId);
  }

  const record = await queryOneWithTenant<PromoStackRuleRow>(
    `SELECT id, name, type_combination AS typeCombination,
            max_total_discount_rate AS maxTotalDiscountRate,
            priority, enabled, created_at AS createdAt
     FROM t_promo_stack_rule WHERE id = ?`,
    [id],
    tenantId
  );

  return record;
}

export async function deleteStackRule(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<IdRow>("SELECT id FROM t_promo_stack_rule WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("叠加规则不存在"), { statusCode: 404 });
  }

  await queryWithTenant("DELETE FROM t_promo_stack_rule WHERE id = ?", [id], tenantId);
  return { id, deleted: true };
}
