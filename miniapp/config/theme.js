/**
 * 小程序模板配置（R96-01）
 *
 * 通过环境变量 UNI_THEME（a/b/c，默认 a）在编译期选择主题，
 * 与 config/index.js 的 sass.data 注入、config/themes.js 模板定义联动。
 */
const themes = require('./themes')

// 编译期主题选择：UNI_THEME ∈ {a, b, c}，缺省取 a（兼容不传环境变量的旧行为）
const themeId = ['a', 'b', 'c'].includes(process.env.UNI_THEME) ? process.env.UNI_THEME : 'a'

// 导出当前主题
module.exports = themes[themeId]
