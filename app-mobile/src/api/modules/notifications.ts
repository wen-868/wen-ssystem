import { get, post, del } from '../request'

/**
 * 消息类型枚举
 */
export type NotificationType = 'system' | 'order' | 'inventory' | 'marketing'

/**
 * 消息项接口
 */
export interface NotificationItem {
  id: number
  title: string
  content: string
  summary: string
  type: NotificationType
  read: boolean
  createdAt: string
  readAt?: string
  linkUrl?: string
  linkText?: string
}

/**
 * 消息列表查询参数
 */
export interface NotificationListParams {
  page?: number
  pageSize?: number
  type?: NotificationType | 'all'
  unreadOnly?: boolean
}

/**
 * 消息列表返回结果
 */
export interface NotificationListResult {
  list: NotificationItem[]
  total: number
  page: number
  pageSize: number
  unreadCount: number
  unreadByType: Record<NotificationType, number>
}

/**
 * 各分类未读数
 */
export interface UnreadCountResult {
  total: number
  system: number
  order: number
  inventory: number
  marketing: number
}

const notificationsApi = {
  /**
   * 获取消息列表
   */
  async list(params?: NotificationListParams): Promise<NotificationListResult> {
    const res: any = await get('/admin/notifications', params)
    return (res?.result ?? res) as NotificationListResult
  },

  /**
   * 获取消息详情
   */
  async detail(id: number): Promise<NotificationItem> {
    const res: any = await get(`/admin/notifications/${id}`)
    return (res?.result ?? res) as NotificationItem
  },

  /**
   * 标记单条消息已读
   */
  async markRead(id: number): Promise<void> {
    return post(`/admin/notifications/${id}/read`)
  },

  /**
   * 按分类标记全部已读
   */
  async markReadByType(type: NotificationType | 'all'): Promise<void> {
    return post('/admin/notifications/read-all', { type })
  },

  /**
   * 全部标记已读
   */
  async markAllRead(): Promise<void> {
    return post('/admin/notifications/read-all', { type: 'all' })
  },

  /**
   * 删除单条消息
   */
  async delete(id: number): Promise<void> {
    return del(`/admin/notifications/${id}`)
  },

  /**
   * 批量删除消息
   */
  async batchDelete(ids: number[]): Promise<void> {
    return post('/admin/notifications/batch-delete', { ids })
  },

  /**
   * 获取未读消息总数
   */
  async getUnreadCount(): Promise<UnreadCountResult> {
    const res: any = await get('/admin/notifications/unread-count')
    return (res?.result ?? res) as UnreadCountResult
  }
}

export { notificationsApi }
