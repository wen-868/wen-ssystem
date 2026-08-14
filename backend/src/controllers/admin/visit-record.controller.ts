import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as visitRecordService from "../../services/admin/visit-record.service";

export const listVisitRecords = asyncHandler(async (req, res) => {
  const result = await visitRecordService.listVisitRecords(req.tenantId!, req.query as any);
  res.json(ok(result));
});

export const getVisitRecordDetail = asyncHandler(async (req, res) => {
  const result = await visitRecordService.getVisitRecordDetail(req.tenantId!, req.params.visitNo);
  res.json(ok(result));
});

export const checkin = asyncHandler(async (req, res) => {
  const body = visitRecordService.checkinSchema.parse(req.body);
  const result = await visitRecordService.checkin(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo,
    body
  );
  res.json(ok(result));
});

export const checkout = asyncHandler(async (req, res) => {
  const body = visitRecordService.checkoutSchema.parse(req.body);
  const result = await visitRecordService.checkout(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo,
    body
  );
  res.json(ok(result));
});

export const listPendingFollowUps = asyncHandler(async (req, res) => {
  const visitorId = req.query.visitor_id ? Number(req.query.visitor_id) : req.user!.id;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await visitRecordService.listPendingFollowUps(req.tenantId!, visitorId, page, pageSize);
  res.json(ok(result));
});

export const getVisitStatistics = asyncHandler(async (req, res) => {
  const visitorId = req.query.visitor_id ? Number(req.query.visitor_id) : null;
  const startDate = (req.query.start_date as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDate = (req.query.end_date as string) || new Date().toISOString().slice(0, 10);
  const result = await visitRecordService.getVisitStatistics(req.tenantId!, visitorId, startDate, endDate);
  res.json(ok(result));
});
