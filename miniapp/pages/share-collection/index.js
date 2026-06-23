const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    token: "",
    detail: {
      storeName: "销售单收款",
      sourceNo: "-",
      amount: 0,
      paidAmount: 0,
      status: "加载中",
      expireAt: "-",
      taxEnabled: false,
      taxRate: "",
      taxAmount: 0,
      items: []
    },
    hasItems: false,
    loading: false,
    errorText: "",
    payDisabled: true,
    theme: {},
    themeCssVars: ""
  },
  onReady() {
    injectTheme(this);
  },
  onShow() {
    injectTheme(this);
  },
  onLoad(options) {
    const token = options.token || "";
    this.setData({ token, errorText: token ? "" : "缺少收款参数" });
    if (token) {
      this.loadDetail(token);
    }
  },
  loadDetail(token) {
    const app = getApp();
    if (app.globalData.demoMode) {
      this.setData({
        detail: {
          storeName: "智享酒业演示门店",
          sourceNo: "SK-DEMO-001",
          amount: 367,
          paidAmount: 0,
          status: "PENDING",
          expireAt: "演示有效期",
          taxEnabled: true,
          taxRate: "13%",
          taxAmount: 42.24,
          items: [
            { skuId: 1, skuName: "示例白酒 53度 500ml", totalBottleQty: 1, subtotalAmount: 199 },
            { skuId: 2, skuName: "商务红酒 750ml", totalBottleQty: 1, subtotalAmount: 168 }
          ]
        },
        hasItems: true,
        errorText: "演示模式：正式域名配置完成后将连接真实收款单",
        payDisabled: false,
        loading: false
      });
      return;
    }
    this.setData({ loading: true });
    wx.request({
      url: `${app.globalData.apiBase}/share/collections/${token}`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          const detail = body.data || {};
          this.setData({
            detail,
            hasItems: detail.items && detail.items.length > 0,
            errorText: "",
            payDisabled: ["PENDING", "PARTIAL"].indexOf(detail.status) === -1
          });
        } else {
          this.setData({ errorText: body.message || "收款单不可用", payDisabled: true });
        }
      },
      fail: () => {
        this.setData({ errorText: "无法连接服务器", payDisabled: true });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },
  handleTap() {
    const app = getApp();
    if (!this.data.token) {
      wx.showToast({ title: "缺少收款参数", icon: "none" });
      return;
    }
    if (app.globalData.demoMode) {
      wx.redirectTo({
        url: "/pages/payment-result/index?success=1&payNo=ZF-DEMO-001&amount=367&sourceNo=SK-DEMO-001"
      });
      return;
    }
    if (this.data.payDisabled) {
      wx.showToast({ title: "当前收款单不可支付", icon: "none" });
      return;
    }
    this.setData({ loading: true });
    wx.request({
      url: `${app.globalData.apiBase}/share/collections/${this.data.token}/pay`,
      method: "POST",
      success: (res) => {
        const body = res.data || {};
        if (body.code !== "0") {
          wx.showToast({ title: body.message || "发起支付失败", icon: "none" });
          return;
        }
        const payResult = body.data || {};
        const detail = this.data.detail || {};
        const amount = detail.amount || payResult.amount || "0";
        wx.redirectTo({
          url: `/pages/payment-result/index?success=1&payNo=${payResult.payNo || ""}&amount=${amount}&sourceNo=${detail.sourceNo || ""}`
        });
      },
      fail: () => {
        wx.redirectTo({
          url: `/pages/payment-result/index?success=0&message=支付接口暂不可用`
        });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  }
});
