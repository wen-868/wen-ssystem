import { randomInt } from "node:crypto";
import type { ResultSetHeader } from "mysql2";
import { query, queryOne, transaction, connExecute } from "../../shared/db";
import { normalizePagination, calculateOffset } from "../../shared/pagination";
import { AppError } from "../../shared/app-error";

/**
 * C6-2-T2（+ F1 修订单）：平台报表导出任务中心服务
 * （t_platform_export_task / t_platform_export_task_log，迁移 docs/migrations/182_平台报表导出任务.sql）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T2.md 交付物①②③、验收标准③④⑤⑥
 *       + docs/tasks/cards/R101-派单-20260926-C6-2-T2-F1.md（仅改端点路径为前端字面契约 /api/platform/reports/export，
 *         并新增 download 只读端点；**业务逻辑、状态机、SQL 一字未动**）
 *       + docs/tasks/cards/R101-C6-2-批2-立项卡-T1+T2+T3+T5.md §二 T2 行、§三 通用硬口径
 *
 * 口径（逐条可核对）：
 * - 平台级表：用 query()/queryOne()，不走 queryWithTenant（不注入 tenant_id 条件，与 /api/platform/* 一致）；
 * - 零假数据：所有返回值都来自真实查询，空表一律空态（records: [] / logs: []），不写隐式种子；
 * - **生成器本单不实现**（本仓全仓无导出 worker，派单卡背景与依据第 4 条）：创建后状态恒为 PENDING、
 *   progress 恒 0、file_url/file_size/started_at/finished_at 恒 NULL；任何状态下都**不**在没有真实导出文件时
 *   写 SUCCESS，也不提供任何"手动置成功"的入口（验收标准⑤，防假成功）；
 * - 状态机：创建 ⇒ PENDING；**只有** FAILED → PENDING（retry）这一条转移被允许，
 *   其它状态（含 PENDING/GENERATING/SUCCESS 与重复 retry）一律显式 400，不静默忽略、不静默成功；
 * - 不吞错：本文件不做 try/catch 包装，异常一律交给上层 errorHandler（红线④）。
 */

/**
 * 导出任务域权限点常量（派单卡交付物⑥要求"以注释登记与 T6 的 PERMISSION_CATALOG 一致的权限点"）。
 *
 * ⚠️ 现状说明（可复跑核对）：T6 的权限点目录 `PERMISSION_CATALOG`
 * （backend/src/services/platform/platform-role.service.ts）当前只有 7 个功能域（tenant/billing/sysconfig/
 * monitor/ticket/marketing/ai），**没有 export 域**（`rg -n 'permCode: "export:' ` ⇒ 0 命中）。
 * 因此本单**不新增/不修改** PERMISSION_CATALOG（扩目录属 T6 契约变更，本单红线：不得扩大改动范围），
 * 只把"导出任务中心需要的权限点"按命名规范登记如下，供 T6 目录后续补齐时逐字对齐；
 * 一致性由单测做**漂移即红**的双向核对（services/platform/platform-export-task.service.test.ts 末组用例）。
 *
 * 本单**不实现按角色强制鉴权**：T6 只有"角色 + 权限矩阵"，没有 admin↔role 绑定表，
 * 无法判定当前管理员角色，写一个"永远放行的权限校验"即为假校验（派单卡交付物⑥、验收标准⑥）。
 */
export const EXPORT_TASK_PERMISSIONS = {
  /** GET /api/platform/reports/export */ list: "export:view",
  /** POST /api/platform/reports/export */ create: "export:create",
  /** GET /api/platform/reports/export/:id/status */ detail: "export:view",
  /** GET /api/platform/reports/export/:id/download */ download: "export:view",
  /** GET /api/platform/reports/export/:id/logs */ logs: "export:view",
  /** POST /api/platform/reports/export/:id/retry */ retry: "export:retry",
} as const;

/** 本域登记的权限点全集（与 T6 目录对齐时的期望取值） */
export const EXPORT_TASK_PERMISSION_CODES: ReadonlyArray<string> = [
  "export:view",
  "export:create",
  "export:retry",
];

