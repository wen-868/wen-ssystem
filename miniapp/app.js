App({
  globalData: {
    apiBase: "https://api.onepan.cn/api",
    demoMode: false
  },
  onLaunch() {
    const anonymousId = wx.getStorageSync("anonymous_member_id");
    if (!anonymousId) {
      wx.setStorageSync("anonymous_member_id", `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`);
    }
  }
});
