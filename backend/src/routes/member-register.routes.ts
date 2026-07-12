import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import { selfRegisterMember, sendRegisterSmsCode } from "../services/admin/member.service.js";

export const memberRegisterRouter = Router();

// POST /api/store/members/sms-code - 发送注册验证码（公开接口）
memberRegisterRouter.post("/sms-code", asyncHandler(async (req, res) => {
  const { mobile, tenantId } = req.body;
  if (!mobile || !tenantId) {
    res.status(400).json({ success: false, code: "400", message: "缺少必填字段" });
    return;
  }
  const result = await sendRegisterSmsCode(mobile, tenantId);
  res.json(ok(result));
}));

// POST /api/store/members/register - 会员自助注册（公开接口）
memberRegisterRouter.post("/register", asyncHandler(async (req, res) => {
  const { mobile, password, smsCode, name, tenantId } = req.body;
  if (!mobile || !password || !smsCode || !tenantId) {
    res.status(400).json({ success: false, code: "400", message: "缺少必填字段" });
    return;
  }
  const result = await selfRegisterMember({ mobile, password, smsCode, name, tenantId });
  res.json(ok({ ...result, message: "注册成功" }));
}));

export const routeConfig: RouteConfig = {
  prefix: "/api/store/members",
  router: memberRegisterRouter,
  auth: "none"
};
