import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-referral-ledger.service";

/**
 * R101-C6-3-2b：老带新台账控制器（**1 条端点**，路径由派单卡 §四 钉死，不得自拟）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2b.md §四
 *   · GET /api/platform/referral-ledger → { items, total, page, pageSize }（分页 + 关键词 + 状态）
 *
 * **不得新增对外"写台账"端点**（卡 §四 硬约束）：台账由归因事件驱动，写入口只在服务层内部
 * （`platform-referral-ledger.service.writeReferralLedgerEntry`），本控制器因此**只有只读一条**。
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ errorHandler 统一 400；业务错误由 service 抛 AppError。
 * 零金额（红线①）：本控制器只透传台账字段与积分，不认识任何金额/佣金/分润/结算/提现字段。
 */

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "页码最小为 1").default(1),
  pageSize: z.coerce.number().int().min(1).max(100, "每页最多 100 条").default(20),
  keyword: z.string().trim().max(64, "关键词最长 64 字符").optional(),
  status: z.enum(["PENDING", "GRANTED", "REVOKED"], {
    invalid_type_error: "status 须为 PENDING/GRANTED/REVOKED 之一",
  }).optional(),
});

/** GET /api/platform/referral-ledger —— 分页 + 关键词 + 状态（空表 ⇒ items: []、total 0） */
export async function listReferralLedger(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  res.json(ok(await service.listReferralLedger(query)));
}
