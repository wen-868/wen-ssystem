/**
 * 租户开通 · 角色与菜单供给（S3-183，P0）
 *
 * 背景（R101-收口总清单第 18 项）：平台开通租户的链路**从不克隆角色与菜单** ⇒ 新租户一出生就是坏的：
 * 该租户下 `t_sys_role` / `t_sys_menu` 0 行 ⇒ 登录后 `getUserPermissions()`（JOIN …
 * `AND r.tenant_id = ur.tenant_id`）命中 0 行、`getUserMenus()`（`AND r.tenant_id = ?`）命中 0 行并
 * 直接 `return []` ⇒ 能登录但功能中心 / 侧栏整屏空白。
 *
 * 口径**照抄迁移 197**（`docs/migrations/197_演示租户隔离.sql`，已生产验证），不另造一套：
 *   ① 从 `t_sys_role WHERE tenant_id='default'` 克隆角色行，带上 `permissions` / `role_name` /
 *      `description` / `data_scope` / `status`；幂等判据 `(role_code, tenant_id)`（与唯一键
 *      `uk_role_code_tenant` 同口径）；**不用 `INSERT IGNORE`**——少写列必须在严格模式下报错停下；
 *   ② 从 `t_sys_menu WHERE tenant_id='default'` 克隆菜单（先顶级、再子级），子级 `parent_id`
 *      **重指向本租户自己的父行**（按 `menu_code` 对齐）；幂等判据 `(menu_code, tenant_id)`；
 *   ③ 新租户的第一个管理员绑定到**本租户自己的** SUPER_ADMIN 角色行（不是 default 的）。
 *
 * 为什么注入 runner 而不是直接 import 数据库：调用方有的在 `transaction(conn)` 内（走 `conn.query`）、
 * 有的走连接池（走 `query`），两者返回形态不同；本模块只依赖"能执行一条参数化 SQL"，由调用方注入，
 * 避免在每个开通落点复制第二套克隆逻辑（公共逻辑只写一次）。
 */
import logger from "../../shared/logger";

/** 克隆源租户：角色/菜单的权威定义都落在它身上 */
export const TENANT_RBAC_SOURCE_TENANT_ID = "default";
/** 新租户首个管理员绑定的角色编码（与 197、rbac.service.ts 同口径） */
export const TENANT_ADMIN_ROLE_CODE = "SUPER_ADMIN";

/** 执行一条参数化 SQL；返回值保持驱动原始形态（本模块只读 affectedRows） */
export type SqlRunner = (sql: string, params?: unknown[]) => Promise<unknown>;

export interface TenantRbacProvisionResult {
  /** 本次新克隆的角色行数 */
  roleRows: number;
  /** 本次新克隆的顶级菜单行数 */
  menuTopRows: number;
  /** 本次新克隆的子级菜单行数 */
  menuChildRows: number;
}

/**
 * 取 affectedRows：`conn.query` 返回 `[ResultSetHeader, fields]`，连接池 `query` 直接返回
 * `ResultSetHeader`，两种形态都要兼容（S3-175 同类教训：形态不归一，日志口径就会失真）。
 */
function affectedRows(result: unknown): number {
  const head = Array.isArray(result) ? result[0] : result;
  const value = (head as { affectedRows?: unknown } | null | undefined)?.affectedRows;
  return typeof value === "number" ? value : 0;
}

/** ① 克隆角色行（幂等：`(role_code, tenant_id)` 已存在则 0 行） */
const CLONE_ROLES_SQL = `INSERT INTO t_sys_role
   (role_code, role_name, description, data_scope, permissions, status, tenant_id)
 SELECT s.role_code, s.role_name, s.description, s.data_scope, s.permissions, s.status, ?
 FROM t_sys_role s
 WHERE s.tenant_id = ?
   AND NOT EXISTS (
     SELECT 1 FROM t_sys_role d WHERE d.tenant_id = ? AND d.role_code = s.role_code
   )`;

/** ② 克隆顶级菜单（parent_id IS NULL） */
const CLONE_TOP_MENUS_SQL = `INSERT INTO t_sys_menu
   (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
 SELECT NULL, m.menu_code, m.menu_name, m.menu_type, m.path, m.component, m.icon, m.sort_no,
        m.visible, m.status, ?
 FROM t_sys_menu m
 WHERE m.tenant_id = ? AND m.parent_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = ? AND d.menu_code = m.menu_code
   )`;

