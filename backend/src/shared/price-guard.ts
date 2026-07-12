/**
 * 越权拦截引擎 - 价格跨层级查询拦截
 *
 * 拦截规则：
 * 1. 成本价(cost_price) → 仅 SUPER_ADMIN / FINANCE_STAFF / PURCHASE_STAFF
 * 2. 批发价(wholesale_price) → 仅 SUPER_ADMIN / STORE_MANAGER / FINANCE_STAFF
 * 3. 协议价(agreement_price) → 仅 SUPER_ADMIN / STORE_MANAGER / FINANCE_STAFF
 * 4. 供应商价(supplier_price) → 仅 SUPER_ADMIN / PURCHASE_STAFF
 * 5. 价格等级查询 → 销售员只能查 RETAIL 和已审批绑定的客户等级
 * 6. 客户价格绑定操作 → 仅 SUPER_ADMIN / STORE_MANAGER
 */

import type { AuthUser } from "./auth";
import logger from "./logger";
import { queryWithTenant } from "./db";

// ─── 角色价格可见性矩阵 ───────────────────────────────────────

export interface PriceAccessRule {
  fieldPattern: string;       // 字段名匹配模式（支持 * 通配符）
  description: string;        // 字段说明
  allowedRoles: string[];     // 允许查看的角色
}

