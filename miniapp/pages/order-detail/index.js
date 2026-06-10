Page({
  data: {
    orderNo: "",
    detail: null,
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
    this.setData({ loading: true, errorText: "" });
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/orders/${this.data.orderNo}`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          this.setData({ detail: body.data });
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