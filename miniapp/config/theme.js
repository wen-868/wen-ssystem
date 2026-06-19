/**
 * 小程序模板配置
 *
 * 使用方法：修改下方 themeName 为模板名称即可切换整套风格
 * 可选值：'liquor-blue' | 'warm-retail'
 */
const themeName = 'liquor-blue'

// ========== 模板定义（请勿修改） ==========

const themes = {
  // 模板1：酒水批发 - 商务蓝
  'liquor-blue': {
    // 品牌信息
    brandName: '智享商城',
    brandSlogan: '正品酒水，极速配送',
    navigationTitle: '智享商城',

    // 配色
    colorPrimary: '#1677FF',
    colorPrimaryHover: '#409EFF',
    colorPrimaryActive: '#0958D9',
    colorPrimarySoft: '#E6F4FF',
    colorPrice: '#9b1c31',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorDanger: '#EF4444',
    textPrimary: '#1F2328',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    bgPage: '#F5F7FA',
    bgCard: '#FFFFFF',
    bgSoft: '#F0F2F5',
    borderNormal: '#E5E7EB',

    // 导航栏
    navBgColor: '#1677FF',
    navTextColor: '#ffffff',

    // tabBar
    tabBarColor: '#697386',
    tabBarSelectedColor: '#1677FF',

    // 卡片样式
    cardRadius: '24rpx',
    cardShadow: '0 4rpx 24rpx rgba(0,0,0,0.06)',

    // 按钮样式
    btnRadius: '999rpx',
    btnFontSize: '28rpx',

    // 价格样式
    priceFontSize: '40rpx',
    priceFontWeight: '700',

    // 首页待下单清单背景
    cartBgColor: '#fefaf0',
    cartBorderColor: '#f0e6d0',
  },

  // 模板2：烟茶零售 - 暖色
  'warm-retail': {
    brandName: '优品商城',
    brandSlogan: '精选烟茶，品质生活',
    navigationTitle: '优品商城',

    colorPrimary: '#C2410C',
    colorPrimaryHover: '#EA580C',
    colorPrimaryActive: '#9A3412',
    colorPrimarySoft: '#FFF7ED',
    colorPrice: '#C2410C',
    colorSuccess: '#059669',
    colorWarning: '#D97706',
    colorDanger: '#DC2626',
    textPrimary: '#1C1917',
    textSecondary: '#57534E',
    textMuted: '#A8A29E',
    bgPage: '#FAFAF9',
    bgCard: '#FFFFFF',
    bgSoft: '#F5F5F4',
    borderNormal: '#E7E5E4',

    navBgColor: '#C2410C',
    navTextColor: '#ffffff',

    tabBarColor: '#78716C',
    tabBarSelectedColor: '#C2410C',

    cardRadius: '20rpx',
    cardShadow: '0 2rpx 16rpx rgba(0,0,0,0.05)',

    btnRadius: '16rpx',
    btnFontSize: '28rpx',

    priceFontSize: '40rpx',
    priceFontWeight: '700',

    cartBgColor: '#FFF7ED',
    cartBorderColor: '#FED7AA',
  }
}

// 导出当前主题
module.exports = themes[themeName] || themes['liquor-blue']
