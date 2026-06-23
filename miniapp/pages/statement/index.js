const { injectTheme } = require('../../utils/theme')
const app = getApp()

Page({
  data: {
    activeTab: 'orders',
    totalPurchase: '0.00',
    totalPaid: '0.00',
    owingAmount: '0.00',
    orderList: [],
    paymentList: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loading: false,
    errorText: '',
    showEmpty: false,
    theme: {},
    themeCssVars: ''
  },

  onReady() {
    injectTheme(this)
  },

  onLoad() {
    this.loadStatementData()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: false, errorText: '', showEmpty: false })
    this.loadStatementData()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 })
      this.loadStatementData(true)
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  loadStatementData(append = false) {
    this.setData({ loading: true, errorText: '' })
    const token = wx.getStorageSync('miniapp_token') || ''
    const anonymousId = wx.getStorageSync('anonymous_member_id') || ''
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/statements`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'x-anonymous-member-id': anonymousId,
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      data: { page: this.data.page, pageSize: this.data.pageSize },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0' && body.data) {
          const data = body.data
          const total = Number(data.total) || 0
          const newOrders = data.orderList || []
          const newPayments = data.paymentList || []
          const loadedCount = append
            ? this.data.orderList.length + newOrders.length
            : newOrders.length

          if (append) {
            this.setData({
              orderList: this.data.orderList.concat(newOrders),
              paymentList: this.data.paymentList.concat(newPayments),
              total: total,
              hasMore: loadedCount < total,
              showEmpty: false
            })
          } else {
            this.setData({
              totalPurchase: data.totalPurchase || '0.00',
              totalPaid: data.totalPaid || '0.00',
              owingAmount: data.owingAmount || '0.00',
              orderList: newOrders,
              paymentList: newPayments,
              total: total,
              hasMore: loadedCount < total,
              showEmpty: newOrders.length === 0 && newPayments.length === 0
            })
          }
        } else {
          this.setData({ errorText: body.message || '加载对账数据失败' })
        }
      },
      fail: () => {
        this.setData({ errorText: '网络异常，加载对账数据失败' })
      },
      complete: () => {
        this.setData({ loading: false })
        wx.stopPullDownRefresh()
      }
    })
  }
})
