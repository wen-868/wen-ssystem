import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as arrearsService from "../../services/platform/platform-billing-arrears.service";

/**
 * R101-C4-1b 段一（包B）：平台级欠费与增值扣费流水控制器
 *
 * 口径：
 * - 三个端点全部走 `requirePlatformAuth`（见 routes/platform-billing-arrears.routes.ts），
 *   **严禁读 `req.tenantId`**（平台鉴权下该字段恒 undefined，踩坑日志 [35] / S3-86 / S3-91）；
 * - 金额一律元、2 位小数，响应体带 `amountUnit: "CNY"` + `amountScale: 2`；
 * - 零假数据：无数据返回 `records: []`，缺载体的字段返回 `null`；
 * - 催缴**仅站内**：不接短信/邮件/微信通道（阶段三范围）。
 */

/** 参数校验错误（统一走 error-handler 的 `statusCode` 分支 ⇒ 400） */
function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

const TENANT_IDS_REQUIRED_MESSAGE =
  "tenantIds 必填：至少 1 个租户ID（不传 / 非数组 / 空数组一律拒绝，平台不再默认按全租户催缴）";
export const TENANT_IDS_LIMIT_MESSAGE = "tenantIds 超过上限：单次最多 200 个租户";

const tenantIdsSchema = z
  .array(z.string().min(1, "tenantIds 元素不能为空字符串"), {
    invalid_type_error: TENANT_IDS_REQUIRED_MESSAGE,
  })
  .max(200, TENANT_IDS_LIMIT_MESSAGE);

/**
 * 租户ID列表校验（与包A `POST /generate` 的 tenantIds 收紧口径一致）：
 * 「缺失 / 非数组 / 空数组」与「超过上限」必须给出**不同**错误信息（派单卡验收标准 3③）。
 */
function requireTenantIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) throw badRequest(TENANT_IDS_REQUIRED_MESSAGE);
  if (!Array.isArray(raw)) throw badRequest(`${TENANT_IDS_REQUIRED_MESSAGE}（收到非数组）`);
  if (raw.length === 0) throw badRequest(`${TENANT_IDS_REQUIRED_MESSAGE}（收到空数组）`);
  return tenantIdsSchema.parse(raw);
}

const stageSchema = z
  .string()
  .min(1)
  .refine(
    (value) => (arrearsService.ARREARS_STAGES as readonly string[]).includes(value),
    { message: `stage 取值非法：仅支持 ${arrearsService.ARREARS_STAGES.join(" / ")}` }
  );

const pageSchema = z.coerce.number().int().min(1, "page 最小为 1").default(1);
const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(1, "pageSize 最小为 1")
  .max(100, "pageSize 最大为 100")
  .default(20);

// ------------------------------------------------------------------
// B-1 GET /api/platform/billing/arrears
// ------------------------------------------------------------------
export const listArrearsCtrl = asyncHandler(async (req, res) => {
  const params = z
    .object({
      stage: stageSchema.optional(),
      keyword: z.string().min(1, "keyword 不能为空").max(64, "keyword 最长 64 字符").optional(),
      page: pageSchema,
      pageSize: pageSizeSchema,
    })
    .parse(req.query);

  const result = await arrearsService.listArrears({
    stage: params.stage as arrearsService.ArrearsStage | undefined,
    keyword: params.keyword,
    page: params.page,
    pageSize: params.pageSize,
  });

  res.json(ok(result));
});

// ------------------------------------------------------------------
// B-2 POST /api/platform/billing/arrears/urge（仅站内通知）
// ------------------------------------------------------------------
export const urgeArrearsCtrl = asyncHandler(async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tenantIds = requireTenantIds(body.tenantIds);

  const result = await arrearsService.urgeArrears(tenantIds);
  res.json(ok(result));
});

// ------------------------------------------------------------------
// B-3 GET /api/platform/billing/addon-charges
// ------------------------------------------------------------------
export const listAddonChargesCtrl = asyncHandler(async (req, res) => {
  const params = z
    .object({
      tenantId: z.string().min(1, "tenantId 不能为空").optional(),
      item: z.string().min(1, "item 不能为空").optional(),
      page: pageSchema,
      pageSize: pageSizeSchema,
    })
    .parse(req.query);

  const result = await arrearsService.listAddonCharges(params);
  res.json(ok(result));
});
