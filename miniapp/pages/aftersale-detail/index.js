const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    aftersaleNo: '',
    detail: null,
    hasDetail: false,
    loading: false,
    errorText: '',
    theme: {},
    themeCssVars: ''
  },

  onReady() {
    injectTheme(this)
  },

  onLoad(options) {
    if (options.aftersaleNo) {
      this.setData({ aftersaleNo: options.aftersaleNo })
      this.loadDetail()
    } else if (options.orderId) {
      this.setData({ aftersaleNo: options.orderId })
      this.loadDetail()
    }
  },

  onPullDownRefresh() {
    this.loadDetail(() => wx.stopPullDownRefresh())
  },

  loadDetail(done) {
    const app = getApp()
    this.setData({ loading: true, errorText: '' })

    const token = wx.getStorageSync('miniapp_token') || ''
    const anonymousId = wx.getStorageSync('anonymous_member_id') || ''

    wx.request({
      url: `${app.globalData.apiBase}/miniapp/aftersales/${this.data.aftersaleNo}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'x-anonymous-member-id': anonymousId,
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0' && body.data) {
          const d = body.data
          // 格式化状态
          d.statusText = this.formatStatusText(d.status)
          d.statusClass = this.formatStatusClass(d.status)
          d.typeLabel = this.formatTypeText(d.aftersaleType)
          d.createdAtFormatted = this.formatTime(d.createdAt)
          d.updatedAtFormatted = this.formatTime(d.updatedAt)
          d.refundAmountFormatted = d.refundAmount ? '¥' + Number(d.refundAmount).toFixed(2) : ''
          // 处理图片
          if (d.images && typeof d.images === 'string') {
            try { d.imageList = JSON.parse(d.images) } catch { d.imageList = [] }
          } else {
            d.imageList = d.images || []
          }
          // 处理时间线
          d.timeline = this.formatTimeline(d.timeline || d.logs || [])
          this.setData({ detail: d, hasDetail: true })
        } else {
          this.setData({ errorText: body.message || '加载售后详情失败' })
        }
      },
      fail: () => {
        this.setData({ errorText: '无法连接服务器' })
      },
      complete: () => {
        this.setData({ loading: false })
        if (done) done()
      }
    })
  },

  formatStatusText(status) {
    const map = {
      'PENDING': '待处理',
      'PROCESSING': '处理中',
      'APPROVED': '已同意',
      'REJECTED': '已拒绝',
      'COMPLETED': '已完成',
      'CANCELLED': '已取消'
    }
    return map[status] || status || '未知'
  },

  formatStatusClass(status) {
    const map = {
      'PENDING': 'warning',
      'PROCESSING': 'info',
      'APPROVED': 'success',
      'REJECTED': 'danger',
      'COMPLETED': 'success',
      'CANCELLED': 'default'
    }
    return map[status] || 'default'
  },

  formatTypeText(type) {
    const map = {
      'REFUND': '退款退货',
      'EXCHANGE': '换货',
      'REFUND_ONLY': '仅退款',
      'REPAIR': '维修'
    }
    return map[type] || type || '售后'
  },

  formatTime(dateStr) {
    if (!dateStr) return ''
    return dateStr.replace('T', ' ').slice(0, 16)
  },

  formatTimeline(timeline) {
    if (!Array.isArray(timeline)) return []
    return timeline.map((item, index) => ({
      event: item.event || item.action || item.status || '未知',
      time: item.time || item.createdAt || item.created_at || '',
      remark: item.remark || item.note || '',
      dotType: index === 0 ? 'primary' : (index === timeline.length - 1 ? 'success' : 'default')
    }))
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.detail.imageList || []
    wx.previewImage({ current: url, urls })
  },

  goBack() {
    wx.navigateBack()
  }
})
