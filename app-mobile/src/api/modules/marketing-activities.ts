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
    const res: any = await get('/admin/marketing/activities', params)
    return (res?.result ?? res) as ActivityListResult
  },

  async detail(id: number): Promise<Activity> {
    const res: any = await get(`/admin/marketing/activities/${id}`)
    return (res?.result ?? res) as Activity
  },

  async create(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Activity> {
    const res: any = await post('/admin/marketing/activities', data)
    return (res?.result ?? res) as Activity
  },

  async update(id: number, data: Partial<Activity>): Promise<Activity> {
    const res: any = await put(`/admin/marketing/activities/${id}`, data)
    return (res?.result ?? res) as Activity
  },

  async delete(id: number): Promise<void> {
    return del(`/admin/marketing/activities/${id}`)
  },

  async start(id: number): Promise<void> {
    return post(`/admin/marketing/activities/${id}/start`)
  },

  async pause(id: number): Promise<void> {
    return post(`/admin/marketing/activities/${id}/pause`)
  },

  async end(id: number): Promise<void> {
    return post(`/admin/marketing/activities/${id}/end`)
  },

  async participationRecords(params?: { page?: number; pageSize?: number; activityId?: number }): Promise<{ list: ParticipationRecord[]; total: number }> {
    const res: any = await get('/admin/marketing/activities/participation-records', params)
    return (res?.result ?? res) as { list: ParticipationRecord[]; total: number }
  }
}

export { activityApi }