import { query, queryOne } from "../../shared/db";

/**
 * R101-C5-1（阶段一 C5）· AI 配置与用量：平台侧只读接口数据层
 *
 * 4 个端点（前缀 `/api/platform/ai`，见 `routes/ai-platform.routes.ts`，路径由凌舟钉死）：
 * 1. `public-models`    → `t_ai_external_model`（清单）+ `t_ai_audit_log`（今日调用现算）
 * 2. `metering-log`     → `t_ai_audit_log` 逐次明细（分页）
 * 3. `abnormal-tenants` → 阈值取 `t_platform_ai_config` 既有列；无可用列 ⇒ UNAVAILABLE 且不计算
 * 4. `model-share`      → `t_ai_audit_log` 逐次明细 `GROUP BY model`
 *
 * 硬性口径（逐条对应派单卡与裁定）：
 * - **平台级**：本文件不接收、不读取 `req.tenantId`（`requirePlatformAuth` 不注入该字段，
 *   踩坑日志 [35]／S3-86／S3-91）；数据范围恒为全平台。
 * - **零假数据**：无数据一律 `records: []`；无载体字段返回 `null`，并在 `unavailable` /
 *   `contractNotes` 逐条说明；不造 0、不造日期、不写死字典（派单卡 §三.1／§三.2）。
 * - **明细载体唯一**：`model-share` 只按 `t_ai_audit_log` 逐次明细聚合 —— 日聚合表
 *   `t_ai_usage_daily` 的 `model` 不在唯一键 `uk_tenant_date_provider` 内且 UPSERT 不更新它，
 *   按模型聚合必然归错，故**禁止**用其近似冒充（凌舟裁定 §二.3／§三.3）。
 * - **场景列**：取 `t_ai_audit_log` 既有语义列 `intent`（docs/migrations/121_ai_base_tables.sql:65）
 *   原样透出，不新造映射表、不在服务层拼接自造枚举（派单卡 §三.2 裁定）。
 * - **费用/扣减来源**：`t_ai_audit_log.cost` / `deduct_source` 为迁移 177 新增列，历史行为 NULL
 *   （凌舟裁定 §三.4：本轮不回填）⇒ 接口返回 `null` 且不报 500。
 * - **阈值**：只从 `t_platform_ai_config` 既有列取，禁止 env 硬编码、禁止写死常量（派单卡 §三.3）。
 */

/* ==========================================================
 * 一、通用工具
 * ========================================================== */

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** DATE 列格式化（`YYYY-MM-DD`）；无值 ⇒ "" */
function formatDateValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

