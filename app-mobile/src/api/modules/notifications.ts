import { get, post } from '../request'

export interface NotificationItem {
  id: number
  title: string
  content: string
  type: string
  read: boolean
  createdAt: string
}

export interface NotificationListParams {
  page?: number
  pageSize?: number
  unreadOnly?: boolean
}

export interface NotificationListResult {
  list: NotificationItem[]
  total: number
  unreadCount: number
}

const notificationsApi = {
  async list(params?: NotificationListParams): Promise<NotificationListResult> {
    const res: any = await get('/admin/notifications', params)
    return (res?.result ?? res) as NotificationListResult
  },

  async markRead(id: number): Promise<void> {
    return post(`/admin/notifications/${id}/read`)
  },

  async markAllRead(): Promise<void> {
    return post('/admin/notifications/read-all')
  },

  async getUnreadCount(): Promise<number> {
    const res: any = await get('/admin/notifications/unread-count')
    return res?.count ?? 0
  }
}

export { notificationsApi }