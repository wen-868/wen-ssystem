/**
 * QODER-17 · `--safe-top` 自引用修复 —— 静态断言门
 *
 * 目标文件：app-mobile/src/App.vue（全局样式 `page` 规则中的 `--safe-top` 根定义）
 * 三条断言（任务书 §三 逐条）：
 *  ① 全文不得出现自引用 `--safe-top: var(--safe-top)`（CSS 变量自引用按定义即 cyclic 无效）；
 *  ② 默认分支（APP-PLUS 条件编译覆盖块之前）必须含 `--safe-top: env(safe-area-inset-top)`；
 *  ③ APP-PLUS 条件编译块内的 `var(--status-bar-height)` 覆盖必须仍在
 *     （App webview 中 env 恒为 0，APP 侧口径不得丢）。
 *
 * 本用例只做文本级静态断言，不依赖条件编译插件对样式块的解析。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appVuePath = fileURLToPath(new URL('../src/App.vue', import.meta.url))
const src = readFileSync(appVuePath, 'utf8')

/** 截取 APP-PLUS 条件编译开始注释与结束注释之间的覆盖块文本 */
function extractAppPlusBlock(text: string): string {
  const m = text.match(/\/\*\s*#ifdef\s+APP-PLUS\s*\*\/([\s\S]*?)\/\*\s*#endif\s*\*\//)
  return m ? m[1] : ''
}

describe('QODER-17 App.vue --safe-top 根定义', () => {
  const appPlusBlock = extractAppPlusBlock(src)
  const appPlusStart = src.indexOf('/* #ifdef APP-PLUS')
  const defaultBranch = appPlusStart === -1 ? src : src.slice(0, appPlusStart)

  it('① 不得出现自引用 `--safe-top: var(--safe-top)`', () => {
    expect(src).not.toMatch(/--safe-top:\s*var\(\s*--safe-top\s*\)/)
  })

  it('② 默认分支必须含 `--safe-top: env(safe-area-inset-top)`', () => {
    expect(defaultBranch).toMatch(/--safe-top:\s*env\(\s*safe-area-inset-top\s*\)/)
  })

  it('③ `#ifdef APP-PLUS` 覆盖为 `var(--status-bar-height)` 仍在', () => {
    expect(appPlusBlock).not.toBe('')
    expect(appPlusBlock).toMatch(/--safe-top:\s*var\(\s*--status-bar-height\s*\)/)
  })
})
