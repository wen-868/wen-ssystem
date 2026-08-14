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

/** 社群营销活动类型 → /api/marketing/* 路径段（R100-02） */
const ACTIVITY_TYPE_PATHS: Record<'group_buy' | 'bargain' | 'seckill', string> = {
  group_buy: 'group-buy',
  bargain: 'bargain',
  seckill: 'seckill',
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

  async end(id: number, type: 'group_buy' | 'bargain' | 'seckill' = 'group_buy'): Promise<void> {
    // R100-02：结束活动真实接口为 /api/marketing/{group-buy|bargain|seckill}/:id/end
    // （满减活动仍只有 activate/pause，无 end 能力，不在此处编造）
    await post(`/marketing/${ACTIVITY_TYPE_PATHS[type]}/${id}/end`)
  },

  async participationRecords(params?: {
    page?: number
    pageSize?: number
    activityId?: number
    type?: 'group_buy' | 'bargain' | 'seckill'
  }): Promise<{ list: ParticipationRecord[]; total: number }> {
    // R100-02：参与记录真实接口为 /api/marketing/{group-buy|bargain|seckill}/:id/records（分页）
    const type = params?.type ?? 'group_buy'
    if (!params?.activityId) {
      return { list: [], total: 0 }
    }
    const res: any = await get(`/marketing/${ACTIVITY_TYPE_PATHS[type]}/${params.activityId}/records`, {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    })
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapParticipationRecord),
      total: Number(raw?.total ?? rows.length),
    }
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

function mapParticipationRecord(r: any): ParticipationRecord {
  const status = r.teamStatus ?? r.status ?? ''
  return {
    id: r.id,
    activityId: r.activityId ?? r.activity_id,
    activityName: r.activityName ?? r.activity_name ?? '',
    memberId: r.memberId ?? r.member_id,
    memberName: r.memberName ?? r.member_name ?? '',
    memberMobile: r.memberMobile ?? r.member_mobile ?? '',
    participationTime: r.participationTime ?? r.participation_time ?? r.joinedAt ?? r.createdAt ?? '',
    status,
    statusText: r.statusText ?? statusTextOfRecord(status),
  }
}

function statusTextOfRecord(status: string): string {
  const map: Record<string, string> = {
    PENDING: '成团中',
    COMPLETED: '已成团',
    ONGOING: '进行中',
    SUCCESS: '成功',
    FAILED: '失败',
    EXPIRED: '已过期',
    CANCELLED: '已取消',
  }
  return map[status] ?? status
}

export { activityApi }
