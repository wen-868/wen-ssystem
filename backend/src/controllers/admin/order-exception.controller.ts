import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as fixService from "../../services/admin/instant-retail-fix.service";

const tenant = (req: any) => req.tenantId as string;

/** 订单异常列表（keyword/status/exceptionType/日期/分页） */
export const listOrderExceptions = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await fixService.listExceptions(tenant(req), {
    page: q.page ? Number(q.page) : 1,
    pageSize: q.pageSize ? Number(q.pageSize) : 20,
    handleStatus: q.status,
    keyword: q.keyword,
    exceptionType: q.exceptionType,
    channelType: q.channelType,
    startDate: q.startDate,
    endDate: q.endDate,
  });
  res.json(ok(result));
});

/** 订单异常详情（含处理日志） */
export const getOrderExceptionDetail = asyncHandler(async (req, res) => {
  const result = await fixService.getExceptionDetail(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 从订单创建异常（标记订单异常） */
export const createOrderException = asyncHandler(async (req, res) => {
  const body = z.object({
    orderNo: z.string().min(1),
    channelType: z.string().optional(),
    exceptionType: z.string().optional(),
    exceptionDetail: z.string().optional(),
    level: z.string().optional(),
  }).parse(req.body);
  const result = await fixService.createException(tenant(req), body);
  res.json(ok(result));
});

/** 更新异常处理状态（PENDING/PROCESSING/RESOLVED/CLOSED） */
export const updateOrderExceptionStatus = asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(["PENDING", "PROCESSING", "RESOLVED", "CLOSED"]).optional(),
    result: z.string().optional(),
    action: z.string().optional(),
  }).parse(req.body || {});
  const status = body.status || "RESOLVED";
  const result = await fixService.handleException(
    tenant(req),
    Number(req.params.id),
    req.user?.id ?? 0,
    req.user?.realName || req.user?.username || "",
    { action: body.action || status, result: body.result, status }
  );
  res.json(ok(result));
});

/** 编辑异常备注 */
export const updateOrderException = asyncHandler(async (req, res) => {
  const body = z.object({
    exceptionDetail: z.string().optional(),
    remark: z.string().optional(),
  }).parse(req.body);
  const result = await fixService.updateException(tenant(req), Number(req.params.id), body);
  res.json(ok(result));
});
