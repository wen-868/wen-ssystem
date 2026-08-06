import { get, post, put, del } from '../request'

/** 角色信息 */
export interface RoleInfo {
  id: number
  name: string
  code: string
  remark?: string
  status?: number
  userCount?: number
  permissions?: string[]
}

/** 角色表单 */
export interface RoleForm {
  id?: number
  name: string
  code: string
  remark?: string
  status?: number
  permissions?: string[]
}

/** 权限节点 */
export interface PermissionNode {
  id: string
  name: string
  type?: string
  children?: PermissionNode[]
}

function mapRole(r: any): RoleInfo {
  return {
    id: r.id,
    name: r.name ?? '',
    code: r.code ?? r.roleCode ?? r.role_code ?? '',
    remark: r.remark ?? r.description,
    status: r.status != null ? Number(r.status) : 1,
    userCount: r.userCount != null ? Number(r.userCount) : undefined,
    permissions: Array.isArray(r.permissions) ? r.permissions : undefined,
  }
}

const rolesApi = {
  /** 角色列表 */
  async list(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{ list: RoleInfo[]; total: number }> {
    // R94-03：原 /admin/roles 不存在，改为 /admin/system/roles（rbac.routes.ts）
    const res: any = await get('/admin/system/roles', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return { list: rows.map(mapRole), total: raw?.total ?? rows.length }
  },

  /** 角色详情（含权限） */
  async detail(id: number): Promise<RoleInfo> {
    const res: any = await get(`/admin/system/roles/${id}`)
    const raw = res?.result ?? res
    return mapRole(raw?.role ?? raw ?? {})
  },

  /** 新建角色 */
  async create(data: RoleForm): Promise<any> {
    return post('/admin/system/roles', data)
  },

  /** 更新角色（含权限配置） */
  async update(id: number, data: RoleForm): Promise<any> {
    return put(`/admin/system/roles/${id}`, data)
  },

  /** 删除角色 */
  async remove(id: number): Promise<any> {
    return del(`/admin/system/roles/${id}`)
  },

  /** 用户角色列表 */
  async userRoles(userId: number): Promise<RoleInfo[]> {
    const res: any = await get(`/admin/system/roles/users/${userId}/roles`)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw ?? (Array.isArray(raw) ? raw : [])
    return rows.map(mapRole)
  },

  /** 设置用户角色 */
  async setUserRoles(userId: number, roleIds: number[]): Promise<any> {
    return put(`/admin/system/roles/users/${userId}/roles`, { roleIds })
  },
}

export { rolesApi }
