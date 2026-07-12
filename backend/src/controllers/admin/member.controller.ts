import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as memberService from "../../services/admin/member.service";

export const registerMember = asyncHandler(async (req, res) => {
  const { name, mobile, password, referrerId } = req.body;
  res.json(ok(await memberService.registerMember({ name, mobile, password, referrerId, tenantId: req.tenantId! })));
});
export const getMemberCard = asyncHandler(async (req, res) => { res.json(ok(await memberService.getMemberCard(Number(req.params.id), req.tenantId!))); });
export const updateMemberLevel = asyncHandler(async (req, res) => {
  const { levelName } = req.body;
  res.json(ok(await memberService.updateMemberLevel(Number(req.params.id), levelName, req.tenantId!)));
});
export const getMemberBenefits = asyncHandler(async (req, res) => { res.json(ok(await memberService.getMemberBenefits(req.tenantId!))); });