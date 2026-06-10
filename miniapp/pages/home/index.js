Page({
  data: {
    products: [],
    loading: false,
    errorText: ""
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
          this.setData({ products: body.data || [] });
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
  handleBuy(event) {
    const skuId = Number(event.currentTarget.dataset.skuId);
    const app = getApp();
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/orders`,
      method: "POST",
      data: {
        storeId: 1,
        fulfillmentType: "PICKUP",
        receiverName: "小程序客户",
        receiverMobile: "13900000001",
        items: [{ skuId, qty: 1 }]
      },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          wx.showToast({ title: "下单成功", icon: "success" });
          wx.switchTab({ url: "/pages/order/index" });
        } else {
          wx.showToast({ title: body.message || "下单失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "下单接口不可用", icon: "none" });
      }
    });
  }
});
