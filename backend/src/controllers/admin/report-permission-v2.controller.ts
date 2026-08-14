import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as reportPermissionV2Service from "../../services/admin/report-permission-v2.service";

// ========== 权限矩阵 ==========

// 获取权限矩阵
export const getPermissionMatrix = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.getPermissionMatrix(req.tenantId!);
  res.json(ok(result));
});

// 更新权限矩阵
export const updatePermissionMatrix = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.savePermissionMatrix(
    req.tenantId!,
    req.body.permissions || [],
    {
      operatorId: req.user!.id,
      operatorName: req.body.operatorName,
    }
  );
  res.json(ok(result));
});

// ========== 数据权限配置 ==========

// 获取数据权限配置
export const getDataScopeConfig = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.getDataScopeConfig(req.tenantId!);
  res.json(ok(result));
});

// 更新数据权限配置
export const updateDataScopeConfig = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.updateDataScopeConfig(
    req.tenantId!,
    req.body.configs || [],
    {
      operatorId: req.user!.id,
      operatorName: req.body.operatorName,
    }
  );
  res.json(ok(result));
});

// ========== 用户权限 ==========

// 获取用户权限
export const getUserPermissions = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.getUserPermissions(
    Number(req.params.userId),
    req.tenantId!
  );
  res.json(ok(result));
});

// 分配用户权限
export const assignUserPermissions = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.assignUserPermissions(
    Number(req.params.userId),
    req.tenantId!,
    req.body.permissions || [],
    {
      operatorId: req.user!.id,
      operatorName: req.body.operatorName,
    }
  );
  res.json(ok(result));
});

// ========== 我的权限 ==========

// 获取我的权限
export const getMyPermissions = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.getMyPermissions(
    req.user!.id,
    req.tenantId!
  );
  res.json(ok(result));
});

// ========== 权限审计日志 ==========

// 获取权限审计日志
export const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await reportPermissionV2Service.getAuditLogs({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    action: req.query.action as string | undefined,
    targetType: req.query.targetType as string | undefined,
    operatorId: req.query.operatorId !== undefined ? Number(req.query.operatorId) : undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// ========== 批量设置权限 ==========

// 批量设置报表权限（多角色 × 多报表）
export const batchSetPermissions = asyncHandler(async (req, res) => {
  const body = z.object({
    roleIds: z.array(z.number().int().positive()).min(1).max(100),
    reportCodes: z.array(z.string().min(1).max(64)).min(1).max(100),
    canView: z.boolean().default(true),
    canExport: z.boolean().default(false),
  }).parse(req.body);

  const result = await reportPermissionV2Service.batchSetPermissions(
    req.tenantId!,
    {
      roleIds: body.roleIds,
      reportCodes: body.reportCodes,
      canView: body.canView,
      canExport: body.canExport,
    },
    {
      operatorId: req.user!.id,
      operatorName: req.body.operatorName,
    }
  );
  res.json(ok(result));
});

// ========== 权限审计日志详情 ==========

// 获取权限审计日志详情
export const getAuditLogDetail = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json(fail("日志ID无效", "400"));
    return;
  }

  const detail = await reportPermissionV2Service.getAuditLogDetail(id, req.tenantId!);
  if (!detail) {
    res.status(404).json(fail("审计日志不存在", "404"));
    return;
  }
  res.json(ok(detail));
});
