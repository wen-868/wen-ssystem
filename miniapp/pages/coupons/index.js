/**
 * 优惠券页（旧 miniapp·微信原生客户端）。
 *
 * S3-187 D 定性 = **仍在用**：Taro 新端由 `miniapp/config/index.js`(sourceRoot:src) 构建，
 * 本目录（pages/*.js）由 `scripts/check-miniapp-release.mjs`（npm run test:miniapp-release）断言、
 * 并由 `deploy/deploy-production.sh` 的「部署小程序源码」步骤发布 ⇒ 不能按"已弃用"删除。
 *
 * S3-196（总清单第 52＋58 项）已收口上一版登记的载体缺口：
 *   · 后端 `/api/miniapp/**` 改用 `requireConsumerAuthWithTenant`：接受**微信令牌**并解析出绑定的
 *     消费者（会员）身份注入 `req.user`（roles 恒空），租户取「令牌 → X-Tenant-Id」；
 *   · 客户端调用点一律走 `app.request()` 统一封装（自动带 Authorization + x-csrf-token）；
 *   · **身份一律由登录态决定**，客户端不再声明 `userId`（声明了反而会与登录态不一致被 403）。
 */
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
    app.request({
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
    // S3-196：登录态判定只看令牌是否存在；身份由服务端按令牌解析（会员绑定）
    if (!app.isLoggedIn()) {
      this.setData({ myList: [] })
      return
    }
    this.setData({ myLoading: true })
    app.request({
      // S3-187 D：路径对齐后端（后端只有 /coupons/my，没有 /coupons/mine）——
      // 旧写法对 /api/miniapp/marketing/* 恒 404，属"看起来能用、实际打不通"的入口。
      url: `${app.globalData.apiBase}/miniapp/marketing/coupons/my`,
      method: 'GET',
      header: { 'Content-Type': 'application/json' },
      data: { status: this.data.myStatus },
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
    if (!app.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.showLoading({ title: '领取中...' })
    app.request({
      url: `${app.globalData.apiBase}/miniapp/marketing/coupons/${templateId}/claim`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {},
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
