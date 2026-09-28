import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-feature-switch.service";

/**
 * R101-C6-3-1：平台全局功能开关控制器（2 条端点，路径由派单卡钉死，不得自拟）
 *
 * 依据：docs/tasks/cards/R101-派单-20260927-C6-3-1.md 交付物 A②
 *   · GET /api/platform/config/feature-switches        → { items: [{ featureCode, featureName, enabled, defaultForNewTenant, remark }] }
 *   · PUT /api/platform/config/feature-switches/:code  → { featureCode, changedFields }
 *
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ errorHandler 统一转 400；
 *   业务冲突（未知 code 404 / 无变更 400）由 service 抛 AppError。
 * 本控制器**不吞错**：不做 try/catch，异常一律交给 errorHandler。
 */

const codeSchema = z
  .string({ required_error: "缺少功能编码" })
  .trim()
  .min(1, "功能编码不能为空")
  .max(64, "功能编码最长 64 字符");

/** 取值口径：布尔值 true/false 或 0/1（两种写法都接受，落库统一为 TINYINT） */
const flagSchema = z.union([z.boolean(), z.coerce.number().int().min(0).max(1)], {
  errorMap: () => ({ message: "取值须为布尔值（true/false）或 0/1" }),
});

/** body 至少要给一项，否则本次调用没有任何可变更字段（= 无变更，必须 400，不得静默成功） */
const updateBodySchema = z
  .object({
    enabled: flagSchema.optional(),
    defaultForNewTenant: flagSchema.optional(),
    remark: z
      .string({ invalid_type_error: "备注须为字符串或 null" })
      .trim()
      .max(255, "备注最长 255 字符")
      .nullable()
      .optional(),
  })
  .refine(
    (body) =>
      body.enabled !== undefined ||
      body.defaultForNewTenant !== undefined ||
      body.remark !== undefined,
    { message: "至少提供 enabled / defaultForNewTenant / remark 之一" }
  );

/** GET /api/platform/config/feature-switches —— 功能开关列表（空表 ⇒ items: []） */
export async function listFeatureSwitches(_req: any, res: any) {
  res.json(ok(await service.listFeatureSwitches()));
}

/** PUT /api/platform/config/feature-switches/:code —— 改 enabled / defaultForNewTenant / remark（未传字段不改） */
export async function updateFeatureSwitch(req: any, res: any) {
  const code = codeSchema.parse(req.params.code);
  const body = updateBodySchema.parse(req.body ?? {});
  res.json(
    ok(
      await service.updateFeatureSwitch(
        code,
        {
          enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
          defaultForNewTenant:
            body.defaultForNewTenant === undefined ? undefined : Boolean(body.defaultForNewTenant),
          remark: body.remark === undefined ? undefined : body.remark,
        },
        req.user?.id ?? null
      )
    )
  );
}
