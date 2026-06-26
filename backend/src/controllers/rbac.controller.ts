import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/rbac.service.js";
import { z } from "zod";

export const listRoles = asyncHandler(async (req, res) => {
  const records = await service.listRoles(req.tenantId!);
  res.json(ok(records));
});

export const createRole = asyncHandler(async (req, res) => {
  const body = z.object({
    roleName: z.string().min(1).max(50),
    roleCode: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    permissions: z.array(z.string()).default([]),
    dataScope: z.enum(["ALL", "DEPARTMENT", "STORE", "SELF"]).default("SELF")
  }).parse(req.body);

  try {
    const record = await service.createRole(body, req.tenantId!);
    res.json(ok(record));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const getRoleDetail = asyncHandler(async (req, res) => {
  try {
    const record = await service.getRoleDetail(Number(req.params.id), req.tenantId!);
    res.json(ok(record));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const updateRole = asyncHandler(async (req, res) => {
  const body = z.object({
    roleName: z.string().min(1).max(50).optional(),
    description: z.string().max(200).optional(),
    permissions: z.array(z.string()).optional(),
    dataScope: z.enum(["ALL", "DEPARTMENT", "STORE", "SELF"]).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional()
  }).parse(req.body);

  try {
    const record = await service.updateRole(Number(req.params.id), body, req.tenantId!);
    res.json(ok(record));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const deleteRole = asyncHandler(async (req, res) => {
  try {
    const result = await service.deleteRole(Number(req.params.id), req.tenantId!);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const getUserRoles = asyncHandler(async (req, res) => {
  const records = await service.getUserRoles(Number(req.params.userId), req.tenantId!);
  res.json(ok(records));
});

export const setUserRoles = asyncHandler(async (req, res) => {
  const body = z.object({
    roleIds: z.array(z.number().int().positive())
  }).parse(req.body);

  try {
    const records = await service.setUserRoles(Number(req.params.userId), body.roleIds, req.tenantId!);
    res.json(ok(records));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});