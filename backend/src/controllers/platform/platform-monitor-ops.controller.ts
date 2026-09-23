import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as monitorOps from "../../services/platform/platform-monitor-ops.service";

/**
 * R101-C4-1b 段二（包C）：平台监控后端缺口控制器
 *
 * 口径：
 * - 全部端点走 `requirePlatformAuth`（见 routes/platform-monitor-ops.routes.ts），
 *   **严禁读 `req.tenantId`**（平台鉴权下该字段恒 undefined，踩坑日志 [35] / S3-86 / S3-91）；
 * - 参数非法一律 400（zod / AppError 由 error-handler 统一映射），且**不触达 service / 数据库**；
 * - 零假数据：无数据 `records: []`；无载体字段 `null` + `fieldNotes` / `unavailable` 逐条说明；
 * - 两个导出端点沿用仓库既有 CSV 范式：BOM + `text/csv; charset=utf-8` + `Content-Disposition`，
 *   并在响应头回传实际导出行数与总数（截断可见，不静默）。
 */

/** 分页参数（与包A/包B 同口径：page ≥ 1、1 ≤ pageSize ≤ 100） */
const pageSchema = z.coerce.number().int().min(1, "page 最小为 1").default(1);
const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(1, "pageSize 最小为 1")
  .max(100, "pageSize 最大为 100")
  .default(20);

/** 账期/月份参数（YYYY-MM）；非法值由 service 的 parseMonthRange 抛 400 */
const monthSchema = z.string().min(1, "月份不能为空").optional();
const operatorSchema = z.string().min(1, "操作人不能为空").max(64, "操作人最长 64 字符").optional();

/** CSV 导出单次行数上限（超出以响应头 X-Export-Truncated 显式声明） */
export const EXPORT_ROW_LIMIT = 5000;

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 发送 CSV（沿用 `controllers/platform/tenant-export.controller.ts` 形态：BOM + text/csv + 附件名）。
 * 注：`escapeCsv` 在仓库已有多份副本（S3-95 登记为公共 util 收口项，本轮**不**顺手重构）；
 * 本文件副本为第 4 份，已在回传卡如实报备。
 */
function sendCsv(
  res: any,
  filename: string,
  header: string[],
  rows: unknown[][],
  meta: { total: number }
): void {
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Export-Total", String(meta.total));
  res.setHeader("X-Export-Rows", String(rows.length));
  res.setHeader("X-Export-Truncated", rows.length < meta.total ? "true" : "false");
  res.send(csv);
}

/** 平台操作人（平台 JWT 载荷：id/username/realName；与 tenant-ops.controller 同口径） */
function operatorOf(req: any): monitorOps.MonitorOperator {
  const user = req.user ?? {};
  return {
    id: Number(user.id ?? 0),
    name: String(user.username || user.realName || "platform_admin"),
  };
}

function clientIp(req: any): string | null {
  const raw = req.ip ?? req.headers?.["x-forwarded-for"] ?? null;
  return raw ? String(raw).split(",")[0].trim().slice(0, 45) : null;
}

// ------------------------------------------------------------------
// C-1 GET /api/platform/monitor/proxy-audit
// ------------------------------------------------------------------
export const listProxyAuditCtrl = asyncHandler(async (req, res) => {
  const params = z
    .object({ operator: operatorSchema, month: monthSchema, page: pageSchema, pageSize: pageSizeSchema })
    .parse(req.query);

  const result = await monitorOps.listProxyAudit(params);
  res.json(ok(result));
});

// ------------------------------------------------------------------
// C-1x GET /api/platform/monitor/proxy-audit/export（CSV）
// ------------------------------------------------------------------
export const exportProxyAuditCtrl = asyncHandler(async (req, res) => {
  const params = z.object({ operator: operatorSchema, month: monthSchema }).parse(req.query);

  const result = await monitorOps.listProxyAudit({
    operator: params.operator,
    month: params.month,
    page: 1,
    pageSize: EXPORT_ROW_LIMIT,
  });

  const header = [
    "记录ID",
    "操作人",
    "目标租户ID",
    "目标租户",
    "代登录账号",
    "事由",
    "进入时间",
    "预计失效时间",
    "退出时间",
    "会话时长",
    "操作摘要",
    "审批人",
    "IP",
  ];
  const rows = result.records.map((row) => [
    row.id,
    row.operator,
    row.tenantId ?? "",
    row.tenant ?? "",
    row.loginUsername ?? "",
    row.reason ?? "",
    row.enterAt ?? "",
    row.expiresAt ?? "",
    row.exitAt ?? "",
    row.duration ?? "",
    row.actionSummary ?? "",
    row.approver ?? "",
    row.ip ?? "",
  ]);

  sendCsv(res, `proxy-audit-${result.month}-${today()}.csv`, header, rows, { total: result.total });
});

