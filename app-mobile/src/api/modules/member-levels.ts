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
    // R94-03：原 /admin/member/levels 不存在，改为 /admin/members/levels/config（points.routes.ts）
    const res: any = await get('/admin/members/levels/config', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapLevel),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(id: number): Promise<MemberLevel> {
    // R94-03 核实：后端仅提供 GET /admin/members/levels/config（列表）与 PUT /levels/config/:id，无 GET 详情；
    // 详情改为从列表接口查询后按 id 本地查找（不编造数据）
    const res: any = await get('/admin/members/levels/config')
    const rows: any[] = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    const found = rows.find((r: any) => Number(r.id) === Number(id))
    return mapLevel(found ?? {})
  },

  async create(data: Omit<MemberLevel, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemberLevel> {
    // R94-03：路径同步改为 /admin/members/levels/config
    const res: any = await post('/admin/members/levels/config', data)
    return (res?.result ?? res) as MemberLevel
  },

  async update(id: number, data: Partial<MemberLevel>): Promise<MemberLevel> {
    // R94-03：路径同步改为 /admin/members/levels/config/:id
    const res: any = await put(`/admin/members/levels/config/${id}`, data)
    return (res?.result ?? res) as MemberLevel
  },

  async delete(id: number): Promise<void> {
    // R100-02：删除会员等级真实接口 DELETE /admin/members/levels/config/:id
    return del(`/admin/members/levels/config/${id}`)
  },

  async toggleStatus(id: number, status: string): Promise<void> {
    // R100-02：启停会员等级真实接口 PUT /admin/members/levels/config/:id/status
    return put(`/admin/members/levels/config/${id}/status`, { status })
  }
}

function mapLevel(r: any): MemberLevel {
  const status = normalizeLevelStatus(r.status)
  return {
    id: r.id,
    name: r.name ?? r.levelName ?? '',
    minPoints: Number(r.minPoints ?? r.min_points ?? r.pointsThreshold ?? 0),
    discountRate: Number(r.discountRate ?? r.discount_rate ?? r.discount ?? 0),
    description: r.description ?? r.remark,
    sortOrder: Number(r.sortOrder ?? r.sort_order ?? 0),
    status,
    statusText: status === 'active' ? '启用' : '停用',
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  }
}

function normalizeLevelStatus(status: any): MemberLevel['status'] {
  if (status === undefined || status === null || status === '') return 'active'
  if (status === 0 || status === '0' || status === false) return 'disabled'
  const v = String(status).toUpperCase()
  if (v === 'DISABLED' || v === 'INACTIVE' || v === 'OFF') return 'disabled'
  return 'active'
}

export { memberLevelApi }
