import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";

// ========== 菜单相关 ==========

export interface MenuItem {
  id: number;
  parentId: number | null;
  menuName: string;
  menuCode: string;
  menuType: string;
  path: string;
  icon: string;
  sortNo: number;
  status: string;
  children?: MenuItem[];
}

export async function getMenuTree(tenantId: string): Promise<MenuItem[]> {
  const records = await queryWithTenant<any>(
    `SELECT id, parent_id AS parentId, menu_name AS menuName, menu_code AS menuCode,
            menu_type AS menuType, path, icon, sort_no AS sortNo, status
     FROM sys_menu
     ORDER BY sort_no ASC`,
    [],
    tenantId
  );

  return buildTree(records);
}

function buildTree(flatList: MenuItem[]): MenuItem[] {
  const map = new Map<number, MenuItem>();
  const roots: MenuItem[] = [];

  for (const item of flatList) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of flatList) {
    const node = map.get(item.id)!;
    if (item.parentId != null && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  // 清理空的 children
  const cleanEmpty = (nodes: MenuItem[]) => {
    for (const node of nodes) {
      if (node.children && node.children.length === 0) {
        delete node.children;
      } else if (node.children) {
        cleanEmpty(node.children);
      }
    }
  };
  cleanEmpty(roots);

  return roots;
}

export async function getRoleMenuCodes(roleId: number, tenantId: string): Promise<string[]> {
  const records = await queryWithTenant<any>(
    `SELECT m.menu_code AS menuCode
     FROM sys_role_menu rm
     JOIN sys_menu m ON m.id = rm.menu_id
     WHERE rm.role_id = ?`,
    [roleId],
    tenantId
  );

  return records.map((r: any) => r.menuCode);
}

export async function getUserMenus(userId: number, tenantId: string): Promise<MenuItem[]> {
  // 获取用户的所有角色
  const roles = await queryWithTenant<any>(
    `SELECT r.id AS roleId
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 'ACTIVE'`,
    [userId],
    tenantId
  );

  const roleIds: number[] = roles.map((r: any) => r.roleId);

  if (roleIds.length === 0) {
    return [];
  }

  // 检查是否有超级管理员角色
  const superAdmin = roles.some((r: any) => r.roleCode === "SUPER_ADMIN");

  // 获取所有有权限的菜单（去重）
  let records: any[];
  if (superAdmin) {
    // 超级管理员看到所有菜单
    records = await queryWithTenant<any>(
      `SELECT DISTINCT id, parent_id AS parentId, menu_name AS menuName, menu_code AS menuCode,
              menu_type AS menuType, path, icon, sort_no AS sortNo, status
       FROM sys_menu
       ORDER BY sort_no ASC`,
      [],
      tenantId
    );
  } else {
    // 根据角色过滤菜单
    const placeholders = roleIds.map(() => "?").join(",");
    records = await queryWithTenant<any>(
      `SELECT DISTINCT m.id, m.parent_id AS parentId, m.menu_name AS menuName, m.menu_code AS menuCode,
              m.menu_type AS menuType, m.path, m.icon, m.sort_no AS sortNo, m.status
       FROM sys_role_menu rm
       JOIN sys_menu m ON m.id = rm.menu_id
       WHERE rm.role_id IN (${placeholders})
       ORDER BY m.sort_no ASC`,
      roleIds,
      tenantId
    );
  }

  return buildTree(records);
}

// ========== 数据权限 ==========

export interface DataPermission {
  id?: number;
  roleId: number;
  tableName: string;
  fieldName: string;
  filterType: string;
  filterValue: string;
}

export async function getDataPermissions(roleId: number, tenantId: string): Promise<DataPermission[]> {
  return await queryWithTenant<DataPermission>(
    `SELECT id, role_id AS roleId, table_name AS tableName, field_name AS fieldName,
            filter_type AS filterType, filter_value AS filterValue
     FROM sys_data_permission
     WHERE role_id = ?`,
    [roleId],
    tenantId
  );
}

// ========== 字段权限 ==========

export interface FieldPermission {
  id?: number;
  roleId: number;
  tableName: string;
  fieldName: string;
  permissionType: string;
}

export async function getFieldPermissions(roleId: number, tenantId: string): Promise<FieldPermission[]> {
  return await queryWithTenant<FieldPermission>(
    `SELECT id, role_id AS roleId, table_name AS tableName, field_name AS fieldName,
            permission_type AS permissionType
     FROM sys_field_permission
     WHERE role_id = ?`,
    [roleId],
    tenantId
  );
}

// ========== 完整权限矩阵 ==========

export interface RolePermissions {
  menus: string[];
  dataPermissions: DataPermission[];
  fieldPermissions: FieldPermission[];
}

export async function getRolePermissions(roleId: number, tenantId: string): Promise<RolePermissions> {
  const [menus, dataPermissions, fieldPermissions] = await Promise.all([
    getRoleMenuCodes(roleId, tenantId),
    getDataPermissions(roleId, tenantId),
    getFieldPermissions(roleId, tenantId),
  ]);

  return { menus, dataPermissions, fieldPermissions };
}

// ========== 设置权限 ==========

export async function setRoleMenuPermissions(
  roleId: number,
  menuIds: number[],
  tenantId: string
): Promise<void> {
  await transaction(async (conn) => {
    // 删除旧的菜单权限
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
      "DELETE FROM sys_role_menu WHERE role_id = ?",
      [roleId]
    );
    // 插入新的菜单权限
    for (const menuId of menuIds) {
      await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
        "INSERT INTO sys_role_menu (role_id, menu_id) VALUES (?, ?)",
        [roleId, menuId]
      );
    }
  });
}

export async function setRoleDataPermissions(
  roleId: number,
  dataPermissions: DataPermission[],
  tenantId: string
): Promise<void> {
  await transaction(async (conn) => {
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
      "DELETE FROM sys_data_permission WHERE role_id = ?",
      [roleId]
    );
    for (const dp of dataPermissions) {
      await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
        `INSERT INTO sys_data_permission (role_id, table_name, field_name, filter_type, filter_value)
         VALUES (?, ?, ?, ?, ?)`,
        [roleId, dp.tableName, dp.fieldName, dp.filterType, dp.filterValue]
      );
    }
  });
}

export async function setRoleFieldPermissions(
  roleId: number,
  fieldPermissions: FieldPermission[],
  tenantId: string
): Promise<void> {
  await transaction(async (conn) => {
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
      "DELETE FROM sys_field_permission WHERE role_id = ?",
      [roleId]
    );
    for (const fp of fieldPermissions) {
      await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
        `INSERT INTO sys_field_permission (role_id, table_name, field_name, permission_type)
         VALUES (?, ?, ?, ?)`,
        [roleId, fp.tableName, fp.fieldName, fp.permissionType]
      );
    }
  });
}