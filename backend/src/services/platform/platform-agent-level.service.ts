/**
 * R101-C6-3-3：平台代理商**层级权益配置**（t_agent_level，迁移 187）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-3.md §三②（逐列口径）、§四（端点与校验口径）
 *
 * 口径（与卡逐条对齐）：
 * - 平台级表（**无 tenant_id**）：用 query()/queryOne()，不走 queryWithTenant；
 * - D11③ 层级自定义命名：level_name 自由输入，服务层**不写死"一级/二级"**，也不预置任何层级行；
 * - D11① 分润比例配置化：profit_rate_* 未传 ⇒ 落 NULL（**不写 0 冒充未配置**）；
 * - D11② 增值初期关闭：profit_mode_upsell 默认 0（新签/续费默认 1）；
 * - 拿货折扣区间 discount_low/high：未配置 ⇒ NULL（不得写 0 冒充）；两者都给且 高<低 ⇒ 400；
 * - level_code 重复 ⇒ AppError 409；未知 id ⇒ AppError 404；无字段变更 ⇒ AppError 400（不得静默成功）；
 * - **零涉钱**（红线①）：本服务只读写"配置值"（比例、模式开关、折扣区间、套餐范围），
 *   不做任何计提／结算／提现的写入或计算，也不读任何订单或订阅金额。
 */
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/** 层级状态（与 184/185 的平台级表同一口径：ACTIVE-启用 / DISABLED-停用） */
export const AGENT_LEVEL_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type AgentLevelStatus = (typeof AGENT_LEVEL_STATUSES)[number];

