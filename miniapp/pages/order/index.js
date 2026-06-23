const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    orders: [],
    loading: false,
    errorText: "",
    showEmpty: false,
    theme: {},
    themeCssVars: ""
  },
  onReady() {
    injectTheme(this);
  },
  onShow() {
    this.loadOrders();
  },
  onPullDownRefresh() {
    this.loadOrders(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadOrders();
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
    const anonymousId = wx.getStorageSync("anonymous_member_id") || "";
    const token = wx.getStorageSync("miniapp_token") || "";
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/orders`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        "x-anonymous-member-id": anonymousId,
        ...(token ? { "Authorization": "Bearer " + token } : {})
      },
      data: { page: 1, pageSize: 20 },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          const orders = (body.data.records || []).map((item) => Object.assign({}, item, {
            orderTagClass: item.orderStatus === "COMPLETED" ? "done"
              : (item.orderStatus === "ACCEPTED" ? "accept"
                : (item.orderStatus === "WAIT_DELIVERY" || item.orderStatus === "DELIVERING" ? "delivery" : "pending")),
            payTagClass: item.payStatus === "PAID" ? "done" : "pending",
            fulfillmentLabel: item.fulfillmentType === "PICKUP" ? "自提" : "配送",
            orderStatusLabel: item.orderStatus === "WAIT_DELIVERY" ? "待配送"
              : (item.orderStatus === "DELIVERING" ? "配送中"
                : (item.orderStatus === "COMPLETED" ? "已完成"
                  : (item.orderStatus === "REJECTED" ? "已拒收"
                    : (item.orderStatus === "CANCELLED" ? "已取消" : item.orderStatus))))
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
