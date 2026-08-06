import { get, post, put, del } from '../request'

export interface Activity {
  id: number
  name: string
  type: 'discount' | 'full_reduction' | 'points_mall' | 'limited_discount'
  typeText: string
  status: 'draft' | 'active' | 'ended' | 'paused'
  statusText: string
  startTime: string
  endTime: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface ActivityListParams {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
  status?: string
}

export interface ActivityListResult {
  list: Activity[]
  total: number
  page: number
  pageSize: number
}

export interface ParticipationRecord {
  id: number
  activityId: number
  activityName: string
  memberId: number
  memberName: string
  memberMobile: string
  participationTime: string
  status: string
  statusText?: string
}

const activityApi = {
  async list(params?: ActivityListParams): Promise<ActivityListResult> {
    // R94-03 核实：后端无统一 /admin/marketing/activities 模块；页面原定位为「满减/折扣活动」，
    // 改接真实接口 /admin/marketing/full-reductions（满减活动，admin-marketing-full-reduction.routes.ts）
    const res: any = await get('/admin/marketing/full-reductions', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    const list: Activity[] = rows.map(mapActivity)
    return {
      list,
      total: raw?.total ?? list.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(id: number): Promise<Activity> {
    const res: any = await get(`/admin/marketing/full-reductions/${id}`)
    return mapActivity(res?.result ?? res ?? {})
  },

  async create(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Activity> {
    const res: any = await post('/admin/marketing/full-reductions', data)
    return mapActivity(res?.result ?? res ?? {})
  },

  async update(id: number, data: Partial<Activity>): Promise<Activity> {
    const res: any = await put(`/admin/marketing/full-reductions/${id}`, data)
    return mapActivity(res?.result ?? res ?? {})
  },

  async delete(id: number): Promise<void> {
    return del(`/admin/marketing/full-reductions/${id}`)
  },

  async start(id: number): Promise<void> {
    // R94-03：满减活动启用接口为 POST /admin/marketing/full-reductions/:id/activate
    return post(`/admin/marketing/full-reductions/${id}/activate`)
  },

  async pause(id: number): Promise<void> {
    return post(`/admin/marketing/full-reductions/${id}/pause`)
  },

  async end(id: number): Promise<void> {
    // R94-03 核实：满减活动仅提供 activate/pause，无 end 接口，由页面降级处理
    return Promise.reject(new Error('结束活动功能开发中（R94-03 核实：后端无 end 接口）'))
  },

  async participationRecords(params?: { page?: number; pageSize?: number; activityId?: number }): Promise<{ list: ParticipationRecord[]; total: number }> {
    // R94-03 核实：后端无营销活动参与记录接口，由页面降级为「开发中」占位
    return Promise.reject(new Error('参与记录功能开发中（R94-03 核实：后端无对应接口）'))
  }
}

function mapActivity(r: any): Activity {
  const status = normalizeStatus(r.status ?? '')
  return {
    id: r.id,
    name: r.name ?? '',
    type: 'full_reduction',
    typeText: '满减活动',
    status,
    statusText: statusTextOf(status),
    startTime: r.startTime ?? r.start_time ?? '',
    endTime: r.endTime ?? r.end_time ?? '',
    description: r.description ?? r.remark,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  }
}

function normalizeStatus(s: string): Activity['status'] {
  const v = s.toUpperCase()
  if (v === 'ACTIVE') return 'active'
  if (v === 'PAUSED') return 'paused'
  if (v === 'ENDED' || v === 'FINISHED') return 'ended'
  return 'draft'
}

function statusTextOf(s: Activity['status']): string {
  const map: Record<Activity['status'], string> = {
    draft: '草稿',
    active: '进行中',
    ended: '已结束',
    paused: '已暂停',
  }
  return map[s] ?? s
}

export { activityApi }
