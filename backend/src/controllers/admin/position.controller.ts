import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as positionService from "../../services/admin/position.service";

export const listPositions = asyncHandler(async (req, res) => {
  res.json(ok(await positionService.listPositions({
    departmentId: req.query.departmentId ? Number(req.query.departmentId) : undefined,
    status: req.query.status ? Number(req.query.status) : undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  })));
});

export const getPosition = asyncHandler(async (req, res) => {
  res.json(ok(await positionService.getPosition(Number(req.params.id), req.tenantId!)));
});

export const createPosition = asyncHandler(async (req, res) => {
  const { positionName, positionCode, departmentId, sortOrder, status, remark } = req.body;
  res.json(ok(await positionService.createPosition({ positionName, positionCode, departmentId, sortOrder, status, remark, tenantId: req.tenantId! })));
});

export const updatePosition = asyncHandler(async (req, res) => {
  const { positionName, positionCode, departmentId, sortOrder, status, remark } = req.body;
  res.json(ok(await positionService.updatePosition(Number(req.params.id), { positionName, positionCode, departmentId, sortOrder, status, remark, tenantId: req.tenantId! })));
});

export const deletePosition = asyncHandler(async (req, res) => {
  res.json(ok(await positionService.deletePosition(Number(req.params.id), req.tenantId!)));
});

export const listAllPositions = asyncHandler(async (req, res) => {
  res.json(ok(await positionService.listAllPositions(req.tenantId!)));
});
