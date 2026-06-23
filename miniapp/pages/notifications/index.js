const { injectTheme } = require('../../utils/theme')
const app = getApp()

Page({
  data: {
    activeTab: 'all',
    notifications: [],
    unreadCount: 0,
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadNotifications()
    this.loadUnreadCount()
  },

  onReady() {
    injectTheme(this)
  },

  onShow() {
    this.loadUnreadCount()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, notifications: [], hasMore: true })
    this.loadNotifications().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab, page: 1, notifications: [], hasMore: true })
    this.loadNotifications()
  },

  loadNotifications() {
    if (this.data.loading) return Promise.resolve()
    this.setData({ loading: true })

    return new Promise((resolve) => {
      const token = wx.getStorageSync('miniapp_token') || ''
      const { page, pageSize, activeTab } = this.data
      const isRead = activeTab === 'unread' ? '0' : ''

      wx.request({
        url: `${app.globalData.apiBase}/miniapp/notifications`,
        method: 'GET',
        header: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        data: { page, pageSize, isRead },
        success: (res) => {
          const body = res.data || {}
          if (body.code === '0' && body.data) {
            const records = body.data.records || []
            const total = body.data.total || 0
            const typeMap = { SYSTEM: '系统', ORDER: '订单', PAYMENT: '支付', ALERT: '预警', CREDIT: '授信', RECALL: '召回' }
            const items = records.map(item => ({
              ...item,
              typeText: typeMap[item.type] || item.type || '系统',
              sentAt: (item.sentAt || '').replace('T', ' ').slice(0, 16)
            }))

            const allNotifications = page === 1 ? items : this.data.notifications.concat(items)
            this.setData({
              notifications: allNotifications,
              hasMore: allNotifications.length < total,
              loading: false
            })
          } else {
            this.setData({ loading: false })
          }
        },
        fail: () => {
          this.setData({ loading: false })
        },
        complete: () => {
          resolve()
        }
      })
    })
  },

  loadUnreadCount() {
    const token = wx.getStorageSync('miniapp_token') || ''
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/notifications/unread-count`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0' && body.data) {
          this.setData({ unreadCount: body.data.count || 0 })
        }
      }
    })
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.loadNotifications()
  },

  handleItemClick(e) {
    const item = e.currentTarget.dataset.item
    if (!item.isRead) {
      this.markRead(item)
    }
  },

  markRead(item) {
    const token = wx.getStorageSync('miniapp_token') || ''
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/notifications/${item.id}/read`,
      method: 'PUT',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      success: () => {
        const notifications = this.data.notifications.map(n => {
          if (n.id === item.id) return { ...n, isRead: 1 }
          return n
        })
        const unreadCount = Math.max(0, this.data.unreadCount - 1)
        this.setData({ notifications, unreadCount })
      }
    })
  }
})
