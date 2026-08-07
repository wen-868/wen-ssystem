import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler";
import { ok } from "../shared/response";
import * as platformMiniappService from "../services/platform-miniapp.service";

/** GET /api/platform-miniapp/plans — 公开套餐列表（仅 ACTIVE + 脱敏） */
export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await platformMiniappService.listPublicPlans();
  res.json(ok(plans));
});

/** POST /api/platform-miniapp/subscriptions — 提交订阅申请（公开 + 基础防刷） */
export const submitSubscription = asyncHandler(async (req, res) => {
  const body = z
    .object({
      openid: z.string().max(64).optional(),
      planId: z.number().int().positive(),
      company: z.string().min(1).max(128),
      contact: z.string().min(1).max(64),
      mobile: z.string().regex(/^1\d{10}$/, "手机号格式不正确"),
      remark: z.string().max(500).optional(),
    })
    .parse(req.body);

  const record = await platformMiniappService.submitSubscription(body);
  res.status(201).json(ok(record));
});

/** GET /api/platform-miniapp/subscriptions/me — 查询本人申请（openid 优先，mobile 兜底） */
export const listMySubscriptions = asyncHandler(async (req, res) => {
  const openid = typeof req.query.openid === "string" ? req.query.openid : undefined;
  const mobile = typeof req.query.mobile === "string" ? req.query.mobile : undefined;
  const list = await platformMiniappService.listMySubscriptions({ openid, mobile });
  res.json(ok(list));
});