// ------------------------------------------------------------------
// C-2 GET /api/platform/monitor/proxy-audit/:id/report
// ------------------------------------------------------------------
export const getProxyAuditReportCtrl = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive("记录ID 必须为正整数").parse(req.params.id);
  const result = await monitorOps.getProxyAuditReport(id);
  res.json(ok(result));
});

// ------------------------------------------------------------------
// C-3 GET /api/platform/monitor/storage/top5
// ------------------------------------------------------------------
export const getStorageTop5Ctrl = asyncHandler(async (req, res) => {
  const params = z
    .object({
      limit: z.coerce
        .number()
        .int()
        .min(1, "limit 最小为 1")
        .max(
          monitorOps.STORAGE_TOP_MAX_LIMIT,
          `limit 最大为 ${monitorOps.STORAGE_TOP_MAX_LIMIT}`
        )
        .default(monitorOps.STORAGE_TOP_DEFAULT_LIMIT),
    })
    .parse(req.query);

  const result = await monitorOps.getStorageTop5(params.limit);
  res.json(ok(result));
});

// ------------------------------------------------------------------
// C-4 GET /api/platform/monitor/storage/orphan-scan
// ------------------------------------------------------------------
export const orphanScanCtrl = asyncHandler(async (req, res) => {
  const params = z
    .object({ tenantId: z.string().min(1, "tenantId 不能为空").max(64, "tenantId 最长 64 字符").optional() })
    .parse(req.query);

  const result = await monitorOps.scanOrphanFiles(params);
  res.json(ok(result));
});

// ------------------------------------------------------------------
// C-5 GET /api/platform/monitor/tenant-api
// ------------------------------------------------------------------
export const getTenantApiCtrl = asyncHandler(async (req, res) => {
  const params = z.object({ period: monthSchema }).parse(req.query);
  const result = await monitorOps.getTenantApiUsage(params.period);
  res.json(ok(result));
});

// ------------------------------------------------------------------
// C-5x GET /api/platform/monitor/tenant-api/export（CSV 月报）
// ------------------------------------------------------------------
export const exportTenantApiCtrl = asyncHandler(async (req, res) => {
  const params = z.object({ period: monthSchema }).parse(req.query);
  const result = await monitorOps.getTenantApiUsage(params.period);

  const header = ["租户ID", "租户名称", "租户编码", "账期", "调用量", "错误数", "错误率", "配额", "使用率(%)"];
  const rows = result.records.map((row) => [
    row.tenantId,
    row.tenantName ?? "",
    row.tenantCode ?? "",
    result.period,
    row.callCount,
    row.errorCount,
    row.errorRate ?? "",
    "", // 配额无载体（见 unavailable），不填 0
    "", // 使用率同因，不填 0
  ]);

  sendCsv(res, `tenant-api-${result.period}-${today()}.csv`, header, rows, { total: result.total });
});

// ------------------------------------------------------------------
// C-6 GET /api/platform/monitor/thresholds
// ------------------------------------------------------------------
export const getThresholdsCtrl = asyncHandler(async (_req, res) => {
  const result = await monitorOps.getMonitorThresholds();
  res.json(ok(result));
});

/**
 * C-6 PUT /api/platform/monitor/thresholds
 * 参数形状校验在 service（`monitorThresholdsSchema`，zod ⇒ 400）；此处只透传 body。
 */
export const updateThresholdsCtrl = asyncHandler(async (req, res) => {
  const result = await monitorOps.saveMonitorThresholds(
    req.body ?? {},
    operatorOf(req),
    clientIp(req)
  );
  res.json(ok(result));
});
