/**
 * 主题注入工具
 * 在每个页面的 onReady 中调用 injectTheme(this) 即可应用主题
 */
const themeConfig = require('../config/theme')

function injectTheme(page) {
  const t = { ...themeConfig } // 浅拷贝，允许覆盖
  // 构建 CSS 变量字符串
  const cssVars = [
    `--color-primary: ${t.colorPrimary}`,
    `--color-primary-hover: ${t.colorPrimaryHover}`,
    `--color-primary-active: ${t.colorPrimaryActive}`,
    `--color-primary-soft: ${t.colorPrimarySoft}`,
    `--color-price: ${t.colorPrice}`,
    `--color-success: ${t.colorSuccess}`,
    `--color-warning: ${t.colorWarning}`,
    `--color-danger: ${t.colorDanger}`,
    `--text-primary: ${t.textPrimary}`,
    `--text-secondary: ${t.textSecondary}`,
    `--text-muted: ${t.textMuted}`,
    `--bg-page: ${t.bgPage}`,
    `--bg-card: ${t.bgCard}`,
    `--bg-soft: ${t.bgSoft}`,
    `--border-normal: ${t.borderNormal}`,
    `--card-radius: ${t.cardRadius}`,
    `--card-shadow: ${t.cardShadow}`,
    `--btn-radius: ${t.btnRadius}`,
    `--btn-font-size: ${t.btnFontSize}`,
    `--price-font-size: ${t.priceFontSize}`,
    `--price-font-weight: ${t.priceFontWeight}`,
    `--cart-bg-color: ${t.cartBgColor}`,
    `--cart-border-color: ${t.cartBorderColor}`,
  ].join('; ')

  // 注入到页面根节点
  page.setData({
    theme: t,
    themeCssVars: cssVars
  })

  // 从后端获取门店信息，覆盖品牌名等
  const app = getApp()
  const baseUrl = app.globalData.baseUrl
  const token = wx.getStorageSync('token')

  if (baseUrl && token) {
    wx.request({
      url: `${baseUrl}/store/info`,
      method: 'GET',
      header: { 'Authorization': `Bearer ${token}` },
      success: (res) => {
        if (res.data && res.data.code === '0' && res.data.data) {
          const storeInfo = res.data.data
          // 用后端门店信息覆盖品牌名
          const overrides = {}
          if (storeInfo.storeName) overrides.brandName = storeInfo.storeName
          if (storeInfo.wxMerchantName) overrides.brandName = storeInfo.wxMerchantName
          if (storeInfo.storePhone) overrides.brandSlogan = `服务热线: ${storeInfo.storePhone}`

          // 合并到 theme
          const updatedTheme = { ...t, ...overrides }
          page.setData({ theme: updatedTheme })
        }
      },
      fail: () => {
        // 静默失败，使用默认模板配置
      }
    })
  }
}

module.exports = { injectTheme }
