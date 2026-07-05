import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as segmentService from "../../services/admin/customer-segment.service.js";

const createSegmentSchema = z.object({
  segmentName: z.string().min(1).max(100),
  conditions: z.record(z.any()),
  autoRefresh: z.boolean().optional(),
});

const updateSegmentSchema = z.object({
  segmentName: z.string().min(1).max(100).optional(),
  conditions: z.record(z.any()).optional(),
  autoRefresh: z.boolean().optional(),
});

export const createSegment = asyncHandler(async (req, res) => {
  const body = createSegmentSchema.parse(req.body);
  const { segmentName, conditions, autoRefresh } = body;
  res.json(ok(await segmentService.createSegment({ segmentName, conditions, autoRefresh, tenantId: req.tenantId! })));
});
export const listSegments = asyncHandler(async (req, res) => { res.json(ok(await segmentService.listSegments(req.tenantId!))); });
export const updateSegment = asyncHandler(async (req, res) => {
  const body = updateSegmentSchema.parse(req.body);
  const { segmentName, conditions, autoRefresh } = body;
  res.json(ok(await segmentService.updateSegment(Number(req.params.id), { segmentName, conditions, autoRefresh, tenantId: req.tenantId! })));
});
export const deleteSegment = asyncHandler(async (req, res) => { res.json(ok(await segmentService.deleteSegment(Number(req.params.id), req.tenantId!))); });
export const refreshSegmentMembers = asyncHandler(async (req, res) => { res.json(ok(await segmentService.refreshSegmentMembers(Number(req.params.id), req.tenantId!))); });
export const listSegmentMembers = asyncHandler(async (req, res) => {
  res.json(ok(await segmentService.listSegmentMembers({
    segmentId: Number(req.params.id), page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId!
  })));
});