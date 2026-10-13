import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as pointsService from "../../services/admin/marketing-points.service";

export const getPointsRule = asyncHandler(async (req, res) => {
  const result = await pointsService.getPointsRule(req.tenantId!);
  res.json(ok(result));
});

export const updatePointsRule = asyncHandler(async (req, res) => {
  const body = z.object({
    // S3-110 ④：t_points_rule.rule_name / earn_type 为 NOT NULL 无默认值，
    // 服务层建规则时会写这两列，故控制器同步开放为可选入参（长度对齐列宽 VARCHAR(100)/VARCHAR(20)）
    ruleName: z.string().min(1).max(100).optional(),
    earnType: z.string().min(1).max(20).optional(),
    earnRatio: z.number().min(0).optional(),
    redeemRatio: z.number().min(0).optional(),
    minRedeemAmount: z.number().min(0).optional(),
    maxRedeemRatio: z.number().min(0).max(1).optional(),
    expireDays: z.number().int().min(0).optional(),
    enabled: z.boolean().optional()
  }).parse(req.body);

  const result = await pointsService.updatePointsRule(body, req.tenantId!);
  res.json(ok(result));
});

export const listPointsRecords = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const type = req.query.type as string | undefined;

  const result = await pointsService.listPointsRecords(page, pageSize, req.tenantId!, userId, type);
  res.json(ok(result));
});

export const getUserPoints = asyncHandler(async (req, res) => {
  // S3-187 C：同一函数被两个端点共用——管理员代查 /api/admin/marketing/points/user/:userId
  //   与消费者侧 /api/miniapp/marketing/points/my。显式分支：
  //   ① 有 :userId ⇒ 用 param（管理员代查，归属/租户隔离由服务层按 tenant_id 兜住）；
  //   ② 无 :userId ⇒ 用登录态身份（此前读 req.params.userId 得到的恒为 NaN ⇒ 身份失真）。
  const paramUserId = req.params.userId === undefined ? undefined : Number(req.params.userId);
  let userId: number;
  if (paramUserId !== undefined) {
    if (!Number.isInteger(paramUserId) || paramUserId <= 0) {
      res.status(400).json(fail("用户ID无效", "400"));
      return;
    }
    userId = paramUserId;
  } else {
    userId = Number(req.user?.id || 0);
    if (!userId) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
  }
  const result = await pointsService.getUserPoints(userId, req.tenantId!);
  res.json(ok(result));
});

export const listMyPointsRecords = asyncHandler(async (req, res) => {
  const userId = Number(req.user?.id || req.query.userId || 0);
  if (!userId) {
    res.status(400).json(fail("缺少用户ID", "400"));
    return;
  }
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const type = req.query.type as string | undefined;

  const result = await pointsService.listMyPointsRecords(userId, page, pageSize, req.tenantId!, type);
  res.json(ok(result));
});

export const getPointsRecords = asyncHandler(async (req, res) => {
  const result = await pointsService.getPointsRecords({
    tenantId: req.tenantId!,
    userId: req.query.userId ? Number(req.query.userId) : undefined,
    type: req.query.type as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20)
  });
  res.json(ok(result));
});

export const createPointsRedeem = asyncHandler(async (req, res) => {
  const body = z.object({
    userId: z.number().int().positive(),
    points: z.number().int().positive(),
    orderId: z.number().int().optional(),
    remark: z.string().optional()
  }).parse(req.body);

  const result = await pointsService.createPointsRedeem({ ...body, tenantId: req.tenantId! });
  res.json(ok(result));
});

export const getPointsStats = asyncHandler(async (req, res) => {
  const result = await pointsService.getPointsStats(req.tenantId!);
  res.json(ok(result));
});