/** DATETIME 列格式化（含时分秒）；无值 ⇒ "" */
function formatDateTimeValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return (
      `${formatDateValue(value)} ` +
      `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
    );
  }
  return String(value);
}

/** DECIMAL／金额出口归一：字符串 → number；`null`/空 ⇒ `null`（不填 0 冒充） */
function toNullableAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** 计数／Token 归一：非法值 ⇒ 0（计数为 0 是真实语义，非造假） */
function toCount(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

/** 文本归一：`null`/空串 ⇒ `null` */
function toNullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text === "" ? null : text;
}

/** 2 位小数（占比较值；后端一次性换算，前端零除法） */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 4 位小数（金额合计；与 DECIMAL(12,4) 同精度） */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** 今日（`YYYY-MM-DD`，本地时区）；`today` 仅用于测试注入 */
function todayString(today?: string): string {
  if (today) return today;
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** `YYYY-MM-DD` → 当日 `00:00:00` 与次日 `00:00:00`（左闭右开，走 DATE 列索引，不用函数包列） */
export function dayRange(date: string): { start: string; end: string } {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: `${date} 00:00:00`,
    end: `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())} 00:00:00`,
  };
}

/** 日期区间（左闭右开）入参 */
export interface DateRange {
  startDate?: string;
  endDate?: string;
}

/**
 * 组装 `created_at` 区间条件（参数化）。
 * `startDate` 含当日 `00:00:00`；`endDate` 含当日（右边界取次日 `00:00:00`，左闭右开）。
 */
export function dateRangeConditions(
  column: string,
  range: DateRange,
  values: unknown[]
): string[] {
  const conditions: string[] = [];
  if (range.startDate) {
    conditions.push(`${column} >= ?`);
    values.push(`${range.startDate} 00:00:00`);
  }
  if (range.endDate) {
    conditions.push(`${column} < ?`);
    values.push(dayRange(range.endDate).end);
  }
  return conditions;
}

/**
 * 探测 `t_ai_audit_log` 的迁移 177 新增列是否已就绪。
 *
 * 为什么要运行时探测：迁移由凌舟在生产执行（本单不执行迁移），若接口代码先上线而 177 尚未执行，
 * 直接 `SELECT a.cost` 会因 `ER_BAD_FIELD_ERROR` 变成 500 —— 与派单卡 §三.2「明确空态、不报 500」
 * 冲突。列缺失时改读 `NULL AS cost`，如实返回空态并登记（见 `unavailable`）。
 */
async function auditLogNewColumns(): Promise<{ cost: boolean; deductSource: boolean }> {
  const rows = await query<{ columnName: unknown }>(
    `SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_ai_audit_log'
       AND COLUMN_NAME IN ('cost', 'deduct_source')`
  );
  const names = new Set(
    (Array.isArray(rows) ? rows : []).map((row) => String(row.columnName ?? ""))
  );
  return { cost: names.has("cost"), deductSource: names.has("deduct_source") };
}

/* ==========================================================
 * 二、GET /api/platform/ai/public-models —— 平台公共模型列表
 * ========================================================== */

/**
 * 无列载体字段（迁移 154 的 `t_ai_external_model` 只有
 * `name/display_name/provider_base_url/api_key/model_name/enabled/sort_order`，
 * 见 docs/migrations/154_ai_external_model.sql:1-15）：
 * - `vendor`（厂商）：无列 ⇒ null，不写死字典、不由 provider_base_url 猜
 * - `scene`（适用场景）：无列 ⇒ null（新增列已登记在 S3-03）
 * - `inputPrice` / `outputPrice`（输入/输出单价）：无列 ⇒ null（同 S3-03）
 */
export const PUBLIC_MODEL_MISSING_FIELDS = [
  "vendor",
  "scene",
  "inputPrice",
  "outputPrice",
] as const;

export interface PublicModelRow {
  id: number;
  /** 唯一标识（如 custom_kimi） */
  name: string | null;
  /** 展示名称（如 Kimi） */
  displayName: string | null;
  /** 模型名称（如 moonshot-v1-8k） */
  modelName: string | null;
  /** 厂商：无列载体 ⇒ 恒 null */
  vendor: null;
  /** 适用场景：无列载体 ⇒ 恒 null */
  scene: null;
  /** 输入单价：无列载体 ⇒ 恒 null */
  inputPrice: null;
  /** 输出单价：无列载体 ⇒ 恒 null */
  outputPrice: null;
  /** 是否启用 */
  enabled: boolean;
  sortOrder: number;
  /** 今日调用次数（`t_ai_audit_log` 按 `model` 现算；无匹配即 0，真实计数非估算） */
  todayCalls: number;
  /** 今日费用（`t_ai_audit_log.cost` 求和；无记录 ⇒ null，不填 0） */
  todayCost: number | null;
}

export interface PublicModelListResult {
  records: PublicModelRow[];
  total: number;
  /** 今日口径日期（`YYYY-MM-DD`，本地时区） */
  today: string;
  /** 单价单位：无单价列 ⇒ null（不造单位） */
  priceUnit: null;
  unavailable: { key: string; reason: string }[];
  contractNotes: string[];
}

interface RawPublicModelRow {
  id: unknown;
  name: unknown;
  displayName: unknown;
  modelName: unknown;
  enabled: unknown;
  sortOrder: unknown;
}

interface RawModelUsageRow {
  model: unknown;
  calls: unknown;
  cost: unknown;
}

/** 今日各模型调用/费用（`t_ai_audit_log` 现算，**不**用日聚合表按模型拆） */
async function todayModelUsage(
  today: string,
  costReady: boolean
): Promise<Map<string, { calls: number; cost: number | null }>> {
  const { start, end } = dayRange(today);
  const rows = await query<RawModelUsageRow>(
    `SELECT model, COUNT(*) AS calls, SUM(${costReady ? "cost" : "NULL"}) AS cost
     FROM t_ai_audit_log
     WHERE created_at >= ? AND created_at < ?
     GROUP BY model`,
    [start, end]
  );
  const map = new Map<string, { calls: number; cost: number | null }>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = toNullableText(row.model);
    if (key == null) continue;
    map.set(key, { calls: toCount(row.calls), cost: toNullableAmount(row.cost) });
  }
  return map;
}

/**
 * 平台公共模型列表（`t_ai_external_model` 全表，按 `sort_order` 升序）。
 * `today` 仅用于测试注入（生产走本地当日）。
 */
export async function listPublicModels(today?: string): Promise<PublicModelListResult> {
  const todayDate = todayString(today);
  const { cost: costReady } = await auditLogNewColumns();

  const [modelRows, usage] = await Promise.all([
    query<RawPublicModelRow>(
      `SELECT id, name, display_name AS displayName, model_name AS modelName,
              enabled, sort_order AS sortOrder
       FROM t_ai_external_model
       ORDER BY sort_order ASC, id ASC`
    ),
    todayModelUsage(todayDate, costReady),
  ]);

  const records: PublicModelRow[] = (Array.isArray(modelRows) ? modelRows : []).map((row) => {
    const modelName = toNullableText(row.modelName);
    const name = toNullableText(row.name);
    // 明细以 `model` 落库，模型库以 `model_name` 标识 ⇒ 两者都作为匹配键（无匹配即 0）
    const hit = (modelName && usage.get(modelName)) || (name && usage.get(name)) || null;
    return {
      id: Number(row.id ?? 0),
      name,
      displayName: toNullableText(row.displayName),
      modelName,
      vendor: null,
      scene: null,
      inputPrice: null,
      outputPrice: null,
      enabled: Number(row.enabled ?? 0) === 1,
      sortOrder: toCount(row.sortOrder),
      todayCalls: hit ? hit.calls : 0,
      todayCost: hit ? hit.cost : null,
    };
  });

  const unavailable = PUBLIC_MODEL_MISSING_FIELDS.map((key) => ({
    key,
    reason:
      key === "inputPrice" || key === "outputPrice"
        ? "t_ai_external_model 无单价列（迁移 154 列清单未含）⇒ 返回 null，不造值"
        : "t_ai_external_model 无对应列（迁移 154 列清单未含）⇒ 返回 null，不造值、不写死字典",
  }));

  return {
    records,
    total: records.length,
    today: todayDate,
    priceUnit: null,
    unavailable,
    contractNotes: [
      "价格单位：暂无单价列，priceUnit 为 null（待 S3-03「t_ai_external_model 补单价列」落地后回填）",
      "todayCalls = t_ai_audit_log 中 created_at 落在当日、model 等于本行 model_name（或 name）的行数，无匹配为 0（真实计数，非估算）",
      "todayCost = 上述行的 SUM(cost)；cost 为迁移 177 新增列，历史与未写入行为 NULL ⇒ 无记录时为 null，不填 0",
      "api_key 为密钥字段，本端点**不**透出",
    ],
  };
}

/* ==========================================================
 * 三、GET /api/platform/ai/metering-log —— 逐次计量流水（分页）
 * ========================================================== */

export interface MeteringLogFilter extends DateRange {
  tenantId?: string;
  model?: string;
  provider?: string;
}

export interface MeteringLogParams extends MeteringLogFilter {
  page: number;
  pageSize: number;
}

export interface MeteringLogRow {
  id: number;
  /** 调用时间（`created_at`） */
  time: string;
  tenantId: string;
  tenantName: string | null;
  /** 场景：取既有语义列 `t_ai_audit_log.intent` 原样透出（NULL ⇒ null，不映射、不造枚举） */
  scene: string | null;
  model: string | null;
  provider: string | null;
  /** 扣减来源（迁移 177 新增列；历史行 NULL ⇒ null） */
  deductSource: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** 费用（迁移 177 新增列；历史行 NULL ⇒ null，不填 0） */
  cost: number | null;
  /** 是否成功（`success` tinyint 归一为布尔） */
  success: boolean;
  /** 调用状态（由 `success` 列派生：SUCCESS / FAILED，非自造业务枚举） */
  status: "SUCCESS" | "FAILED";
  errorMessage: string | null;
}

export interface MeteringLogResult {
  records: MeteringLogRow[];
  total: number;
  page: number;
  pageSize: number;
  costUnit: "CNY";
  costScale: number;
  unavailable: { key: string; reason: string }[];
  contractNotes: string[];
}

interface RawMeteringLogRow {
  id: unknown;
  createdAt: unknown;
  tenantId: unknown;
  tenantName: unknown;
  intent: unknown;
  model: unknown;
  provider: unknown;
  deductSource: unknown;
  promptTokens: unknown;
  completionTokens: unknown;
  cost: unknown;
  success: unknown;
  errorMessage: unknown;
}

/** 费用列精度（`t_ai_audit_log.cost` 为 DECIMAL(12,4)，与 121 的金额列同口径） */
export const AI_COST_SCALE = 4;

/** 逐次计量流水分页列表；无数据 ⇒ `records: []`、`total: 0` */
export async function listMeteringLog(params: MeteringLogParams): Promise<MeteringLogResult> {
  const { cost: costReady, deductSource: deductSourceReady } = await auditLogNewColumns();

  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  if (params.tenantId) {
    conditions.push("a.tenant_id = ?");
    values.push(params.tenantId);
  }
  if (params.model) {
    conditions.push("a.model = ?");
    values.push(params.model);
  }
  if (params.provider) {
    conditions.push("a.provider = ?");
    values.push(params.provider);
  }
  conditions.push(...dateRangeConditions("a.created_at", params, values));
  const where = conditions.join(" AND ");
  const offset = (params.page - 1) * params.pageSize;

  const costSelect = costReady ? "a.cost AS cost" : "NULL AS cost";
  const deductSourceSelect = deductSourceReady
    ? "a.deduct_source AS deductSource"
    : "NULL AS deductSource";

  const [totalRow, rows] = await Promise.all([
    queryOne<{ total: unknown }>(
      `SELECT COUNT(*) AS total FROM t_ai_audit_log a WHERE ${where}`,
      values
    ),
    query<RawMeteringLogRow>(
      `SELECT a.id, a.created_at AS createdAt, a.tenant_id AS tenantId,
              COALESCE(t.tenant_name, t.company_name) AS tenantName,
              a.intent, a.model, a.provider,
              ${deductSourceSelect},
              a.prompt_tokens AS promptTokens, a.completion_tokens AS completionTokens,
              ${costSelect},
              a.success, a.error_message AS errorMessage
       FROM t_ai_audit_log a
       LEFT JOIN t_tenant t ON t.id = a.tenant_id
       WHERE ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...values, params.pageSize, offset]
    ),
  ]);

  const records: MeteringLogRow[] = (Array.isArray(rows) ? rows : []).map((row) => {
    const promptTokens = toCount(row.promptTokens);
    const completionTokens = toCount(row.completionTokens);
    const success = Number(row.success ?? 0) === 1;
    return {
      id: Number(row.id ?? 0),
      time: formatDateTimeValue(row.createdAt),
      tenantId: toNullableText(row.tenantId) ?? "",
      tenantName: toNullableText(row.tenantName),
      scene: toNullableText(row.intent),
      model: toNullableText(row.model),
      provider: toNullableText(row.provider),
      deductSource: toNullableText(row.deductSource),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost: toNullableAmount(row.cost),
      success,
      status: success ? "SUCCESS" : "FAILED",
      errorMessage: toNullableText(row.errorMessage),
    };
  });

  const unavailable: { key: string; reason: string }[] = [];
  if (!costReady) {
    unavailable.push({
      key: "cost",
      reason: "t_ai_audit_log.cost 尚未就绪（迁移 177 未执行）⇒ 恒返回 null，不造 0",
    });
  }
  if (!deductSourceReady) {
    unavailable.push({
      key: "deductSource",
      reason: "t_ai_audit_log.deduct_source 尚未就绪（迁移 177 未执行）⇒ 恒返回 null，不造值",
    });
  }

  return {
    records,
    total: toCount(totalRow?.total),
    page: params.page,
    pageSize: params.pageSize,
    costUnit: "CNY",
    costScale: AI_COST_SCALE,
    unavailable,
    contractNotes: [
      "scene 取自 t_ai_audit_log.intent（既有语义列，原样透出，不做映射、不新造枚举）；库内为技术意图标签（如 chat/tool_execution/write_guard），业务场景口径待裁定",
      "cost / deductSource 为迁移 177 新增列，历史行 NULL（凌舟裁定 §三.4 本轮不回填）⇒ null 表示「未记录」，不等同 0",
      "status 由 success 列派生（1 ⇒ SUCCESS、其余 ⇒ FAILED），同时返回 success 与 errorMessage 原文",
      "tenantName 来自 t_tenant（tenant_name 缺失时取 company_name）；租户无记录时为 null，不回退造值",
    ],
  };
}

