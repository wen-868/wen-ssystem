import { get, post, put, del } from '../request'

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
  unreadByType?: Record<NotificationType, number>
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

/**
 * 后端通知类型 → 前端分类
 * 后端枚举：SYSTEM/ORDER/PAYMENT/ALERT/CREDIT/RECALL
 */
function normalizeType(type: string): NotificationType {
  const map: Record<string, NotificationType> = {
    SYSTEM: 'system',
    ORDER: 'order',
    PAYMENT: 'order',
    ALERT: 'inventory',
    MARKETING: 'marketing',
    CREDIT: 'system',
    RECALL: 'system',
  }
  return map[type] || 'system'
}

/** 前端分类 → 后端类型（无对应后端类型时返回 undefined，表示不按类型过滤） */
function toBackendType(type: NotificationType): string | undefined {
  const map: Record<string, string> = {
    system: 'SYSTEM',
    order: 'ORDER',
    inventory: 'ALERT',
  }
  return map[type]
}

/** 后端通知行 → 前端消息项 */
function normalizeItem(row: any): NotificationItem {
  return {
    id: Number(row.id),
    title: row.title ?? '',
    content: row.content ?? '',
    summary: row.summary ?? '',
    type: normalizeType(row.type),
    read: Number(row.isRead ?? row.is_read ?? 0) === 1,
    createdAt: row.sentAt ?? row.sent_at ?? row.createdAt ?? row.created_at ?? '',
    readAt: row.readAt ?? row.read_at ?? undefined,
  }
}

const notificationsApi = {
  /**
   * 获取消息列表
   */
  async list(params?: NotificationListParams): Promise<NotificationListResult> {
    const query: Record<string, any> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    }
    // 前端分类 → 后端类型；无对应后端类型（如 marketing）时不传 type，由后端返回全量
    if (params?.type && params.type !== 'all') {
      const backendType = toBackendType(params.type as NotificationType)
      if (backendType) query.type = backendType
    }
    const res: any = await get('/admin/notifications', query)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(normalizeItem),
      total: Number(raw?.total ?? rows.length),
      page: Number(raw?.page ?? query.page),
      pageSize: Number(raw?.pageSize ?? query.pageSize),
      unreadCount: Number(raw?.unreadCount ?? 0),
    }
  },

  /**
   * 获取消息详情
   * GET /admin/notifications/:id
   */
  async detail(id: number): Promise<NotificationItem> {
    const res: any = await get(`/admin/notifications/${id}`)
    const raw = res?.result ?? res
    return normalizeItem(raw)
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
   * DELETE /admin/notifications/:id
   */
  async delete(id: number): Promise<void> {
    await del(`/admin/notifications/${id}`)
  },

  /**
   * 批量删除消息
   * POST /admin/notifications/batch-delete
   */
  async batchDelete(ids: number[]): Promise<void> {
    await post('/admin/notifications/batch-delete', { ids })
  },

  /**
   * 获取未读消息总数
   */
  async getUnreadCount(): Promise<UnreadCountResult> {
    const res: any = await get('/admin/notifications/unread-count')
    const raw = res?.result ?? res
    const count = Number(raw?.count ?? raw?.total ?? 0)
    // 后端仅提供总数，前端分类未读数默认 0（不编造分类数据）
    return {
      total: count,
      system: 0,
      order: 0,
      inventory: 0,
      marketing: 0,
    }
  }
}

export { notificationsApi }
