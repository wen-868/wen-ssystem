import { z } from "zod";
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import {
  getAuditLogById,
  insertPlatformAuditLog,
  listAuditLogs,
  type AuditLogItem,
} from "../admin/platform-audit-log.service";
import { getTenantQuota } from "./tenant-quota.service";

/**
 * R101-C4-1b 段二（包C）：平台监控后端缺口补齐（零 DDL）
 *
 * 覆盖 C4-0 清账列出的监控域缺口（派单卡 §二.段二）：
 * - 代登录审计（列表 / 导出 / 单条审计报告）：**复用** `services/admin/platform-audit-log.service.ts`
 *   的读路径（`listAuditLogs` / `getAuditLogById`），不另写一套同表 SQL；留痕表口径 =
 *   `module='tenant'` + `action='PROXY_LOGIN'`（写入口 `services/platform/tenant-ops.service.ts`
 *   `proxyLogin` → `insertPlatformAuditLog`）。
 * - 存储占用 TOP N：`t_upload_file.file_size` 聚合；配额**复用** `tenant-quota.service.getTenantQuota`
 *   （与 `GET /api/platform/tenants/:id/quota` 同口径），无配额 ⇒ `null`（不填 0）。
 * - 孤儿文件扫描：只按**库内归属关系**判定（租户不存在 / 未关联业务对象），只读、不删除。
 * - 各租户 API 调用量 + 月报导出：只读聚合 C3 的 `t_open_api_call_daily`（**不建同义表**）。
 * - 监控阈值配置：落既有 `t_platform_config`（`config_key='monitor:thresholds'`）；
 *   未配置 ⇒ `thresholds: null`（**系统不内置默认阈值**，凌舟裁定 R101-S2-02 护栏④）。
 *
 * 硬性口径：
 * 1. **平台级**：本文件不接收 `req.tenantId`（`requirePlatformAuth` 不注入该字段，踩坑日志 [35] / S3-86 / S3-91）；
 * 2. **零假数据**：无数据一律 `records: []`；无载体的字段返回 `null` 并在 `fieldNotes` / `unavailable` 逐条说明；
 * 3. **零 DDL**：本段不新增表、不新增列、不改既有迁移文件。
 */

/* ==================================================================
 * 一、通用工具
 * ================================================================== */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 当前本地时间（SQL DATETIME 形态，秒级）；仅用于「会话是否仍在有效期」等派生判断 */
function nowDateTime(): string {
  const now = new Date();
  return (
    `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ` +
    `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
  );
}

/** SQL DATETIME/DATE 文本（或 Date 实例）→ Date；非法 ⇒ null */
function parseSqlDateTime(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value == null || value === "") return null;
  const text = String(value).trim();
  const iso = text.includes("T") ? text : text.replace(" ", "T");
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso) ? `${iso}:00` : iso;
  const ms = Date.parse(withSeconds);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Date → SQL DATETIME 文本（本地时区） */
function formatDateTime(value: Date): string {
  return (
    `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ` +
    `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
  );
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text === "" ? null : text;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** 2 位小数（存储/占用率口径；后端一次性换算，前端零除法） */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 业务错误（统一走 error-handler 的 `statusCode` 分支 ⇒ 400） */
function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

/**
 * `YYYY-MM` 账期解析（缺省 = 当前自然月；**不回落固定账期**）。
 * 返回的 `dateStart` / `dateEnd` 为闭区间日期，供 `DATE` 列区间过滤（走索引，不用 DATE_FORMAT 包列）。
 */
export function parseMonthRange(
  input?: string,
  fallback: Date = new Date()
): { month: string; dateStart: string; dateEnd: string } {
  const month =
    input == null || input === ""
      ? `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}`
      : String(input).trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw badRequest("月份参数非法：需为 YYYY-MM 形式（如 2026-09）");
  }
  const [year, mon] = month.split("-").map(Number);
  // 下月第 0 天 = 本月最后一天
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { month, dateStart: `${month}-01`, dateEnd: `${month}-${pad2(lastDay)}` };
}

interface TenantNameRow {
  id: unknown;
  tenantName: unknown;
  tenantCode: unknown;
}

interface TenantBrief {
  tenantName: string | null;
  tenantCode: string | null;
}

/**
 * 批量取租户名（t_tenant，`tenant_name` 优先、缺省回退 `company_name`）。
 * 说明：本函数查询的是 **t_tenant**（非审计表），用于给审计行补「目标租户」展示名；
 * 审计表本身的读取路径仍唯一来自 platform-audit-log.service（不产生第二套同表 SQL）。
 */