/**
 * ② 克隆子级菜单：parent_id 按 `menu_code` 对齐**本租户自己的父行**。
 * 父行用 LEFT JOIN，源租户存在"父行缺失"的历史脏行时该子行降级为顶级菜单照常克隆
 * （保证"default 有几行、新租户就有几行"，与 197 第 6 条同口径）。
 */
const CLONE_CHILD_MENUS_SQL = `INSERT INTO t_sys_menu
   (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
 SELECT p.id, m.menu_code, m.menu_name, m.menu_type, m.path, m.component, m.icon, m.sort_no,
        m.visible, m.status, ?
 FROM t_sys_menu m
 LEFT JOIN t_sys_menu sp ON sp.id = m.parent_id AND sp.tenant_id = ?
 LEFT JOIN t_sys_menu p ON p.tenant_id = ? AND p.menu_code = sp.menu_code
 WHERE m.tenant_id = ? AND m.parent_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = ? AND d.menu_code = m.menu_code
   )`;

/**
 * ③ 绑定管理员到**本租户自己的** SUPER_ADMIN 角色行。
 * 角色查询**必须限定租户**：不限租户时 LIMIT 1 会命中 default 的 SUPER_ADMIN 行，绑出一条
 * 过不了 `r.tenant_id = ur.tenant_id` 的跨租户绑定（197 的 F2 判红就是这一处）。
 * 幂等：`(user_id, role_id)` 已有绑定则不插（`uk_sys_user_role (user_id, role_id)` 不含 tenant_id）。
 */
const BIND_ADMIN_SQL = `INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
 SELECT ?, r.id, ?
 FROM t_sys_role r
 WHERE r.tenant_id = ? AND r.role_code = ?
   AND NOT EXISTS (
     SELECT 1 FROM t_sys_user_role ur WHERE ur.user_id = ? AND ur.role_id = r.id
   )
 ORDER BY r.id ASC
 LIMIT 1`;

/**
 * 开通链路：为新租户克隆角色与菜单（幂等，可重复执行）。
 *
 * @param run 执行器（事务内传 conn.query，连接池传 query）
 * @param tenantId 新租户 ID
 * @param sourceTenantId 克隆源，默认 `default`
 */
export async function provisionTenantRbac(
  run: SqlRunner,
  tenantId: string,
  sourceTenantId: string = TENANT_RBAC_SOURCE_TENANT_ID
): Promise<TenantRbacProvisionResult> {
  if (tenantId === sourceTenantId) {
    // 源租户自己不需要克隆（调用方若把 default 传进来是调用错误，明确拒绝而不是静默 0 行）
    throw new Error(`租户 ${tenantId} 即克隆源，无需克隆角色/菜单`);
  }

  const roleRows = affectedRows(await run(CLONE_ROLES_SQL, [tenantId, sourceTenantId, tenantId]));
  const menuTopRows = affectedRows(await run(CLONE_TOP_MENUS_SQL, [tenantId, sourceTenantId, tenantId]));
  const menuChildRows = affectedRows(
    await run(CLONE_CHILD_MENUS_SQL, [tenantId, sourceTenantId, tenantId, sourceTenantId, tenantId])
  );

  logger.info(
    `[租户开通] 已从 ${sourceTenantId} 克隆角色/菜单到 ${tenantId}：角色 ${roleRows} 行、` +
      `顶级菜单 ${menuTopRows} 行、子级菜单 ${menuChildRows} 行`
  );

  return { roleRows, menuTopRows, menuChildRows };
}

/**
 * 开通链路：把该租户第一个管理员绑定到本租户自己的 SUPER_ADMIN 角色行。
 *
 * @returns true=本次新增了绑定；false=本租户没有可用 SUPER_ADMIN 角色行（应视为开通失败，
 *          由调用方按业务失败处理，不得静默放过）
 */
export async function bindTenantAdminToOwnSuperAdmin(
  run: SqlRunner,
  tenantId: string,
  userId: number,
  roleCode: string = TENANT_ADMIN_ROLE_CODE
): Promise<boolean> {
  const rows = affectedRows(await run(BIND_ADMIN_SQL, [userId, tenantId, tenantId, roleCode, userId]));
  if (rows === 0) {
    logger.warn(
      `[租户开通] ${tenantId} 未绑定到本租户的 ${roleCode} 角色行（可能是已有绑定或本租户缺该角色行）`
    );
  }
  return rows > 0;
}