/** 状态四态（与迁移 182 的 status 列口径、控制器 status 过滤器逐字一致） */
export const EXPORT_TASK_STATUSES = ["PENDING", "GENERATING", "SUCCESS", "FAILED"] as const;
export type ExportTaskStatus = (typeof EXPORT_TASK_STATUSES)[number];

/** 导出格式两值（派单卡钉死：format 仅 CSV|XLSX） */
export const EXPORT_TASK_FORMATS = ["CSV", "XLSX"] as const;
export type ExportTaskFormat = (typeof EXPORT_TASK_FORMATS)[number];

/** 日志级别三态（与迁移 182 的 level 列口径一致） */
export const EXPORT_TASK_LOG_LEVELS = ["INFO", "WARN", "ERROR"] as const;
export type ExportTaskLogLevel = (typeof EXPORT_TASK_LOG_LEVELS)[number];

/**
 * 创建态：**恒为 PENDING**（不是 GENERATING —— 没有人在生成就不许显示"生成中"）。
 * 单测以本常量 + INSERT 参数双重断言，防"改成 GENERATING / 直接 SUCCESS + 假 fileUrl"的回归（验收标准④b）。
 */
export const CREATED_STATUS: ExportTaskStatus = "PENDING";

/** 创建时 progress 恒 0 */
export const CREATED_PROGRESS = 0;

/** 创建任务时写入的 INFO 日志文案（派单卡钉死原句） */
export const CREATED_LOG_MESSAGE = "任务已创建，等待生成器接入";

/** retry 允许的唯一状态转移：FAILED → PENDING */
export const RETRY_FROM_STATUS: ExportTaskStatus = "FAILED";
export const RETRY_TO_STATUS: ExportTaskStatus = "PENDING";
export const RETRY_LOG_MESSAGE = "任务已重排为 PENDING，等待生成器接入";

export interface ExportTaskRecord {
  id: number;
  taskNo: string;
  exportType: string;
  period: string | null;
  format: string;
  status: string;
  progress: number;
  fileUrl: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  createdAt: unknown;
  startedAt: unknown;
  finishedAt: unknown;
}

export interface ExportTaskLogItem {
  level: string;
  message: string;
  createdAt: unknown;
}

export interface ExportTaskListQuery {
  page?: number;
  pageSize?: number;
  /** 单状态精确筛选（PENDING/GENERATING/SUCCESS/FAILED） */
  status?: ExportTaskStatus;
}

export interface ExportTaskList {
  total: number;
  page: number;
  pageSize: number;
  records: ExportTaskRecord[];
}

export interface CreateExportTaskInput {
  exportType: string;
  period?: string | null;
  format: ExportTaskFormat;
  /** 平台管理员 ID（requirePlatformAuth 解码出的 admin.id；缺省记 NULL，不编造） */
  adminId?: number | null;
}

interface ExportTaskRow {
  id: number;
  taskNo: string;
  exportType: string;
  period: string | null;
  format: string;
  status: string;
  progress: number | string;
  fileUrl: string | null;
  fileSize: number | string | null;
  errorMessage: string | null;
  createdAt: unknown;
  startedAt: unknown;
  finishedAt: unknown;
}

interface ExportTaskLogRow {
  level: string;
  message: string;
  createdAt: unknown;
}

interface ExportTaskStateRow {
  id: number;
  taskNo: string;
  status: string;
}

/** 任务列表/详情共用列口径（避免字段名漂移） */
const TASK_COLUMNS = `id AS id, task_no AS taskNo, export_type AS exportType, period AS period,
            format AS format, status AS status, progress AS progress, file_url AS fileUrl,
            file_size AS fileSize, error_message AS errorMessage, created_at AS createdAt,
            started_at AS startedAt, finished_at AS finishedAt`;

