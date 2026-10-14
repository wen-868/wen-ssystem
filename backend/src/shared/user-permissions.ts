/**
 * 用户权限集合解析（**唯一出处**，S3-203 提取）
 *
 * ── 为什么要有这个文件 ──────────────────────────────────────────────
 *   S3-203 处置卡 §6.2.3 要求「同一身份域内的角色必须在**工作台与移动端解析出同一权限集合**」。
 *   提取前：工作台（`services/admin/auth.service.ts`）读 `t_sys_role.permissions`；
 *   移动端（`services/store/auth.service.ts` 的 `getCurrentUser`）返回的是**一份硬编码权限数组**
 *   —— 同一角色两端口径天然可能不一致，且移动端那份不随角色配置变化。
 *   提取后：两头都只经本文件的 `getUserPermissions()`，判据只有一条 SQL（`t_sys_role.permissions`）。
 *
 * ── 口径（不许在这里分叉）────────────────────────────────────────────
 *   · 只读 `t_sys_role.permissions`（JSON 数组），按用户全部角色**去重合并**；
 *   · JOIN 必须带 `r.tenant_id = ur.tenant_id`（跨租户绑定不得被算作本租户权限）；
 *   · 角色的 `status` 兼容 VARCHAR('ACTIVE') 与 TINYINT(1) 两种历史形态（079 迁移 seed 用 1）。
 */
import { query } from "./db";

/** 角色权限行 */
export interface RolePermissionRow {
  permissions: unknown;
}

/**
 * 规范化角色 permissions 字段为字符串数组
 *
 * 兼容 mysql2 对 JSON 类型的多种返回形态（R54-15 引入 getUserPermissions 后的生产 500 修复）：
 * - mysql2 默认会自动解析 JSON 类型列为 JS 对象（数组/对象），此时 JSON.parse(数组) 会抛异常
 * - 不同 mysql2 版本 / 配置下，permissions 可能返回：
 *   1) JS 数组（mysql2 自动解析 JSON）—— 直接使用
 *   2) JSON 字符串（如 '["perm1"]'）—— JSON.parse 解析
 *   3) 空字符串 "" —— 返回 []
 *   4) null / undefined —— 返回 []
 *   5) 非法 JSON 字符串 —— 容错返回 []
 *
 * 关联任务：R54遗留 生产环境登录 API 500 错误修复
 */
export function normalizePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === "string");
  }
  if (typeof raw === "string") {
    if (raw === "") return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === "string");
      }
    } catch {
      // 非法 JSON 字符串，容错返回空数组，避免登录 500
      return [];
    }
  }
  // null / undefined / 其他类型
  return [];
}

/**
 * 根据用户ID获取其所有角色的权限列表（去重合并）
 * 角色 permissions 字段存储 JSON 数组格式的权限编码
 *
 * 注意：status 查询条件兼容 VARCHAR('ACTIVE') 和 TINYINT(1) 两种类型，
 *       因为 init_database.sql 中 status 是 VARCHAR DEFAULT 'ACTIVE'，
 *       但 079_权限矩阵.sql 的 seed 数据用 1（被转成字符串 "1"）。
 */
export async function getUserPermissions(userId: number, tenantId: string): Promise<string[]> {
  const roles = await query<RolePermissionRow>(
    `SELECT r.permissions
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ? AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [userId, tenantId]
  );

  const permSet = new Set<string>();
  for (const role of roles) {
    const perms = normalizePermissions(role.permissions);
    for (const p of perms) {
      permSet.add(p);
    }
  }
  return Array.from(permSet);
}
