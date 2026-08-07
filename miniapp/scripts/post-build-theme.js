/**
 * 构建后主题注入脚本（R96-01）
 *
 * Taro 的 app.config.ts 为静态配置，tabBar 选中色/导航栏背景等无法直接
 * 读取运行时环境变量。本脚本在 Taro 构建完成后：
 *   1. 按 UNI_THEME（a/b/c，默认 a）将主题色值写入 dist/app.json：
 *      - window.navigationBarBackgroundColor / navigationBarTitleText
 *      - tabBar.color / selectedColor / backgroundColor
 *   2. 复制对应主题图标到 dist/assets/tab/
 *      （selectedIconPath 固定指向 *-active.png，复制时用当前主题变体覆盖）
 *
 * 用法：UNI_THEME=a node scripts/post-build-theme.js
 */

const fs = require('fs')
const path = require('path')
const { resolveTheme } = require('../config/resolve-theme')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const APP_JSON = path.join(DIST, 'app.json')

// H5 构建不产出 app.json，直接跳过（H5 主题由 sass 变量 + defineConstants 生效）
if (!fs.existsSync(APP_JSON)) {
  console.log('[post-build-theme] 未找到 dist/app.json（H5 构建？），跳过主题注入')
  process.exit(0)
}

const theme = resolveTheme()

function main() {
  const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'))

  // 导航栏
  app.window = app.window || {}
  app.window.navigationBarBackgroundColor = theme.navBgColor
  app.window.navigationBarTextStyle = 'white'
  app.window.navigationBarTitleText = theme.navigationTitle
  app.window.backgroundColor = theme.bgPage

  // tabBar
  if (app.tabBar) {
    app.tabBar.color = theme.tabBarColor
    app.tabBar.selectedColor = theme.tabBarSelectedColor
    app.tabBar.backgroundColor = theme.tabBarBgColor
  }

  fs.writeFileSync(APP_JSON, JSON.stringify(app, null, 2), 'utf8')

  // 复制主题图标（app.json 引用 assets/tab/*.png）
  const srcTab = path.join(ROOT, 'src', 'assets', 'tab')
  const distTab = path.join(DIST, 'assets', 'tab')
  if (fs.existsSync(srcTab)) {
    fs.mkdirSync(distTab, { recursive: true })
    const names = ['home.png', 'category.png', 'cart.png', 'profile.png']
    for (const name of names) {
      const from = path.join(srcTab, name)
      if (fs.existsSync(from)) {
        fs.copyFileSync(from, path.join(distTab, name))
      }
      // 选中态图标：直接用当前主题变体 *-active-{theme}.png 写入固定文件名
      const activeName = name.replace(/\.png$/, '-active.png')
      const activeFrom = path.join(srcTab, `${name.replace(/\.png$/, '')}-active-${theme.id}.png`)
      if (fs.existsSync(activeFrom)) {
        fs.copyFileSync(activeFrom, path.join(distTab, activeName))
      }
    }
  }

  console.log(`[post-build-theme] 主题 ${theme.id}（${theme.name}）已注入 dist/app.json`)
  console.log(`  navigationBarTitleText=${theme.navigationTitle}  navBg=${theme.navBgColor}`)
  console.log(`  tabBarSelectedColor=${theme.tabBarSelectedColor}`)
}

main()
