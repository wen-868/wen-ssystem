import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as platformMiniappService from "../../services/platform-miniapp.service";

/** GET /api/platform/subscription-applies — 订阅申请列表（requirePlatformAuth） */
export const listApplies = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const result = await platformMiniappService.listSubscriptionApplies({ status, page, pageSize });
  res.json(ok(result));
});

/** GET /api/platform/subscription-applies/:id — 申请详情（requirePlatformAuth） */
export const getApply = asyncHandler(async (req, res) => {
  const record = await platformMiniappService.getSubscriptionApply(Number(req.params.id));
  if (!record) {
    res.status(404).json(fail("申请不存在", "404"));
    return;
  }
  res.json(ok(record));
});

/** PUT /api/platform/subscription-applies/:id/audit — 审核（通过/驳回） */
export const auditApply = asyncHandler(async (req, res) => {
  const body = z
    .object({
      action: z.enum(["APPROVED", "REJECTED"]),
      auditRemark: z.string().max(500).optional(),
    })
    .parse(req.body);

  const reviewerId = (req as any).user?.id;
  const record = await platformMiniappService.auditSubscriptionApply(
    Number(req.params.id),
    body.action,
    body.auditRemark || "",
    reviewerId
  );
  res.json(ok(record));
});
