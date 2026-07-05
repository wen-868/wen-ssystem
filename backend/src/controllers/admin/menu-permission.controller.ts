import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import { z } from "zod";
import * as menuPermissionService from "../../services/admin/menu-permission.service.js";

// GET /menus/tree
export const getMenuTree = asyncHandler(async (req, res) => {
  const tree = await menuPermissionService.getMenuTree(req.tenantId!);
  res.json(ok(tree));
});

// GET /menus/user
export const getUserMenus = asyncHandler(async (req, res) => {
  const menus = await menuPermissionService.getUserMenus(req.user!.id, req.tenantId!);
  res.json(ok(menus));
});

// GET /roles/:roleId/permissions
export const getRolePermissions = asyncHandler(async (req, res) => {
  const roleId = z.coerce.number().int().positive().parse(req.params.roleId);
  const permissions = await menuPermissionService.getRolePermissions(roleId, req.tenantId!);
  res.json(ok(permissions));
});

// PUT /roles/:roleId/menus
export const setRoleMenuPermissions = asyncHandler(async (req, res) => {
  const roleId = z.coerce.number().int().positive().parse(req.params.roleId);
  const body = z.object({
    menuIds: z.array(z.number().int().positive())
  }).parse(req.body);
  await menuPermissionService.setRoleMenuPermissions(roleId, body.menuIds, req.tenantId!);
  res.json(ok({ roleId, menuCount: body.menuIds.length }));
});

// GET /roles/:roleId/data-permissions
export const getDataPermissions = asyncHandler(async (req, res) => {
  const roleId = z.coerce.number().int().positive().parse(req.params.roleId);
  const dataPermissions = await menuPermissionService.getDataPermissions(roleId, req.tenantId!);
  res.json(ok(dataPermissions));
});

// PUT /roles/:roleId/data-permissions
export const setRoleDataPermissions = asyncHandler(async (req, res) => {
  const roleId = z.coerce.number().int().positive().parse(req.params.roleId);
  const body = z.object({
    dataPermissions: z.array(z.object({
      tableName: z.string().min(1),
      fieldName: z.string().min(1),
      filterType: z.string().min(1),
      filterValue: z.string()
    }))
  }).parse(req.body);
  await menuPermissionService.setRoleDataPermissions(roleId, body.dataPermissions.map((dp: any) => ({ ...dp, roleId })), req.tenantId!);
  res.json(ok({ roleId, count: body.dataPermissions.length }));
});

// GET /roles/:roleId/field-permissions
export const getFieldPermissions = asyncHandler(async (req, res) => {
  const roleId = z.coerce.number().int().positive().parse(req.params.roleId);
  const fieldPermissions = await menuPermissionService.getFieldPermissions(roleId, req.tenantId!);
  res.json(ok(fieldPermissions));
});

// PUT /roles/:roleId/field-permissions
export const setRoleFieldPermissions = asyncHandler(async (req, res) => {
  const roleId = z.coerce.number().int().positive().parse(req.params.roleId);
  const body = z.object({
    fieldPermissions: z.array(z.object({
      tableName: z.string().min(1),
      fieldName: z.string().min(1),
      permissionType: z.string().min(1)
    }))
  }).parse(req.body);
  await menuPermissionService.setRoleFieldPermissions(roleId, body.fieldPermissions.map((fp: any) => ({ ...fp, roleId })), req.tenantId!);
  res.json(ok({ roleId, count: body.fieldPermissions.length }));
});