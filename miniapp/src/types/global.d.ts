/**
 * 编译期注入常量声明（R96-01）
 *
 * 由 miniapp/config/index.js 的 defineConstants 注入：
 * - BASE_URL：API 地址（TARO_APP_API_BASE）
 * - __THEME__：当前主题配置（UNI_THEME → config/themes.js）
 */

declare const BASE_URL: string

interface MiniappThemeConfig {
  id: 'a' | 'b' | 'c'
  key: string
  name: string
  brandName: string
  brandSlogan: string
  navigationTitle: string
  colorPrimary: string
  gradientFrom: string
  gradientTo: string
  navBgColor: string
  navTextColor: string
  tabBarColor: string
  tabBarSelectedColor: string
  tabBarBgColor: string
  bgPage: string
}

declare const __THEME__: MiniappThemeConfig
