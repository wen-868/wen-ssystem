import { z } from "zod";
import { ok, fail } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import * as service from "../../services/platform/platform-export-task.service";

/**
 * C6-2-T2-F1：平台报表导出任务中心控制器（6 条端点，路径由 F1 派单卡钉死）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T2-F1.md 交付物①②
 *   · GET  /api/platform/reports/export                → { total, page, pageSize, records }        ← export:view
 *   · POST /api/platform/reports/export                → { id, taskNo, status }（创建即 PENDING）   ← export:create
 *   · GET  /api/platform/reports/export/:id/status      → 任务状态（T2 详情记录的超集；不存在 404）  ← export:view
 *   · GET  /api/platform/reports/export/:id/download    → 无 file_url ⇒ 404 明确拒绝（不返回空文件）  ← export:view
 *   · GET  /api/platform/reports/export/:id/logs        → { logs }（created_at 升序；不存在 404）     ← export:view
 *   · POST /api/platform/reports/export/:id/retry       → 仅 FAILED → PENDING（否则 400；不存在 404） ← export:retry
 *
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ 由 errorHandler 统一转 400；
 * 业务错误（任务不存在 404 / 非法状态转移 400）由 service 抛 AppError。
 * 本控制器**不吞错**：不做 try/catch 包装，异常一律交给 errorHandler（T2 红线④延续）。
 * 权限点只以注释登记（常量见 service 层 EXPORT_TASK_PERMISSIONS），**本单不实现假鉴权**（交付物⑥）。
 *
 * F1 的唯二行为变化：① 全部路径逐字对齐前端既有契约（前缀 /api/platform/reports/export）；
 * ② 新增 download 读取端点——本期没有生成器 ⇒ file_url 恒 NULL ⇒ 一律 404 + 明确 msg，
 * **禁止**返回 200 空文件、**禁止**假下载（验收标准⑤）。
 */

const taskIdSchema = z.coerce.number().int().positive();

/** 状态筛选取值与迁移 182 / 服务层 EXPORT_TASK_STATUSES 逐字一致（卡内钉死四态） */
const statusSchema = z.enum(["PENDING", "GENERATING", "SUCCESS", "FAILED"]);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // 卡内钉死 pageSize ≤ 100：超限显式 400（不静默夹取成 100）
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: statusSchema.optional(),
});

/**
 * 创建体：exportType 必填非空；period 可选（空串/纯空白 ⇒ 由 service 归一化为 NULL，不落空串）；
 * format 必填且仅 CSV|XLSX（卡内钉死；迁移里 format 的 DEFAULT 'CSV' 只是非端点写入方的兜底，
 * 端点层不把"缺 format"当成 CSV —— 不替调用方决定导出格式）。
 * period 三种"未指定"写法（缺省 / null / 空串）都归一化为 NULL，与列语义（NULL=未指定）一致。
 */
const createBodySchema = z.object({
  exportType: z.string().trim().min(1),
  period: z.string().trim().nullable().optional(),
  format: z.enum(["CSV", "XLSX"]),
});

/** 当前平台管理员 ID（requirePlatformAuth 注入 req.user）；拿不到身份 ⇒ NULL，不编造 ID */
function currentAdminId(req: any): number | null {
  const adminId = Number(req?.user?.id ?? 0);
  return Number.isFinite(adminId) && adminId > 0 ? adminId : null;
}

/** period 的"未指定"归一化：缺省 / null / 纯空白 ⇒ null（列语义 NULL=未指定，不落空串） */
function normalizePeriod(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const text = value.trim();
  return text.length === 0 ? null : text;
}

/**
 * download 无文件时的 404 原文（派单卡 C6-2-T2-F1 交付物①逐字钉死，不得改写）：
 * 「导出文件尚未生成（生成器待接入）」
 */
export const DOWNLOAD_NOT_READY_MSG = "导出文件尚未生成（生成器待接入）";

/**
 * 有 file_url 但下载通道未接入时的 501 原文。
 * 本仓当前没有导出生成器（file_url 只可能由未来的生成器写入），也没有文件落盘/静态托管通道，
 * 故"文件存在"这一分支无法交付真实字节流 ⇒ 按本仓既有先例（admin/platform-review.controller.ts 的
 * 无载体 501）明确 501 拒绝，**不返回 200、不返回空文件**（派单卡：有 file_url 时不在本单覆盖）。
 */
export const DOWNLOAD_CHANNEL_UNSUPPORTED_MSG =
  "导出文件下载通道尚未接入（生成器待接入：file_url 仅登记，文件未落盘）";

/** GET /api/platform/reports/export —— 任务列表（零数据 ⇒ records: []） */
export async function listExportTasks(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  res.json(
    ok(
      await service.listExportTasks({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
      })
    )
  );
}

/** POST /api/platform/reports/export —— 创建任务（创建即 PENDING，等待生成器接入） */
export async function createExportTask(req: any, res: any) {
  const body = createBodySchema.parse(req.body ?? {});
  res.json(
    ok(
      await service.createExportTask({
        exportType: body.exportType,
        period: normalizePeriod(body.period),
        format: body.format,
        adminId: currentAdminId(req),
      })
    )
  );
}

/**
 * GET /api/platform/reports/export/:id/status —— 任务状态（不存在 ⇒ 404）
 *
 * 返回体 = T2 详情记录（getExportTaskDetail）**原样透出**：既覆盖 F1 卡内 9 键
 * （id/taskNo/status/progress/fileUrl/fileSize/errorMessage/startedAt/finishedAt），
 * 也保留 T2 详情原有的 exportType/period/format/createdAt —— 一个字段都不删（F1 澄清第 1 条）。
 */
export async function getExportTaskStatus(req: any, res: any) {
  const id = taskIdSchema.parse(req.params.id);
  res.json(ok(await service.getExportTaskDetail(id)));
}

/**
 * GET /api/platform/reports/export/:id/download —— 导出文件下载（本期无生成器）
 *
 * 事实口径：file_url 只允许由未来的生成器写入，本期恒 NULL ⇒ 无文件时**必须 404 + 明确 msg**；
 * 禁止 200 空响应、禁止假下载。有 file_url 时（本单不覆盖）无真实落盘通道 ⇒ 501 明确拒绝。
 * 读取路径只调详情查询（只读），**不写任何列**（不置 SUCCESS、不伪造 file_url）。
 */
export async function downloadExportTask(req: any, res: any) {
  const id = taskIdSchema.parse(req.params.id);
  const task = await service.getExportTaskDetail(id); // 任务不存在 ⇒ service 抛 404
  if (!task.fileUrl) {
    throw new AppError(DOWNLOAD_NOT_READY_MSG, 404);
  }
  res.status(501).json(fail(DOWNLOAD_CHANNEL_UNSUPPORTED_MSG, "501"));
}

/** GET /api/platform/reports/export/:id/logs —— 任务日志（created_at 升序；不存在 ⇒ 404） */
export async function getExportTaskLogs(req: any, res: any) {
  const id = taskIdSchema.parse(req.params.id);
  res.json(ok(await service.listExportTaskLogs(id)));
}

/** POST /api/platform/reports/export/:id/retry —— 重排（仅 FAILED → PENDING，其它状态 400） */
export async function retryExportTask(req: any, res: any) {
  const id = taskIdSchema.parse(req.params.id);
  res.json(ok(await service.retryExportTask(id)));
}
