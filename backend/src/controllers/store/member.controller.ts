import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { z } from "zod";
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

/** 新增会员（会员管理页维护） */
export const createMemberManage = asyncHandler(async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).max(64),
      mobile: z.string().min(1).max(20),
      customerType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
      address: z.string().max(255).optional(),
      cardNo: z.string().max(32).optional(),
      contact: z.string().max(64).optional(),
      gender: z.string().max(8).optional(),
      birthday: z.string().max(20).optional(),
      province: z.string().max(32).optional(),
      city: z.string().max(32).optional(),
      district: z.string().max(32).optional(),
      tags: z.string().max(255).optional(),
      remark: z.string().max(255).optional(),
    })
    .parse(req.body);
  const result = await memberService.createMemberManage(tenant(req), body);
  res.json(ok(result));
});

/** 更新会员（会员详情「修改」） */
export const updateMemberManage = asyncHandler(async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).max(64).optional(),
      mobile: z.string().min(1).max(20).optional(),
      customerType: z.enum(["RETAIL", "WHOLESALE"]).optional(),
      address: z.string().max(255).optional(),
      cardNo: z.string().max(32).optional(),
      contact: z.string().max(64).optional(),
      gender: z.string().max(8).optional(),
      birthday: z.string().max(20).optional(),
      province: z.string().max(32).optional(),
      city: z.string().max(32).optional(),
      district: z.string().max(32).optional(),
      tags: z.string().max(255).optional(),
      remark: z.string().max(255).optional(),
    })
    .parse(req.body);
  await memberService.updateMemberManage(tenant(req), Number(req.params.id), body);
  const result = await memberService.getMemberDetail(tenant(req), Number(req.params.id));
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
