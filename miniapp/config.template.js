/**
 * 小程序配置模板
 *
 * 此文件会在部署时由平台注入实际配置值。
 * 占位符格式：{{PLACEHOLDER_NAME}}
 * 本地开发时使用默认值，生产环境由 CI/CD 替换。
 *
 * 部署注入方式（示例）：
 *   envsubst < config.template.js > config.injected.js
 *   # 或
 *   sed -i 's|{{API_BASE}}|https://api.example.com|g' config.template.js
 */

// ========== 平台注入变量（占位符） ==========

const PLATFORM_CONFIG = {
  /** 后端 API 地址 */
  apiBase: '{{API_BASE}}' !== '{{API_BASE}}' ? '{{API_BASE}}' : 'https://api.onepan.cn/api',

  /** 门店 ID */
  storeId: '{{STORE_ID}}' !== '{{STORE_ID}}' ? Number('{{STORE_ID}}') : 1,

  /** 商户名称 */
  storeName: '{{STORE_NAME}}' !== '{{STORE_NAME}}' ? '{{STORE_NAME}}' : '智享商城',

  /** 支付配置 */
  payment: {
    /** 微信支付商户号 */
    mchId: '{{PAYMENT_MCH_ID}}' !== '{{PAYMENT_MCH_ID}}' ? '{{PAYMENT_MCH_ID}}' : '',
    /** 支付密钥 */
    payKey: '{{PAYMENT_KEY}}' !== '{{PAYMENT_KEY}}' ? '{{PAYMENT_KEY}}' : '',
    /** 支付回调地址 */
    notifyUrl: '{{PAYMENT_NOTIFY_URL}}' !== '{{PAYMENT_NOTIFY_URL}}' ? '{{PAYMENT_NOTIFY_URL}}' : '',
    /** 是否启用支付 */
    enablePay: '{{PAYMENT_ENABLE}}' !== '{{PAYMENT_ENABLE}}' ? '{{PAYMENT_ENABLE}}' === 'true' : true
  },

  /** 实时同步配置 */
  sync: {
    /** WebSocket 地址 */
    wsUrl: '{{SYNC_WS_URL}}' !== '{{SYNC_WS_URL}}' ? '{{SYNC_WS_URL}}' : 'wss://ws.onepan.cn/sync',
    /** 轮询间隔（毫秒） */
    pollIntervalMs: '{{SYNC_POLL_INTERVAL}}' !== '{{SYNC_POLL_INTERVAL}}' ? Number('{{SYNC_POLL_INTERVAL}}') : 10000,
    /** 是否启用实时同步 */
    enabled: '{{SYNC_ENABLED}}' !== '{{SYNC_ENABLED}}' ? '{{SYNC_ENABLED}}' === 'true' : true
  },

  /** 页面布局配置 */
  pageConfig: {
    /** 首页显示模式：standard | wholesale | retail */
    homeMode: '{{PAGE_HOME_MODE}}' !== '{{PAGE_HOME_MODE}}' ? '{{PAGE_HOME_MODE}}' : 'standard',
    /** 是否展示搜索栏 */
    showSearch: '{{PAGE_SHOW_SEARCH}}' !== '{{PAGE_SHOW_SEARCH}}' ? '{{PAGE_SHOW_SEARCH}}' === 'true' : true,
    /** 是否展示购物车 */
    showCart: '{{PAGE_SHOW_CART}}' !== '{{PAGE_SHOW_CART}}' ? '{{PAGE_SHOW_CART}}' === 'true' : true,
    /** 是否展示价格 */
    showPrice: '{{PAGE_SHOW_PRICE}}' !== '{{PAGE_SHOW_PRICE}}' ? '{{PAGE_SHOW_PRICE}}' === 'true' : true,
    /** 是否展示批发价 */
    showWholesalePrice: '{{PAGE_SHOW_WHOLESALE_PRICE}}' !== '{{PAGE_SHOW_WHOLESALE_PRICE}}' ? '{{PAGE_SHOW_WHOLESALE_PRICE}}' === 'true' : false,
    /** 是否展示库存 */
    showStock: '{{PAGE_SHOW_STOCK}}' !== '{{PAGE_SHOW_STOCK}}' ? '{{PAGE_SHOW_STOCK}}' === 'true' : true,
    /** 是否展示分类筛选 */
    showCategory: '{{PAGE_SHOW_CATEGORY}}' !== '{{PAGE_SHOW_CATEGORY}}' ? '{{PAGE_SHOW_CATEGORY}}' === 'true' : true,
    /** 下单按钮文字 */
    orderButtonText: '{{PAGE_ORDER_BUTTON_TEXT}}' !== '{{PAGE_ORDER_BUTTON_TEXT}}' ? '{{PAGE_ORDER_BUTTON_TEXT}}' : '加入下单'
  },

  /** 主题配置 */
  theme: {
    /** 主题名称：liquor-blue | warm-retail */
    themeName: '{{THEME_NAME}}' !== '{{THEME_NAME}}' ? '{{THEME_NAME}}' : 'liquor-blue',
    /** 品牌名称 */
    brandName: '{{BRAND_NAME}}' !== '{{BRAND_NAME}}' ? '{{BRAND_NAME}}' : '智享商城',
    /** 品牌标语 */
    brandSlogan: '{{BRAND_SLOGAN}}' !== '{{BRAND_SLOGAN}}' ? '{{BRAND_SLOGAN}}' : '正品酒水，极速配送',
    /** 主色调 */
    colorPrimary: '{{COLOR_PRIMARY}}' !== '{{COLOR_PRIMARY}}' ? '{{COLOR_PRIMARY}}' : '#1677FF',
    /** 导航栏背景色 */
    navBgColor: '{{NAV_BG_COLOR}}' !== '{{NAV_BG_COLOR}}' ? '{{NAV_BG_COLOR}}' : '#1677FF',
    /** 导航栏文字色 */
    navTextColor: '{{NAV_TEXT_COLOR}}' !== '{{NAV_TEXT_COLOR}}' ? '{{NAV_TEXT_COLOR}}' : '#ffffff'
  }
}

// ========== 兼容旧版 theme 导出 ==========
// 如果平台注入了自定义主题，则覆盖 config/theme.js 中的默认值
const theme = require('./config/theme')
const mergedTheme = Object.assign({}, theme, {
  brandName: PLATFORM_CONFIG.theme.brandName,
  brandSlogan: PLATFORM_CONFIG.theme.brandSlogan,
  colorPrimary: PLATFORM_CONFIG.theme.colorPrimary,
  navBgColor: PLATFORM_CONFIG.theme.navBgColor,
  navTextColor: PLATFORM_CONFIG.theme.navTextColor
})

module.exports = {
  config: PLATFORM_CONFIG,
  theme: mergedTheme
}