async function loadTenantNames(tenantIds: string[]): Promise<Map<string, TenantBrief>> {
  const unique = Array.from(new Set(tenantIds.filter((id) => id != null && id !== "")));
  const map = new Map<string, TenantBrief>();
  if (unique.length === 0) return map;

  const placeholders = unique.map(() => "?").join(", ");
  const rows = await query<TenantNameRow>(
    `SELECT t.id, COALESCE(t.tenant_name, t.company_name) AS tenantName, t.tenant_code AS tenantCode
       FROM t_tenant t
      WHERE t.id IN (${placeholders})`,
    unique
  );
  for (const row of Array.isArray(rows) ? rows : []) {
    map.set(String(row.id), {
      tenantName: asText(row.tenantName),
      tenantCode: asText(row.tenantCode),
    });
  }
  return map;
}

/* ==================================================================
 * 二、代登录审计（列表 / 导出 / 单条审计报告）
 * ==================================================================
 * 数据源（唯一）：`t_platform_audit_log`，读路径统一走 `platform-audit-log.service`。
 * 留痕口径由写入口决定：`services/platform/tenant-ops.service.ts` 的 `proxyLogin()` 写入
 * `module='tenant'`、`action='PROXY_LOGIN'`、`detail.type='PROXY_LOGIN'`，
 * `detail` 内含 `{ tenantId, tenantCode, loginUsername, loginUserId, reason, ttlSeconds }`。
 */

export const PROXY_AUDIT_MODULE = "tenant";
export const PROXY_AUDIT_ACTION = "PROXY_LOGIN";
export const PROXY_AUDIT_TYPE = "PROXY_LOGIN";

export const PROXY_AUDIT_CRITERIA =
  "代登录留痕口径：t_platform_audit_log 中 module='tenant' 且 action='PROXY_LOGIN' " +
  "（写入口 services/platform/tenant-ops.service.ts 的 proxyLogin → insertPlatformAuditLog）";

/**
 * 「设计稿有列、后端无载体」字段的逐条说明（一行一条，前端据此展示「—」而不是 0/空串）。
 * 这些字段**不造值**：无法从既有列派生的，一律返回 null 并在本清单给出业务理由。
 */
export const PROXY_AUDIT_FIELD_NOTES: { field: string; reason: string }[] = [
  {
    field: "ticketNo",
    reason: "工单号无载体：代登录留痕未记录工单号（工单系统属 C6 范围，C4-0 裁定 §二.2 本轮不建表）",
  },
  {
    field: "exitAt",
    reason: "退出时间无载体：仓库只有代登录「签发时点」，没有退出/失效回写（无会话表、无回写点）",
  },
  {
    field: "duration",
    reason: "会话时长无载体：同 exitAt（无退出回写 ⇒ 无法得出实际时长，不按 TTL 冒充）",
  },
  {
    field: "actionSummary",
    reason: "操作摘要无载体：无会话级操作留痕表（逐屏记录/录屏属客户端采集能力，M05/M06 本批不做）",
  },
  {
    field: "approver",
    reason: "审批人无载体：仓库无审批流表；代登录当前只强制填写事由 + 平台审计留痕",
  },
];

export interface ProxyAuditRow {
  id: number;
  /** 工单号（无载体 ⇒ 恒 null） */
  ticketNo: string | null;
  operator: string;
  operatorId: number;
  tenantId: string | null;
  tenant: string | null;
  tenantCode: string | null;
  reason: string | null;
  loginUsername: string | null;
  /** 进入时间 = 审计行 created_at（代登录签发时点） */
  enterAt: string | null;
  /** 预计失效时间 = 进入时间 + detail.ttlSeconds（可派生，非假值） */
  expiresAt: string | null;
  /** 退出时间（无载体 ⇒ 恒 null） */
  exitAt: string | null;
  /** 会话时长（无载体 ⇒ 恒 null） */
  duration: null;
  /** 会话是否仍在有效期（由 expiresAt 与实际时间派生；无法判定 ⇒ null） */
  ongoing: boolean | null;
  /** 操作摘要（无载体 ⇒ 恒 null） */
  actionSummary: null;
  /** 审批人（无载体 ⇒ 恒 null） */
  approver: null;
  ip: string | null;
  description: string | null;
}

export interface ProxyAuditListParams {
  operator?: string;
  month?: string;
  page: number;
  pageSize: number;
}

export interface ProxyAuditListResult {
  records: ProxyAuditRow[];
  total: number;
  page: number;
  pageSize: number;
  month: string;
  criteria: string;
  fieldNotes: { field: string; reason: string }[];
}

function tenantIdOfAuditRow(row: AuditLogItem): string | null {
  const fromDetail = asText(row.detail?.tenantId);
  return fromDetail ?? asText(row.targetId);
}

