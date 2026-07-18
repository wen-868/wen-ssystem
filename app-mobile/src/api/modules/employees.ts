import { get, post, put } from '../request'

export interface Employee {
  id: number
  name: string
  phone: string
  roleName?: string
  storeName?: string
  hireDate?: string
  status: 'active' | 'inactive'
}

export interface EmployeeListParams {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

const employeeApi = {
  async getEmployees(params?: EmployeeListParams): Promise<{ records: Employee[]; total: number }> {
    const res: any = await get('/admin/staff/list', params)
    return {
      records: res?.records || [],
      total: res?.total || 0
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
    await put(`/admin/staff/${id}/status`, { status })
  }
}

export { employeeApi }
