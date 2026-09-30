/**
 * R101-C6-3-3：平台代理商**档案**（t_agent，迁移 186）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-3.md §三①（逐列口径）、§四（端点与校验口径）、
 *       §二（本单范围钉死：档 1 不涉钱）
 *
 * 口径（与卡逐条对齐）：
 * - 平台级表（**无 tenant_id**）：用 query()/queryOne()，不走 queryWithTenant；
 * - 状态机落在服务层（卡 §三① 逐字）：PENDING→ACTIVE；ACTIVE↔FROZEN；ACTIVE/FROZEN→TERMINATED。
 *   非法流转 ⇒ AppError 400；同值流转（状态未变更）同样 400，**不得静默成功**；
 * - agent_code 重复 ⇒ AppError 409（先查一次，再兜住并发下的 ER_DUP_ENTRY）；
 * - levelId 逻辑引用 t_agent_level.id（不建物理外键），不存在 ⇒ AppError 400；
 * - 未知 id ⇒ AppError 404；
 * - **零涉钱**（红线①）：本服务只读写档案字段（编码/名称/层级/区域/联系人/状态/备注），
 *   不写任何金额、不做任何计提／结算／提现的写入或计算。
 */
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { normalizePagination, calculateOffset } from "../../shared/pagination";

/** 状态枚举（卡 §三① 逐字，与迁移 186 的列注释一致） */
export const AGENT_STATUSES = ["PENDING", "ACTIVE", "FROZEN", "TERMINATED"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/**
 * 状态机（卡 §三① 逐字）：
 *   PENDING→ACTIVE；ACTIVE↔FROZEN；ACTIVE/FROZEN→TERMINATED。
 * TERMINATED 是终态（无出边）；同值流转不在表内 ⇒ 视为非法（服务层单独给"状态未变更"文案）。
 */
export const AGENT_STATUS_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  PENDING: ["ACTIVE"],
  ACTIVE: ["FROZEN", "TERMINATED"],
  FROZEN: ["ACTIVE", "TERMINATED"],
  TERMINATED: [],
};

/** 状态是否合法（zod 之外的第二道，供服务层独立判定） */
export function isAgentStatus(value: string): value is AgentStatus {
  return (AGENT_STATUSES as readonly string[]).includes(value);
}

/** 由 from 到 to 的流转是否合法（同值不算合法流转） */
export function canTransitAgentStatus(from: string, to: string): boolean {
  if (!isAgentStatus(from) || !isAgentStatus(to)) return false;
  return AGENT_STATUS_TRANSITIONS[from].includes(to);
}

