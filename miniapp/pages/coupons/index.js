const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    currentTab: 'available',
    availableList: [],
    myList: [],
    availableLoading: false,
    myLoading: false,
    errorText: '',
    myStatus: 'AVAILABLE',
    theme: {},
    themeCssVars: ''
  },
  onReady() {
    injectTheme(this)
  },
  onShow() {
    this.loadAvailable()
    this.loadMine()
  },
  onPullDownRefresh() {
    this.loadAvailable(() => wx.stopPullDownRefresh())
    this.loadMine()
  },

  onReachBottom() {
    // 优惠券列表暂不做分页加载
  },
  switchTab(e) {
    this.setData({ currentTab: e.currentTarget.dataset.tab })
    if (e.currentTarget.dataset.tab === 'mine') {
      this.loadMine()
    }
  },
  switchMyStatus(e) {
    this.setData({ myStatus: e.currentTarget.dataset.status })
    this.loadMine()
  },
  loadAvailable(done) {
    const app = getApp()
    this.setData({ availableLoading: true, errorText: '' })
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/marketing/coupons/available`,
      method: 'GET',
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          this.setData({ availableList: body.data?.records || body.data || [] })
        } else {
          this.setData({ errorText: body.message || '加载失败' })
        }
      },
      fail: () => {
        this.setData({ errorText: '无法连接服务器' })
      },
      complete: () => {
        this.setData({ availableLoading: false })
        if (done) done()
      }
    })
  },
  loadMine() {
    const app = getApp()
    const token = wx.getStorageSync('miniapp_token') || ''
    const userId = this.getUserId()
    if (!userId) {
      this.setData({ myList: [] })
      return
    }
    this.setData({ myLoading: true })
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/marketing/coupons/mine`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      data: { userId: userId, status: this.data.myStatus },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          this.setData({ myList: body.data?.records || [] })
        }
      },
      fail: () => {},
      complete: () => {
        this.setData({ myLoading: false })
      }
    })
  },
  claimCoupon(e) {
    const templateId = e.currentTarget.dataset.id
    const app = getApp()
    const token = wx.getStorageSync('miniapp_token') || ''
    const userId = this.getUserId()
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.showLoading({ title: '领取中...' })
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/marketing/coupons/${templateId}/claim`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      data: { userId: userId },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          wx.showToast({ title: '领取成功', icon: 'success' })
          this.loadAvailable()
          this.loadMine()
        } else {
          wx.showToast({ title: body.message || '领取失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },
  getUserId() {
    const app = getApp()
    // 优先从 globalData 获取，其次尝试从 token 解析
    if (app.globalData.wxUserInfo && app.globalData.wxUserInfo.id) {
      return String(app.globalData.wxUserInfo.id)
    }
    const token = wx.getStorageSync('miniapp_token') || ''
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.sub) return String(payload.sub)
        if (payload.userId) return String(payload.userId)
        if (payload.id) return String(payload.id)
      } catch (e) {
        // 解析失败则忽略
      }
    }
    return wx.getStorageSync('user_id') || ''
  },

  formatCouponValue(coupon) {
    if (coupon.type === 'PERCENT') return coupon.value + '折'
    return '\u00A5' + coupon.value
  },
  formatMinAmount(amount) {
    if (!amount || amount <= 0) return '无门槛'
    return '满' + amount + '元可用'
  },
  couponStatusText(status) {
    const map = { AVAILABLE: '可使用', USED: '已使用', EXPIRED: '已过期', CANCELLED: '已取消' }
    return map[status] || status
  },
  couponStatusClass(status) {
    const map = { AVAILABLE: 'available', USED: 'used', EXPIRED: 'expired', CANCELLED: 'cancelled' }
    return map[status] || ''
  }
})
