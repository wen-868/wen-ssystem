import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as segmentService from "../../services/admin/customer-segment.service.js";

export const createSegment = asyncHandler(async (req, res) => {
  const { segmentName, conditions, autoRefresh } = req.body;
  res.json(ok(await segmentService.createSegment({ segmentName, conditions, autoRefresh, tenantId: req.tenantId! })));
});
export const listSegments = asyncHandler(async (req, res) => { res.json(ok(await segmentService.listSegments(req.tenantId!))); });
export const updateSegment = asyncHandler(async (req, res) => {
  const { segmentName, conditions, autoRefresh } = req.body;
  res.json(ok(await segmentService.updateSegment(Number(req.params.id), { segmentName, conditions, autoRefresh, tenantId: req.tenantId! })));
});
export const deleteSegment = asyncHandler(async (req, res) => { res.json(ok(await segmentService.deleteSegment(Number(req.params.id), req.tenantId!))); });
export const refreshSegmentMembers = asyncHandler(async (req, res) => { res.json(ok(await segmentService.refreshSegmentMembers(Number(req.params.id), req.tenantId!))); });
export const listSegmentMembers = asyncHandler(async (req, res) => {
  res.json(ok(await segmentService.listSegmentMembers({
    segmentId: Number(req.params.id), page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId!
  })));
});