function toProxyAuditRow(
  row: AuditLogItem,
  tenantMap: Map<string, TenantBrief>,
  now: string
): ProxyAuditRow {
  const detail = row.detail ?? {};
  const tenantId = tenantIdOfAuditRow(row);
  const brief = tenantId == null ? undefined : tenantMap.get(tenantId);
  const enterAt = asText(row.createdAt);
  const ttlSeconds = asNumber(detail.ttlSeconds);
  const enterDate = parseSqlDateTime(enterAt);
  const expiresAt =
    enterDate && ttlSeconds != null && ttlSeconds > 0
      ? formatDateTime(new Date(enterDate.getTime() + ttlSeconds * 1000))
      : null;
  const nowDate = parseSqlDateTime(now);
  const ongoing =
    expiresAt && nowDate ? (parseSqlDateTime(expiresAt) as Date).getTime() > nowDate.getTime() : null;

  return {
    id: row.id,
    ticketNo: asText(detail.ticketNo),
    operator: row.adminName,
    operatorId: row.adminId,
    tenantId,
    tenant: brief?.tenantName ?? null,
    tenantCode: brief?.tenantCode ?? asText(detail.tenantCode),
    reason: asText(detail.reason),
    loginUsername: asText(detail.loginUsername),
    enterAt,
    expiresAt,
    exitAt: null,
    duration: null,
    ongoing,
    actionSummary: null,
    approver: null,
    ip: row.ip ?? row.ipAddress,
    description: row.description,
  };
}

/**
 * C-1：代登录审计列表（按操作人 / 按月筛选，分页）。
 * 无数据 ⇒ `records: []`（不造数）。
 */
export async function listProxyAudit(
  params: ProxyAuditListParams,
  options: { now?: string } = {}
): Promise<ProxyAuditListResult> {
  const { month, dateStart, dateEnd } = parseMonthRange(params.month);

  // 复用审计日志读路径（含 A8 修复后的真实列投影）
  const result = await listAuditLogs({
    page: params.page,
    pageSize: params.pageSize,
    type: PROXY_AUDIT_TYPE,
    module: PROXY_AUDIT_MODULE,
    action: PROXY_AUDIT_ACTION,
    adminName: params.operator,
    dateStart,
    dateEnd,
  });

  const tenantMap = await loadTenantNames(
    result.records
      .map((row) => tenantIdOfAuditRow(row))
      .filter((id): id is string => id != null)
  );
  const now = options.now ?? nowDateTime();

  return {
    records: result.records.map((row) => toProxyAuditRow(row, tenantMap, now)),
    total: result.total,
    page: params.page,
    pageSize: params.pageSize,
    month,
    criteria: PROXY_AUDIT_CRITERIA,
    fieldNotes: PROXY_AUDIT_FIELD_NOTES,
  };
}

/** 五步审计法（设计稿）逐步状态；`NO_CARRIER` = 后端无载体，如实声明而不是标「已完成」 */
export interface ProxyAuditReportStep {
  step: number;
  name: string;
  status: "DONE" | "NO_CARRIER";
  basis: string;
}

export interface ProxyAuditReport {
  id: number;
  operator: string;
  operatorId: number;
  tenantId: string | null;
  tenantName: string | null;
  tenantCode: string | null;
  reason: string | null;
  loginUsername: string | null;
  ip: string | null;
  enterAt: string | null;
  ttlSeconds: number | null;
  expiresAt: string | null;
  sessionStatus: "ONGOING" | "EXPIRED" | "UNKNOWN";
  steps: ProxyAuditReportStep[];
  criteria: string;
  fieldNotes: { field: string; reason: string }[];
}

/** 五步审计法逐条状态（抽成纯函数，便于单测与复杂度控制） */
function buildReportSteps(ttlSeconds: number | null, reason: string | null): ProxyAuditReportStep[] {
  const hasTtl = ttlSeconds != null && ttlSeconds > 0;
  const staticSteps: ProxyAuditReportStep[] = [
    {
      step: 2,
      name: "审批（审批人≠申请人）",
      status: "NO_CARRIER",
      basis: "仓库无审批流表与审批人字段：代登录当前只做「强制填写事由 + 平台审计留痕」",
    },
    {
      step: 4,
      name: "全程留痕录屏",
      status: "NO_CARRIER",
      basis: "无录屏采集与存储（M05/M06 属客户端采集能力，本批不做）",
    },
    {
      step: 5,
      name: "回放与月度抽检",
      status: "NO_CARRIER",
      basis: "无会话回放载体（依赖第 4 步录屏数据）",
    },
  ];

  return [
    {
      step: 1,
      name: "申请（工单关联必填）",
      status: reason ? "DONE" : "NO_CARRIER",
      basis: reason ? `事由已落库（detail.reason）：${reason}` : "detail.reason 缺失，无法证明申请环节",
    },
    staticSteps[0],
    {
      step: 3,
      name: "限时会话（≤30 分钟）",
      status: hasTtl ? "DONE" : "NO_CARRIER",
      basis: hasTtl
        ? `detail.ttlSeconds=${ttlSeconds}（签发即写入的令牌有效期）`
        : "detail.ttlSeconds 缺失，会话时限无法证明",
    },
    staticSteps[1],
    staticSteps[2],
  ];
}

