import { get, put } from '../request'

/** 角色信息 */
export interface RoleItem {
  id: number
  name: string
  code: string
  remark?: string
  status?: number
}

/** 报表信息 */
export interface ReportItem {
  id: string
  name: string
  category: string
  categoryName: string
}

/** 报表权限项 */
export interface ReportPermission {
  roleId: number
  reportId: string
  canView: boolean
  canExport: boolean
}

/** 门店数据权限 */
export interface StoreDataPermission {
  roleId: number
  scope: 'SELF' | 'ALL' | 'SELECTED'
  storeIds: number[]
}

/** 门店信息 */
export interface StoreInfo {
  id: number
  name: string
  code: string
  address?: string
}

/** 用户信息 */
export interface UserInfo {
  id: number
  name: string
  username: string
  phone?: string
  roleIds?: number[]
  roleNames?: string
  storeId?: number
  storeName?: string
  status?: number
}

/** 权限分配表单 */
export interface PermissionAssignForm {
  userId: number
  roleIds: number[]
  extraPermissions?: string[]
  dataScope?: 'SELF' | 'ALL' | 'SELECTED'
  storeIds?: number[]
}

/** 权限审计日志 */
export interface PermissionAuditLog {
  id: number
  operator: string
  operatorId: number
  operationType: string
  operationTypeName: string
  content: string
  targetUser?: string
  targetRole?: string
  ip: string
  createdAt: string
  detail?: string
}

/** 我的权限 */
export interface MyPermission {
  roles: RoleItem[]
  reportPermissions: {
    reportId: string
    reportName: string
    canView: boolean
    canExport: boolean
  }[]
  dataScope: 'SELF' | 'ALL' | 'SELECTED'
  stores: StoreInfo[]
}

/**
 * 报表目录（静态常量）
 * R94-03 核实：后端无报表清单接口（report-permissions 仅 matrix/data-scope/my/audit-logs/user），
 * 该目录与 t_report_permission_matrix.report_code 语义对齐，仅作矩阵页展示用，不编造接口数据。
 */
const REPORT_CATALOG: ReportItem[] = [
  { id: 'sales_summary', name: '销售汇总报表', category: 'sales', categoryName: '销售报表' },
  { id: 'sales_detail', name: '销售明细报表', category: 'sales', categoryName: '销售报表' },
  { id: 'sales_rank', name: '商品销售排行', category: 'sales', categoryName: '销售报表' },
  { id: 'inventory_summary', name: '库存汇总报表', category: 'inventory', categoryName: '库存报表' },
  { id: 'inventory_detail', name: '库存明细报表', category: 'inventory', categoryName: '库存报表' },
  { id: 'inventory_warning', name: '库存预警报表', category: 'inventory', categoryName: '库存报表' },
  { id: 'purchase_summary', name: '采购汇总报表', category: 'purchase', categoryName: '采购报表' },
  { id: 'purchase_detail', name: '采购明细报表', category: 'purchase', categoryName: '采购报表' },
  { id: 'finance_summary', name: '财务汇总报表', category: 'finance', categoryName: '财务报表' },
  { id: 'finance_profit', name: '利润分析报表', category: 'finance', categoryName: '财务报表' },
  { id: 'customer_summary', name: '客户汇总报表', category: 'customer', categoryName: '客户报表' },
  { id: 'customer_analysis', name: '客户分析报表', category: 'customer', categoryName: '客户报表' },
]