/* ==========================================================
 * 四、GET /api/platform/ai/model-share —— 模型占比（逐次明细聚合）
 * ========================================================== */

export type ModelShareParams = DateRange;

export interface ModelShareRow {
  /** 模型名（`t_ai_audit_log.model` 原样；NULL 归入 `model: null` 组） */
  model: string | null;
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** 费用合计（无任何 cost 记录 ⇒ null，不填 0） */
  cost: number | null;
  /** 本模型下有 cost 记录的行数（用于识别部分覆盖，避免把部分和当成全量） */
  costRecordedRows: number;
  /** 调用次数占比（% / 2 位小数；总调用为 0 ⇒ null） */
  callShare: number | null;
  /** Token 占比（% / 2 位小数；总 Token 为 0 ⇒ null） */
  tokenShare: number | null;
}

export interface ModelShareResult {
  records: ModelShareRow[];
  /** 模型数（分组行数） */
  total: number;
  totals: {
    callCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number | null;
    costRecordedRows: number;
  };
  /** 占比单位固定为百分比（前端零换算） */
  shareUnit: "PERCENT";
  shareScale: number;
  costUnit: "CNY";
  costScale: number;
  scope: { startDate: string | null; endDate: string | null };
  unavailable: { key: string; reason: string }[];
  contractNotes: string[];
}