/** 由签发时点 + TTL 派生「预计失效时间」与「会话状态」 */
function resolveSession(
  enterAt: string | null,
  ttlSeconds: number | null,
  now: string
): { expiresAt: string | null; ttlSeconds: number | null; sessionStatus: ProxyAuditReport["sessionStatus"] } {
  const enterDate = parseSqlDateTime(enterAt);
  const validTtl = ttlSeconds != null && ttlSeconds > 0 ? ttlSeconds : null;
  const expiresAt =
    enterDate && validTtl != null
      ? formatDateTime(new Date(enterDate.getTime() + validTtl * 1000))
      : null;
  const expiresDate = parseSqlDateTime(expiresAt);
  const nowDate = parseSqlDateTime(now);
  if (!expiresDate || !nowDate) {
    return { expiresAt, ttlSeconds: validTtl, sessionStatus: "UNKNOWN" };
  }
  return {
    expiresAt,
    ttlSeconds: validTtl,
    sessionStatus: expiresDate.getTime() > nowDate.getTime() ? "ONGOING" : "EXPIRED",
  };
}

/**
 * C-2：单条代登录审计记录报告（按 `:id`）。
 * 复用 `getAuditLogById`（同一条读路径）；记录不存在 ⇒ 404（不返回空壳报告）。
 */
export async function getProxyAuditReport(
  id: number,
  options: { now?: string } = {}
): Promise<ProxyAuditReport> {
  const row = await getAuditLogById(id);
  if (!row) throw new AppError("代登录记录不存在", 404);

  const detail = row.detail ?? {};
  const tenantId = tenantIdOfAuditRow(row);
  const tenantMap = await loadTenantNames(tenantId == null ? [] : [tenantId]);
  const brief = tenantId == null ? undefined : tenantMap.get(tenantId);
  const reason = asText(detail.reason);
  const session = resolveSession(
    asText(row.createdAt),
    asNumber(detail.ttlSeconds),
    options.now ?? nowDateTime()
  );

  return {
    id: row.id,
    operator: row.adminName,
    operatorId: row.adminId,
    tenantId,
    tenantName: brief?.tenantName ?? null,
    tenantCode: brief?.tenantCode ?? asText(detail.tenantCode),
    reason,
    loginUsername: asText(detail.loginUsername),
    ip: row.ip ?? row.ipAddress,
    enterAt: asText(row.createdAt),
    ttlSeconds: session.ttlSeconds,
    expiresAt: session.expiresAt,
    sessionStatus: session.sessionStatus,
    steps: buildReportSteps(session.ttlSeconds, reason),
    criteria: PROXY_AUDIT_CRITERIA,
    fieldNotes: PROXY_AUDIT_FIELD_NOTES,
  };
}

/* ==================================================================
 * 三、存储监控：租户占用 TOP N + 孤儿文件扫描
 * ================================================================== */

export const STORAGE_TOP_DEFAULT_LIMIT = 5;
export const STORAGE_TOP_MAX_LIMIT = 20;

export const STORAGE_CRITERIA =
  "存储占用口径：t_upload_file 中 status=1 的行，按 tenant_id 聚合 IFNULL(SUM(file_size),0)（字节）；" +
  "配额上限复用 tenant-quota.service.getTenantQuota 的 storage.limit（GB），与 GET /api/platform/tenants/:id/quota 完全同口径";

export const STORAGE_NOTES: string[] = [
  "usedBytes 为字节原值；usedGb 为字节换算后的 GB（2 位小数，后端一次性换算，前端零除法）",
  "quotaLimitGb 为 null ⇒ 该租户无存储配额载体（无订阅套餐且无 t_tenant_config.storage_limit）⇒ usagePercent 同为 null，不填 0",
  "本端点只读、不做上传拦截；80%/95%/100% 三档处置阈值不在本端点计算（阈值配置见 GET/PUT /api/platform/monitor/thresholds）",
];

export interface StorageTopRow {
  rank: number;
  tenantId: string;
  tenantName: string | null;
  tenantCode: string | null;
  usedBytes: number;
  /** 占用（GB / 2 位小数） */
  usedGb: number;
  fileCount: number;
  /** 配额上限（GB；null = 无配额载体） */
  quotaLimitGb: number | null;
  /** 使用率（%；无配额 ⇒ null） */
  usagePercent: number | null;
  /** 配额来源：UNCONFIGURED（无载体）/ TENANT_QUOTA（tenant-quota.service 口径） */
  quotaSource: "UNCONFIGURED" | "TENANT_QUOTA";
}

export interface StorageTopResult {
  records: StorageTopRow[];
  total: number;
  limit: number;
  unit: "GB";
  criteria: string;
  notes: string[];
}

interface RawStorageRow {
  tenantId: unknown;
  usedBytes: unknown;
  fileCount: unknown;
}

