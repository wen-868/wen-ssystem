import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as aiPlatform from "../../services/platform/ai-platform.service";

/**
 * R101-C5-1（阶段一 C5）· AI 配置与用量：平台侧只读端点控制器
 *
 * 路径契约（凌舟钉死，见 `routes/ai-platform.routes.ts`）：
 * - `GET /api/platform/ai/public-models`
 * - `GET /api/platform/ai/metering-log`
 * - `GET /api/platform/ai/abnormal-tenants`
 * - `GET /api/platform/ai/model-share`
 *
 * 口径：
 * - 全部端点走 `requirePlatformAuth`（平台总后台），**严禁读 `req.tenantId`**
 *   （平台鉴权不注入该字段，踩坑日志 [35]／S3-86／S3-91）；
 * - 参数非法一律 400（zod 抛 ZodError → `middleware/error-handler.ts` 统一映射），且**不触达 service / 数据库**；
 * - 零假数据：无数据 `records: []`，无载体字段 `null` + `unavailable` / `contractNotes` 逐条说明。
 */

/** 分页参数（与平台侧其他列表同口径：page ≥ 1、1 ≤ pageSize ≤ 100） */
const pageSchema = z.coerce.number().int().min(1, "page 最小为 1").default(1);
const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(1, "pageSize 最小为 1")
  .max(100, "pageSize 最大为 100")
  .default(20);

/** 日期参数（YYYY-MM-DD；非法 ⇒ 400） */
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期需为 YYYY-MM-DD 形式（如 2026-09-24）")
  .optional();

/** 起止先后校验（同时给出时不允许 startDate > endDate） */
const rangeOrderOk = (value: { startDate?: string; endDate?: string }): boolean =>
  !(value.startDate && value.endDate) || value.startDate <= value.endDate;

const rangeOrderIssue = {
  message: "startDate 不能晚于 endDate",
  path: ["startDate"],
};

// ------------------------------------------------------------------
// GET /api/platform/ai/public-models —— 平台公共模型列表
// ------------------------------------------------------------------
export const listPublicModelsCtrl = asyncHandler(async (_req, res) => {
  const result = await aiPlatform.listPublicModels();
  res.json(ok(result));
});

// ------------------------------------------------------------------
// GET /api/platform/ai/metering-log —— 逐次计量流水（分页）
// ------------------------------------------------------------------
export const listMeteringLogCtrl = asyncHandler(async (req, res) => {
  const params = z
    .object({
      tenantId: z.string().min(1, "tenantId 不能为空").max(64, "tenantId 最长 64 字符").optional(),
      model: z.string().min(1, "model 不能为空").max(64, "model 最长 64 字符").optional(),
      provider: z.string().min(1, "provider 不能为空").max(32, "provider 最长 32 字符").optional(),
      startDate: dateSchema,
      endDate: dateSchema,
      page: pageSchema,
      pageSize: pageSizeSchema,
    })
    .refine(rangeOrderOk, rangeOrderIssue)
    .parse(req.query);

  const result = await aiPlatform.listMeteringLog(params);
  res.json(ok(result));
});

// ------------------------------------------------------------------
// GET /api/platform/ai/abnormal-tenants —— 异常用量租户（阈值无载体 ⇒ 不计算）
// ------------------------------------------------------------------
export const listAbnormalTenantsCtrl = asyncHandler(async (_req, res) => {
  const result = await aiPlatform.listAbnormalTenants();
  res.json(ok(result));
});

// ------------------------------------------------------------------
// GET /api/platform/ai/model-share —— 模型占比（逐次明细 GROUP BY model）
// ------------------------------------------------------------------
export const getModelShareCtrl = asyncHandler(async (req, res) => {
  const params = z
    .object({ startDate: dateSchema, endDate: dateSchema })
    .refine(rangeOrderOk, rangeOrderIssue)
    .parse(req.query);

  const result = await aiPlatform.getModelShare(params);
  res.json(ok(result));
});