interface RawModelShareRow {
  model: unknown;
  calls: unknown;
  promptTokens: unknown;
  completionTokens: unknown;
  totalTokens: unknown;
  cost: unknown;
  costRecordedRows: unknown;
}

/**
 * 模型占比：**只**按 `t_ai_audit_log` 逐次明细 `GROUP BY model`。
 * 明确禁止使用 `t_ai_usage_daily`（唯一键不含 `model`、UPSERT 不更新 `model`，按模型聚合必然归错）。
 */
export async function getModelShare(params: ModelShareParams): Promise<ModelShareResult> {
  const { cost: costReady } = await auditLogNewColumns();

  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  conditions.push(...dateRangeConditions("a.created_at", params, values));
  const where = conditions.join(" AND ");
  const costExpr = costReady ? "a.cost" : "NULL";

  const rows = await query<RawModelShareRow>(
    `SELECT a.model,
            COUNT(*) AS calls,
            IFNULL(SUM(a.prompt_tokens), 0) AS promptTokens,
            IFNULL(SUM(a.completion_tokens), 0) AS completionTokens,
            IFNULL(SUM(a.prompt_tokens + a.completion_tokens), 0) AS totalTokens,
            SUM(${costExpr}) AS cost,
            COUNT(${costExpr}) AS costRecordedRows
     FROM t_ai_audit_log a
     WHERE ${where}
     GROUP BY a.model
     ORDER BY calls DESC, a.model ASC`,
    values
  );

  const raw = Array.isArray(rows) ? rows : [];
  const totalCalls = raw.reduce((sum, row) => sum + toCount(row.calls), 0);
  const totalTokens = raw.reduce((sum, row) => sum + toCount(row.totalTokens), 0);

  const records: ModelShareRow[] = raw.map((row) => {
    const callCount = toCount(row.calls);
    const rowTokens = toCount(row.totalTokens);
    return {
      model: toNullableText(row.model),
      callCount,
      promptTokens: toCount(row.promptTokens),
      completionTokens: toCount(row.completionTokens),
      totalTokens: rowTokens,
      cost: toNullableAmount(row.cost),
      costRecordedRows: toCount(row.costRecordedRows),
      callShare: totalCalls > 0 ? round2((callCount / totalCalls) * 100) : null,
      tokenShare: totalTokens > 0 ? round2((rowTokens / totalTokens) * 100) : null,
    };
  });

  const totalCostRecordedRows = records.reduce((sum, row) => sum + row.costRecordedRows, 0);
  const totalCost =
    totalCostRecordedRows > 0
      ? round4(records.reduce((sum, row) => sum + (row.cost ?? 0), 0))
      : null;

  const unavailable: { key: string; reason: string }[] = [];
  if (!costReady) {
    unavailable.push({
      key: "cost",
      reason: "t_ai_audit_log.cost 尚未就绪（迁移 177 未执行）⇒ 费用占比不可算，cost 恒 null",
    });
  }

  return {
    records,
    total: records.length,
    totals: {
      callCount: totalCalls,
      promptTokens: records.reduce((sum, row) => sum + row.promptTokens, 0),
      completionTokens: records.reduce((sum, row) => sum + row.completionTokens, 0),
      totalTokens,
      cost: totalCost,
      costRecordedRows: totalCostRecordedRows,
    },
    shareUnit: "PERCENT",
    shareScale: 2,
    costUnit: "CNY",
    costScale: AI_COST_SCALE,
    scope: { startDate: params.startDate ?? null, endDate: params.endDate ?? null },
    unavailable,
    contractNotes: [
      "口径：只按 t_ai_audit_log 逐次明细 GROUP BY model；禁止用 t_ai_usage_daily 近似（其唯一键 uk_tenant_date_provider 不含 model、UPSERT 不更新 model，按模型聚合必然归错）",
      "callShare / tokenShare 为百分比（2 位小数，后端算好，前端零换算）；分母为本次筛选范围内的合计",
      "model 为 NULL 的历史行归入 model: null 分组（原样透出，不做填充）",
      "cost 为迁移 177 新增列，仅统计有记录的行；costRecordedRows 用于识别部分覆盖（历史行为 NULL，见 S3-103）",
    ],
  };
}