/** C-3：存储占用 TOP N（无数据 ⇒ `records: []`） */
export async function getStorageTop5(limit: number): Promise<StorageTopResult> {
  const rows = await query<RawStorageRow>(
    `SELECT f.tenant_id AS tenantId,
            IFNULL(SUM(f.file_size), 0) AS usedBytes,
            COUNT(*) AS fileCount
       FROM t_upload_file f
      WHERE f.status = 1
      GROUP BY f.tenant_id
      ORDER BY usedBytes DESC, f.tenant_id ASC
      LIMIT ?`,
    [limit]
  );

  const list = Array.isArray(rows) ? rows : [];
  const tenantMap = await loadTenantNames(list.map((row) => String(row.tenantId)));

  const records: StorageTopRow[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    const tenantId = String(row.tenantId);
    const usedBytes = asNumber(row.usedBytes) ?? 0;
    const usedGb = round2(usedBytes / 1024 ** 3);
    // 配额复用既有配额服务（不另写一套配额 SQL，避免出现第二个口径）
    const quota = await getTenantQuota(tenantId);
    const quotaLimitGb = quota.quota.storage?.limit ?? null;
    records.push({
      rank: index + 1,
      tenantId,
      tenantName: tenantMap.get(tenantId)?.tenantName ?? null,
      tenantCode: tenantMap.get(tenantId)?.tenantCode ?? null,
      usedBytes,
      usedGb,
      fileCount: asNumber(row.fileCount) ?? 0,
      quotaLimitGb,
      usagePercent: quotaLimitGb != null && quotaLimitGb > 0 ? round2((usedGb / quotaLimitGb) * 100) : null,
      quotaSource: quotaLimitGb == null ? "UNCONFIGURED" : "TENANT_QUOTA",
    });
  }

  return {
    records,
    total: records.length,
    limit,
    unit: "GB",
    criteria: STORAGE_CRITERIA,
    notes: STORAGE_NOTES,
  };
}

export const ORPHAN_SCAN_LIMIT = 500;

export const ORPHAN_CRITERIA: string[] = [
  "扫描范围：t_upload_file 中 status=1（未软删）的行；只按**库内归属关系**判定，不比对磁盘文件是否存在（仓库无磁盘清单数据源）",
  "判定口径①（TENANT_MISSING）：该行的 tenant_id 在 t_tenant 中不存在（租户已删除 / 未建）",
  "判定口径②（NO_BIZ_LINK）：biz_type 与 biz_id 均为 NULL（未关联任何业务对象，疑似上传中断残留）",
  "两口径取并集，逐行回传 reasons；本端点为**只读扫描**，不删除、不改状态",
];

export interface OrphanFileRow {
  id: number;
  tenantId: string;
  tenantName: string | null;
  fileName: string | null;
  filePath: string | null;
  fileSize: number;
  bizType: string | null;
  bizId: number | null;
  createdAt: string | null;
  reasons: ("TENANT_MISSING" | "NO_BIZ_LINK")[];
}

export interface OrphanScanResult {
  records: OrphanFileRow[];
  total: number;
  scanLimit: number;
  scanLimitReached: boolean;
  criteria: string[];
  notes: string[];
}

interface RawOrphanRow {
  id: unknown;
  tenantId: unknown;
  fileName: unknown;
  filePath: unknown;
  fileSize: unknown;
  bizType: unknown;
  bizId: unknown;
  createdAt: unknown;
  tenantMissing: unknown;
}

