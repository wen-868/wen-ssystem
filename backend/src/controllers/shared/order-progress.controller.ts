/**
 * 订单进度查询控制器（TOTAL-ORDER-PROGRESS-02）
 *
 * GET /api/orders/{family}/{orderNo}/progress?since_seq=&cursor=&limit=&channel=
 * - 租户来自 JWT（§5.1，缺失 ⇒ 403）
 * - AI 通道（channel=ai）⇒ 字段白名单物理裁剪（§5.4）
 *
 * 负责人：阿坚（总台后端与数据）｜创建日期：2026-10-28
 */
import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { resolveCaller, queryOrderProgress } from "../../services/store/order-progress-query.service";

const querySchema = z.object({
  since_seq: z.coerce.number().int().min(0).optional(),
  cursor: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  channel: z.enum(["human", "ai"]).optional(),
});

export const getOrderProgress = asyncHandler(async (req, res) => {
  const caller = resolveCaller(req.user as never);
  const q = querySchema.parse(req.query);
  const result = await queryOrderProgress(caller, {
    orderFamily: req.params.family as string,
    orderNo: req.params.orderNo as string,
    sinceSeq: q.since_seq ?? null,
    cursor: q.cursor ?? null,
    limit: q.limit ?? 50,
    channel: q.channel ?? "human",
  });
  res.json(ok(result));
});
