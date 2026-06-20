const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    skuIds: [],
    items: [],
    goodsAmount: 0,
    discountAmount: 0,
    discountDesc: '',
    shippingFee: 0,
    payableAmount: 0,
    customerType: 'RETAIL',
    // 收货信息
    receiverName: '',
    receiverMobile: '',
    receiverAddress: '',
    // 配送方式
    fulfillmentType: 'DELIVERY',
    // 支付方式
    payMethod: 'WECHAT',
    // 备注
    remark: '',
    // 状态
    loading: false,
    submitting: false,
    errorText: '',
    theme: {},
    themeCssVars: ''
  },

  onReady() {
    injectTheme(this)
  },

  onLoad(options) {
    if (options.skuIds) {
      this.setData({ skuIds: options.skuIds.split(',').map(Number) })
    }
    this.loadPreview()
  },

  // ========== 加载结算预览 ==========
  loadPreview() {
    const app = getApp()
    this.setData({ loading: true, errorText: '' })
    app.request({
      url: `${app.globalData.apiBase}/miniapp/cart/checkout/preview`,
      method: 'POST',
      data: {
        skuIds: this.data.skuIds,
        storeId: app.globalData.storeId || wx.getStorageSync('storeId') || 1
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          const data = body.data || {}
          this.setData({
            items: data.items || [],
            goodsAmount: data.goodsAmount || 0,
            discountAmount: data.discountAmount || 0,
            discountDesc: data.discountDesc || '',
            shippingFee: data.shippingFee || 0,
            payableAmount: data.payableAmount || 0,
            customerType: data.customerType || 'RETAIL'
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
      }
    })
  },

  // ========== 输入事件 ==========
  onNameInput(e) { this.setData({ receiverName: e.detail.value }) },
  onMobileInput(e) { this.setData({ receiverMobile: e.detail.value }) },
  onAddrInput(e) { this.setData({ receiverAddress: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  // ========== 选择配送方式 ==========
  selectFulfillment(e) {
    this.setData({ fulfillmentType: e.currentTarget.dataset.type })
  },

  // ========== 选择支付方式 ==========
  selectPayMethod(e) {
    this.setData({ payMethod: e.currentTarget.dataset.method })
  },

  // ========== 选择地址（微信地址） ==========
  chooseAddress() {
    wx.chooseAddress({
      success: (res) => {
        this.setData({
          receiverName: res.userName,
          receiverMobile: res.telNumber,
          receiverAddress: `${res.provinceName}${res.cityName}${res.countyName}${res.detailInfo}`
        })
      },
      fail: () => {
        // 用户取消选择地址
      }
    })
  },

  // ========== 提交订单 ==========
  submitOrder() {
    const { items, receiverName, receiverMobile, receiverAddress, fulfillmentType, remark, skuIds } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '无结算商品', icon: 'none' })
      return
    }
    if (fulfillmentType === 'DELIVERY' && (!receiverName || !receiverMobile)) {
      wx.showToast({ title: '请填写收货人信息', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const app = getApp()
    app.request({
      url: `${app.globalData.apiBase}/miniapp/cart/checkout/create`,
      method: 'POST',
      data: {
        storeId: app.globalData.storeId || wx.getStorageSync('storeId') || 1,
        fulfillmentType,
        receiverName: receiverName || undefined,
        receiverMobile: receiverMobile || undefined,
        receiverAddress: receiverAddress || undefined,
        remark: remark || undefined,
        skuIds
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          const orderNo = body.data.orderNo
          wx.showToast({ title: '下单成功', icon: 'success' })
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/payment-result/index?orderNo=${orderNo}&amount=${body.data.payableAmount}`
            })
          }, 1000)
        } else {
          wx.showToast({ title: body.message || '下单失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        this.setData({ submitting: false })
      }
    })
  }
})
