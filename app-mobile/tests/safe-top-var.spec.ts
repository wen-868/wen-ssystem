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
 * QODER-17F1 · 追加第 4 条断言（安全区根链的另一半）：
 *  ④ app-mobile/index.html 的 viewport meta 必须同时含 `width=device-width` 与
 *     `viewport-fit=cover`。根因：缺 `viewport-fit=cover` 时 iOS 真机 webview 不把内容
 *     铺到刘海/圆角区，`env(safe-area-inset-top)` 恒解析为 0，②的 env 定义在真机上拿不到值。
 *     该断言单独成一条 `it`，失败时点名精确，便于反测定位。
 *
 * 本用例只做文本级静态断言，不依赖条件编译插件对样式块的解析。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appVuePath = fileURLToPath(new URL('../src/App.vue', import.meta.url))
const src = readFileSync(appVuePath, 'utf8')
const indexPath = fileURLToPath(new URL('../index.html', import.meta.url))
const indexHtml = readFileSync(indexPath, 'utf8')

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

describe('QODER-17F1 index.html viewport（安全区根链另一半）', () => {
  it('④ viewport meta 必须同时含 `width=device-width` 与 `viewport-fit=cover`', () => {
    const viewportMetas = indexHtml.match(/<meta[^>]*name=["']viewport["'][^>]*>/g) ?? []
    // 只允许一个 viewport：多份 viewport meta 时后者优先级不可控，安全区口径会漂
    expect(viewportMetas.length).toBe(1)
    const content = viewportMetas[0]
    expect(content).toMatch(/width=device-width/)
    expect(content).toMatch(/viewport-fit=cover/)
  })
})