/** 价格相关敏感字段访问规则 */
export const PRICE_SENSITIVE_FIELDS: PriceAccessRule[] = [
  { fieldPattern: "costPrice", description: "成本价", allowedRoles: ["SUPER_ADMIN", "FINANCE_STAFF", "PURCHASE_STAFF"] },
  { fieldPattern: "cost_price", description: "成本价", allowedRoles: ["SUPER_ADMIN", "FINANCE_STAFF", "PURCHASE_STAFF"] },
  { fieldPattern: "wholesalePrice", description: "批发价", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"] },
  { fieldPattern: "wholesale_price", description: "批发价", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"] },
  { fieldPattern: "supplierPrice", description: "供应商价", allowedRoles: ["SUPER_ADMIN", "PURCHASE_STAFF"] },
  { fieldPattern: "supplier_price", description: "供应商价", allowedRoles: ["SUPER_ADMIN", "PURCHASE_STAFF"] },
  { fieldPattern: "agreementPrice", description: "协议价", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"] },
  { fieldPattern: "agreement_price", description: "协议价", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"] },
  { fieldPattern: "suggestedRetailPrice", description: "建议零售价", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF", "PURCHASE_STAFF", "SALES_STAFF", "CUSTOMER_SERVICE"] },
  { fieldPattern: "suggested_retail_price", description: "建议零售价", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF", "PURCHASE_STAFF", "SALES_STAFF", "CUSTOMER_SERVICE"] },
  { fieldPattern: "profit", description: "利润", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"] },
  { fieldPattern: "margin", description: "毛利率", allowedRoles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"] },
];

/** 价格等级操作权限 */
export const PRICE_LEVEL_MANAGEMENT_ROLES = ["SUPER_ADMIN", "STORE_MANAGER"];
export const PRICE_BINDING_MANAGEMENT_ROLES = ["SUPER_ADMIN", "STORE_MANAGER"];
export const PRICE_CHANGE_LOG_VIEW_ROLES = ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"];

// ─── 价格守卫引擎 ─────────────────────────────────────────────

/**
 * 检查用户是否可以查看指定价格字段
 */
export function canAccessPriceField(user: AuthUser, fieldName: string): boolean {
  // 超级管理员不限制
  if (user.roles.includes("SUPER_ADMIN")) return true;

  const rule = PRICE_SENSITIVE_FIELDS.find(r => matchesField(fieldName, r.fieldPattern));
  if (!rule) return true; // 非敏感字段，允许访问

  return rule.allowedRoles.some(role => user.roles.includes(role));
}

/**
 * 检查用户是否可以访问指定价格等级
 */
export async function canAccessPriceLevel(
  user: AuthUser,
  priceLevelCode: string,
  tenantId: string
): Promise<boolean> {
  if (user.roles.includes("SUPER_ADMIN")) return true;
  if (user.roles.includes("STORE_MANAGER") || user.roles.includes("FINANCE_STAFF")) return true;

  // 销售员只能访问 RETAIL 等级
  if (user.roles.includes("SALES_STAFF")) {
    return priceLevelCode === "RETAIL";
  }

  return false;
}

/**
 * 过滤对象中的敏感价格字段，将无权限字段替换为 null
 * @returns 过滤后的对象和无权限字段列表
 */
export function filterPriceFields<T extends Record<string, any>>(
  user: AuthUser,
  data: T
): { filtered: T; blockedFields: string[] } {
  if (user.roles.includes("SUPER_ADMIN")) return { filtered: data, blockedFields: [] };

  const blockedFields: string[] = [];
  const filtered = { ...data } as Record<string, unknown>;

  for (const key of Object.keys(filtered)) {
    if (!canAccessPriceField(user, key)) {
      blockedFields.push(key);
      filtered[key] = null;
    }
  }

  return { filtered: filtered as T, blockedFields };
}

/**
 * 批量过滤数组中的敏感价格字段
 */
export function filterPriceFieldsBatch<T extends Record<string, any>>(
  user: AuthUser,
  dataList: T[]
): { filtered: T[]; blockedFields: string[] } {
  if (user.roles.includes("SUPER_ADMIN")) return { filtered: dataList, blockedFields: [] };

  const blockedFieldsSet = new Set<string>();
  const filtered = dataList.map(item => {
    const result = filterPriceFields(user, item);
    result.blockedFields.forEach(f => blockedFieldsSet.add(f));
    return result.filtered;
  });

  return { filtered, blockedFields: Array.from(blockedFieldsSet) };
}

// ─── 审计日志 ─────────────────────────────────────────────────

/**
 * 记录越权访问尝试
 */
export async function logUnauthorizedAccess(
  user: AuthUser,
  action: string,
  detail: string,
  target: string,
  tenantId: string
): Promise<void> {
  try {
    await queryWithTenant(
      `INSERT INTO t_operation_log (user_id, action, detail, target, category, tenant_id, created_at)
       VALUES (?, ?, ?, ?, 'UNAUTHORIZED_ACCESS', ?, NOW())`,
      [user.id, action, detail, target, tenantId],
      tenantId
    );
  } catch {
    // 审计日志写入失败不应影响主流程
    logger.error("[PriceGuard] Failed to log unauthorized access attempt");
  }
}

// ─── 工具函数 ─────────────────────────────────────────────────

/** 测试字段名是否匹配模式（支持 * 通配符） */
export function matchesField(fieldName: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.includes("*")) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$", "i");
    return regex.test(fieldName);
  }
  return fieldName.toLowerCase() === pattern.toLowerCase();
}

/**
 * 获取用户可访问的价格字段白名单
 */
export function getAccessiblePriceFields(user: AuthUser): string[] {
  const fields: string[] = [];

  for (const rule of PRICE_SENSITIVE_FIELDS) {
    if (rule.allowedRoles.some(role => user.roles.includes(role))) {
      fields.push(rule.fieldPattern);
    }
  }

  return fields;
}

/**
 * 获取用户被禁止访问的价格字段列表
 */
export function getBlockedPriceFields(user: AuthUser): string[] {
  if (user.roles.includes("SUPER_ADMIN")) return [];

  return PRICE_SENSITIVE_FIELDS
    .filter(rule => !rule.allowedRoles.some(role => user.roles.includes(role)))
    .map(rule => rule.fieldPattern);
}

/**
 * 获取价格字段的访问权限详情（用于前端展示权限矩阵）
 */
export function getPricePermissionMatrix(): Record<string, { description: string; roles: string[] }> {
  const matrix: Record<string, { description: string; roles: string[] }> = {};
  for (const rule of PRICE_SENSITIVE_FIELDS) {
    matrix[rule.fieldPattern] = { description: rule.description, roles: rule.allowedRoles };
  }
  return matrix;
}