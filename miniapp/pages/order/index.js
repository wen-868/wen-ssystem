Page({
  data: {
    orders: [],
    loading: false,
    errorText: "",
    showEmpty: false
  },
  onShow() {
    this.loadOrders();
  },
  onPullDownRefresh() {
    this.loadOrders(() => wx.stopPullDownRefresh());
  },
  loadOrders(done) {
    const app = getApp();
    if (app.globalData.demoMode) {
      this.setData({
        orders: [
          {
            orderNo: "DD-DEMO-001",
            orderStatus: "PENDING_PAYMENT",
            payStatus: "UNPAID",
            fulfillmentType: "DELIVERY",
            payableAmount: 367,
            createdAt: "演示订单",
            orderTagClass: "pending",
            payTagClass: "pending",
            fulfillmentLabel: "配送"
          },
          {
            orderNo: "DD-DEMO-002",
            orderStatus: "COMPLETED",
            payStatus: "PAID",
            fulfillmentType: "PICKUP",
            payableAmount: 199,
            createdAt: "演示订单",
            orderTagClass: "done",
            payTagClass: "done",
            fulfillmentLabel: "自提"
          }
        ],
        loading: false,
        errorText: "演示模式：服务器域名配置完成后将自动连接真实订单",
        showEmpty: false
      });
      if (done) done();
      return;
    }
    this.setData({ loading: true, errorText: "" });
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/orders`,
      method: "GET",
      data: { page: 1, pageSize: 20 },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          const orders = (body.data.records || []).map((item) => Object.assign({}, item, {
            orderTagClass: item.orderStatus === "COMPLETED" ? "done" : (item.orderStatus === "ACCEPTED" ? "accept" : "pending"),
            payTagClass: item.payStatus === "PAID" ? "done" : "pending",
            fulfillmentLabel: item.fulfillmentType === "PICKUP" ? "自提" : "配送"
          }));
          this.setData({ orders, showEmpty: orders.length === 0 });
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
