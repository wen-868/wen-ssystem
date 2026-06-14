Page({
  data: {
    token: "",
    detail: null,
    loading: false,
    errorText: "",
    payDisabled: true
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
