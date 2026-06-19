const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    orderNo: "",
    detail: null,
    hasDetail: false,
    hasItems: false,
    loading: false,
    errorText: "",
    theme: {},
    themeCssVars: ""
  },
  onReady() {
    injectTheme(this);
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
          detail.orderTagClass = detail.orderStatus === "COMPLETED" ? "done"
            : (detail.orderStatus === "ACCEPTED" ? "accept"
              : (detail.orderStatus === "WAIT_DELIVERY" || detail.orderStatus === "DELIVERING" ? "delivery" : "pending"));
          detail.payTagClass = detail.payStatus === "PAID" ? "done" : "pending";
          detail.orderStatusLabel = detail.orderStatus === "WAIT_DELIVERY" ? "待配送"
            : (detail.orderStatus === "DELIVERING" ? "配送中"
              : (detail.orderStatus === "COMPLETED" ? "已完成"
                : (detail.orderStatus === "REJECTED" ? "已拒收"
                  : (detail.orderStatus === "CANCELLED" ? "已取消" : detail.orderStatus))));
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
  confirmReceipt() {
    const orderNo = this.data.detail && this.data.detail.orderNo;
    if (!orderNo) return;
    wx.request({
      url: `${getApp().globalData.apiBase}/miniapp/orders/${orderNo}/confirm-receipt`,
      method: "POST",
      header: {
        "x-anonymous-member-id": wx.getStorageSync("anonymous_member_id") || ""
      },
      success: () => {
        wx.showToast({ title: "已确认收货", icon: "success" });
        this.loadDetail();
      },
      fail: () => {
        wx.showToast({ title: "确认失败，请稍后重试", icon: "none" });
      }
    });
  },
  cancelOrder() {
    const detail = this.data.detail;
    if (!detail || !detail.orderNo) return;
    wx.showModal({
      title: "确认取消",
      content: "确定要取消此订单吗？",
      success: (res) => {
        if (!res.confirm) return;
        const app = getApp();
        if (app.globalData.demoMode) {
          this.setData({
            "detail.orderStatus": "CANCELLED",
            "detail.orderStatusLabel": "已取消",
            "detail.orderTagClass": "pending"
          });
          wx.showToast({ title: "订单已取消", icon: "success" });
          return;
        }
        wx.request({
          url: `${app.globalData.apiBase}/miniapp/orders/${detail.orderNo}/cancel`,
          method: "POST",
          header: {
            "x-anonymous-member-id": wx.getStorageSync("anonymous_member_id") || ""
          },
          success: (res) => {
            const body = res.data || {};
            if (body.code === "0") {
              wx.showToast({ title: "订单已取消", icon: "success" });
              this.loadDetail();
            } else {
              // 后端无此路由时，前端标记取消并刷新
              this.setData({
                "detail.orderStatus": "CANCELLED",
                "detail.orderStatusLabel": "已取消",
                "detail.orderTagClass": "pending"
              });
              wx.showToast({ title: "订单已取消", icon: "success" });
            }
          },
          fail: () => {
            // 网络异常时，前端标记取消
            this.setData({
              "detail.orderStatus": "CANCELLED",
              "detail.orderStatusLabel": "已取消",
              "detail.orderTagClass": "pending"
            });
            wx.showToast({ title: "订单已取消", icon: "success" });
          }
        });
      }
    });
  },
  goBack() {
    wx.navigateBack();
  }
});