/** C-4：孤儿文件扫描（可选按租户过滤；无结果 ⇒ `records: []`） */
export async function scanOrphanFiles(params: { tenantId?: string }): Promise<OrphanScanResult> {
  const conditions = [
    "f.status = 1",
    "(t.id IS NULL OR (f.biz_type IS NULL AND f.biz_id IS NULL))",
  ];
  const values: unknown[] = [];
  if (params.tenantId) {
    conditions.push("f.tenant_id = ?");
    values.push(params.tenantId);
  }

  /**
   * R101-C4-1c（同族前例 C5-1b）：跨表 JOIN 的列↔列谓词**必须显式钉 collation**。
   *
   * 生产实测（凌舟 2026-09-25）：本端点 500，pm2 日志
   * `Illegal mix of collations (utf8mb4_0900_ai_ci,IMPLICIT) and (utf8mb4_unicode_ci,IMPLICIT) for operation '='`。
   * 两侧 collation 依据（DDL 原文，非猜测）：
   * - `t_upload_file.tenant_id` = **utf8mb4_unicode_ci**：`docs/migrations/115_missing_tables.sql:66`
   *   `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上传文件记录表';`
   * - `t_tenant.id` = **utf8mb4_0900_ai_ci**：`docs/migrations/029_add_tenant.sql:31` 与
   *   `docs/migrations/092_租户ID.sql:64-76` 均为 `ENGINE=... DEFAULT CHARSET=utf8mb4`（**未写 COLLATE**）
   *   ⇒ 跟随库默认，见 `docs/migrations/001_phase1_schema.sql:7-9`
   *   `CREATE DATABASE ... DEFAULT COLLATE utf8mb4_0900_ai_ci`。
   *
   * 修法（取 C5-1b 已验证口径，零 DDL）：
   * - `COLLATE` 只加在**非索引侧** `f.tenant_id`；需要保住的是被探测侧 `t.id` 的 `PRIMARY`；
   * - 目标 collation 取 `t.id` **自身**的 `utf8mb4_0900_ai_ci` ⇒ 比较 collation 与索引 collation 一致，
   *   `EXPLAIN` 期望 `t` 行仍 `key=PRIMARY`（否则会退化成逐行全表扫 t_tenant）；
   * - 筛选侧 `f.tenant_id = ?` **不加** COLLATE：参数为 COERCIBLE 本不触发 1267，
   *   加了反而丢 `idx_tenant_status` / `idx_tenant_biz`。
   */
  const rows = await query<RawOrphanRow>(
    `SELECT f.id, f.tenant_id AS tenantId, f.file_name AS fileName, f.file_path AS filePath,
            f.file_size AS fileSize, f.biz_type AS bizType, f.biz_id AS bizId,
            f.created_at AS createdAt, (t.id IS NULL) AS tenantMissing
       FROM t_upload_file f
       LEFT JOIN t_tenant t ON t.id = f.tenant_id COLLATE utf8mb4_0900_ai_ci
      WHERE ${conditions.join(" AND ")}
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT ?`,
    [...values, ORPHAN_SCAN_LIMIT + 1]
  );

  const scannedAll = Array.isArray(rows) ? rows : [];
  const scanLimitReached = scannedAll.length > ORPHAN_SCAN_LIMIT;
  const scanned = scanLimitReached ? scannedAll.slice(0, ORPHAN_SCAN_LIMIT) : scannedAll;
  const tenantMap = await loadTenantNames(scanned.map((row) => String(row.tenantId)));

  const records: OrphanFileRow[] = scanned.map((row) => {
    const tenantId = String(row.tenantId);
    const bizType = asText(row.bizType);
    const bizId = asNumber(row.bizId);
    const reasons: OrphanFileRow["reasons"] = [];
    if (Number(row.tenantMissing ?? 0) === 1) reasons.push("TENANT_MISSING");
    if (bizType == null && bizId == null) reasons.push("NO_BIZ_LINK");
    return {
      id: Number(row.id),
      tenantId,
      tenantName: tenantMap.get(tenantId)?.tenantName ?? null,
      fileName: asText(row.fileName),
      filePath: asText(row.filePath),
      fileSize: asNumber(row.fileSize) ?? 0,
      bizType,
      bizId,
      createdAt: asText(row.createdAt),
      reasons,
    };
  });

  return {
    records,
    total: records.length,
    scanLimit: ORPHAN_SCAN_LIMIT,
    scanLimitReached,
    criteria: ORPHAN_CRITERIA,
    notes: [
      "命中 scanLimit（500 行）时 scanLimitReached=true，表示结果被上限截断（不静默截断）",
      "「孤儿」是**待人工确认的疑似项**：口径②可能包含合法的直传文件（如未回写 biz 的素材），处置前请人工核对",
    ],
  };
}

/* ==================================================================
 * 四、各租户 API 调用量（只读复用 t_open_api_call_daily）
 * ==================================================================
 * 表来源：C3 的 `t_open_api_call_daily`（`docs/migrations/175_open_platform_api_call_daily.sql`，
 * 列 `api_key_id / tenant_id / stat_date / call_count / error_count`）——**不建同义表**。
 * 诚实声明：该表**当前无写入方**（C3-1 已声明）⇒ 真库在有写入方之前必然为空态；
 *           本端点只读，不造数、不代写。
 */

export const TENANT_API_SCAN_LIMIT = 200;

export const TENANT_API_CRITERIA =
  "调用量口径：t_open_api_call_daily 按 tenant_id 聚合 SUM(call_count) / SUM(error_count)，" +
  "区间为账期的首末日（stat_date 闭区间，走 idx_tenant_date 索引）";

export const TENANT_API_UNAVAILABLE: { key: string; reason: string }[] = [
  {
    key: "quota",
    reason:
      "套餐配额无载体：t_subscription_plan 仅有 max_users / max_stores / max_customers / max_products / max_storage_mb，无 API 调用配额列（docs/migrations/016_phase9_tenant_subscription.sql:50-54）⇒ 配额与使用率返回 null，不填 0",
  },
  {
    key: "writer",
    reason:
      "t_open_api_call_daily 当前无写入方（C3-1 声明，见 docs/migrations/175 文件末尾说明）⇒ 真库列表中「有调用量的租户」在接入写入方之前必然为空态",
  },
];

