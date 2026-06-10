Page({
  data: {
    orders: [],
    loading: false,
    errorText: ""
  },
  onShow() {
    this.loadOrders();
  },
  onPullDownRefresh() {
    this.loadOrders(() => wx.stopPullDownRefresh());
  },
  loadOrders(done) {
    const app = getApp();
    this.setData({ loading: true, errorText: "" });
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/orders`,
      method: "GET",
      data: { page: 1, pageSize: 20 },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          this.setData({ orders: body.data.records || [] });
        } else {
          this.setData({ errorText: body.message || "订单加载失败" });
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
  handleTap() {
    this.loadOrders();
  },
  goDetail(event) {
    const orderNo = event.currentTarget.dataset.orderNo;
    wx.navigateTo({ url: `/pages/order-detail/index?orderNo=${orderNo}` });
  }
});