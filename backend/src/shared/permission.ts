import type { AuthUser } from "./auth.js";

/**
 * 检查权限列表中是否包含指定权限
 * 支持通配符 "*" 表示全部权限
 */
export function checkPermission(permCode: string, permissions: string[]): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(permCode);
}

/**
 * 获取用户的数据范围
 * 返回: ALL | DEPARTMENT | STORE | SELF
 */
export function getDataScope(user: AuthUser): string {
  if (user.roles.includes("SUPER_ADMIN")) return "ALL";
  if (user.roles.includes("STORE_MANAGER")) return "STORE";
  if (user.roles.includes("SALES_STAFF") || user.roles.includes("CUSTOMER_SERVICE")) return "SELF";
  return "SELF";
}

/**
 * 根据用户角色返回数据权限过滤条件（SQL WHERE 子句）
 * @param user - 用户信息
 * @param tableName - 表名
 * @returns SQL WHERE 子句字符串（不含 WHERE 关键字），如 "store_id = 5" 或 "1=1"
 */
export function applyDataPermissionFilter(user: AuthUser, tableName: string): string {
  const scope = getDataScope(user);

  if (scope === "ALL") {
    return "1=1";
  }
  if (scope === "STORE") {
    if (user.storeId != null) {
      return `store_id = ${user.storeId}`;
    }
    return "1=0";
  }
  // scope === "SELF"（getDataScope 默认返回值）
  if (tableName === "sys_user" || tableName === "employee") {
    return `id = ${user.id}`;
  }
  return "1=0";
}

/**
 * 敏感字段映射表
 * 定义哪些表的哪些字段是敏感字段，哪些角色可以查看
 */
const SENSITIVE_FIELDS_MAP: Record<string, { fields: string[]; allowedRoles: string[] }> = {
  "sys_user": {
    fields: ["password_hash", "mobile", "id_card"],
    allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER"]
  },
  "customer": {
    fields: ["mobile", "id_card", "address"],
    allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "CUSTOMER_SERVICE"]
  },
  "order": {
    fields: ["cost_price", "profit"],
    allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"]
  },
  "product": {
    fields: ["cost_price", "supplier_price"],
    allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "PURCHASE_STAFF"]
  }
};

/**
 * 根据用户角色过滤返回数据中的敏感字段
 * @param user - 用户信息
 * @param tableName - 表名
 * @param data - 要过滤的数据（单条或数组）
 * @returns 过滤后的数据
 */
export function filterSensitiveFields<T extends Record<string, any>>(
  user: AuthUser,
  tableName: string,
  data: T
): T;
export function filterSensitiveFields<T extends Record<string, any>>(
  user: AuthUser,
  tableName: string,
  data: T[]
): T[];
export function filterSensitiveFields<T extends Record<string, any>>(
  user: AuthUser,
  tableName: string,
  data: T | T[]
): T | T[] {
  // 超级管理员不限制
  if (user.roles.includes("SUPER_ADMIN")) return data;

  const config = SENSITIVE_FIELDS_MAP[tableName];
  if (!config) return data;

  // 检查用户是否有权限查看敏感字段
  const hasAccess = config.allowedRoles.some((role) => user.roles.includes(role));
  if (hasAccess) return data;

  // 过滤敏感字段
  const sensitiveFields = config.fields;

  if (Array.isArray(data)) {
    return data.map((item) => {
      const filtered = { ...item };
      for (const field of sensitiveFields) {
        delete filtered[field];
      }
      return filtered;
    }) as T[];
  }

  const filtered = { ...data };
  for (const field of sensitiveFields) {
    delete filtered[field];
  }
  return filtered;
}