export interface TenantApiRow {
  tenantId: string;
  tenantName: string | null;
  tenantCode: string | null;
  callCount: number;
  errorCount: number;
  /** 错误率（4 位小数；无调用 ⇒ null） */
  errorRate: number | null;
  /** 配额（无载体 ⇒ 恒 null） */
  quota: null;
  /** 使用率（%）（无配额 ⇒ 恒 null） */
  usagePercent: null;
  /** 三档状态（无配额 ⇒ 恒 null） */
  status: null;
}

export interface TenantApiResult {
  records: TenantApiRow[];
  total: number;
  period: string;
  scanLimit: number;
  scanLimitReached: boolean;
  criteria: string;
  unavailable: { key: string; reason: string }[];
}

interface RawTenantApiRow {
  tenantId: unknown;
  callCount: unknown;
  errorCount: unknown;
}

/** C-5：各租户 API 调用量（按账期；无数据 ⇒ `records: []`） */
export async function getTenantApiUsage(period?: string): Promise<TenantApiResult> {
  const { month, dateStart, dateEnd } = parseMonthRange(period);

  const rows = await query<RawTenantApiRow>(
    `SELECT d.tenant_id AS tenantId,
            IFNULL(SUM(d.call_count), 0) AS callCount,
            IFNULL(SUM(d.error_count), 0) AS errorCount
       FROM t_open_api_call_daily d
      WHERE d.stat_date >= ? AND d.stat_date <= ?
      GROUP BY d.tenant_id
      ORDER BY callCount DESC, d.tenant_id ASC
      LIMIT ?`,
    [dateStart, dateEnd, TENANT_API_SCAN_LIMIT + 1]
  );

  const scannedAll = Array.isArray(rows) ? rows : [];
  const scanLimitReached = scannedAll.length > TENANT_API_SCAN_LIMIT;
  const scanned = scanLimitReached ? scannedAll.slice(0, TENANT_API_SCAN_LIMIT) : scannedAll;
  const tenantMap = await loadTenantNames(scanned.map((row) => String(row.tenantId)));

  const records: TenantApiRow[] = scanned.map((row) => {
    const tenantId = String(row.tenantId);
    const callCount = asNumber(row.callCount) ?? 0;
    const errorCount = asNumber(row.errorCount) ?? 0;
    return {
      tenantId,
      tenantName: tenantMap.get(tenantId)?.tenantName ?? null,
      tenantCode: tenantMap.get(tenantId)?.tenantCode ?? null,
      callCount,
      errorCount,
      errorRate: callCount > 0 ? Number((errorCount / callCount).toFixed(4)) : null,
      quota: null,
      usagePercent: null,
      status: null,
    };
  });

  return {
    records,
    total: records.length,
    period: month,
    scanLimit: TENANT_API_SCAN_LIMIT,
    scanLimitReached,
    criteria: TENANT_API_CRITERIA,
    unavailable: TENANT_API_UNAVAILABLE,
  };
}

/* ==================================================================
 * 五、监控阈值配置（落既有 t_platform_config，零 DDL）
 * ==================================================================
 * 载体：`t_platform_config`（`docs/migrations/074_即时零售表.sql:8-25` 建表，
 *       `docs/migrations/152_business_columns_fill.sql:84-88` 补 config_key/config_value/category/description/updated_by），
 *       键 `config_key='monitor:thresholds'`、`platform='SAAS'`、`tenant_id='platform'`。
 * 护栏④（凌舟裁定 R101-S2-02）：**系统不内置任何默认阈值**；未配置 ⇒ 返回 null 并明确「未配置」。
 * 写操作留痕：复用 `insertPlatformAuditLog`（t_platform_audit_log，仅追加），不新建表。
 */

export const MONITOR_THRESHOLD_CONFIG_KEY = "monitor:thresholds";
export const MONITOR_THRESHOLD_PLATFORM = "SAAS";
export const MONITOR_THRESHOLD_TENANT_ID = "platform";

export const MONITOR_THRESHOLD_UNCONFIGURED_NOTE =
  "未配置：系统不内置任何默认阈值（凌舟裁定 R101-S2-02 护栏④），前端应置「待配置」并阻断阈值判定；" +
  "请通过 PUT /api/platform/monitor/thresholds 配置后生效";

/**
 * 阈值包契约（与 saas-admin MonitorView「阈值配置」三档按钮一一对应）：
 * - 三档百分比必填（不提供默认值，避免「未配置」被默认值洗成「已配置」）；
 * - notify 三段开关均为必填布尔（前端提交整包，后端不做静默补默认）。
 */
export const monitorThresholdsSchema = z.object({
  version: z.number().int().positive().default(1),
  warnPercent: z.number().int().min(1).max(99),
  alertPercent: z.number().int().min(1).max(99),
  blockPercent: z.number().int().min(1).max(100),
  notify: z.object({
    warn: z.object({ inApp: z.boolean(), email: z.boolean(), sms: z.boolean() }),
    alert: z.object({ escalateTicket: z.boolean(), notifyCsm: z.boolean() }),
    block: z.object({ hardLimit429: z.boolean(), tempQuotaPlus20: z.boolean() }),
  }),
});

