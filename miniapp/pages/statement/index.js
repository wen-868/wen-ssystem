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
    hasMore: true
  },

  onLoad() {
    this.loadStatementData()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadStatementData()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 })
      this.loadStatementData(true)
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  loadStatementData(append = false) {
    // 模拟对账数据
    const orders = [
      { id: 1, orderNo: 'XS-2026-0619-001', items: '飞天茅台x2, 五粮液x3', amount: '12,800.00', date: '2026-06-19', statusText: '已收款' },
      { id: 2, orderNo: 'XS-2026-0618-002', items: '青岛啤酒x10, 百威x5', amount: '1,560.00', date: '2026-06-18', statusText: '已收款' },
      { id: 3, orderNo: 'XS-2026-0615-003', items: '张裕干红x4, 长城干红x2', amount: '3,200.00', date: '2026-06-15', statusText: '部分收款' },
      { id: 4, orderNo: 'XS-2026-0612-004', items: '剑南春x6, 泸州老窖x4', amount: '8,500.00', date: '2026-06-12', statusText: '未收款' },
      { id: 5, orderNo: 'XS-2026-0610-005', items: '洋河蓝色经典x3', amount: '4,200.00', date: '2026-06-10', statusText: '已收款' },
      { id: 6, orderNo: 'XS-2026-0608-006', items: '飞天茅台x1, 郎酒x2', amount: '6,800.00', date: '2026-06-08', statusText: '已收款' },
      { id: 7, orderNo: 'XS-2026-0605-007', items: '青岛啤酒x20', amount: '960.00', date: '2026-06-05', statusText: '已收款' },
      { id: 8, orderNo: 'XS-2026-0601-008', items: '五粮液x2, 剑南春x2', amount: '5,600.00', date: '2026-06-01', statusText: '已收款' }
    ]

    const payments = [
      { id: 1, paymentNo: 'HK-2026-0619-001', method: '银行转账', amount: '12,800.00', date: '2026-06-19', statusText: '已确认' },
      { id: 2, paymentNo: 'HK-2026-0618-002', method: '微信支付', amount: '1,560.00', date: '2026-06-18', statusText: '已确认' },
      { id: 3, paymentNo: 'HK-2026-0616-003', method: '现金', amount: '2,000.00', date: '2026-06-16', statusText: '已确认' },
      { id: 4, paymentNo: 'HK-2026-0611-004', method: '银行转账', amount: '4,200.00', date: '2026-06-11', statusText: '已确认' },
      { id: 5, paymentNo: 'HK-2026-0609-005', method: '微信支付', amount: '6,800.00', date: '2026-06-09', statusText: '已确认' },
      { id: 6, paymentNo: 'HK-2026-0606-006', method: '现金', amount: '960.00', date: '2026-06-06', statusText: '已确认' },
      { id: 7, paymentNo: 'HK-2026-0602-007', method: '银行转账', amount: '5,600.00', date: '2026-06-02', statusText: '已确认' }
    ]

    this.setData({
      totalPurchase: '43,620.00',
      totalPaid: '33,920.00',
      owingAmount: '9,700.00',
      orderList: orders,
      paymentList: payments,
      hasMore: false
    })
  }
})
