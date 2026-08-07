/**
 * 编译期主题解析（R96-01）
 *
 * 统一从 process.env.UNI_THEME 读取主题标识（a/b/c，默认 a），
 * 供 config/index.js（sass.data 注入、defineConstants）与构建脚本共用。
 */
const themes = require('./themes')

const THEME_IDS = ['a', 'b', 'c']

function resolveThemeId() {
  return THEME_IDS.includes(process.env.UNI_THEME) ? process.env.UNI_THEME : 'a'
}

function resolveTheme() {
  return themes[resolveThemeId()]
}

module.exports = {
  THEME_IDS,
  resolveThemeId,
  resolveTheme
}