export type MonitorThresholds = z.infer<typeof monitorThresholdsSchema>;

export interface MonitorThresholdsResult {
  configured: boolean;
  valid: boolean | null;
  thresholds: MonitorThresholds | null;
  configKey: string;
  note: string | null;
}

interface ConfigValueRow {
  config_value: string | null;
}

/** C-6：读取监控阈值配置（未配置 ⇒ thresholds=null，不回落内置默认值） */
export async function getMonitorThresholds(): Promise<MonitorThresholdsResult> {
  const row = await queryOne<ConfigValueRow>(
    `SELECT config_value FROM t_platform_config
      WHERE config_key = ? AND platform = ? LIMIT 1`,
    [MONITOR_THRESHOLD_CONFIG_KEY, MONITOR_THRESHOLD_PLATFORM]
  );

  if (!row) {
    return {
      configured: false,
      valid: null,
      thresholds: null,
      configKey: MONITOR_THRESHOLD_CONFIG_KEY,
      note: MONITOR_THRESHOLD_UNCONFIGURED_NOTE,
    };
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.config_value ?? "");
  } catch {
    parsed = null;
  }
  const check = monitorThresholdsSchema.safeParse(parsed ?? {});
  if (!check.success) {
    return {
      configured: true,
      valid: false,
      thresholds: null,
      configKey: MONITOR_THRESHOLD_CONFIG_KEY,
      note:
        "库内 monitor:thresholds 存在但不符合契约（字段缺失或取值非法）；按「不回落默认值」口径返回 null，" +
        "请通过 PUT /api/platform/monitor/thresholds 重新提交完整配置",
    };
  }

  return {
    configured: true,
    valid: true,
    thresholds: check.data,
    configKey: MONITOR_THRESHOLD_CONFIG_KEY,
    note: null,
  };
}

export interface MonitorThresholdWriteResult {
  updated: boolean;
  thresholds: MonitorThresholds;
  configKey: string;
  auditLogId: number;
  note: string;
}

export interface MonitorOperator {
  id: number;
  name: string;
}

/**
 * C-6：保存监控阈值配置（整包 upsert 到 t_platform_config + 平台操作日志留痕）。
 * 校验失败 ⇒ zod/AppError ⇒ 400（不落库、不留痕）。
 */
export async function saveMonitorThresholds(
  payload: unknown,
  operator: MonitorOperator,
  ip: string | null
): Promise<MonitorThresholdWriteResult> {
  const validated = monitorThresholdsSchema.parse(payload ?? {});

  if (
    !(
      validated.warnPercent < validated.alertPercent &&
      validated.alertPercent < validated.blockPercent
    )
  ) {
    throw badRequest(
      `阈值取值非法：三档必须递增（warnPercent < alertPercent < blockPercent），当前为 ` +
        `${validated.warnPercent} / ${validated.alertPercent} / ${validated.blockPercent}`
    );
  }

  const json = JSON.stringify(validated);
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM t_platform_config WHERE config_key = ? AND platform = ? LIMIT 1`,
    [MONITOR_THRESHOLD_CONFIG_KEY, MONITOR_THRESHOLD_PLATFORM]
  );

  if (existing) {
    await query(
      `UPDATE t_platform_config
          SET config_value = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ?`,
      [json, operator.name, existing.id]
    );
  } else {
    await query(
      `INSERT INTO t_platform_config
         (platform, store_id, enabled, tenant_id, config_key, config_value, category, description, updated_by)
       VALUES (?, NULL, 1, ?, ?, ?, 'monitor', '监控阈值配置(JSON)', ?)`,
      [
        MONITOR_THRESHOLD_PLATFORM,
        MONITOR_THRESHOLD_TENANT_ID,
        MONITOR_THRESHOLD_CONFIG_KEY,
        json,
        operator.name,
      ]
    );
  }

  const auditLogId = await insertPlatformAuditLog({
    adminId: operator.id,
    adminName: operator.name,
    module: "monitor",
    auditType: "MONITOR_THRESHOLD_UPDATE",
    action: "MONITOR_THRESHOLD_UPDATE",
    targetType: "platform_config",
    targetId: MONITOR_THRESHOLD_CONFIG_KEY,
    description: `更新监控阈值配置：${validated.warnPercent}% / ${validated.alertPercent}% / ${validated.blockPercent}%`,
    detail: validated as unknown as Record<string, unknown>,
    ip,
  });

  return {
    updated: true,
    thresholds: validated,
    configKey: MONITOR_THRESHOLD_CONFIG_KEY,
    auditLogId,
    note: "阈值变更已写入平台操作日志（t_platform_audit_log，仅追加不可改删）",
  };
}
