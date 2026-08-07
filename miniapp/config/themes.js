/**
 * 小程序三套主题模板定义（R96-01）
 *
 * 与 src/styles/themes/theme-{a,b,c}.scss 的色值一一对应：
 * - theme.js 负责构建期配置（导航栏/tabBar/品牌文案/图标）
 * - scss 变量文件负责页面样式
 *
 * 取值规则：
 * - 模板 A「商务经典 · 深海蓝」默认主题
 * - 模板 B「高端酒红金 · 臻品」
 * - 模板 C「清新活力 · 青翠」
 */

const themes = {
  a: {
    id: 'a',
    key: 'theme-a',
    name: '商务经典 · 深海蓝',
    brandName: '智享商城',
    brandSlogan: '正品酒水，极速配送',
    navigationTitle: '智享商城',
    // 主色与渐变（与 theme-a.scss 一致）
    colorPrimary: '#1e40af',
    gradientFrom: '#2563eb',
    gradientTo: '#1e40af',
    // 导航栏
    navBgColor: '#1e40af',
    navTextColor: '#ffffff',
    // tabBar
    tabBarColor: '#999999',
    tabBarSelectedColor: '#1e40af',
    tabBarBgColor: '#ffffff',
    // 页面背景
    bgPage: '#f5f5f5'
  },
  b: {
    id: 'b',
    key: 'theme-b',
    name: '高端酒红金 · 臻品',
    brandName: '臻品酒庄',
    brandSlogan: '传承匠心，典藏臻品',
    navigationTitle: '臻品酒庄',
    colorPrimary: '#9d1f33',
    gradientFrom: '#b91c1c',
    gradientTo: '#7f1d2d',
    navBgColor: '#7f1d2d',
    navTextColor: '#ffffff',
    tabBarColor: '#8a8a8a',
    tabBarSelectedColor: '#9d1f33',
    tabBarBgColor: '#ffffff',
    bgPage: '#faf7f2'
  },
  c: {
    id: 'c',
    key: 'theme-c',
    name: '清新活力 · 青翠',
    brandName: '青翠便利',
    brandSlogan: '新鲜好物，活力每一天',
    navigationTitle: '青翠便利',
    colorPrimary: '#0e9f6e',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    navBgColor: '#059669',
    navTextColor: '#ffffff',
    tabBarColor: '#999999',
    tabBarSelectedColor: '#0e9f6e',
    tabBarBgColor: '#ffffff',
    bgPage: '#f2fbf7'
  }
}

module.exports = themes
