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
    submitting: false
  },
  onLoad() {
    this.loadProducts();
  },
  onPullDownRefresh() {
    this.loadProducts(() => wx.stopPullDownRefresh());
  },
  loadProducts(done) {
    const app = getApp();
    this.setData({ loading: true, errorText: "" });
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/products`,
      method: "GET",
      data: { storeId: 1 },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          const products = (body.data || []).map((p) => Object.assign({}, p, { _qty: 1 }));
          this.setData({ products });
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
      return Object.assign({}, p, { _qty: newQty });
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
  clearCart() {
    this.setData({ cartItems: [], cartTotal: 0 });
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
    const items = cartItems.map((c) => ({ skuId: c.skuId, qty: c.qty }));
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/orders`,
      method: "POST",
      data: {
        storeId: 1,
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
