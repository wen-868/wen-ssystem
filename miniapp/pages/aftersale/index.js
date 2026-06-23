const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'processing', label: '处理中' },
      { key: 'completed', label: '已完成' }
    ],
    records: [],
    loading: false,
    errorText: '',
    showEmpty: false,
    page: 1,
    hasMore: true,
    theme: {},
    themeCssVars: ''
  },

  onReady() {
    injectTheme(this)
  },

  onShow() {
    this.setData({ page: 1, records: [], hasMore: true })
    this.loadList()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, records: [], hasMore: true })
    this.loadList(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  // ========== 切换Tab ==========
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab, page: 1, records: [], hasMore: true })
    this.loadList()
  },

  // ========== 加载列表 ==========
  loadList(done) {
    const app = getApp()
    this.setData({ loading: true, errorText: '' })
    const token = wx.getStorageSync('miniapp_token') || ''

    let statusParam = ''
    if (this.data.activeTab === 'processing') {
      statusParam = 'PENDING,APPROVED,RETURNING,RECEIVED,INSPECTING'
    } else if (this.data.activeTab === 'completed') {
      statusParam = 'COMPLETED,CLOSED,CANCELLED,REJECTED,EXPIRED'
    }

    wx.request({
      url: `${app.globalData.apiBase}/miniapp/aftersales/aftersales/mine`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      data: {
        status: statusParam || undefined,
        page: this.data.page,
        pageSize: 20
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          const data = body.data || {}
          const newRecords = (data.records || []).map(item => ({
            ...item,
            statusTagClass: this.getStatusTagClass(item.status),
            timeLabel: this.formatTime(item.createdAt)
          }))
          const records = this.data.page === 1 ? newRecords : this.data.records.concat(newRecords)
          this.setData({
            records,
            hasMore: records.length < data.total,
            showEmpty: records.length === 0
          })
        } else {
          this.setData({ errorText: body.message || '加载失败' })
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

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.loadList()
  },

  // ========== 状态标签样式 ==========
  getStatusTagClass(status) {
    const map = {
      'PENDING': 'tag-pending',
      'APPROVED': 'tag-accept',
      'RETURNING': 'tag-delivery',
      'RECEIVED': 'tag-accept',
      'INSPECTING': 'tag-delivery',
      'COMPLETED': 'tag-done',
      'CANCELLED': 'tag-cancel',
      'REJECTED': 'tag-cancel',
      'EXPIRED': 'tag-cancel',
      'CLOSED': 'tag-cancel'
    }
    return map[status] || 'tag-pending'
  },

  // ========== 格式化时间 ==========
  formatTime(dateStr) {
    if (!dateStr) return ''
    return dateStr.replace('T', ' ').slice(0, 16)
  },

  // ========== 跳转详情 ==========
  goDetail(e) {
    const aftersaleNo = e.currentTarget.dataset.aftersaleNo
    wx.navigateTo({ url: `/pages/aftersale-detail/index?aftersaleNo=${aftersaleNo}` })
  },

  // ========== 跳转申请 ==========
  goApply() {
    wx.navigateTo({ url: '/pages/aftersale-apply/index' })
  }
})
