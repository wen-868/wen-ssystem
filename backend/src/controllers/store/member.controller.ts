import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as memberService from "../../services/store/member.service";

const tenant = (req: any) => req.tenantId as string;

/** 会员管理列表（统计 + 分页） */
export const listMemberManage = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword ? String(req.query.keyword) : "";
  const result = await memberService.listMemberManage(tenant(req), page, pageSize, keyword);
  res.json(ok(result));
});

/** 会员详情 */
export const getMemberDetail = asyncHandler(async (req, res) => {
  const result = await memberService.getMemberDetail(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 会员积分 */
export const getMemberPoints = asyncHandler(async (req, res) => {
  const result = await memberService.getMemberPoints(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 会员积分明细 */
export const getMemberPointsLogs = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const type = req.query.type ? String(req.query.type) : undefined;
  const result = await memberService.getMemberPointsLogs(tenant(req), Number(req.params.id), page, pageSize, type);
  res.json(ok(result));
});

/** 会员订单 */
export const getMemberOrders = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status ? String(req.query.status) : undefined;
  const result = await memberService.getMemberOrders(tenant(req), Number(req.params.id), page, pageSize, status);
  res.json(ok(result));
});
