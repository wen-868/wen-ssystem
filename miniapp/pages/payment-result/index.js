const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    success: true,
    payNo: "",
    amount: "",
    message: "",
    sourceNo: "",
    theme: {},
    themeCssVars: ""
  },
  onReady() {
    injectTheme(this);
  },
  onLoad(options) {
    const success = options.success !== "0";
    this.setData({
      success,
      payNo: options.payNo || "",
      amount: options.amount || "",
      message: success ? "支付成功，门店将尽快处理您的订单" : (options.message || "支付未完成，请稍后重试"),
      sourceNo: options.sourceNo || ""
    });
  },
  goHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },
  goOrders() {
    wx.switchTab({ url: "/pages/order/index" });
  }
});