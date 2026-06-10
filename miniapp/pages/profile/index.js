Page({
  data: {
    profile: {
      nickname: "未登录",
      customerType: "RETAIL",
      customerLabel: "零售",
      mobile: "",
      memberLevel: "普通会员",
      points: 0
    },
    loading: false,
    errorText: ""
  },
  onShow() {
    this.refreshProfile();
  },
  refreshProfile(done) {
    const app = getApp();
    this.setData({ loading: true, errorText: "" });
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/profile`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0" && body.data) {
          const data = body.data;
          this.setData({
            profile: {
              nickname: data.nickname || "微信用户",
              customerType: data.customerType || "RETAIL",
              customerLabel:
                data.customerType === "WHOLESALE"
                  ? "批发客户"
                  : data.customerType === "VIP"
                  ? "VIP客户"
                  : "零售客户",
              mobile: data.mobile || "",
              memberLevel: data.memberLevel || "普通会员",
              points: Number(data.points || 0)
            }
          });
        } else {
          this.setData({ errorText: body.message || "" });
        }
      },
      fail: () => {
        this.setData({ errorText: "无法连接服务器，已使用本地缓存信息" });
      },
      complete: () => {
        this.setData({ loading: false });
        if (done) done();
      }
    });
  },
  handleLogin() {
    wx.login({
      success: (loginRes) => {
        const app = getApp();
        wx.request({
          url: `${app.globalData.apiBase}/miniapp/auth/login`,
          method: "POST",
          data: { code: loginRes.code },
          success: (res) => {
            const body = res.data || {};
            if (body.code === "0" && body.data) {
              wx.setStorageSync("miniapp_token", body.data.token || "");
              wx.showToast({ title: "已登录", icon: "success" });
              this.refreshProfile();
            } else {
              wx.showToast({ title: body.message || "登录失败", icon: "none" });
            }
          },
          fail: () => {
            wx.showToast({ title: "登录接口不可用", icon: "none" });
          }
        });
      }
    });
  },
  handleTap() {
    this.refreshProfile();
  }
});
