/**
 * QODER-1（批次 0）· 门 3 —— app-mobile vitest 配置
 *
 * 关键点：`uni-ifdef` 插件是**测试期的条件编译 shim**（只处理 `// #ifdef/#ifndef/#endif`
 * 注释行，目标平台固定 H5）。不做这件事的话，`src/utils/crypto.ts` 的双份导出会让
 * 模块直接加载失败（这正是 vue-tsc 报 TS2323/TS2393 的同一根因，S3-245 修前现状）。
 * 这不是第二套构建链：生产构建仍只走 `uni build`（@dcloudio/vite-plugin-uni），
 * 本插件仅让 node 侧单测能按 **H5 分支的真实代码**跑起来。
 */
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const TARGET = 'H5'

/** uni 条件编译表达式（本仓实际用到的子集）：`NAME` / `!NAME`，用 `&&`、`||` 连接 */
function evalCondition(expr: string): boolean {
  return expr
    .split(/\s*\|\|\s*/)
    .some((clause) =>
      clause.split(/\s*&&\s*/).every((term) => {
        const m = term.trim().match(/^!?\s*([A-Z0-9_-]+)$/)
        if (!m) return true
        const hit = m[1] === TARGET
        return term.trim().startsWith('!') ? !hit : hit
      })
    )
}

function uniIfdef() {
  return {
    name: 'uni-ifdef-shim-for-vitest',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!/\.[cm]?[jt]sx?$/.test(id) || id.includes('node_modules')) return null
      if (!/#(ifdef|ifndef|endif)/.test(code)) return null
      const lines = code.split(/\r?\n/)
      const out: string[] = []
      const stack: boolean[] = []
      for (const line of lines) {
        const ifdef = line.match(/^\s*\/\/\s*#ifdef\s+(.+?)\s*$/)
        const ifndef = line.match(/^\s*\/\/\s*#ifndef\s+(.+?)\s*$/)
        const endif = /^\s*\/\/\s*#endif/.test(line)
        if (ifdef) {
          stack.push(evalCondition(ifdef[1]))
          out.push(line)
          continue
        }
        if (ifndef) {
          stack.push(!evalCondition(ifndef[1]))
          out.push(line)
          continue
        }
        if (endif) {
          stack.pop()
          out.push(line)
          continue
        }
        if (stack.every(Boolean)) out.push(line)
      }
      return { code: out.join('\n'), map: null }
    },
  }
}

export default defineConfig({
  plugins: [uniIfdef()],
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
