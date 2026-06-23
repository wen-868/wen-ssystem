const { injectTheme } = require('../../utils/theme')

Page({
  data: {
    isLoggedIn: false,
    profile: {
      nickname: "未登录",
      customerType: "RETAIL",
      customerLabel: "零售",
      mobile: "",
      memberLevel: "普通会员",
      points: 0
    },
    wxProfile: null,      // 微信用户资料
    bindings: [],        // 系统账号绑定列表
    loading: false,
    errorText: "",
    theme: {},
    themeCssVars: "",
    bindDialogVisible: false,
    bindForm: { username: "", password: "", bindingType: "CONSUMER" },
    // 追溯扫码（内嵌）
    traceVisible: false,
    traceLoading: false,
    traceError: '',
    traceCode: '',
    traceInfo: {},
    verifyResult: {
      status: 'pending',
      title: '验证中...',
      desc: '正在验证商品真伪'
    },
    timeline: []
  },
  onReady() {
    injectTheme(this);
  },
  onShow() {
    const app = getApp();
    if (app.isLoggedIn()) {
      this.setData({ isLoggedIn: true });
    }
    this.refreshProfile();
    this.loadWxProfile();
  },
  refreshProfile(done) {
    const app = getApp();
    if (app.globalData.demoMode) {
      this.setData({
        profile: {
          nickname: "内测演示用户",
          customerType: "RETAIL",
          customerLabel: "零售客户",
          mobile: "13800000000",
          memberLevel: "普通会员",
          points: 120
        },
        loading: false,
        errorText: "演示模式：服务器域名配置完成后将自动连接真实身份"
      });
      if (done) done();
      return;
    }
    this.setData({ loading: true, errorText: "" });
    const token = wx.getStorageSync("miniapp_token") || "";
    wx.request({
      url: `${app.globalData.apiBase}/miniapp/profile`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": "Bearer " + token } : {})
      },
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

  /** 加载微信用户资料 */
  loadWxProfile() {
    const app = getApp();
    if (!app.isLoggedIn()) return;
    app.request({
      url: `${app.globalData.apiBase}/miniapp/wechat/auth/profile`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0" && body.data) {
          this.setData({
            wxProfile: body.data,
            bindings: body.data.bindings || []
          });
        }
      }
    });
  },

  handleLogin() {
    const app = getApp();
    if (app.globalData.demoMode) {
      wx.showToast({ title: "演示登录成功", icon: "success" });
      this.setData({ isLoggedIn: true });
      this.refreshProfile();
      return;
    }
    wx.login({
      success: (loginRes) => {
        wx.request({
          url: `${app.globalData.apiBase}/miniapp/wechat/auth/login`,
          method: "POST",
          header: { "Content-Type": "application/json" },
          data: { code: loginRes.code },
          success: (res) => {
            const body = res.data || {};
            if (body.code === "0" && body.data) {
              wx.setStorageSync("miniapp_token", body.data.token || "");
              app.globalData.token = body.data.token || "";
              this.setData({ isLoggedIn: true });
              wx.showToast({ title: "已登录", icon: "success" });
              this.refreshProfile();
              this.loadWxProfile();
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

  /** 获取手机号 */
  handleGetPhone(e) {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      wx.showToast({ title: "用户拒绝授权", icon: "none" });
      return;
    }
    app.request({
      url: `${app.globalData.apiBase}/miniapp/wechat/auth/decrypt-phone`,
      method: "POST",
      data: {
        encryptedData: e.detail.encryptedData,
        iv: e.detail.iv
      },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0" && body.data) {
          wx.showToast({ title: "手机号获取成功", icon: "success" });
          this.setData({
            "profile.mobile": body.data.phone,
            "wxProfile.phone": body.data.phone
          });
        } else {
          wx.showToast({ title: body.message || "获取失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "请求失败", icon: "none" });
      }
    });
  },

  /** 显示绑定对话框 */
  showBindDialog() {
    this.setData({ bindDialogVisible: true });
  },

  /** 隐藏绑定对话框 */
  hideBindDialog() {
    this.setData({ bindDialogVisible: false, bindForm: { username: "", password: "", bindingType: "CONSUMER" } });
  },

  /** 绑定表单输入 */
  onBindInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`bindForm.${field}`]: e.detail.value });
  },

  /** 绑定类型选择 */
  onBindTypeChange(e) {
    this.setData({ "bindForm.bindingType": e.detail.value });
  },

  /** 提交绑定 */
  handleBind() {
    const app = getApp();
    const { username, password, bindingType } = this.data.bindForm;
    if (!username || !password) {
      wx.showToast({ title: "请填写账号和密码", icon: "none" });
      return;
    }
    app.request({
      url: `${app.globalData.apiBase}/miniapp/wechat/auth/bind`,
      method: "POST",
      data: { username, password, bindingType },
      success: (res) => {
        const body = res.data || {};
        if (body.code === "0") {
          wx.showToast({ title: "绑定成功", icon: "success" });
          this.hideBindDialog();
          this.loadWxProfile();
        } else {
          wx.showToast({ title: body.message || "绑定失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "请求失败", icon: "none" });
      }
    });
  },

  /** 解除绑定 */
  handleUnbind(e) {
    const app = getApp();
    const systemUserId = e.currentTarget.dataset.id;
    wx.showModal({
      title: "确认解绑",
      content: "解绑后将无法通过微信快捷登录系统账号",
      success: (modalRes) => {
        if (modalRes.confirm) {
          app.request({
            url: `${app.globalData.apiBase}/miniapp/wechat/auth/unbind`,
            method: "POST",
            data: { systemUserId },
            success: (res) => {
              const body = res.data || {};
              if (body.code === "0") {
                wx.showToast({ title: "已解绑", icon: "success" });
                this.loadWxProfile();
              } else {
                wx.showToast({ title: body.message || "解绑失败", icon: "none" });
              }
            }
          });
        }
      }
    });
  },

  handleTap() {
    this.refreshProfile();
  },
  goStatement() {
    wx.navigateTo({ url: '/pages/statement/index' });
  },
  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/index' });
  },
  goAftersale() {
    wx.navigateTo({ url: '/pages/aftersale/index' });
  },

  /** 追溯扫码 - 内嵌展示结果 */
  goTraceScan() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode', 'qrCode'],
      success: (scanRes) => {
        const traceCode = scanRes.result || '';
        if (traceCode) {
          this.setData({
            traceVisible: true,
            traceLoading: true,
            traceError: '',
            traceCode: traceCode,
            traceInfo: {},
            verifyResult: { status: 'pending', title: '验证中...', desc: '正在验证商品真伪' },
            timeline: []
          });
          this.loadTraceInfo();
          this.verifyTrace();
        } else {
          wx.showToast({ title: '未识别到有效码', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '扫码已取消', icon: 'none' });
      }
    });
  },

  /** 关闭追溯结果 */
  hideTraceResult() {
    this.setData({ traceVisible: false, traceInfo: {}, timeline: [], verifyResult: { status: 'pending', title: '验证中...', desc: '' } });
  },

  /** 获取追溯信息 */
  loadTraceInfo() {
    const app = getApp();
    const token = wx.getStorageSync('miniapp_token') || '';
    const { traceCode } = this.data;

    wx.request({
      url: `${app.globalData.apiBase}/miniapp/trace/c/query/${encodeURIComponent(traceCode)}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      success: (res) => {
        const body = res.data || {};
        if (body.code === '0' && body.data) {
          const data = body.data;
          const shelfInfo = this.calcShelfStatus(data.productionDate, data.expiryDate);
          this.setData({
            traceInfo: {
              ...data,
              shelfStatus: shelfInfo.status,
              shelfStatusLabel: shelfInfo.label
            },
            timeline: this.formatTimeline(data.timeline || [])
          });
        } else {
          this.setData({ traceError: body.message || '未查询到追溯信息' });
        }
      },
      fail: () => {
        this.setData({ traceError: '网络异常，无法查询追溯信息' });
      },
      complete: () => {
        this.setData({ traceLoading: false });
      }
    });
  },

  /** 真伪验证 */
  verifyTrace() {
    const app = getApp();
    const token = wx.getStorageSync('miniapp_token') || '';
    const { traceCode } = this.data;

    wx.request({
      url: `${app.globalData.apiBase}/miniapp/trace/c/verify`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      data: { traceCode },
      success: (res) => {
        const body = res.data || {};
        if (body.code === '0' && body.data) {
          const isPass = body.data.verified === true || body.data.verified === 'true';
          this.setData({
            verifyResult: {
              status: isPass ? 'pass' : 'fail',
              title: isPass ? '正品验证通过' : '验证失败',
              desc: isPass
                ? '该商品已通过系统真伪验证'
                : (body.data.reason || '该商品未通过真伪验证，请谨慎购买')
            }
          });
        } else {
          this.setData({
            verifyResult: {
              status: 'fail',
              title: '验证失败',
              desc: body.message || '无法完成真伪验证'
            }
          });
        }
      },
      fail: () => {
        this.setData({
          verifyResult: {
            status: 'fail',
            title: '验证失败',
            desc: '网络异常，无法完成真伪验证'
          }
        });
      }
    });
  },

  /** 计算保质期状态 */
  calcShelfStatus(productionDate, expiryDate) {
    if (!expiryDate) return { status: 'normal', label: '正常' };
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { status: 'expired', label: '已过期' };
    if (diffDays <= 30) return { status: 'expiring', label: '临期（剩余' + diffDays + '天）' };
    return { status: 'normal', label: '正常' };
  },

  /** 格式化时间线数据 */
  formatTimeline(rawTimeline) {
    if (!Array.isArray(rawTimeline)) return [];
    return rawTimeline.map((item, index) => ({
      eventType: item.eventType || item.event_type || '未知事件',
      eventTime: item.eventTime || item.event_time || '',
      location: item.location || '',
      operator: item.operator || '',
      dotType: this.getDotType(item.eventType || item.event_type || '', index, rawTimeline.length)
    }));
  },

  /** 根据事件类型确定圆点样式 */
  getDotType(eventType, index, total) {
    if (index === 0) return 'primary';
    if (index === total - 1) return 'success';
    const typeMap = {
      '生产': 'primary', '入库': 'primary',
      '出库': 'warning', '配送': 'warning',
      '签收': 'success', '上架': 'success',
      '扫码': 'default'
    };
    for (const key in typeMap) {
      if (eventType.indexOf(key) !== -1) return typeMap[key];
    }
    return 'default';
  }
});