interface AgentLevelRow {
  id: number | string;
  levelCode: string;
  levelName: string;
  allowSubLevel: number | boolean;
  planScope: unknown;
  discountLow: string | number | null;
  discountHigh: string | number | null;
  profitModeSignup: number | boolean;
  profitModeRenew: number | boolean;
  profitModeUpsell: number | boolean;
  profitRateSignup: string | number | null;
  profitRateRenew: string | number | null;
  profitRateUpsell: string | number | null;
  sortNo: number | string | null;
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AgentLevelView {
  id: number;
  levelCode: string;
  levelName: string;
  allowSubLevel: boolean;
  /** 可售套餐范围：planId 数组；未配置 ⇒ null（不返回空数组冒充） */
  planScope: number[] | null;
  discountLow: number | null;
  discountHigh: number | null;
  profitModeSignup: boolean;
  profitModeRenew: boolean;
  profitModeUpsell: boolean;
  profitRateSignup: number | null;
  profitRateRenew: number | null;
  profitRateUpsell: number | null;
  sortNo: number;
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AgentLevelCreateInput {
  levelCode: string;
  levelName: string;
  allowSubLevel?: boolean;
  planScope?: number[] | null;
  discountLow?: number | null;
  discountHigh?: number | null;
  profitModeSignup?: boolean;
  profitModeRenew?: boolean;
  profitModeUpsell?: boolean;
  profitRateSignup?: number | null;
  profitRateRenew?: number | null;
  profitRateUpsell?: number | null;
  sortNo?: number;
  status?: AgentLevelStatus;
}

export type AgentLevelUpdateInput = Partial<Omit<AgentLevelCreateInput, "levelCode">>;

const SELECT_COLUMNS = `id, level_code AS levelCode, level_name AS levelName,
            allow_sub_level AS allowSubLevel, plan_scope AS planScope,
            discount_low AS discountLow, discount_high AS discountHigh,
            profit_mode_signup AS profitModeSignup, profit_mode_renew AS profitModeRenew,
            profit_mode_upsell AS profitModeUpsell,
            profit_rate_signup AS profitRateSignup, profit_rate_renew AS profitRateRenew,
            profit_rate_upsell AS profitRateUpsell,
            sort_no AS sortNo, status, created_at AS createdAt, updated_at AS updatedAt`;

/** DECIMAL 列在 mysql2 下回来是字符串 ⇒ 统一归一为 number 或 null（null 保持 null，不当 0） */
function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * JSON 列读回：mysql2 通常已解析为数组，但驱动/版本差异下也可能是字符串 ⇒ 两种都兜。
 * 未配置（NULL）返回 null；非数组的脏值同样返回 null（不编造范围）。
 */
function parsePlanScope(value: unknown): number[] | null {
  if (value === null || value === undefined) return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
}

/** 写侧：JS 数组 ⇒ JSON 字符串；null/undefined ⇒ NULL（未配置，不写空数组冒充） */
function serializePlanScope(value: number[] | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function toView(row: AgentLevelRow): AgentLevelView {
  return {
    id: Number(row.id),
    levelCode: row.levelCode,
    levelName: row.levelName,
    allowSubLevel: Boolean(row.allowSubLevel),
    planScope: parsePlanScope(row.planScope),
    discountLow: toNullableNumber(row.discountLow),
    discountHigh: toNullableNumber(row.discountHigh),
    profitModeSignup: Boolean(row.profitModeSignup),
    profitModeRenew: Boolean(row.profitModeRenew),
    profitModeUpsell: Boolean(row.profitModeUpsell),
    profitRateSignup: toNullableNumber(row.profitRateSignup),
    profitRateRenew: toNullableNumber(row.profitRateRenew),
    profitRateUpsell: toNullableNumber(row.profitRateUpsell),
    sortNo: Number(row.sortNo ?? 0),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 折扣区间一致性：两者都配置时，上限不得低于下限（未配置=NULL，不参与比较，也不当 0） */
export function assertDiscountRange(
  low: number | null | undefined,
  high: number | null | undefined
): void {
  if (low === null || low === undefined || high === null || high === undefined) return;
  if (Number(high) < Number(low)) {
    throw new AppError(`拿货折扣区间不合法：上限 ${high} 低于下限 ${low}`, 400);
  }
}

/** GET /api/platform/agents/levels —— 层级列表（零预置 ⇒ 空表 ⇒ items: []） */
export async function listAgentLevels(): Promise<{ items: AgentLevelView[] }> {
  const rows = await query<AgentLevelRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM t_agent_level
      ORDER BY sort_no ASC, id ASC`
  );
  return { items: rows.map(toView) };
}

/** POST /api/platform/agents/levels —— 新建层级（level_code 重复 ⇒ 409） */
export async function createAgentLevel(
  input: AgentLevelCreateInput,
  operatorId?: number | null
): Promise<AgentLevelView> {
  const duplicated = await queryOne<{ id: number }>(
    "SELECT id FROM t_agent_level WHERE level_code = ?",
    [input.levelCode]
  );
  if (duplicated) {
    throw new AppError(`层级编码已存在：${input.levelCode}`, 409);
  }

  assertDiscountRange(input.discountLow, input.discountHigh);

  let insertId: number;
  try {
    const result: any = await query(
      `INSERT INTO t_agent_level
         (level_code, level_name, allow_sub_level, plan_scope, discount_low, discount_high,
          profit_mode_signup, profit_mode_renew, profit_mode_upsell,
          profit_rate_signup, profit_rate_renew, profit_rate_upsell,
          sort_no, status, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.levelCode,
        input.levelName,
        input.allowSubLevel ? 1 : 0,
        serializePlanScope(input.planScope),
        input.discountLow ?? null,
        input.discountHigh ?? null,
        input.profitModeSignup === undefined ? 1 : input.profitModeSignup ? 1 : 0,
        input.profitModeRenew === undefined ? 1 : input.profitModeRenew ? 1 : 0,
        input.profitModeUpsell ? 1 : 0,
        input.profitRateSignup ?? null,
        input.profitRateRenew ?? null,
        input.profitRateUpsell ?? null,
        Number.isFinite(Number(input.sortNo)) ? Number(input.sortNo) : 0,
        input.status ?? "ACTIVE",
        operatorId ?? null,
      ]
    );
    insertId = Number(result?.insertId ?? result?.[0]?.insertId ?? 0);
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      throw new AppError(`层级编码已存在：${input.levelCode}`, 409);
    }
    throw err;
  }

  if (!insertId) {
    throw new AppError("层级创建失败：未取得新增主键", 500);
  }
  const created = await queryOne<AgentLevelRow>(
    `SELECT ${SELECT_COLUMNS} FROM t_agent_level WHERE id = ?`,
    [insertId]
  );
  if (!created) {
    throw new AppError(`层级创建后读取失败：${insertId}`, 500);
  }
  return toView(created);
}

/**
 * PUT /api/platform/agents/levels/:id —— 部分更新（level_code 不可改）
 * · 未知 id ⇒ 404；一个字段没传 / 传了但与现值一致 ⇒ 400（不得静默成功）
 */
export async function updateAgentLevel(
  id: number,
  input: AgentLevelUpdateInput,
  operatorId?: number | null
): Promise<{ id: number; changedFields: string[] }> {
  const existing = await queryOne<AgentLevelRow>(
    `SELECT ${SELECT_COLUMNS} FROM t_agent_level WHERE id = ?`,
    [id]
  );
  if (!existing) {
    throw new AppError(`层级不存在：${id}`, 404);
  }
  const current = toView(existing);

  const assignments: string[] = [];
  const params: unknown[] = [];
  const changedFields: string[] = [];

  if (input.levelName !== undefined && input.levelName !== current.levelName) {
    assignments.push("level_name = ?");
    params.push(input.levelName);
    changedFields.push("levelName");
  }

  if (
    input.allowSubLevel !== undefined &&
    Boolean(input.allowSubLevel) !== current.allowSubLevel
  ) {
    assignments.push("allow_sub_level = ?");
    params.push(input.allowSubLevel ? 1 : 0);
    changedFields.push("allowSubLevel");
  }

  if (input.planScope !== undefined) {
    const nextScope = input.planScope === null ? null : serializePlanScope(input.planScope);
    const currentScope = current.planScope === null ? null : JSON.stringify(current.planScope);
    if (nextScope !== currentScope) {
      assignments.push("plan_scope = ?");
      params.push(nextScope);
      changedFields.push("planScope");
    }
  }

  const nextLow = input.discountLow === undefined ? current.discountLow : input.discountLow;
  const nextHigh = input.discountHigh === undefined ? current.discountHigh : input.discountHigh;
  assertDiscountRange(nextLow, nextHigh);

  const numberFields: Array<{
    field:
      | "discountLow"
      | "discountHigh"
      | "profitRateSignup"
      | "profitRateRenew"
      | "profitRateUpsell";
    column: string;
    current: number | null;
    next: number | null | undefined;
  }> = [
    { field: "discountLow", column: "discount_low", current: current.discountLow, next: input.discountLow },
    { field: "discountHigh", column: "discount_high", current: current.discountHigh, next: input.discountHigh },
    { field: "profitRateSignup", column: "profit_rate_signup", current: current.profitRateSignup, next: input.profitRateSignup },
    { field: "profitRateRenew", column: "profit_rate_renew", current: current.profitRateRenew, next: input.profitRateRenew },
    { field: "profitRateUpsell", column: "profit_rate_upsell", current: current.profitRateUpsell, next: input.profitRateUpsell },
  ];
  for (const item of numberFields) {
    if (item.next === undefined) continue;
    const next = item.next === null ? null : Number(item.next);
    if (next !== item.current) {
      assignments.push(`${item.column} = ?`);
      params.push(next);
      changedFields.push(item.field);
    }
  }

  const boolFields: Array<{
    field: "profitModeSignup" | "profitModeRenew" | "profitModeUpsell";
    column: string;
    current: boolean;
    next: boolean | undefined;
  }> = [
    { field: "profitModeSignup", column: "profit_mode_signup", current: current.profitModeSignup, next: input.profitModeSignup },
    { field: "profitModeRenew", column: "profit_mode_renew", current: current.profitModeRenew, next: input.profitModeRenew },
    { field: "profitModeUpsell", column: "profit_mode_upsell", current: current.profitModeUpsell, next: input.profitModeUpsell },
  ];
  for (const item of boolFields) {
    if (item.next === undefined) continue;
    if (Boolean(item.next) !== item.current) {
      assignments.push(`${item.column} = ?`);
      params.push(item.next ? 1 : 0);
      changedFields.push(item.field);
    }
  }

  if (input.sortNo !== undefined && Number(input.sortNo) !== current.sortNo) {
    assignments.push("sort_no = ?");
    params.push(Number(input.sortNo));
    changedFields.push("sortNo");
  }

  if (input.status !== undefined && input.status !== current.status) {
    assignments.push("status = ?");
    params.push(input.status);
    changedFields.push("status");
  }

  if (changedFields.length === 0) {
    throw new AppError("提交内容与当前层级配置一致，无字段变更", 400);
  }

  assignments.push("updated_by = ?");
  params.push(operatorId ?? null);

  await query(
    `UPDATE t_agent_level SET ${assignments.join(", ")} WHERE id = ?`,
    [...params, id]
  );

  return { id, changedFields };
}
