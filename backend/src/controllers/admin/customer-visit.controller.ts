import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as customerVisitService from "../../services/admin/customer-visit.service.js";

export const listVisits = asyncHandler(async (req, res) => {
  const result = await customerVisitService.listVisits(req.tenantId!, req.query as any);
  res.json(ok(result));
});

export const getVisitDetail = asyncHandler(async (req, res) => {
  const result = await customerVisitService.getVisitDetail(req.tenantId!, req.params.visitNo);
  res.json(ok(result));
});

export const createVisit = asyncHandler(async (req, res) => {
  const body = customerVisitService.createVisitSchema.parse(req.body);
  const result = await customerVisitService.createVisit(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.user!.realName,
    body
  );
  res.json(ok(result));
});

export const updateVisit = asyncHandler(async (req, res) => {
  const body = customerVisitService.updateVisitSchema.parse(req.body);
  const result = await customerVisitService.updateVisit(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo,
    body
  );
  res.json(ok(result));
});

export const checkin = asyncHandler(async (req, res) => {
  const body = customerVisitService.checkinSchema.parse(req.body);
  const result = await customerVisitService.checkin(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo,
    body
  );
  res.json(ok(result));
});

export const checkout = asyncHandler(async (req, res) => {
  const body = customerVisitService.checkoutSchema.parse(req.body);
  const result = await customerVisitService.checkout(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo,
    body
  );
  res.json(ok(result));
});

export const cancelVisit = asyncHandler(async (req, res) => {
  const result = await customerVisitService.cancelVisit(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo
  );
  res.json(ok(result));
});

export const listPendingFollowUps = asyncHandler(async (req, res) => {
  const visitorId = req.query.visitor_id ? Number(req.query.visitor_id) : req.user!.id;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await customerVisitService.listPendingFollowUps(req.tenantId!, visitorId, page, pageSize);
  res.json(ok(result));
});

export const getVisitStatistics = asyncHandler(async (req, res) => {
  const visitorId = req.query.visitor_id ? Number(req.query.visitor_id) : null;
  const startDate = (req.query.start_date as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDate = (req.query.end_date as string) || new Date().toISOString().slice(0, 10);
  const result = await customerVisitService.getVisitStatistics(req.tenantId!, visitorId, startDate, endDate);
  res.json(ok(result));
});