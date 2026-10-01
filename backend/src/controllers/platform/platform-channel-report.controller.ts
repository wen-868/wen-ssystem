import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-channel-report.service";

/**
 * R101-C6-3-2b：渠道效果报表控制器（**1 条端点**，路径由派单卡 §四 钉死，不得自拟）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2b.md §四
 *   · GET /api/platform/channel-reports/effect → { items:[{...}], basis, filters, totals }
 *
 * 口径与过滤条件**随响应返回**（卡 §四："口径与过滤条件必须写进响应或文档说明"）：
 * `basis` 是口径说明（维度规则 / 三个指标的算法），`filters` 是本次实际生效的过滤条件回显。
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ errorHandler 统一 400；业务错误由 service 抛 AppError。
 * 零金额（红线①）：只读聚合，不读订阅金额、不算佣金/分润/结算/提现。
 */

const effectQuerySchema = z.object({
  attributionType: z
    .enum(["AGENT", "PROMO", "REFERRAL"], {
      invalid_type_error: "attributionType 须为 AGENT/PROMO/REFERRAL 之一",
    })
    .optional(),
  channelType: z.string().trim().min(1, "渠道类型不能为空").max(32, "渠道类型最长 32 字符").optional(),
});

/** GET /api/platform/channel-reports/effect —— 渠道效果聚合（无归因数据 ⇒ items: []） */
export async function getChannelEffect(req: any, res: any) {
  const query = effectQuerySchema.parse(req.query ?? {});
  res.json(ok(await service.getChannelEffectReport(query)));
}
