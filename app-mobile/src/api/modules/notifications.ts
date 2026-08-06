import { get, post, put } from '../request'

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
   * R94-03 核实：后端无单条消息详情接口（notification.routes.ts 仅列表/未读数/已读），
   * 详情页改用列表项数据渲染（列表已含 content），此处保留占位并拒绝请求，禁止编造数据
   */
  async detail(id: number): Promise<NotificationItem> {
    return Promise.reject(new Error('消息详情功能开发中（R94-03 核实：后端无单条详情接口，请从列表进入）'))
  },

  /**
   * 标记单条消息已读
   */
  async markRead(id: number): Promise<void> {
    // R94-03：后端已读接口为 PUT /admin/notifications/:id/read（notification.routes.ts），原 POST 方法不匹配
    return put(`/admin/notifications/${id}/read`)
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
   * R94-03 核实：后端无删除接口（仅列表/未读数/已读），由页面降级为「开发中」提示
   */
  async delete(id: number): Promise<void> {
    return Promise.reject(new Error('删除消息功能开发中（R94-03 核实：后端无删除接口）'))
  },

  /**
   * 批量删除消息
   * R94-03 核实：后端无批量删除接口（notification.routes.ts 无 batch-delete），由页面降级为「开发中」提示
   */
  async batchDelete(ids: number[]): Promise<void> {
    return Promise.reject(new Error('批量删除消息功能开发中（R94-03 核实：后端无批量删除接口）'))
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