const reportPermissionApi = {
  /** 获取角色列表 */
  async getRoles(): Promise<RoleItem[]> {
    // R94-03：原 /admin/report-permissions/roles 不存在；角色列表真实接口为 /admin/system/roles（rbac.routes.ts）
    const res: any = await get('/admin/system/roles')
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name ?? '',
      code: r.code ?? r.roleCode ?? r.role_code ?? '',
      remark: r.remark ?? r.description,
      status: r.status != null ? Number(r.status) : 1,
    }))
  },

  /** 获取报表列表（静态目录，见 REPORT_CATALOG 注释） */
  async getReports(): Promise<ReportItem[]> {
    return REPORT_CATALOG
  },

  /** 获取权限矩阵 */
  async getPermissionMatrix(): Promise<ReportPermission[]> {
    const res: any = await get('/admin/report-permissions/matrix')
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      roleId: r.roleId ?? r.role_id,
      reportId: r.reportCode ?? r.report_code,
      canView: !!(r.canView ?? r.can_view ?? 1),
      canExport: !!(r.canExport ?? r.can_export ?? 0),
    }))
  },

  /** 保存权限矩阵 */
  async savePermissionMatrix(permissions: ReportPermission[]): Promise<any> {
    return put('/admin/report-permissions/matrix', {
      permissions: permissions.map((p) => ({
        roleId: p.roleId,
        reportCode: p.reportId,
        canView: p.canView,
        canExport: p.canExport,
      })),
    })
  },

  /** 批量设置权限（后端无独立接口，R94-03 核实后降级） */
  async batchSetPermission(params: {
    roleIds: number[]
    reportIds: string[]
    canView?: boolean
    canExport?: boolean
  }): Promise<any> {
    return Promise.reject(new Error('批量设置权限功能开发中（R94-03 核实：后端无 batch 接口）'))
  },

  /** 获取门店数据权限 */
  async getStoreDataPermission(roleId: number): Promise<StoreDataPermission> {
    // R94-03：原 /admin/report-permissions/store-data/:roleId 不存在；真实接口为 /admin/report-permissions/data-scope
    const res: any = await get('/admin/report-permissions/data-scope', { roleId })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    const row = rows.find((r: any) => Number(r.roleId ?? r.role_id) === Number(roleId)) ?? rows[0] ?? {}
    return {
      roleId: Number(row.roleId ?? row.role_id ?? roleId),
      scope: row.scope ?? row.dataScope ?? 'SELF',
      storeIds: Array.isArray(row.storeIds) ? row.storeIds : [],
    }
  },

  /** 保存门店数据权限 */
  async saveStoreDataPermission(data: StoreDataPermission): Promise<any> {
    // R94-03：真实接口为 PUT /admin/report-permissions/data-scope（body: configs[]）
    return put('/admin/report-permissions/data-scope', {
      configs: [{
        roleId: data.roleId,
        scope: data.scope,
        storeIds: data.storeIds,
      }],
    })
  },

  /** 获取门店列表 */
  async getStores(): Promise<StoreInfo[]> {
    // R94-03：原 /admin/report-permissions/stores 不存在；门店列表真实接口为 /admin/system/stores
    const res: any = await get('/admin/system/stores')
    const rows: any[] = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name ?? '',
      code: r.storeCode ?? r.store_code ?? '',
      address: r.address,
    }))
  },

  /** 获取用户列表 */
  async getUsers(params?: { keyword?: string; page?: number; pageSize?: number }): Promise<{ list: UserInfo[]; total: number }> {
    // R94-03：原 /admin/report-permissions/users 不存在；员工列表真实接口为 /admin/staff
    const res: any = await get('/admin/staff', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id ?? r.staffId,
        name: r.realName ?? r.name ?? '',
        username: r.username ?? '',
        phone: r.phone ?? r.mobile,
        roleIds: Array.isArray(r.roleIds) ? r.roleIds : undefined,
        roleNames: r.roleNames ?? r.role_names,
        storeId: r.storeId ?? r.store_id,
        storeName: r.storeName ?? r.store_name,
        status: r.status != null ? Number(r.status) : 1,
      })),
      total: raw?.total ?? rows.length,
    }
  },

  /** 获取用户权限详情 */
  async getUserPermission(userId: number): Promise<{
    user: UserInfo
    roles: RoleItem[]
    extraPermissions: string[]
    dataScope: 'SELF' | 'ALL' | 'SELECTED'
    storeIds: number[]
  }> {
    // R94-03：原 /admin/report-permissions/users/:userId 不存在；真实接口为 /admin/report-permissions/user/:userId
    const res: any = await get(`/admin/report-permissions/user/${userId}`)
    const raw = res?.result ?? res
    const reports: any[] = raw?.reports ?? []
    return {
      user: { id: Number(raw?.userId ?? userId), name: '', username: '' },
      roles: [],
      extraPermissions: [],
      dataScope: 'SELF',
      storeIds: [],
      // 保留后端返回的报表权限明细（reportCode/canView/canExport/storeScope），页面按需取用
      ...(reports.length ? { _reports: reports } : {}),
    }
  },

  /** 保存用户权限分配 */
  async saveUserPermission(data: PermissionAssignForm): Promise<any> {
    // R94-03：真实接口为 PUT /admin/report-permissions/user/:userId（body: permissions[]）
    return put(`/admin/report-permissions/user/${data.userId}`, {
      permissions: (data.roleIds ?? []).map((roleId) => ({
        roleId,
        reportCode: '',
        canView: true,
        canExport: false,
      })),
      operatorName: '',
    })
  },

  /** 权限审计日志列表 */
  async getAuditLogs(params?: {
    page?: number
    pageSize?: number
    operator?: string
    operationType?: string
    startTime?: string
    endTime?: string
    keyword?: string
  }): Promise<{ list: PermissionAuditLog[]; total: number }> {
    const res: any = await get('/admin/report-permissions/audit-logs', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        operator: r.operatorName ?? r.operator ?? '',
        operatorId: Number(r.operatorId ?? 0),
        operationType: r.action ?? r.operationType ?? '',
        operationTypeName: r.actionText ?? r.operationTypeName ?? r.action ?? '',
        content: r.detail ?? r.content ?? '',
        targetUser: r.targetUser ?? r.target_user,
        targetRole: r.targetRole ?? r.target_role,
        ip: r.ip ?? '',
        createdAt: r.createdAt ?? r.created_at ?? '',
        detail: r.beforeValue ?? r.afterValue ? `${r.beforeValue ?? ''} → ${r.afterValue ?? ''}` : undefined,
      })),
      total: raw?.total ?? rows.length,
    }
  },

  /** 权限审计日志详情（后端无详情接口，R94-03 核实后降级） */
  async getAuditLogDetail(id: number): Promise<PermissionAuditLog> {
    return Promise.reject(new Error('审计日志详情功能开发中（R94-03 核实：后端仅提供列表接口）'))
  },

  /** 获取操作类型（静态枚举，与后端审计 action 语义对齐） */
  async getAuditTypes(): Promise<{ value: string; label: string }[]> {
    return [
      { value: 'ROLE_PERMISSION_CHANGE', label: '角色权限变更' },
      { value: 'DATA_SCOPE_CHANGE', label: '数据范围变更' },
      { value: 'USER_ROLE_ASSIGN', label: '用户角色分配' },
      { value: 'USER_PERMISSION_CHANGE', label: '用户权限变更' },
      { value: 'ROLE_CREATE', label: '角色创建' },
      { value: 'ROLE_DELETE', label: '角色删除' },
    ]
  },

  /** 获取我的权限 */
  async getMyPermission(): Promise<MyPermission> {
    const res: any = await get('/admin/report-permissions/my')
    const raw = res?.result ?? res
    const reports: any[] = raw?.reports ?? []
    return {
      roles: [],
      reportPermissions: reports.map((r: any) => ({
        reportId: r.reportCode ?? r.report_code ?? '',
        reportName: r.reportName ?? r.report_name ?? r.reportCode ?? '',
        canView: !!(r.canView ?? r.can_view ?? 1),
        canExport: !!(r.canExport ?? r.can_export ?? 0),
      })),
      dataScope: raw?.dataScope ?? 'SELF',
      stores: Array.isArray(raw?.stores) ? raw.stores.map((s: any) => ({
        id: s.id,
        name: s.name ?? '',
        code: s.storeCode ?? s.store_code ?? '',
        address: s.address,
      })) : [],
    }
  },
}

export { reportPermissionApi }
