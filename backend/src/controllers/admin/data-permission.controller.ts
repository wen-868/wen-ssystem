import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/data-permission.service";
import { z } from "zod";

export const listDataPermissions = asyncHandler(async (req, res) => {
  const records = await service.listDataPermissions(req.tenantId!);
  res.json(ok(records));
});

export const getDataPermissionDetail = asyncHandler(async (req, res) => {
  const record = await service.getDataPermissionDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(record));
});

export const createDataPermission = asyncHandler(async (req, res) => {
  const body = z.object({
    permissionName: z.string().min(1).max(128),
    permissionCode: z.string().min(1).max(64),
    permissionType: z.enum(["ALL", "DEPARTMENT", "STORE", "CUSTOMER"]),
    description: z.string().max(255).optional(),
    status: z.number().int().min(0).max(1).optional(),
    sortNo: z.number().int().optional(),
  }).parse(req.body);

  const record = await service.createDataPermission(body, req.tenantId!);
  res.json(ok(record));
});

export const updateDataPermission = asyncHandler(async (req, res) => {
  const body = z.object({
    permissionName: z.string().min(1).max(128).optional(),
    description: z.string().max(255).optional(),
    status: z.number().int().min(0).max(1).optional(),
    sortNo: z.number().int().optional(),
  }).parse(req.body);

  const record = await service.updateDataPermission(Number(req.params.id), body, req.tenantId!);
  res.json(ok(record));
});

export const deleteDataPermission = asyncHandler(async (req, res) => {
  const result = await service.deleteDataPermission(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const getRoleDataPermissions = asyncHandler(async (req, res) => {
  const records = await service.getRoleDataPermissions(Number(req.params.roleId), req.tenantId!);
  res.json(ok(records));
});

export const assignRoleDataPermission = asyncHandler(async (req, res) => {
  const body = z.object({
    dataPermissionId: z.number().int().positive(),
    scopeValues: z.array(z.number().int().positive()).nullable().optional(),
  }).parse(req.body);

  const records = await service.assignRoleDataPermission(
    Number(req.params.roleId),
    body.dataPermissionId,
    body.scopeValues ?? null,
    req.tenantId!
  );
  res.json(ok(records));
});

export const removeRoleDataPermission = asyncHandler(async (req, res) => {
  const records = await service.removeRoleDataPermission(
    Number(req.params.roleId),
    Number(req.params.dataPermissionId),
    req.tenantId!
  );
  res.json(ok(records));
});

export const getUserDataPermissions = asyncHandler(async (req, res) => {
  const records = await service.getUserDataPermissions(Number(req.params.userId), req.tenantId!);
  res.json(ok(records));
});

export const checkDataPermission = asyncHandler(async (req, res) => {
  const body = z.object({
    dataType: z.enum(["DEPARTMENT", "STORE", "CUSTOMER"]),
    targetId: z.number().int().positive().nullable().optional(),
  }).parse(req.body);

  const hasPermission = await service.checkDataPermission(
    Number(req.params.userId),
    req.tenantId!,
    body.dataType,
    body.targetId ?? null
  );
  res.json(ok({ hasPermission }));
});
