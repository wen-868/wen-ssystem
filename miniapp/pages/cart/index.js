const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    items: [],
    totalAmount: 0,
    totalQty: 0,
    allChecked: true,
    checkedIds: [],
    loading: false,
    errorText: '',
    showEmpty: false,
    editing: false,
    theme: {},
    themeCssVars: ''
  },

  onReady() {
    injectTheme(this)
  },

  onShow() {
    this.loadCart()
  },

  onPullDownRefresh() {
    this.loadCart(() => wx.stopPullDownRefresh())
  },

  // ========== 加载购物车 ==========
  loadCart(done) {
    const app = getApp()
    this.setData({ loading: true, errorText: '' })
    app.request({
      url: `${app.globalData.apiBase}/miniapp/cart/cart`,
      method: 'GET',
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          const items = (body.data.items || []).map(item => ({
            ...item,
            checked: true
          }))
          const checkedIds = items.map(item => item.skuId)
          this.setData({
            items,
            totalAmount: body.data.totalAmount || 0,
            totalQty: body.data.totalQty || 0,
            allChecked: true,
            checkedIds,
            showEmpty: items.length === 0
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

  // ========== 全选/取消全选 ==========
  toggleAll() {
    const allChecked = !this.data.allChecked
    const items = this.data.items.map(item => ({ ...item, checked: allChecked }))
    const checkedIds = allChecked ? items.map(item => item.skuId) : []
    this.setData({ allChecked, items, checkedIds })
    this.calcTotal()
  },

  // ========== 单选 ==========
  toggleCheck(e) {
    const skuId = Number(e.currentTarget.dataset.skuId)
    const items = this.data.items.map(item => {
      if (item.skuId === skuId) return { ...item, checked: !item.checked }
      return item
    })
    const checkedIds = items.filter(item => item.checked).map(item => item.skuId)
    const allChecked = items.length > 0 && checkedIds.length === items.length
    this.setData({ items, checkedIds, allChecked })
    this.calcTotal()
  },

  // ========== 计算选中总价 ==========
  calcTotal() {
    const checkedItems = this.data.items.filter(item => item.checked)
    const totalAmount = checkedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const totalQty = checkedItems.reduce((sum, item) => sum + item.quantity, 0)
    this.setData({
      totalAmount: Number(totalAmount.toFixed(2)),
      totalQty
    })
  },

  // ========== 修改数量 ==========
  changeQty(e) {
    const skuId = Number(e.currentTarget.dataset.skuId)
    const delta = Number(e.currentTarget.dataset.delta)
    const items = this.data.items.map(item => {
      if (item.skuId !== skuId) return item
      const newQty = item.quantity + delta
      if (newQty < 1) return item
      if (newQty > item.availableQty) {
        wx.showToast({ title: '超出可售库存', icon: 'none' })
        return item
      }
      return { ...item, quantity: newQty }
    })
    this.setData({ items })
    this.calcTotal()
    // 异步更新后端
    const target = items.find(i => i.skuId === skuId)
    if (target) this.updateQtyRemote(skuId, target.quantity)
  },

  updateQtyRemote(skuId, quantity) {
    const app = getApp()
    app.request({
      url: `${app.globalData.apiBase}/miniapp/cart/cart/items/${skuId}`,
      method: 'PUT',
      data: { quantity },
      fail: () => {}
    })
  },

  // ========== 删除商品 ==========
  deleteItem(e) {
    const skuId = Number(e.currentTarget.dataset.skuId)
    wx.showModal({
      title: '确认删除',
      content: '确定要从购物车移除该商品吗？',
      success: (res) => {
        if (!res.confirm) return
        const app = getApp()
        app.request({
          url: `${app.globalData.apiBase}/miniapp/cart/cart/items/${skuId}`,
          method: 'DELETE',
          success: () => {
            const items = this.data.items.filter(item => item.skuId !== skuId)
            const checkedIds = items.filter(item => item.checked).map(item => item.skuId)
            const allChecked = items.length > 0 && checkedIds.length === items.length
            this.setData({ items, checkedIds, allChecked, showEmpty: items.length === 0 })
            this.calcTotal()
            wx.showToast({ title: '已删除', icon: 'success' })
          }
        })
      }
    })
  },

  // ========== 清空购物车 ==========
  clearCart() {
    if (this.data.items.length === 0) return
    wx.showModal({
      title: '确认清空',
      content: '确定要清空购物车吗？',
      success: (res) => {
        if (!res.confirm) return
        const app = getApp()
        app.request({
          url: `${app.globalData.apiBase}/miniapp/cart/cart/clear`,
          method: 'POST',
          success: () => {
            this.setData({ items: [], totalAmount: 0, totalQty: 0, checkedIds: [], showEmpty: true })
            wx.showToast({ title: '已清空', icon: 'success' })
          }
        })
      }
    })
  },

  // ========== 去结算 ==========
  goCheckout() {
    const checkedItems = this.data.items.filter(item => item.checked)
    if (checkedItems.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    const skuIds = checkedItems.map(item => item.skuId)
    wx.navigateTo({
      url: `/pages/checkout/index?skuIds=${skuIds.join(',')}`
    })
  },

  // ========== 切换编辑模式 ==========
  toggleEdit() {
    this.setData({ editing: !this.data.editing })
  },

  // ========== 返回首页 ==========
  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
