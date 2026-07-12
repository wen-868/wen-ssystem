import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// ===== 积分规则 =====
export async function listPointsRules(tenantId: string) {
  return queryWithTenant<any>(
    "SELECT id, rule_name AS ruleName, earn_type AS earnType, earn_rate AS earnRate, daily_limit AS dailyLimit, enabled FROM points_rule WHERE tenant_id = ? ORDER BY id",
    [tenantId], tenantId
  );
}

export async function createPointsRule(params: { ruleName: string; earnType: string; earnRate: number; dailyLimit?: number; tenantId: string }) {
  const { ruleName, earnType, earnRate, dailyLimit, tenantId } = params;
  const result = await queryWithTenant<any>(
    "INSERT INTO points_rule (rule_name, earn_type, earn_rate, daily_limit, tenant_id) VALUES (?, ?, ?, ?, ?)",
    [ruleName, earnType, earnRate, dailyLimit ?? 0, tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, ruleName, earnType, earnRate };
}

export async function updatePointsRule(id: number, params: { ruleName?: string; earnRate?: number; dailyLimit?: number; enabled?: number; tenantId: string }) {
  const fields: string[] = []; const values: unknown[] = [];
  if (params.ruleName !== undefined) { fields.push("rule_name = ?"); values.push(params.ruleName); }
  if (params.earnRate !== undefined) { fields.push("earn_rate = ?"); values.push(params.earnRate); }
  if (params.dailyLimit !== undefined) { fields.push("daily_limit = ?"); values.push(params.dailyLimit); }
  if (params.enabled !== undefined) { fields.push("enabled = ?"); values.push(params.enabled); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<any>(`UPDATE points_rule SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

// ===== 积分调整 =====
export async function adjustCustomerPoints(params: { customerId: number; points: number; type: string; remark?: string; tenantId: string }) {
  const { customerId, points, type, remark, tenantId } = params;
  const cp = await queryOneWithTenant<any>("SELECT id, available_points FROM customer_points WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  if (!cp) throw new Error("客户积分账户不存在");
  const newAvailable = Math.max(0, Number(cp.available_points) + points);
  const recordNo = makeBizNo("JF");
  await queryWithTenant(
    "UPDATE customer_points SET available_points = ?, total_points = total_points + ? WHERE customer_id = ? AND tenant_id = ?",
    [newAvailable, points > 0 ? points : 0, customerId, tenantId], tenantId
  );
  await queryWithTenant(
    "INSERT INTO points_record (record_no, customer_id, type, points, balance_after, remark, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [recordNo, customerId, type, points, newAvailable, remark ?? null, tenantId], tenantId
  );
  return { recordNo, customerId, points, balanceAfter: newAvailable };
}

// ===== 积分明细 =====
export async function getCustomerPointsRecords(params: { customerId: number; type?: string; page: number; pageSize: number; tenantId: string }) {
  const { customerId, type, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?", "customer_id = ?"]; const values: unknown[] = [tenantId, customerId];
  if (type) { conditions.push("type = ?"); values.push(type); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT record_no AS recordNo, type, points, balance_after AS balanceAfter, source_type AS sourceType, source_no AS sourceNo, remark, created_at AS createdAt
     FROM points_record ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM points_record ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

// ===== 等级配置 =====
export async function listLevelConfigs(tenantId: string) {
  return queryWithTenant<any>(
    "SELECT id, level_name AS levelName, min_points AS minPoints, max_points AS maxPoints, discount_rate AS discountRate, benefits FROM level_config WHERE tenant_id = ? ORDER BY min_points",
    [tenantId], tenantId
  );
}

export async function createLevelConfig(params: { levelName: string; minPoints: number; maxPoints: number; discountRate: number; benefits?: any; tenantId: string }) {
  const { levelName, minPoints, maxPoints, discountRate, benefits, tenantId } = params;
  const result = await queryWithTenant<any>(
    "INSERT INTO level_config (level_name, min_points, max_points, discount_rate, benefits, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
    [levelName, minPoints, maxPoints, discountRate, benefits ? JSON.stringify(benefits) : null, tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, levelName };
}

export async function updateLevelConfig(id: number, params: { levelName?: string; minPoints?: number; maxPoints?: number; discountRate?: number; benefits?: any; tenantId: string }) {
  const fields: string[] = []; const values: unknown[] = [];
  if (params.levelName !== undefined) { fields.push("level_name = ?"); values.push(params.levelName); }
  if (params.minPoints !== undefined) { fields.push("min_points = ?"); values.push(params.minPoints); }
  if (params.maxPoints !== undefined) { fields.push("max_points = ?"); values.push(params.maxPoints); }
  if (params.discountRate !== undefined) { fields.push("discount_rate = ?"); values.push(params.discountRate); }
  if (params.benefits !== undefined) { fields.push("benefits = ?"); values.push(JSON.stringify(params.benefits)); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<any>(`UPDATE level_config SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

// 自动升级检查
export async function checkLevelUpgrade(customerId: number, tenantId: string) {
  const cp = await queryOneWithTenant<any>("SELECT total_points FROM customer_points WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  if (!cp) return null;
  const totalPoints = Number(cp.total_points);
  const configs = await queryWithTenant<any>(
    "SELECT level_name AS levelName, min_points AS minPoints, max_points AS maxPoints FROM level_config WHERE tenant_id = ? AND min_points <= ? AND max_points >= ? ORDER BY min_points DESC LIMIT 1",
    [tenantId, totalPoints, totalPoints], tenantId
  );
  if (configs.length === 0) return null;
  const newLevel = configs[0];
  const current = await queryOneWithTenant<any>("SELECT level_name FROM customer_level WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  if (current && current.level_name === newLevel.levelName) return null;
  if (current) {
    await queryWithTenant("UPDATE customer_level SET level_name = ?, level_points = ?, upgraded_at = NOW() WHERE customer_id = ? AND tenant_id = ?", [newLevel.levelName, totalPoints, customerId, tenantId], tenantId);
  } else {
    await queryWithTenant("INSERT INTO customer_level (customer_id, level_name, level_points, upgraded_at, tenant_id) VALUES (?, ?, ?, NOW(), ?)", [customerId, newLevel.levelName, totalPoints, tenantId], tenantId);
  }
  await queryWithTenant("UPDATE customer_profile SET member_level = ? WHERE customer_id = ? AND tenant_id = ?", [newLevel.levelName, customerId, tenantId], tenantId);
  return { customerId, oldLevel: current?.level_name ?? "NONE", newLevel: newLevel.levelName };
}