/**
 * 主题化构建入口（R96-01）
 *
 * 用法：node scripts/build-with-theme.js [weapp|h5]
 *
 * 行为：
 *   1. 读取 UNI_THEME（a/b/c，默认 a）并透传给 Taro 构建
 *      （config/index.js 的 sass.data 按 UNI_THEME 注入主题变量）；
 *   2. 构建成功后执行 scripts/post-build-theme.js，
 *      将主题色值/图标写入 dist/app.json（仅 weapp 生效）。
 */

const { spawnSync } = require('child_process')
const path = require('path')
const { resolveThemeId } = require('../config/resolve-theme')

const platform = process.argv[2] || 'weapp'
const themeId = resolveThemeId()

console.log(`[build-with-theme] 开始构建 platform=${platform} UNI_THEME=${themeId}`)

// H5 构建会内联 tabBar 选中图标（固定文件名 *-active.png），
// 先按当前主题生成同名选中图标，保证内联的是当前主题色
if (platform === 'h5') {
  const gen = spawnSync(process.execPath, [path.join(__dirname, 'generate-tab-icons.js'), themeId], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  })
  if (gen.status !== 0) {
    console.error('[build-with-theme] tab 图标生成失败')
    process.exit(gen.status || 1)
  }
}

const taro = spawnSync('npx', ['taro', 'build', '--type', platform], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

if (taro.status !== 0) {
  console.error(`[build-with-theme] Taro 构建失败（exit=${taro.status}）`)
  process.exit(taro.status || 1)
}

const post = spawnSync(process.execPath, [path.join(__dirname, 'post-build-theme.js')], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit'
})

if (post.status !== 0) {
  console.error(`[build-with-theme] 主题注入失败（exit=${post.status}）`)
  process.exit(post.status || 1)
}

console.log(`[build-with-theme] 构建完成 platform=${platform} UNI_THEME=${themeId}`)
