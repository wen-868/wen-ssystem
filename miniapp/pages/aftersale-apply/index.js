const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    orderNo: '',
    orderItems: [],
    // 售后类型
    aftersaleType: '',
    typeOptions: [
      { value: 'REFUND_ONLY', label: '仅退款', desc: '未收到货或无需退货' },
      { value: 'RETURN_REFUND', label: '退货退款', desc: '已收到货，需要退回' },
      { value: 'EXCHANGE', label: '换货', desc: '商品有问题，需要更换' },
      { value: 'REPAIR', label: '维修', desc: '商品需要维修处理' }
    ],
    // 原因
    reason: '',
    reasonOptions: ['商品破损', '质量问题', '发错商品', '数量不符', '与描述不符', '不想要了', '其他原因'],
    reasonDetail: '',
    // 图片凭证
    images: [],
    maxImages: 5,
    // 选中的商品
    selectedItems: [],
    // 退款金额
    refundAmount: 0,
    // 提交状态
    submitting: false,
    theme: {},
    themeCssVars: ''
  },

  onReady() {
    injectTheme(this)
  },

  onLoad(options) {
    if (options.orderNo) {
      this.setData({ orderNo: options.orderNo })
      this.loadOrderItems(options.orderNo)
    }
  },

  // ========== 加载订单商品 ==========
  loadOrderItems(orderNo) {
    const app = getApp()
    app.request({
      url: `${app.globalData.apiBase}/miniapp/orders/${orderNo}`,
      method: 'GET',
      success: (res) => {
        const body = res.data || {}
        if (body.code === '0') {
          const items = (body.data.items || []).map(item => ({
            ...item,
            selected: true,
            applyQty: item.qty || item.quantity
          }))
          this.setData({
            orderItems: items,
            selectedItems: items,
            refundAmount: items.reduce((sum, item) => sum + (item.subtotalAmount || item.unitPrice * (item.qty || item.quantity)), 0)
          })
        }
      }
    })
  },

  // ========== 选择售后类型 ==========
  selectType(e) {
    this.setData({ aftersaleType: e.currentTarget.dataset.value })
  },

  // ========== 选择原因 ==========
  selectReason(e) {
    this.setData({ reason: e.currentTarget.dataset.reason })
  },

  // ========== 输入详细说明 ==========
  onDetailInput(e) {
    this.setData({ reasonDetail: e.detail.value })
  },

  // ========== 选择图片 ==========
  chooseImage() {
    const remaining = this.data.maxImages - this.data.images.length
    if (remaining <= 0) {
      wx.showToast({ title: `最多上传${this.data.maxImages}张`, icon: 'none' })
      return
    }
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = this.data.images.concat(res.tempFilePaths)
        this.setData({ images: newImages.slice(0, this.data.maxImages) })
      }
    })
  },

  // ========== 删除图片 ==========
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== index)
    this.setData({ images })
  },

  // ========== 修改申请数量 ==========
  changeApplyQty(e) {
    const skuId = Number(e.currentTarget.dataset.skuId)
    const delta = Number(e.currentTarget.dataset.delta)
    const selectedItems = this.data.selectedItems.map(item => {
      if (item.skuId !== skuId) return item
      const newQty = (item.applyQty || 1) + delta
      if (newQty < 1) return item
      if (newQty > (item.qty || item.quantity)) return item
      return { ...item, applyQty: newQty }
    })
    const refundAmount = selectedItems.reduce((sum, item) => {
      return sum + item.unitPrice * (item.applyQty || 1)
    }, 0)
    this.setData({ selectedItems, refundAmount: Number(refundAmount.toFixed(2)) })
  },

  // ========== 上传图片到服务器 ==========
  uploadImages() {
    const app = getApp()
    const images = this.data.images
    if (!images || images.length === 0) {
      return Promise.resolve([])
    }
    return Promise.all(images.map(tempFilePath => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.apiBase}/miniapp/upload/image`,
          filePath: tempFilePath,
          name: 'file',
          header: {
            'Authorization': 'Bearer ' + (app.globalData.token || wx.getStorageSync('miniapp_token') || '')
          },
          success: (res) => {
            try {
              const data = JSON.parse(res.data)
              if (data.code === '0' && data.data && data.data.url) {
                resolve(data.data.url)
              } else {
                reject(new Error(data.message || '上传失败'))
              }
            } catch (e) {
              reject(new Error('解析上传结果失败'))
            }
          },
          fail: (err) => {
            reject(err)
          }
        })
      })
    }))
  },

  // ========== 提交申请 ==========
  submitApply() {
    const { orderNo, aftersaleType, reason, selectedItems, refundAmount, reasonDetail } = this.data

    if (!orderNo) {
      wx.showToast({ title: '缺少订单信息', icon: 'none' })
      return
    }
    if (!aftersaleType) {
      wx.showToast({ title: '请选择售后类型', icon: 'none' })
      return
    }
    if (!reason) {
      wx.showToast({ title: '请选择申请原因', icon: 'none' })
      return
    }
    if (selectedItems.length === 0) {
      wx.showToast({ title: '请选择售后商品', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    const app = getApp()

    const items = selectedItems.map(item => ({
      skuId: item.skuId,
      skuName: item.skuName,
      qty: item.applyQty || item.qty || item.quantity,
      unitPrice: item.unitPrice,
      subtotal: Number((item.unitPrice * (item.applyQty || item.qty || item.quantity)).toFixed(2))
    }))

    // 先上传图片，再提交售后申请
    this.uploadImages().then((imageUrls) => {
      app.request({
        url: `${app.globalData.apiBase}/miniapp/aftersales/aftersales`,
        method: 'POST',
        data: {
          orderNo,
          aftersaleType,
          reason,
          reasonDetail: reasonDetail || undefined,
          images: imageUrls,
          items,
          refundAmount
        },
        success: (res) => {
          const body = res.data || {}
          if (body.code === '0') {
            wx.showToast({ title: '申请已提交', icon: 'success' })
            setTimeout(() => {
              wx.navigateBack()
            }, 1200)
          } else {
            wx.showToast({ title: body.message || '提交失败', icon: 'none' })
          }
        },
        fail: () => {
          wx.showToast({ title: '网络异常', icon: 'none' })
        },
        complete: () => {
          this.setData({ submitting: false })
        }
      })
    }).catch(() => {
      wx.showToast({ title: '图片上传失败', icon: 'none' })
      this.setData({ submitting: false })
    })
  }
})
