const theme = require('./config/theme')

App({
  globalData: {
    apiBase: "https://api.onepan.cn/api",
    demoMode: false,
    theme: theme,
    token: "",       // 微信登录token
    csrfToken: "",   // S3-187 E：wechat 写端点自本次起校验 x-csrf-token，登录响应下发
    wxUserInfo: null // 微信用户信息
  },

  onLaunch() {
    const anonymousId = wx.getStorageSync("anonymous_member_id");
    if (!anonymousId) {
      wx.setStorageSync("anonymous_member_id", `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`);
    }
    // 静默登录
    this.silentLogin();
  },

  /** 静默登录：在 onLaunch 中自动调用 wx.login 获取 token */
  silentLogin() {
    const savedToken = wx.getStorageSync("miniapp_token") || "";
    if (savedToken) {
      this.globalData.token = savedToken;
      // 已有token，直接获取用户信息
      this.fetchWxProfile();
      return;
    }
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) return;
        // S3-196：登录本身是「令牌的来源」，此刻还没有 token/csrfToken 可带，
        // 故保持裸 wx.request（统一封装的默认头对它是空集）；登录成功后由 app.request() 统一携带。
        wx.request({
          url: `${this.globalData.apiBase}/miniapp/wechat/auth/login`,
          method: "POST",
          header: { "Content-Type": "application/json" },
          data: { code: loginRes.code },
          success: (res) => {
            const body = res.data || {};
            if (body.code === "0" && body.data && body.data.token) {
              const token = body.data.token;
              this.globalData.token = token;
              wx.setStorageSync("miniapp_token", token);
              // S3-187 E：CSRF 令牌随登录态一起保存（客户端无法自行计算 HMAC，只能由后端下发）
              if (body.data.csrfToken) {
                this.globalData.csrfToken = body.data.csrfToken;
                wx.setStorageSync("miniapp_csrf_token", body.data.csrfToken);
              }
              if (body.data.userInfo) {
                this.globalData.wxUserInfo = body.data.userInfo;
              }
              this.fetchWxProfile();
            }
          },
          fail: () => {
            console.log("[silentLogin] 静默登录请求失败");
          }
        });
      },
      fail: () => {
        console.log("[silentLogin] wx.login 失败");
      }
    });
  },

  /** 获取微信用户详细信息 */
  fetchWxProfile() {
    if (!this.globalData.token) return;
    // S3-196：消费者端调用点一律走统一封装（自动带 Authorization + x-csrf-token）
    this.request({
      url: `${this.globalData.apiBase}/miniapp/wechat/auth/profile`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + this.globalData.token
      },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0" && body.data) {
          this.globalData.wxUserInfo = body.data;
        }
      }
    });
  },

  /** 封装请求方法，自动带 token */
  request(options) {
    const token = this.globalData.token || wx.getStorageSync("miniapp_token") || "";
    const csrfToken = this.globalData.csrfToken || wx.getStorageSync("miniapp_csrf_token") || "";
    const header = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": "Bearer " + token } : {}),
      // S3-187 E：写端点（POST/PUT/DELETE）必须带 CSRF 令牌，否则 403
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {})
    };
    // 合并自定义header
    if (options.header) {
      Object.assign(header, options.header);
    }
    return new Promise((resolve, reject) => {
      wx.request({
        ...options,
        header,
        success: (res) => resolve(res),
        fail: (err) => reject(err)
      });
    });
  },

  /** 检查是否已登录 */
  isLoggedIn() {
    return !!(this.globalData.token || wx.getStorageSync("miniapp_token"));
  },

  /** 退出登录 */
  logout() {
    this.globalData.token = "";
    this.globalData.csrfToken = "";
    this.globalData.wxUserInfo = null;
    wx.removeStorageSync("miniapp_token");
    wx.removeStorageSync("miniapp_csrf_token");
  }
});
