Page({
  data: {
    orderNo: "",
    detail: null,
    hasDetail: false,
    hasItems: false,
    loading: false,
    errorText: ""
  },
  onLoad(options) {
    if (options.orderNo) {
      this.setData({ orderNo: options.orderNo });
      this.loadDetail();
    }
  },
  onPullDownRefresh() {
    this.loadDetail(() => wx.stopPullDownRefresh());
  },
  loadDetail(done) {
    const app = getApp();
    if (app.globalData.demoMode) {
      this.setData({
        detail: {
          orderNo: this.data.orderNo || "DD-DEMO-001",
          orderStatus: "PENDING_PAYMENT",
          payStatus: "UNPAID",
          payableAmount: 367,
          orderTagClass: "pending",
          payTagClass: "pending",
          receiverName: "内测用户",
          receiverMobile: "13800000000",
          receiverAddress: "演示地址",
          createdAt: "演示订单",
          items: [
            { skuId: 1, skuName: "示例白酒 53度 500ml", qty: 1, unitPrice: 199, subtotalAmount: 199, displayAmount: 199 },
            { skuId: 2, skuName: "商务红酒 750ml", qty: 1, unitPrice: 168, subtotalAmount: 168, displayAmount: 168 }
          ]
        },
        hasDetail: true,
        hasItems: true,
        loading: false,
        errorText: ""
      });
      if (done) done();
      return;
    }
    this.setData({ loading: true, errorText: "" });
    const anonymousId = wx.getStorageSync("anonymous_member_id") || "";
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/orders/${this.data.orderNo}`,
      method: "GET",
      header: {
        "x-anonymous-member-id": anonymousId
      },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          const detail = body.data || {};
          const items = (detail.items || []).map((item) => Object.assign({}, item, {
            displayAmount: item.subtotalAmount || (item.unitPrice * item.qty)
          }));
          detail.items = items;
          detail.orderTagClass = detail.orderStatus === "COMPLETED" ? "done" : (detail.orderStatus === "ACCEPTED" ? "accept" : "pending");
          detail.payTagClass = detail.payStatus === "PAID" ? "done" : "pending";
          this.setData({ detail, hasDetail: true, hasItems: items.length > 0 });
        } else {
          this.setData({ errorText: body.message || "加载失败" });
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
  goBack() {
    wx.navigateBack();
  }
});