interface AgentRow {
  id: number | string;
  agentCode: string;
  agentName: string;
  levelId: number | string;
  levelName: string | null;
  region: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  remark: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AgentView {
  id: number;
  agentCode: string;
  agentName: string;
  levelId: number;
  levelName: string | null;
  region: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  remark: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AgentListInput {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface AgentListResult {
  items: AgentView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AgentCreateInput {
  agentCode: string;
  agentName: string;
  levelId: number;
  region?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  remark?: string | null;
}

export interface AgentUpdateInput {
  agentName?: string;
  levelId?: number;
  region?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  remark?: string | null;
}

const SELECT_COLUMNS = `a.id, a.agent_code AS agentCode, a.agent_name AS agentName,
            a.level_id AS levelId, l.level_name AS levelName,
            a.region, a.contact_name AS contactName, a.contact_phone AS contactPhone,
            a.status, a.remark, a.created_at AS createdAt, a.updated_at AS updatedAt`;

const FROM_WITH_LEVEL = `FROM t_agent a
       LEFT JOIN t_agent_level l ON l.id = a.level_id`;

/** 空白串（含 "" 与纯空格）归一为 NULL —— 列语义是 NULL=未填写，不用空串冒充（与 184/185 同口径） */
function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function toView(row: AgentRow): AgentView {
  return {
    id: Number(row.id),
    agentCode: row.agentCode,
    agentName: row.agentName,
    levelId: Number(row.levelId),
    levelName: row.levelName ?? null,
    region: row.region ?? null,
    contactName: row.contactName ?? null,
    contactPhone: row.contactPhone ?? null,
    status: row.status,
    remark: row.remark ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 层级必须已存在（逻辑引用校验；不存在 ⇒ 400，卡 §四 校验口径） */
async function assertLevelExists(levelId: number): Promise<void> {
  const level = await queryOne<{ id: number }>(
    "SELECT id FROM t_agent_level WHERE id = ?",
    [levelId]
  );
  if (!level) {
    throw new AppError(`层级不存在：${levelId}`, 400);
  }
}

/**
 * GET /api/platform/agents —— 分页 + 关键词（返回 items/total/page/pageSize，卡 §四 逐字）
 * 关键词命中 编码 / 名称 / 区域 / 联系人姓名 / 联系人电话；空表 ⇒ items: []。
 */
export async function listAgents(input: AgentListInput = {}): Promise<AgentListResult> {
  const { page, pageSize } = normalizePagination({ page: input.page, pageSize: input.pageSize });
  const keyword = input.keyword === undefined ? "" : String(input.keyword).trim();

  const where = keyword
    ? `WHERE (a.agent_code LIKE ? OR a.agent_name LIKE ? OR a.region LIKE ?
              OR a.contact_name LIKE ? OR a.contact_phone LIKE ?)`
    : "";
  const whereParams = keyword
    ? Array.from({ length: 5 }, () => `%${keyword}%`)
    : [];

  const totalRows = await query<{ total: number | string }>(
    `SELECT COUNT(*) AS total ${FROM_WITH_LEVEL} ${where}`,
    whereParams
  );
  const total = Number(totalRows[0]?.total ?? 0);

  const rows = await query<AgentRow>(
    `SELECT ${SELECT_COLUMNS}
       ${FROM_WITH_LEVEL}
       ${where}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, calculateOffset(page, pageSize)]
  );

  return { items: rows.map(toView), total, page, pageSize };
}

/** GET /api/platform/agents/:id —— 详情；未知 id ⇒ 404 */
export async function getAgent(id: number): Promise<AgentView> {
  const row = await queryOne<AgentRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_WITH_LEVEL} WHERE a.id = ?`,
    [id]
  );
  if (!row) {
    throw new AppError(`代理商不存在：${id}`, 404);
  }
  return toView(row);
}

/**
 * POST /api/platform/agents —— 新建档案（状态固定 PENDING=待审核，卡 §三① 默认值）
 * · agent_code 重复 ⇒ 409（先查后插，并兜住并发下的唯一键冲突）
 * · levelId 不存在 ⇒ 400
 */
export async function createAgent(
  input: AgentCreateInput,
  operatorId?: number | null
): Promise<AgentView> {
  await assertLevelExists(input.levelId);

  const duplicated = await queryOne<{ id: number }>(
    "SELECT id FROM t_agent WHERE agent_code = ?",
    [input.agentCode]
  );
  if (duplicated) {
    throw new AppError(`代理商编码已存在：${input.agentCode}`, 409);
  }

  let insertId: number;
  try {
    const result: any = await query(
      `INSERT INTO t_agent
         (agent_code, agent_name, level_id, region, contact_name, contact_phone, status, remark, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        input.agentCode,
        input.agentName,
        input.levelId,
        normalizeNullableText(input.region),
        normalizeNullableText(input.contactName),
        normalizeNullableText(input.contactPhone),
        normalizeNullableText(input.remark),
        operatorId ?? null,
      ]
    );
    insertId = Number(result?.insertId ?? result?.[0]?.insertId ?? 0);
  } catch (err: any) {
    // 并发窗口：唯一键撞车同样按 409 报，不落 500（卡 §四 校验口径）
    if (err?.code === "ER_DUP_ENTRY") {
      throw new AppError(`代理商编码已存在：${input.agentCode}`, 409);
    }
    throw err;
  }

  if (!insertId) {
    throw new AppError("代理商创建失败：未取得新增主键", 500);
  }
  return getAgent(insertId);
}

/**
 * PUT /api/platform/agents/:id —— 部分更新（只改传了的字段）
 * · 未知 id ⇒ 404（不 upsert）
 * · 一个可变更字段都没传 / 传了但与当前值完全一致 ⇒ 400（**不得静默成功**）
 * · 改 levelId 时同样校验层级存在（不存在 ⇒ 400）
 */
export async function updateAgent(
  id: number,
  input: AgentUpdateInput,
  operatorId?: number | null
): Promise<{ id: number; changedFields: string[] }> {
  const existing = await queryOne<AgentRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_WITH_LEVEL} WHERE a.id = ?`,
    [id]
  );
  if (!existing) {
    throw new AppError(`代理商不存在：${id}`, 404);
  }

  const assignments: string[] = [];
  const params: unknown[] = [];
  const changedFields: string[] = [];

  if (input.agentName !== undefined && input.agentName !== existing.agentName) {
    assignments.push("agent_name = ?");
    params.push(input.agentName);
    changedFields.push("agentName");
  }

  if (input.levelId !== undefined && Number(input.levelId) !== Number(existing.levelId)) {
    await assertLevelExists(Number(input.levelId));
    assignments.push("level_id = ?");
    params.push(Number(input.levelId));
    changedFields.push("levelId");
  }

  const textFields: Array<{
    field: "region" | "contactName" | "contactPhone" | "remark";
    column: string;
    current: string | null;
    next: string | null | undefined;
  }> = [
    { field: "region", column: "region", current: existing.region ?? null, next: input.region },
    { field: "contactName", column: "contact_name", current: existing.contactName ?? null, next: input.contactName },
    { field: "contactPhone", column: "contact_phone", current: existing.contactPhone ?? null, next: input.contactPhone },
    { field: "remark", column: "remark", current: existing.remark ?? null, next: input.remark },
  ];

  for (const item of textFields) {
    if (item.next === undefined) continue;
    const next = normalizeNullableText(item.next);
    if (next !== item.current) {
      assignments.push(`${item.column} = ?`);
      params.push(next);
      changedFields.push(item.field);
    }
  }

  if (changedFields.length === 0) {
    throw new AppError("提交内容与当前档案一致，无字段变更", 400);
  }

  assignments.push("updated_by = ?");
  params.push(operatorId ?? null);

  await query(
    `UPDATE t_agent SET ${assignments.join(", ")} WHERE id = ?`,
    [...params, id]
  );

  return { id, changedFields };
}

/**
 * POST /api/platform/agents/:id/status —— 状态流转（状态机见 AGENT_STATUS_TRANSITIONS）
 * · 未知 id ⇒ 404
 * · 目标状态与当前一致 ⇒ 400（状态未变更）
 * · 状态机不存在的边 ⇒ 400（卡 §四：非法流转 ⇒ 400）
 */
export async function changeAgentStatus(
  id: number,
  status: AgentStatus,
  operatorId?: number | null
): Promise<{ id: number; status: AgentStatus }> {
  const existing = await queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM t_agent WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw new AppError(`代理商不存在：${id}`, 404);
  }

  if (existing.status === status) {
    throw new AppError(`状态未变更：${status}`, 400);
  }
  if (!canTransitAgentStatus(existing.status, status)) {
    throw new AppError(`非法状态流转：${existing.status} → ${status}`, 400);
  }

  await query("UPDATE t_agent SET status = ?, updated_by = ? WHERE id = ?", [
    status,
    operatorId ?? null,
    id,
  ]);

  return { id, status };
}
