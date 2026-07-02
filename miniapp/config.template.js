/**
 * 小程序配置模板
 *
 * 此文件会在部署时由平台注入实际配置值。
 * 占位符格式：__PLACEHOLDER_NAME__
 * 本地开发时使用默认值，生产环境由 CI/CD 替换。
 *
 * 部署注入方式（示例）：
 *   sed -i 's|__API_BASE__|https://api.example.com|g' config.template.js
 */

// ========== 平台注入变量（占位符） ==========

const PLATFORM_CONFIG = {
  /** 后端 API 地址 */
  apiBase: '__API_BASE__' !== '__API_BASE__' ? '__API_BASE__' : 'https://api.onepan.cn/api',

  /** 门店 ID */
  storeId: '__STORE_ID__' !== '__STORE_ID__' ? Number('__STORE_ID__') : 1,

  /** 商户名称 */
  storeName: '__STORE_NAME__' !== '__STORE_NAME__' ? '__STORE_NAME__' : '智享商城',

  /** 支付配置 */
  payment: {
    /** 微信支付商户号 */
    mchId: '__PAYMENT_MCH_ID__' !== '__PAYMENT_MCH_ID__' ? '__PAYMENT_MCH_ID__' : '',
    /** 支付密钥 */
    payKey: '__PAYMENT_KEY__' !== '__PAYMENT_KEY__' ? '__PAYMENT_KEY__' : '',
    /** 支付回调地址 */
    notifyUrl: '__PAYMENT_NOTIFY_URL__' !== '__PAYMENT_NOTIFY_URL__' ? '__PAYMENT_NOTIFY_URL__' : '',
    /** 是否启用支付 */
    enablePay: '__PAYMENT_ENABLE__' !== '__PAYMENT_ENABLE__' ? '__PAYMENT_ENABLE__' === 'true' : true
  },

  /** 实时同步配置 */
  sync: {
    /** WebSocket 地址 */
    wsUrl: '__SYNC_WS_URL__' !== '__SYNC_WS_URL__' ? '__SYNC_WS_URL__' : 'wss://ws.onepan.cn/sync',
    /** 轮询间隔（毫秒） */
    pollIntervalMs: '__SYNC_POLL_INTERVAL__' !== '__SYNC_POLL_INTERVAL__' ? Number('__SYNC_POLL_INTERVAL__') : 10000,
    /** 是否启用实时同步 */
    enabled: '__SYNC_ENABLED__' !== '__SYNC_ENABLED__' ? '__SYNC_ENABLED__' === 'true' : true
  },

  /** 页面布局配置 */
  pageConfig: {
    /** 首页显示模式：standard | wholesale | retail */
    homeMode: '__PAGE_HOME_MODE__' !== '__PAGE_HOME_MODE__' ? '__PAGE_HOME_MODE__' : 'standard',
    /** 是否展示搜索栏 */
    showSearch: '__PAGE_SHOW_SEARCH__' !== '__PAGE_SHOW_SEARCH__' ? '__PAGE_SHOW_SEARCH__' === 'true' : true,
    /** 是否展示购物车 */
    showCart: '__PAGE_SHOW_CART__' !== '__PAGE_SHOW_CART__' ? '__PAGE_SHOW_CART__' === 'true' : true,
    /** 是否展示价格 */
    showPrice: '__PAGE_SHOW_PRICE__' !== '__PAGE_SHOW_PRICE__' ? '__PAGE_SHOW_PRICE__' === 'true' : true,
    /** 是否展示批发价 */
    showWholesalePrice: '__PAGE_SHOW_WHOLESALE_PRICE__' !== '__PAGE_SHOW_WHOLESALE_PRICE__' ? '__PAGE_SHOW_WHOLESALE_PRICE__' === 'true' : false,
    /** 是否展示库存 */
    showStock: '__PAGE_SHOW_STOCK__' !== '__PAGE_SHOW_STOCK__' ? '__PAGE_SHOW_STOCK__' === 'true' : true,
    /** 是否展示分类筛选 */
    showCategory: '__PAGE_SHOW_CATEGORY__' !== '__PAGE_SHOW_CATEGORY__' ? '__PAGE_SHOW_CATEGORY__' === 'true' : true,
    /** 下单按钮文字 */
    orderButtonText: '__PAGE_ORDER_BUTTON_TEXT__' !== '__PAGE_ORDER_BUTTON_TEXT__' ? '__PAGE_ORDER_BUTTON_TEXT__' : '加入下单'
  },

  /** 主题配置 */
  theme: {
    /** 主题名称：liquor-blue | warm-retail */
    themeName: '__THEME_NAME__' !== '__THEME_NAME__' ? '__THEME_NAME__' : 'liquor-blue',
    /** 品牌名称 */
    brandName: '__BRAND_NAME__' !== '__BRAND_NAME__' ? '__BRAND_NAME__' : '智享商城',
    /** 品牌标语 */
    brandSlogan: '__BRAND_SLOGAN__' !== '__BRAND_SLOGAN__' ? '__BRAND_SLOGAN__' : '正品酒水，极速配送',
    /** 主色调 */
    colorPrimary: '__COLOR_PRIMARY__' !== '__COLOR_PRIMARY__' ? '__COLOR_PRIMARY__' : '#1677FF',
    /** 导航栏背景色 */
    navBgColor: '__NAV_BG_COLOR__' !== '__NAV_BG_COLOR__' ? '__NAV_BG_COLOR__' : '#1677FF',
    /** 导航栏文字色 */
    navTextColor: '__NAV_TEXT_COLOR__' !== '__NAV_TEXT_COLOR__' ? '__NAV_TEXT_COLOR__' : '#ffffff'
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