function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toRecord(row: ExportTaskRow): ExportTaskRecord {
  return {
    id: Number(row.id),
    taskNo: String(row.taskNo),
    exportType: String(row.exportType),
    period: row.period === null || row.period === undefined ? null : String(row.period),
    format: String(row.format),
    status: String(row.status),
    progress: Number(row.progress ?? 0),
    fileUrl: row.fileUrl === null || row.fileUrl === undefined ? null : String(row.fileUrl),
    fileSize: row.fileSize === null || row.fileSize === undefined ? null : Number(row.fileSize),
    errorMessage:
      row.errorMessage === null || row.errorMessage === undefined ? null : String(row.errorMessage),
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
  };
}

function requireNonEmpty(value: string | null | undefined, label: string): string {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    throw new AppError(`${label}不能为空`, 400);
  }
  return text;
}

function requireFormat(value: string): ExportTaskFormat {
  if (!(EXPORT_TASK_FORMATS as ReadonlyArray<string>).includes(value)) {
    throw new AppError(`导出格式非法：${value}（仅支持 CSV/XLSX）`, 400);
  }
  return value as ExportTaskFormat;
}

/**
 * 任务编号：EXP + yyyyMMddHHmmss + 4 位随机数（共 21 字符 ≤ 列宽 32）。
 * 列上有 UNIQUE KEY uk_task_no 兜底；随机后缀避免同秒并发撞号（不做"查库再拼号"的二次竞态查询）。
 * 导出本函数供单测做确定性断言（时间入参可控）。
 */
export function buildTaskNo(now: Date = new Date()): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `EXP${stamp}${pad(randomInt(0, 10000), 4)}`;
}

/** 任务不存在 ⇒ 404（读 status 供状态机判定、读 task_no 供回包，避免二次查询） */
async function requireExportTask(id: number): Promise<ExportTaskStateRow> {
  const row = await queryOne<ExportTaskStateRow>(
    "SELECT id AS id, task_no AS taskNo, status AS status FROM t_platform_export_task WHERE id = ?",
    [id]
  );
  if (!row) {
    throw new AppError(`导出任务不存在：${id}`, 404);
  }
  return { id: Number(row.id), taskNo: String(row.taskNo), status: String(row.status) };
}

/**
 * 任务列表（GET /api/platform/reports/export）
 * 分页口径：page 默认 1 / pageSize 默认 20 且 ≤100（超限由控制器显式 400，不静默夹取）；
 * status 为可选精确筛选；空表 ⇒ records: []、total 0。
 */
