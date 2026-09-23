import type { Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as billingService from "../../services/platform/platform-billing.service";

/**
 * R101-C4-1 包A：平台级财务对账与账单控制器
 *
 * 口径（派单卡 C4-1/包A）：
 * - 全部端点走 `requirePlatformAuth`（见 routes/platform-billing.routes.ts），**严禁读 `req.tenantId`**
 *   （该字段在平台鉴权下恒为 undefined，踩坑日志 [35] / S3-86 / S3-91）；
 * - 金额一律元、2 位小数，响应体带 `amountUnit: "CNY"` + `amountScale: 2`；
 * - 零假数据：无数据返回空数组 + 明确说明，不造数；
 * - CSV 导出沿仓库既有范式（`controllers/platform/tenant-export.controller.ts`）：
 *   BOM + `text/csv; charset=utf-8` + `Content-Disposition: attachment`。
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 真日期校验（拒绝 2026-02-30、2026-13-01 这类格式合法但不存在的日期） */
function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const dateSchema = z
  .string()
  .regex(DATE_PATTERN, "日期格式须为 YYYY-MM-DD")
  .refine(isRealDate, "日期非法");

/** 日对账单 CSV 表头：金额列显式标注单位与精度（元 / 2 位小数） */
const STATEMENT_HEADER = [
  "对账日期",
  "平台",
  "平台订单数",
  "平台金额(元/2位小数)",
  "系统订单数",
  "系统金额(元/2位小数)",
  "差异单数",
  "差异金额(元/2位小数)",
  "佣金金额(元/2位小数)",
  "状态",
];

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function sendCsv(
  res: Response,
  filename: string,
  rows: unknown[][],
  extraHeaders: Record<string, string> = {}
) {
  const csv = `\uFEFF${[STATEMENT_HEADER, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.send(csv);
}

function toStatementRow(row: billingService.DailyReconciliationRow): unknown[] {
  return [
    row.date,
    row.platform,
    row.platformOrderCount,
    row.platformAmount,
    row.systemOrderCount,
    row.systemAmount,
    row.diffCount,
    row.diffAmount,
    row.commissionAmount == null ? "" : row.commissionAmount,
    row.status,
  ];
}

const amountMeta = {
  amountUnit: billingService.AMOUNT_UNIT,
  amountScale: billingService.AMOUNT_SCALE,
};

/**
 * 契约收紧（R101-C4-1b §一裁定 #2 + §二.段一.3）：
 * `tenantIds` 由「可选 ⇒ 未传即按全租户生成」改为**必填**（≥1、上限 200），
 * 目的是避免"一次请求写多行、含 0.00 占位单"。
 * 「缺失 / 非数组 / 空数组」与「超过上限」必须给出**不同**错误信息（验收标准 3③）。
 */
const TENANT_IDS_REQUIRED_MESSAGE =
  "tenantIds 必填：至少 1 个租户ID（不传 / 非数组 / 空数组一律拒绝，平台不再默认按全租户生成）";
const TENANT_IDS_LIMIT_MESSAGE = "tenantIds 超过上限：单次最多 200 个租户";

const tenantIdsSchema = z
  .array(z.string().min(1, "tenantIds 元素不能为空字符串"), {
    invalid_type_error: TENANT_IDS_REQUIRED_MESSAGE,
  })
  .max(200, TENANT_IDS_LIMIT_MESSAGE);

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

// ------------------------------------------------------------------
// A-1 GET /api/platform/billing/reconciliation-daily
// ------------------------------------------------------------------
export const listDailyReconciliationsCtrl = asyncHandler(async (req, res) => {
  const params = z
    .object({
      dateStart: dateSchema.optional(),
      dateEnd: dateSchema.optional(),
      status: z.string().min(1).optional(),
      platform: z.string().min(1).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    })
    .refine((value) => !value.dateStart || !value.dateEnd || value.dateStart <= value.dateEnd, {
      message: "dateStart 不得晚于 dateEnd",
      path: ["dateStart"],
    })
    .parse(req.query);

  const result = await billingService.listDailyReconciliations(params);

  res.json(
    ok({
      records: result.records,
      total: result.total,
      page: params.page,
      pageSize: params.pageSize,
      ...amountMeta,
    })
  );
});

// ------------------------------------------------------------------
// A-2 GET /api/platform/billing/reconciliation-daily/:date/statement
// ------------------------------------------------------------------
export const exportDailyStatementCtrl = asyncHandler(async (req, res) => {
  const date = dateSchema.parse(req.params.date);
  const rows = await billingService.listDailyReconciliationsForExport({
    dateStart: date,
    dateEnd: date,
  });

  // 当日无数据 ⇒ 仅表头（不 500、不造行）
  sendCsv(res, `reconciliation-statement-${date}.csv`, rows.map(toStatementRow), {
    "X-Export-Rows": String(rows.length),
    "X-Amount-Unit": billingService.AMOUNT_UNIT,
    "X-Amount-Scale": String(billingService.AMOUNT_SCALE),
  });
});

// ------------------------------------------------------------------
// A-3 GET /api/platform/billing/reconciliation-daily/:date/diff
// ------------------------------------------------------------------
export const getDailyDiffCtrl = asyncHandler(async (req, res) => {
  const date = dateSchema.parse(req.params.date);
  const summary = await billingService.summarizeDailyReconciliation(date);

  res.json(
    ok({
      date,
      // 逐笔差异明细库内无载体：t_platform_reconciliation 只有 diff_count / diff_amount 聚合列，
      // 差异明细表本轮未获批（C4-0 裁定 §二）⇒ 明示空态与原因，绝不造逐笔行
      records: [],
      rowCount: summary.rowCount,
      diffCount: summary.diffCount,
      diffAmount: summary.diffAmount,
      note: "无逐笔差异明细数据源：库内仅有 diff_count/diff_amount 聚合列，差异明细表本轮未获批（C4-0 裁定 §二），故 records 恒为空数组，不做下钻推断",
      ...amountMeta,
    })
  );
});

// ------------------------------------------------------------------
// A-4 POST /api/platform/billing/generate
// ------------------------------------------------------------------
export const generateBillingCtrl = asyncHandler(async (req, res) => {
  const rawTenantIds = (req.body as Record<string, unknown> | undefined)?.tenantIds;
  if (rawTenantIds === undefined || rawTenantIds === null) {
    throw badRequest(TENANT_IDS_REQUIRED_MESSAGE);
  }
  if (!Array.isArray(rawTenantIds)) {
    throw badRequest(`${TENANT_IDS_REQUIRED_MESSAGE}（收到非数组）`);
  }
  if (rawTenantIds.length === 0) {
    throw badRequest(`${TENANT_IDS_REQUIRED_MESSAGE}（收到空数组）`);
  }

  const body = z
    .object({
      periodStart: dateSchema,
      periodEnd: dateSchema,
      tenantIds: tenantIdsSchema,
    })
    .refine((value) => value.periodStart <= value.periodEnd, {
      message: "periodStart 不得晚于 periodEnd",
      path: ["periodStart"],
    })
    .parse(req.body);

  const result = await billingService.generateSettlements(body);
  res.json(ok({ ...result, ...amountMeta }));
});

// ------------------------------------------------------------------
// A-5 POST /api/platform/billing/statement/export
// ------------------------------------------------------------------
export const exportStatementCtrl = asyncHandler(async (req, res) => {
  const body = z
    .object({
      dateStart: dateSchema,
      dateEnd: dateSchema,
      platform: z.string().min(1).optional(),
    })
    .refine((value) => value.dateStart <= value.dateEnd, {
      message: "dateStart 不得晚于 dateEnd",
      path: ["dateStart"],
    })
    .parse(req.body);

  const rows = await billingService.listDailyReconciliationsForExport(body);

  sendCsv(
    res,
    `reconciliation-statement-${body.dateStart}_${body.dateEnd}.csv`,
    rows.map(toStatementRow),
    {
      "X-Export-Rows": String(rows.length),
      "X-Amount-Unit": billingService.AMOUNT_UNIT,
      "X-Amount-Scale": String(billingService.AMOUNT_SCALE),
    }
  );
});

// ------------------------------------------------------------------
// A-6 POST /api/platform/billing/invoice
// ------------------------------------------------------------------
export const createInvoiceCtrl = asyncHandler(async (req, res) => {
  const body = z
    .object({
      tenantId: z.string().min(1, "tenantId 必填"),
      settlementNo: z.string().min(1).optional(),
      settlementId: z.coerce.number().int().positive().optional(),
      amount: z.coerce.number().positive("amount 必须大于 0").optional(),
      taxRate: z.coerce
        .number()
        .min(0, "taxRate 必须在 0~1 之间")
        .max(1, "taxRate 必须在 0~1 之间")
        .optional(),
      // 本端点只承载平台开给租户的销项票（t_invoice.invoice_type = OUT）；
      // 进项票（IN）属租户侧财务流程，不在本包范围，越界取值一律 400
      invoiceType: z.literal(billingService.PLATFORM_INVOICE_TYPE).optional(),
    })
    .parse(req.body);

  const result = await billingService.createInvoice(body);
  res.status(201).json(ok({ ...result, ...amountMeta }));
});
