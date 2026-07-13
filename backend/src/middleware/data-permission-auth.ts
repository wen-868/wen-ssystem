import type { RequestHandler } from "express";
import { requireAuthWithTenant, type AuthUser } from "./auth";
import { getUserDataPermissions } from "../services/admin/data-permission.service";
import { fail } from "../shared/response";

export type DataPermissionType = "DEPARTMENT" | "STORE" | "CUSTOMER";

export interface DataPermissionContext {
  hasAllPermission: boolean;
  permissions: Array<{
    permissionType: DataPermissionType | "ALL";
    scopeValues: number[];
  }>;
}

export function requireDataPermission(dataType: DataPermissionType, targetIdGetter: (req: any) => number | null): RequestHandler {
  return async (req: any, res: any, next: any) => {
    const user = req.user as AuthUser | undefined;
    const tenantId = req.tenantId;
    
    if (!user) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    
    if (user.roles.includes("SUPER_ADMIN")) {
      req.dataPermission = {
        hasAllPermission: true,
        permissions: [{ permissionType: "ALL", scopeValues: [] }],
      };
      next();
      return;
    }
    
    try {
      const permissions = await getUserDataPermissions(user.id, tenantId);
      const context: DataPermissionContext = {
        hasAllPermission: false,
        permissions: permissions.map(p => ({
          permissionType: p.permission_type,
          scopeValues: p.scopeValues ? JSON.parse(p.scopeValues) : [],
        })),
      };
      
      for (const perm of context.permissions) {
        if (perm.permissionType === "ALL") {
          context.hasAllPermission = true;
          req.dataPermission = context;
          next();
          return;
        }
        
        if (perm.permissionType === dataType) {
          const targetId = targetIdGetter(req);
          if (targetId === null || perm.scopeValues.length === 0 || perm.scopeValues.includes(targetId)) {
            req.dataPermission = context;
            next();
            return;
          }
        }
      }
      
      res.status(403).json(fail(`无权限访问此${dataType.toLowerCase()}数据`, "403"));
    } catch (err) {
      res.status(500).json(fail("数据权限检查失败", "500"));
    }
  };
}

export function getDataPermissionFilter(dataType: DataPermissionType, scopeField: string): RequestHandler {
  return (req: any, res: any, next: any) => {
    const permissionCtx = req.dataPermission as DataPermissionContext | undefined;
    
    if (!permissionCtx || permissionCtx.hasAllPermission) {
      next();
      return;
    }
    
    const targetPermission = permissionCtx.permissions.find(p => p.permissionType === dataType);
    if (!targetPermission || targetPermission.scopeValues.length === 0) {
      next();
      return;
    }
    
    req.dataPermissionFilter = {
      [scopeField]: targetPermission.scopeValues,
    };
    
    next();
  };
}

export async function getUserDataPermissionContext(userId: number, tenantId: string): Promise<DataPermissionContext> {
  const permissions = await getUserDataPermissions(userId, tenantId);
  return {
    hasAllPermission: permissions.some(p => p.permission_type === "ALL"),
    permissions: permissions.map(p => ({
      permissionType: p.permission_type,
      scopeValues: p.scopeValues ? JSON.parse(p.scopeValues) : [],
    })),
  };
}
