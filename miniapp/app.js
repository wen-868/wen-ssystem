const theme = require('./config/theme')

// 读取平台配置模板（支持占位符注入）
let platformConfig = null
try {
  const configTemplate = require('./config.template')
  platformConfig = configTemplate.config
  theme = configTemplate.theme
} catch (e) {
  // config.template.js 不存在时使用默认配置
  platformConfig = {
    apiBase: 'https://api.onepan.cn/api',
    storeId: 1,
    storeName: '智享商城',
    payment: { enablePay: true },
    sync: { wsUrl: 'wss://ws.onepan.cn/sync', pollIntervalMs: 10000, enabled: true },
    pageConfig: { homeMode: 'standard', showSearch: true, showCart: true, showPrice: true, showWholesalePrice: false, showStock: true, showCategory: true, orderButtonText: '加入下单' }
  }
}

App({
  globalData: {
    apiBase: platformConfig.apiBase,
    demoMode: false,
    theme: theme,
    token: "",       // 微信登录token
    wxUserInfo: null, // 微信用户信息
    platformConfig: platformConfig, // 平台配置
    storeId: platformConfig.storeId,
    storeName: platformConfig.storeName
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
    wx.request({
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
    const header = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": "Bearer " + token } : {})
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
    this.globalData.wxUserInfo = null;
    wx.removeStorageSync("miniapp_token");
  }
});
