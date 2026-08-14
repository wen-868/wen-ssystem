import { get, post, put } from '../request'

export interface Employee {
  id: number
  name: string
  phone: string
  roleName?: string
  storeName?: string
  hireDate?: string
  status: 'active' | 'inactive'
  statusLabel?: string
}

export interface EmployeeListParams {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

const employeeApi = {
  async getEmployees(params?: EmployeeListParams): Promise<{ records: Employee[]; total: number }> {
    // R94-03：原 /admin/staff/list 不存在，改为 /admin/staff（admin-staff.routes.ts）
    const res: any = await get('/admin/staff', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      records: rows.map((r: any) => ({
        id: r.id ?? r.staffId,
        name: r.realName ?? r.name ?? '',
        phone: r.phone ?? r.mobile ?? '',
        roleName: r.roleName ?? r.role_name,
        storeName: r.storeName ?? r.store_name,
        hireDate: r.hireDate ?? r.hire_date,
        status: r.status === 0 || r.status === 'INACTIVE' ? 'inactive' : 'active',
      })),
      total: raw?.total ?? rows.length
    }
  },

  async addEmployee(data: { name: string; phone: string; roleId?: number; storeId?: number }): Promise<Employee> {
    const res: any = await post('/admin/staff', data)
    return res
  },

  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee> {
    const res: any = await put(`/admin/staff/${id}`, data)
    return res
  },

  async toggleStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
    // 禁用走 PUT /admin/staff/:id/disable；启用走 POST /admin/staff/:id/restore
    if (status === 'inactive') {
      await put(`/admin/staff/${id}/disable`, { status })
    } else {
      await post(`/admin/staff/${id}/restore`)
    }
  }
}

export { employeeApi }