/* ==========================================================
 * 五、GET /api/platform/ai/abnormal-tenants —— 异常用量租户
 * ========================================================== */

/**
 * 阈值候选列名白名单（按列名语义匹配既有列，不写死任何列的取值）。
 * 判据：只允许用 `t_platform_ai_config` 既有列做阈值来源（派单卡 §三.3）。
 */
export const ABNORMAL_THRESHOLD_NAME_PATTERNS = [
  "threshold",
  "alert",
  "quota",
  "limit",
] as const;

export interface AbnormalTenantsResult {
  /** 阈值来源：UNAVAILABLE = 表内无阈值/配额列（或口径未裁定）⇒ 不计算异常数 */
  thresholdSource: "UNAVAILABLE";
  thresholds: null;
  /** 运行时探测到的候选阈值列（当前为空数组，即表内无可用阈值列） */
  thresholdColumns: string[];
  abnormalTenantCount: null;
  records: never[];
  total: number;
  /** 判据（哪张表 / 哪个列 / 什么比较）——口径待裁定，故本轮不计算 */
  criteria: string;
  unavailable: { key: string; reason: string }[];
  contractNotes: string[];
}

/**
 * 异常用量租户计数 + 明细。
 *
 * 凌舟裁定（派单卡 §三.3）：阈值与配额**一律**取 `t_platform_ai_config` 既有列；
 * 禁止 env 硬编码阈值、禁止写死常量。该表既有列为
 * `default_provider/default_model/default_api_key/default_endpoint/default_temperature/
 * default_max_tokens/default_system_prompt`（docs/migrations/121_ai_base_tables.sql:26-38）
 * —— **无任何阈值/配额列** ⇒ 按裁定返回 `thresholdSource: "UNAVAILABLE"` 且**不计算异常数**
 * （不造数、不自行加列、不建表）。
 *
 * 此处用运行时探测（information_schema）而非仅凭 DDL 断言，保证结论与生产真实列一致；
 * 即使探测到候选列也**不**擅自定口径（阈值取自哪一列、与哪张用量表如何比较均需凌舟裁定）。
 */