export async function listExportTasks(input: ExportTaskListQuery = {}): Promise<ExportTaskList> {
  const { page, pageSize } = normalizePagination({ page: input.page, pageSize: input.pageSize });
  const where = input.status ? "WHERE status = ?" : "";
  const whereParams: unknown[] = input.status ? [input.status] : [];

  const totalRows = rowsOf<{ total: number | string }>(
    await query(`SELECT COUNT(*) AS total FROM t_platform_export_task ${where}`, whereParams)
  );
  const total = Number(totalRows[0]?.total ?? 0);

  const rows = rowsOf<ExportTaskRow>(
    await query(
      `SELECT ${TASK_COLUMNS}
         FROM t_platform_export_task
         ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [...whereParams, pageSize, calculateOffset(page, pageSize)]
    )
  );

  return { total, page, pageSize, records: rows.map(toRecord) };
}

/**
 * 创建导出任务（POST /api/platform/reports/export）
 *
 * **本单最重要的一条**（验收标准⑤）：创建即 PENDING、progress=0，
 * file_url/file_size/error_message/started_at/finished_at 一律 NULL —— 没有生成器就不许有任何"已生成"痕迹。
 * 同时写一条 INFO 日志「任务已创建，等待生成器接入」（运行时由本服务写，不在迁移里）。
 */
export async function createExportTask(
  input: CreateExportTaskInput
): Promise<{ id: number; taskNo: string; status: ExportTaskStatus }> {
  const exportType = requireNonEmpty(input.exportType, "导出类型");
  const format = requireFormat(input.format);
  const period =
    input.period === undefined || input.period === null || String(input.period).trim() === ""
      ? null
      : String(input.period).trim();
  const adminId =
    input.adminId === undefined || input.adminId === null || Number.isNaN(Number(input.adminId))
      ? null
      : Number(input.adminId);
  const taskNo = buildTaskNo();

  const taskId = await transaction(async (conn) => {
    const [inserted] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_platform_export_task
         (task_no, export_type, period, format, status, progress,
          file_url, file_size, error_message, admin_id, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL)`,
      [taskNo, exportType, period, format, CREATED_STATUS, CREATED_PROGRESS, adminId]
    );
    const newId = Number(inserted.insertId);
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_platform_export_task_log (task_id, level, message, created_at)
       VALUES (?, 'INFO', ?, NOW())`,
      [newId, CREATED_LOG_MESSAGE]
    );
    return newId;
  });

  return { id: taskId, taskNo, status: CREATED_STATUS };
}

/**
 * 任务详情（GET /api/platform/reports/export/:id/status —— T2 详情由 status 端点承接）：
 * 不存在 ⇒ 404。该记录同时是 status 与 download 两条端点的读取源（download 只读 fileUrl，不写库）。
 */
export async function getExportTaskDetail(id: number): Promise<ExportTaskRecord> {
  const row = await queryOne<ExportTaskRow>(
    `SELECT ${TASK_COLUMNS} FROM t_platform_export_task WHERE id = ?`,
    [id]
  );
  if (!row) {
    throw new AppError(`导出任务不存在：${id}`, 404);
  }
  return toRecord(row);
}

/**
 * 任务日志（GET /api/platform/reports/export/:id/logs）
 * 按 created_at 升序；同秒写入的多条日志用 id 升序做确定性 tiebreak（只靠秒级 DATETIME 无法定序）。
 * 任务不存在 ⇒ 404；无日志 ⇒ logs: []。
 */
export async function listExportTaskLogs(id: number): Promise<{ logs: ExportTaskLogItem[] }> {
  await requireExportTask(id);
  const rows = rowsOf<ExportTaskLogRow>(
    await query(
      `SELECT level AS level, message AS message, created_at AS createdAt
         FROM t_platform_export_task_log
        WHERE task_id = ?
        ORDER BY created_at ASC, id ASC`,
      [id]
    )
  );
  return {
    logs: rows.map((row) => ({
      level: String(row.level),
      message: String(row.message),
      createdAt: row.createdAt,
    })),
  };
}

/**
 * 重排任务（POST /api/platform/reports/export/:id/retry）
 *
 * **只允许 FAILED → PENDING**：重置 progress=0，清空 error_message/file_url/file_size/started_at/finished_at，
 * 并写一条 INFO 日志。其它状态（含 PENDING/GENERATING/SUCCESS 以及重复 retry）⇒ 显式 400；不存在 ⇒ 404。
 * UPDATE 的 WHERE 里再带一次 status='FAILED'（纵深防御：并发下被他人改动 ⇒ affectedRows 0 ⇒ 400，不静默成功）。
 */
export async function retryExportTask(
  id: number
): Promise<{ id: number; taskNo: string; status: ExportTaskStatus }> {
  const task = await requireExportTask(id);
  if (task.status !== RETRY_FROM_STATUS) {
    throw new AppError(
      `仅失败任务可重排：当前状态为 ${task.status}，只允许 ${RETRY_FROM_STATUS} → ${RETRY_TO_STATUS}`,
      400
    );
  }

  await transaction(async (conn) => {
    const [updated] = await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_platform_export_task
          SET status = ?, progress = 0, error_message = NULL, file_url = NULL, file_size = NULL,
              started_at = NULL, finished_at = NULL
        WHERE id = ? AND status = ?`,
      [RETRY_TO_STATUS, id, RETRY_FROM_STATUS]
    );
    if (Number(updated.affectedRows ?? 0) === 0) {
      throw new AppError(
        `任务状态已变化，重排未生效（要求 ${RETRY_FROM_STATUS} → ${RETRY_TO_STATUS}）`,
        400
      );
    }
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_platform_export_task_log (task_id, level, message, created_at)
       VALUES (?, 'INFO', ?, NOW())`,
      [id, RETRY_LOG_MESSAGE]
    );
  });

  return { id, taskNo: task.taskNo, status: RETRY_TO_STATUS };
}
