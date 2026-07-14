import { get, post, put } from '../request'

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

const reportPermissionApi = {
  /** 获取角色列表 */
  async getRoles(): Promise<RoleItem[]> {
    try {
      const res: any = await get('/admin/report-permissions/roles')
      return res?.list ?? res ?? []
    } catch {
      return getMockRoles()
    }
  },

  /** 获取报表列表 */
  async getReports(): Promise<ReportItem[]> {
    try {
      const res: any = await get('/admin/report-permissions/reports')
      return res?.list ?? res ?? []
    } catch {
      return getMockReports()
    }
  },

  /** 获取权限矩阵 */
  async getPermissionMatrix(): Promise<ReportPermission[]> {
    try {
      const res: any = await get('/admin/report-permissions/matrix')
      return res?.list ?? res ?? []
    } catch {
      return getMockPermissionMatrix()
    }
  },

  /** 保存权限矩阵 */
  async savePermissionMatrix(permissions: ReportPermission[]): Promise<any> {
    return put('/admin/report-permissions/matrix', { permissions })
  },

  /** 批量设置权限 */
  async batchSetPermission(params: {
    roleIds: number[]
    reportIds: string[]
    canView?: boolean
    canExport?: boolean
  }): Promise<any> {
    return put('/admin/report-permissions/batch', params)
  },

  /** 获取门店数据权限 */
  async getStoreDataPermission(roleId: number): Promise<StoreDataPermission> {
    try {
      const res: any = await get(`/admin/report-permissions/store-data/${roleId}`)
      return res?.result ?? res
    } catch {
      return getMockStoreDataPermission(roleId)
    }
  },

  /** 保存门店数据权限 */
  async saveStoreDataPermission(data: StoreDataPermission): Promise<any> {
    return put('/admin/report-permissions/store-data', data)
  },

  /** 获取门店列表 */
  async getStores(): Promise<StoreInfo[]> {
    try {
      const res: any = await get('/admin/report-permissions/stores')
      return res?.list ?? res ?? []
    } catch {
      return getMockStores()
    }
  },

  /** 获取用户列表 */
  async getUsers(params?: { keyword?: string; page?: number; pageSize?: number }): Promise<{ list: UserInfo[]; total: number }> {
    try {
      const res: any = await get('/admin/report-permissions/users', params)
      return { list: res?.list ?? [], total: res?.total ?? 0 }
    } catch {
      const mockUsers = getMockUsers()
      return { list: mockUsers, total: mockUsers.length }
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
    try {
      const res: any = await get(`/admin/report-permissions/users/${userId}`)
      return res?.result ?? res
    } catch {
      return getMockUserPermission(userId)
    }
  },

  /** 保存用户权限分配 */
  async saveUserPermission(data: PermissionAssignForm): Promise<any> {
    return put('/admin/report-permissions/users/assign', data)
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
    try {
      const res: any = await get('/admin/report-permissions/audit-logs', params)
      return { list: res?.list ?? [], total: res?.total ?? 0 }
    } catch {
      const logs = getMockAuditLogs()
      return { list: logs, total: logs.length }
    }
  },

  /** 权限审计日志详情 */
  async getAuditLogDetail(id: number): Promise<PermissionAuditLog> {
    try {
      const res: any = await get(`/admin/report-permissions/audit-logs/${id}`)
      return res?.result ?? res
    } catch {
      return getMockAuditLogs().find(l => l.id === id) || ({} as PermissionAuditLog)
    }
  },

  /** 获取操作类型 */
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
    try {
      const res: any = await get('/admin/report-permissions/my')
      return res?.result ?? res
    } catch {
      return getMockMyPermission()
    }
  },
}

/** Mock 角色数据 */
function getMockRoles(): RoleItem[] {
  return [
    { id: 1, name: '总部管理员', code: 'BOSS', remark: '拥有所有权限', status: 1 },
    { id: 2, name: '门店经理', code: 'MGR', remark: '门店管理权限', status: 1 },
    { id: 3, name: '店员', code: 'CASHIER', remark: '基础操作权限', status: 1 },
    { id: 4, name: '财务', code: 'FIN', remark: '财务相关权限', status: 1 },
    { id: 5, name: '业务员', code: 'SALES', remark: '销售业务权限', status: 1 },
    { id: 6, name: '库管', code: 'STOCK', remark: '库存管理权限', status: 1 },
  ]
}