export async function listAbnormalTenants(): Promise<AbnormalTenantsResult> {
  const rows = await query<{ columnName: unknown }>(
    `SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_platform_ai_config'
       AND (COLUMN_NAME LIKE '%threshold%' OR COLUMN_NAME LIKE '%alert%'
            OR COLUMN_NAME LIKE '%quota%' OR COLUMN_NAME LIKE '%limit%')`
  );
  const thresholdColumns = Array.from(
    new Set((Array.isArray(rows) ? rows : []).map((row) => String(row.columnName ?? "")))
  )
    .filter((name) => name !== "")
    .sort();

  return {
    thresholdSource: "UNAVAILABLE",
    thresholds: null,
    thresholdColumns,
    abnormalTenantCount: null,
    records: [],
    total: 0,
    criteria:
      "异常判据（口径待凌舟裁定，故本轮不计算）：以 t_ai_usage_daily 当日 SUM(total_cost) / " +
      "SUM(total_tokens)（列见 docs/migrations/121_ai_base_tables.sql:95-99）与 " +
      "t_platform_ai_config 的阈值列比较，超出阈值即判异常。当前该表无阈值/配额列 ⇒ " +
      "thresholdSource=UNAVAILABLE，不计算异常租户数、不返回明细。",
    unavailable: [
      {
        key: "thresholdSource",
        reason:
          "t_platform_ai_config 无名称含 threshold/alert/quota/limit 的可用列" +
          `（运行时探测命中 ${thresholdColumns.length} 列）⇒ 无法取阈值，按派单卡 §三.3 不计算异常数`,
      },
    ],
    contractNotes: [
      "阈值只允许来自 t_platform_ai_config 既有列（禁止 env 硬编码、禁止写死常量）",
      "abnormalTenantCount=null / records=[] 表示「未计算」，不是「异常数为 0」",
      "如需启用本能力，须由凌舟裁定：阈值列（哪个列）+ 判据口径（哪张表、哪个比较）—— 本单不自行加列、不建表",
    ],
  };
}
