#!/usr/bin/env node
/**
 * WCAG 对比度实测 —— 林夕｜TOTAL-SAAS-UI-TOKENS-01
 * 用于量化「App.vue :root 覆盖」造成的可达性倒退。
 * 用法：node docs/设计/contrast.mjs
 */
function srgbToLin(c) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
function lum(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b)
}
function ratio(fg, bg) {
  const a = lum(fg), b = lum(bg)
  const hi = Math.max(a, b), lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}
const cases = [
  ['现状·App.vue 覆盖值', '#6b7280', '#f5f7fa', '次级文字 / 页面底'],
  ['设计令牌 v5.0', '#444444', '#f7f7f7', '次级文字 / 页面底'],
  ['现状·App.vue 覆盖值', '#6b7280', '#ffffff', '次级文字 / 卡片白底'],
  ['设计令牌 v5.0', '#444444', '#ffffff', '次级文字 / 卡片白底'],
  ['现状·App.vue 覆盖值', '#1a1a2e', '#f5f7fa', '主文字 / 页面底'],
  ['设计令牌 v5.0', '#000000', '#f7f7f7', '主文字 / 页面底'],
  ['残留 Element 灰', '#909399', '#ffffff', 'MessageConfig/ErrorLogs 等'],
  ['残留 Element 灰', '#606266', '#ffffff', 'MobilePreview/PlatformRegister'],
]
console.log('═══ WCAG 对比度实测（TOTAL-SAAS-UI-TOKENS-01）═══')
console.log('组别'.padEnd(22) + '前景'.padEnd(10) + '背景'.padEnd(10) + '对比度'.padEnd(10) + 'AA正文(4.5)  说明')
console.log('─'.repeat(100))
let fails = 0
for (const [grp, fg, bg, note] of cases) {
  const r = ratio(fg, bg)
  const ok = r >= 4.5
  if (!ok) fails++
  console.log(
    grp.padEnd(20) + fg.padEnd(10) + bg.padEnd(10) +
    (r.toFixed(2) + ':1').padEnd(10) +
    (ok ? '✅ 通过      ' : '❌ 不达标    ') + note
  )
}
console.log('─'.repeat(100))
console.log(`不达标 ${fails} / ${cases.length}`)
