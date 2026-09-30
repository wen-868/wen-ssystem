import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-agent-level.service";

/**
 * R101-C6-3-3：平台代理商**层级权益配置**控制器（3 条端点，路径由派单卡钉死，不得自拟）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-3.md §四
 *   · GET  /api/platform/agents/levels      → { items: [...] }（零预置 ⇒ 空表 ⇒ items: []）
 *   · POST /api/platform/agents/levels      → 新建层级（levelCode 重复 ⇒ 409）
 *   · PUT  /api/platform/agents/levels/:id  → 部分更新（未知 id ⇒ 404；无变更 ⇒ 400）
 *
 * D11 落地：① 分润比例**配置值**（profitRate* 未配置 ⇒ null，不写 0 冒充）；
 *   ② 增值模式默认关闭（profitModeUpsell 默认 false）；③ 层级自定义命名（levelName 自由输入，不写死"一级/二级"）。
 * 零涉钱（红线①）：本控制器只读写配置字段，不认识任何金额；档 1 不产生任何计提。
 * 本控制器**不吞错**：不做 try/catch 包装，异常一律交给 errorHandler。
 */

const levelIdSchema = z.coerce.number({ invalid_type_error: "层级 ID 须为数字" }).int("层级 ID 须为整数").positive("层级 ID 须为正整数");

/**
 * 可空的数值字段："" / null / undefined ⇒ null（**不得把未配置折成 0**）；
 * 其余按数字解析。上限按列精度设（避免超列范围落库报 500），不额外发明业务阈值。
 */
const nullableNumberSchema = (max: number, label: string) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string" && value.trim() === "") return null;
      return Number(value);
    },
    z
      .number({ invalid_type_error: `${label}须为数字或 null` })
      .min(0, `${label}不能为负`)
      .max(max, `${label}超出列精度上限 ${max}`)
      .nullable()
  );

/** 可售套餐范围：planId 正整数数组；null=未配置；空数组视为"未配置的另一种写法"⇒ 400（不用空数组冒充配置） */
const planScopeSchema = z
  .array(z.coerce.number().int().positive("套餐 ID 须为正整数"), {
    invalid_type_error: "planScope 须为 planId 数组或 null",
  })
  .min(1, "planScope 不能为空数组（未配置请传 null）")
  .nullable();

/** 布尔字段：接受 true/false 或 0/1（两种写法都收），落地前统一转成 boolean */
const flagSchema = z
  .union([z.boolean(), z.coerce.number().int().min(0).max(1)], {
    errorMap: () => ({ message: "取值须为布尔值（true/false）或 0/1" }),
  })
  .transform((value) => Boolean(value));

const levelStatusSchema = z.enum(["ACTIVE", "DISABLED"], {
  invalid_type_error: "status 须为 ACTIVE/DISABLED 之一",
});

/** POST /levels body：levelCode / levelName 必填，其余可选（未配置即 NULL，服务层不补 0） */
const levelCreateBodySchema = z
  .object({
    levelCode: z
      .string({ required_error: "缺少层级编码" })
      .trim()
      .min(1, "层级编码不能为空")
      .max(32, "层级编码最长 32 字符"),
    levelName: z
      .string({ required_error: "缺少层级名称" })
      .trim()
      .min(1, "层级名称不能为空")
      .max(64, "层级名称最长 64 字符"),
    allowSubLevel: flagSchema.optional(),
    planScope: planScopeSchema.optional(),
    discountLow: nullableNumberSchema(999.99, "拿货折扣下限").optional(),
    discountHigh: nullableNumberSchema(999.99, "拿货折扣上限").optional(),
    profitModeSignup: flagSchema.optional(),
    profitModeRenew: flagSchema.optional(),
    profitModeUpsell: flagSchema.optional(),
    profitRateSignup: nullableNumberSchema(99.9999, "新签分润比例").optional(),
    profitRateRenew: nullableNumberSchema(99.9999, "续费分润比例").optional(),
    profitRateUpsell: nullableNumberSchema(99.9999, "增值分润比例").optional(),
    sortNo: z.coerce.number().int().optional(),
    status: levelStatusSchema.optional(),
  })
  .strict();

/** PUT /levels/:id body：levelCode 不可改；至少要给一项可变更字段（否则 400，不静默成功） */
const levelUpdateBodySchema = z
  .object({
    levelName: z
      .string({ invalid_type_error: "层级名称须为字符串" })
      .trim()
      .min(1, "层级名称不能为空")
      .max(64, "层级名称最长 64 字符")
      .optional(),
    allowSubLevel: flagSchema.optional(),
    planScope: planScopeSchema.optional(),
    discountLow: nullableNumberSchema(999.99, "拿货折扣下限").optional(),
    discountHigh: nullableNumberSchema(999.99, "拿货折扣上限").optional(),
    profitModeSignup: flagSchema.optional(),
    profitModeRenew: flagSchema.optional(),
    profitModeUpsell: flagSchema.optional(),
    profitRateSignup: nullableNumberSchema(99.9999, "新签分润比例").optional(),
    profitRateRenew: nullableNumberSchema(99.9999, "续费分润比例").optional(),
    profitRateUpsell: nullableNumberSchema(99.9999, "增值分润比例").optional(),
    sortNo: z.coerce.number().int().optional(),
    status: levelStatusSchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.levelName !== undefined ||
      body.allowSubLevel !== undefined ||
      body.planScope !== undefined ||
      body.discountLow !== undefined ||
      body.discountHigh !== undefined ||
      body.profitModeSignup !== undefined ||
      body.profitModeRenew !== undefined ||
      body.profitModeUpsell !== undefined ||
      body.profitRateSignup !== undefined ||
      body.profitRateRenew !== undefined ||
      body.profitRateUpsell !== undefined ||
      body.sortNo !== undefined ||
      body.status !== undefined,
    { message: "至少提供一个可变更字段" }
  );

/** 当前平台管理员 ID（requirePlatformAuth 注入 req.user）；拿不到身份 ⇒ NULL，不编造 ID */
function currentAdminId(req: any): number | null {
  const adminId = Number(req?.user?.id ?? 0);
  return Number.isFinite(adminId) && adminId > 0 ? adminId : null;
}

/** GET /api/platform/agents/levels —— 层级列表（零预置 ⇒ items: []） */
export async function listAgentLevels(_req: any, res: any) {
  res.json(ok(await service.listAgentLevels()));
}

/** POST /api/platform/agents/levels —— 新建层级 */
export async function createAgentLevel(req: any, res: any) {
  const body = levelCreateBodySchema.parse(req.body ?? {});
  res.json(ok(await service.createAgentLevel(body, currentAdminId(req))));
}

/** PUT /api/platform/agents/levels/:id —— 部分更新（未传字段不改） */
export async function updateAgentLevel(req: any, res: any) {
  const id = levelIdSchema.parse(req.params.id);
  const body = levelUpdateBodySchema.parse(req.body ?? {});
  res.json(ok(await service.updateAgentLevel(id, body, currentAdminId(req))));
}
