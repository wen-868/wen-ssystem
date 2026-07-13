import { get, post, put, del } from '../request'

export interface MemberLevel {
  id: number
  name: string
  minPoints: number
  discountRate: number
  description?: string
  sortOrder: number
  status: 'active' | 'disabled'
  statusText?: string
  createdAt?: string
  updatedAt?: string
}

export interface MemberLevelListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface MemberLevelListResult {
  list: MemberLevel[]
  total: number
  page: number
  pageSize: number
}

const memberLevelApi = {
  async list(params?: MemberLevelListParams): Promise<MemberLevelListResult> {
    const res: any = await get('/admin/member/levels', params)
    return (res?.result ?? res) as MemberLevelListResult
  },

  async detail(id: number): Promise<MemberLevel> {
    const res: any = await get(`/admin/member/levels/${id}`)
    return (res?.result ?? res) as MemberLevel
  },

  async create(data: Omit<MemberLevel, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemberLevel> {
    const res: any = await post('/admin/member/levels', data)
    return (res?.result ?? res) as MemberLevel
  },

  async update(id: number, data: Partial<MemberLevel>): Promise<MemberLevel> {
    const res: any = await put(`/admin/member/levels/${id}`, data)
    return (res?.result ?? res) as MemberLevel
  },

  async delete(id: number): Promise<void> {
    return del(`/admin/member/levels/${id}`)
  },

  async toggleStatus(id: number, status: string): Promise<void> {
    return post(`/admin/member/levels/${id}/status`, { status })
  }
}

export { memberLevelApi }