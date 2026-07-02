const { injectTheme } = require('../../utils/theme')
const { getSyncManager, EVENT_TYPES } = require('../../utils/sync')

Page({
  data: {
    products: [],
    loading: false,
    errorText: "",
    cartItems: [],
    cartTotal: 0,
    receiverName: "",
    receiverMobile: "",
    receiverAddress: "",
    submitting: false,
    showEmpty: false,
    keyword: "",
    theme: {},
    themeCssVars: "",
    // 页面配置（从平台配置注入）
    pageConfig: {
      homeMode: 'standard',
      showSearch: true,
      showCart: true,
      showPrice: true,
      showWholesalePrice: false,
      showStock: true,
      showCategory: true,
      orderButtonText: '加入下单'
    },
    // 同步状态
    syncStatus: 'disconnected',
    syncStatusText: '未连接'
  },

  _syncManager: null,
  _syncHandlers: {},

  onLoad() {
    this._initPageConfig()
    this.loadProducts()
  },

  onReady() {
    injectTheme(this)
  },

  onShow() {
    this.loadProducts()
    this.loadCartCount()
    injectTheme(this)
    this._startSync()
  },

  onHide() {
    this._stopSync()
  },

  onUnload() {
    this._stopSync()
  },
  onPullDownRefresh() {
    this.loadProducts(() => wx.stopPullDownRefresh());
  },
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },
  onSearch() {
    this.loadProducts();
  },
  loadProducts(done) {
    const app = getApp();
    if (app.globalData.demoMode) {
      this.setData({
        products: [
          {
            skuId: 1,
            name: "示例白酒",
            skuName: "53度 500ml",
            price: 199,
            availableQty: 24,
            priceType: "零售价",
            _qty: 1,
            displayQty: 1
          },
          {
            skuId: 2,
            name: "商务红酒",
            skuName: "750ml 单瓶",
            price: 168,
            availableQty: 12,
            priceType: "会员价",
            _qty: 1,
            displayQty: 1
          }
        ],
        loading: false,
        errorText: "演示模式：服务器域名配置完成后将自动连接真实数据",
        showEmpty: false
      });
      if (done) done();
      return;
    }
    this.setData({ loading: true, errorText: "" });
    const anonymousId = wx.getStorageSync("anonymous_member_id") || "";
    app.request({
      url: `${app.globalData.apiBase}/miniapp/products`,
      method: "GET",
      header: {
        "x-anonymous-member-id": anonymousId
      },
      data: { storeId: app.globalData.storeId || wx.getStorageSync('storeId') || 1, keyword: this.data.keyword },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          const products = (body.data || []).map((p) => Object.assign({}, p, { _qty: 1, displayQty: 1 }));
          this.setData({ products, showEmpty: products.length === 0 });
        } else {
          this.setData({ errorText: body.message || "商品加载失败" });
        }
      },
      fail: () => {
        this.setData({ errorText: "无法连接服务器" });
      },
      complete: () => {
        this.setData({ loading: false });
        if (done) done();
      }
    });
  },
  changeQty(event) {
    const skuId = Number(event.currentTarget.dataset.skuId);
    const delta = Number(event.currentTarget.dataset.delta);
    const products = this.data.products.map((p) => {
      if (p.skuId !== skuId) return p;
      const newQty = (p._qty || 1) + delta;
      if (newQty < 1 || newQty > p.availableQty) return p;
      return Object.assign({}, p, { _qty: newQty, displayQty: newQty });
    });
    this.setData({ products });
  },
  handleBuy(event) {
    const skuId = Number(event.currentTarget.dataset.skuId);
    const product = this.data.products.filter((p) => p.skuId === skuId)[0];
    if (!product) return;
    const qty = product._qty || 1;
    const subtotal = Number((product.price * qty).toFixed(2));
    const cartItems = this.data.cartItems.filter((c) => c.skuId !== skuId);
    cartItems.push({ skuId, name: product.skuName || product.name, qty, price: product.price, subtotal });
    this.updateCart(cartItems);
    wx.showToast({ title: "已加入清单", icon: "success", duration: 1000 });
  },
  updateCart(items) {
    const cartTotal = items.reduce((sum, c) => sum + c.subtotal, 0);
    this.setData({ cartItems: items, cartTotal: Number(cartTotal.toFixed(2)) });
  },
  // ========== 加入购物车（后端） ==========
  addToCart(event) {
    const skuId = Number(event.currentTarget.dataset.skuId);
    const product = this.data.products.filter((p) => p.skuId === skuId)[0];
    if (!product) return;
    const qty = product._qty || 1;
    const app = getApp();
    app.request({
      url: `${app.globalData.apiBase}/miniapp/cart/cart/add`,
      method: "POST",
      data: { skuId, quantity: qty },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          wx.showToast({ title: "已加入购物车", icon: "success", duration: 1000 });
          this.loadCartCount();
        } else {
          wx.showToast({ title: body.message || "加入失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
      }
    });
  },
  // ========== 加载购物车数量 ==========
  loadCartCount() {
    const app = getApp();
    app.request({
      url: `${app.globalData.apiBase}/miniapp/cart/cart/count`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0" && body.data) {
          wx.setTabBarBadge({ index: 1, text: String(body.data.count || 0) });
        }
      },
      fail: () => {}
    });
  },
  clearCart() {
    this.setData({ cartItems: [], cartTotal: 0 });
  },

  // ========== 页面配置初始化 ==========

  _initPageConfig() {
    try {
      const app = getApp()
      const platformConfig = app.globalData.platformConfig
      if (platformConfig && platformConfig.pageConfig) {
        this.setData({ pageConfig: platformConfig.pageConfig })
      }
    } catch (e) {
      // 使用默认配置
    }
  },

  // ========== 实时同步 ==========

  _startSync() {
    try {
      const app = getApp()
      const syncConfig = app.globalData.platformConfig.sync
      if (!syncConfig || !syncConfig.enabled) return

      this._syncManager = getSyncManager()

      // 保存 handler 引用，供 off() 时使用
      this._syncHandlers = {
        onProductsUpdated: (data) => {
          console.log('[Sync] 商品更新:', data)
          this.loadProducts()
        },
        onPriceChanged: (data) => {
          console.log('[Sync] 价格变更:', data)
          this.loadProducts()
        },
        onStockUpdated: (data) => {
          console.log('[Sync] 库存更新:', data)
          this.loadProducts()
        },
        onConnectionStatus: (status) => {
          const statusMap = {
            'connected': '已连接',
            'connecting': '连接中',
            'disconnected': '未连接',
            'reconnecting': '重连中',
            'degraded': '轮询模式'
          }
          this.setData({
            syncStatus: status.status,
            syncStatusText: statusMap[status.status] || status.status
          })
        }
      }

      this._syncManager.on(EVENT_TYPES.PRODUCTS_UPDATED, this._syncHandlers.onProductsUpdated)
      this._syncManager.on(EVENT_TYPES.PRICE_CHANGED, this._syncHandlers.onPriceChanged)
      this._syncManager.on(EVENT_TYPES.STOCK_UPDATED, this._syncHandlers.onStockUpdated)
      this._syncManager.on(EVENT_TYPES.CONNECTION_STATUS, this._syncHandlers.onConnectionStatus)

      this._syncManager.start()
    } catch (e) {
      console.error('[Sync] 启动失败:', e)
    }
  },

  _stopSync() {
    if (this._syncManager && this._syncHandlers) {
      this._syncManager.off(EVENT_TYPES.PRODUCTS_UPDATED, this._syncHandlers.onProductsUpdated)
      this._syncManager.off(EVENT_TYPES.PRICE_CHANGED, this._syncHandlers.onPriceChanged)
      this._syncManager.off(EVENT_TYPES.STOCK_UPDATED, this._syncHandlers.onStockUpdated)
      this._syncManager.off(EVENT_TYPES.CONNECTION_STATUS, this._syncHandlers.onConnectionStatus)
      this._syncHandlers = {}
      this._syncManager = null
    }
  },
  onNameInput(e) { this.setData({ receiverName: e.detail.value }); },
  onMobileInput(e) { this.setData({ receiverMobile: e.detail.value }); },
  onAddrInput(e) { this.setData({ receiverAddress: e.detail.value }); },
  submitCart() {
    const { cartItems, receiverName, receiverMobile, receiverAddress } = this.data;
    if (cartItems.length === 0) {
      wx.showToast({ title: "请先选择商品", icon: "none" });
      return;
    }
    if (!receiverName || !receiverMobile) {
      wx.showToast({ title: "请填写收货人姓名和联系电话", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    const app = getApp();
    if (app.globalData.demoMode) {
      wx.showToast({ title: "演示下单成功", icon: "success" });
      this.setData({ cartItems: [], cartTotal: 0, receiverName: "", receiverMobile: "", receiverAddress: "", submitting: false });
      setTimeout(() => wx.switchTab({ url: "/pages/order/index" }), 800);
      return;
    }
    const items = cartItems.map((c) => ({ skuId: c.skuId, qty: c.qty }));
    const anonymousId = wx.getStorageSync("anonymous_member_id") || "";
    app.request({
      url: `${app.globalData.apiBase}/miniapp/orders`,
      method: "POST",
      header: {
        "x-anonymous-member-id": anonymousId
      },
      data: {
        storeId: app.globalData.storeId || wx.getStorageSync('storeId') || 1,
        fulfillmentType: "DELIVERY",
        receiverName,
        receiverMobile,
        receiverAddress,
        items
      },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          wx.showToast({ title: "下单成功", icon: "success" });
          this.setData({ cartItems: [], cartTotal: 0, receiverName: "", receiverMobile: "", receiverAddress: "" });
          setTimeout(() => wx.switchTab({ url: "/pages/order/index" }), 1200);
        } else {
          wx.showToast({ title: body.message || "下单失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "下单接口不可用", icon: "none" });
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  }
});