/** Mock 报表数据 */
function getMockReports(): ReportItem[] {
  return [
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
}

/** Mock 权限矩阵数据 */
function getMockPermissionMatrix(): ReportPermission[] {
  const roles = getMockRoles()
  const reports = getMockReports()
  const result: ReportPermission[] = []

  roles.forEach(role => {
    reports.forEach(report => {
      let canView = false
      let canExport = false

      if (role.code === 'BOSS') {
        canView = true
        canExport = true
      } else if (role.code === 'MGR') {
        canView = true
        canExport = ['sales_summary', 'inventory_summary', 'finance_summary'].includes(report.id)
      } else if (role.code === 'FIN') {
        canView = ['finance_summary', 'finance_profit', 'sales_summary', 'purchase_summary'].includes(report.id)
        canExport = ['finance_summary', 'finance_profit'].includes(report.id)
      } else if (role.code === 'STOCK') {
        canView = ['inventory_summary', 'inventory_detail', 'inventory_warning', 'purchase_summary'].includes(report.id)
        canExport = false
      } else if (role.code === 'SALES') {
        canView = ['sales_summary', 'sales_detail', 'customer_summary'].includes(report.id)
        canExport = false
      } else if (role.code === 'CASHIER') {
        canView = ['sales_summary'].includes(report.id)
        canExport = false
      }

      result.push({
        roleId: role.id,
        reportId: report.id,
        canView,
        canExport,
      })
    })
  })

  return result
}

/** Mock 门店数据权限 */
function getMockStoreDataPermission(roleId: number): StoreDataPermission {
  const role = getMockRoles().find(r => r.id === roleId)
  let scope: 'SELF' | 'ALL' | 'SELECTED' = 'SELF'
  let storeIds: number[] = []

  if (role?.code === 'BOSS') {
    scope = 'ALL'
  } else if (role?.code === 'FIN') {
    scope = 'SELECTED'
    storeIds = [1, 2, 3]
  } else if (role?.code === 'MGR') {
    scope = 'SELF'
  } else {
    scope = 'SELF'
  }

  return { roleId, scope, storeIds }
}

/** Mock 门店数据 */
function getMockStores(): StoreInfo[] {
  return [
    { id: 1, name: '总部旗舰店', code: 'HQ001', address: '北京市朝阳区建国路88号' },
    { id: 2, name: '朝阳门店', code: 'CY001', address: '北京市朝阳区朝阳门外大街1号' },
    { id: 3, name: '海淀门店', code: 'HD001', address: '北京市海淀区中关村大街1号' },
    { id: 4, name: '西城门店', code: 'XC001', address: '北京市西城区西单北大街1号' },
    { id: 5, name: '东城门店', code: 'DC001', address: '北京市东城区王府井大街1号' },
    { id: 6, name: '丰台门店', code: 'FT001', address: '北京市丰台区丰台路1号' },
  ]
}

/** Mock 用户数据 */
function getMockUsers(): UserInfo[] {
  return [
    { id: 1, name: '张总', username: 'admin', phone: '13800138001', roleIds: [1], roleNames: '总部管理员', storeId: 1, storeName: '总部旗舰店', status: 1 },
    { id: 2, name: '李经理', username: 'manager1', phone: '13800138002', roleIds: [2], roleNames: '门店经理', storeId: 2, storeName: '朝阳门店', status: 1 },
    { id: 3, name: '王店员', username: 'cashier1', phone: '13800138003', roleIds: [3], roleNames: '店员', storeId: 2, storeName: '朝阳门店', status: 1 },
    { id: 4, name: '赵财务', username: 'finance1', phone: '13800138004', roleIds: [4], roleNames: '财务', storeId: 1, storeName: '总部旗舰店', status: 1 },
    { id: 5, name: '孙业务', username: 'sales1', phone: '13800138005', roleIds: [5], roleNames: '业务员', storeId: 3, storeName: '海淀门店', status: 1 },
    { id: 6, name: '周库管', username: 'stock1', phone: '13800138006', roleIds: [6], roleNames: '库管', storeId: 1, storeName: '总部旗舰店', status: 1 },
  ]
}

/** Mock 用户权限详情 */
function getMockUserPermission(userId: number) {
  const user = getMockUsers().find(u => u.id === userId) || getMockUsers()[0]
  return {
    user,
    roles: getMockRoles().filter(r => user.roleIds?.includes(r.id)),
    extraPermissions: user.roleIds?.includes(1) ? ['report:export:all'] : [],
    dataScope: user.roleIds?.includes(1) ? 'ALL' as const : 'SELF' as const,
    storeIds: user.roleIds?.includes(1) ? [1, 2, 3, 4, 5, 6] : [user.storeId || 1],
  }
}

/** Mock 审计日志数据 */
function getMockAuditLogs(): PermissionAuditLog[] {
  const now = new Date()
  return [
    {
      id: 1,
      operator: '张总',
      operatorId: 1,
      operationType: 'ROLE_PERMISSION_CHANGE',
      operationTypeName: '角色权限变更',
      content: '修改角色「门店经理」的报表权限：新增库存预警报表查看权限',
      targetRole: '门店经理',
      ip: '192.168.1.100',
      createdAt: now.toISOString(),
      detail: '角色ID: 2\n变更前: 销售汇总(查看+导出)、库存汇总(查看)、财务汇总(查看)\n变更后: 销售汇总(查看+导出)、库存汇总(查看)、库存预警(查看)、财务汇总(查看)',
    },
    {
      id: 2,
      operator: '张总',
      operatorId: 1,
      operationType: 'DATA_SCOPE_CHANGE',
      operationTypeName: '数据范围变更',
      content: '修改角色「财务」的数据权限：从仅本店改为指定门店',
      targetRole: '财务',
      ip: '192.168.1.100',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
      detail: '角色ID: 4\n变更前: SELF (仅本店)\n变更后: SELECTED (总部旗舰店、朝阳门店、海淀门店)',
    },
    {
      id: 3,
      operator: '张总',
      operatorId: 1,
      operationType: 'USER_ROLE_ASSIGN',
      operationTypeName: '用户角色分配',
      content: '为用户「王店员」分配角色：店员',
      targetUser: '王店员',
      ip: '192.168.1.100',
      createdAt: new Date(now.getTime() - 7200000).toISOString(),
      detail: '用户ID: 3\n分配角色: 店员(ID:3)',
    },
    {
      id: 4,
      operator: '李经理',
      operatorId: 2,
      operationType: 'USER_PERMISSION_CHANGE',
      operationTypeName: '用户权限变更',
      content: '修改用户「孙业务」的额外权限：新增销售报表导出权限',
      targetUser: '孙业务',
      ip: '192.168.1.101',
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      detail: '用户ID: 5\n额外权限变更: 新增 report:export:sales',
    },
    {
      id: 5,
      operator: '张总',
      operatorId: 1,
      operationType: 'ROLE_CREATE',
      operationTypeName: '角色创建',
      content: '创建新角色「见习店长」',
      targetRole: '见习店长',
      ip: '192.168.1.100',
      createdAt: new Date(now.getTime() - 172800000).toISOString(),
      detail: '角色名称: 见习店长\n角色编码: TRAINEE_MGR\n初始权限: 销售报表查看、库存报表查看',
    },
    {
      id: 6,
      operator: '张总',
      operatorId: 1,
      operationType: 'ROLE_DELETE',
      operationTypeName: '角色删除',
      content: '删除角色「临时员工」',
      targetRole: '临时员工',
      ip: '192.168.1.100',
      createdAt: new Date(now.getTime() - 259200000).toISOString(),
      detail: '角色ID: 7\n角色名称: 临时员工\n删除原因: 岗位调整',
    },
    {
      id: 7,
      operator: '赵财务',
      operatorId: 4,
      operationType: 'ROLE_PERMISSION_CHANGE',
      operationTypeName: '角色权限变更',
      content: '修改角色「财务」的报表权限：新增利润分析报表导出权限',
      targetRole: '财务',
      ip: '192.168.1.102',
      createdAt: new Date(now.getTime() - 345600000).toISOString(),
      detail: '角色ID: 4\n变更内容: 利润分析报表 导出权限 关闭→开启',
    },
  ]
}

/** Mock 我的权限 */
function getMockMyPermission(): MyPermission {
  return {
    roles: [
      { id: 1, name: '总部管理员', code: 'BOSS', status: 1 },
    ],
    reportPermissions: getMockReports().map(r => ({
      reportId: r.id,
      reportName: r.name,
      canView: true,
      canExport: true,
    })),
    dataScope: 'ALL',
    stores: getMockStores(),
  }
}

export { reportPermissionApi }
