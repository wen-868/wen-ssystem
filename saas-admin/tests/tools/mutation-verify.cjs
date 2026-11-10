#!/usr/bin/env node
/**
 * TOTAL-SAAS-UI-TOKENS-01 · mutation 验证（验收卡 §四.5）
 * 四类突变，每类：应用变异 → 跑契约测试（期望红）→ 还原 → 记录
 * 判据 PASS = 该类 mutation 下契约测试失败（测试有分辨力）
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = process.cwd()
const SPEC = 'saas-admin/src/styles/tokens.contract.spec.ts'
const APP = path.join(ROOT, 'saas-admin/src/App.vue')
const TOKENS = path.join(ROOT, 'saas-admin/src/styles/tokens.css')
const COMPONENTS = path.join(ROOT, 'saas-admin/src/styles/components.css')

const read = (p) => fs.readFileSync(p, 'utf8')
const write = (p, s) => fs.writeFileSync(p, s, 'utf8')

/** 跑契约测试，返回 { failed } */
function runSpec() {
  try {
    execFileSync('node', ['../node_modules/vitest/vitest.mjs', 'run', 'src/styles/tokens.contract.spec.ts'], {
      cwd: path.join(ROOT, 'saas-admin'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000,
    })
    return { failed: false }
  } catch (e) {
    return { failed: true, out: (e.stdout || '').split('\n').filter((l) => /×|FAIL|AssertionError/.test(l)).slice(0, 4).join(' | ').slice(0, 260) }
  }
}

const MUTATIONS = [
  {
    id: 'M1 恢复重复定义',
    apply() {
      const s = read(APP)
      // CRLF 中性：在 <style> 标签后插入 :root 重复定义（Windows 工作树为 \r\n，
      // 用 '<style>\n' 定位会静默失配 ⇒ 变异不生效 ⇒ 假绿，务必用无换行锚点）
      if (!s.includes('<style>')) throw new Error('App.vue 找不到 <style> 锚点')
      write(APP, s.replace(
        '<style>',
        '<style>\n:root {\n  --text-primary: #1a1a2e;\n  --text-secondary: #6b7280;\n  --bg-page: #f5f7fa;\n}\n',
      ))
    },
    restore() {},
    marker: 'saas-admin/src/App.vue',
  },
  {
    id: 'M2 错误覆盖优先级（组件级样式再定义基线令牌）',
    apply() {
      const s = read(COMPONENTS)
      write(COMPONENTS, ':root {\n  --text-primary: #123456;\n}\n\n' + s)
    },
    restore() {},
    marker: 'saas-admin/src/styles/components.css',
  },
  {
    id: 'M3 删除仍被引用的 token',
    apply() {
      const s = read(TOKENS)
      write(TOKENS, s.replace(/^\s*--bg-page:\s*#f7f7f7;\s*$/m, '/* MUTATION-M3-REMOVED --bg-page */'))
    },
    restore() {},
    marker: 'saas-admin/src/styles/tokens.css',
  },
  {
    id: 'M4 改坏对比度',
    apply() {
      const s = read(TOKENS)
      write(TOKENS, s.replace('--text-secondary: #444444;', '--text-secondary: #999999;'))
    },
    restore() {},
    marker: 'saas-admin/src/styles/tokens.css',
  },
]

const results = []
for (const m of MUTATIONS) {
  const snap = { [APP]: read(APP), [TOKENS]: read(TOKENS), [COMPONENTS]: read(COMPONENTS) }
  let r
  try {
    m.apply()
    r = runSpec()
  } catch (e) {
    r = { failed: true, out: 'apply/run 异常: ' + String(e).slice(0, 120) }
  }
  // 无条件还原
  for (const [p, s] of Object.entries(snap)) write(p, s)
  const pass = r.failed // 变异后测试红 = 测试有分辨力
  results.push({ id: m.id, mutationCaught: pass, detail: r.failed ? r.out || '(测试失败)' : '测试仍绿 —— 无分辨力!' })
  console.log(`${pass ? '✅' : '❌'} ${m.id}`)
  console.log(`   ${results[results.length - 1].detail}`)
}

// 终验：还原后测试必须回到全绿
const final = runSpec()
console.log(`\n还原后契约测试: ${final.failed ? '❌ 仍红（还原失败！）' : '✅ 全绿'}`)
fs.writeFileSync(
  path.join(ROOT, 'saas-admin/tests/tools/mutation-report.json'),
  JSON.stringify({ at: new Date().toISOString(), mutations: results, restoredGreen: !final.failed }, null, 2),
  'utf8',
)
console.log('报告: saas-admin/tests/tools/mutation-report.json')
process.exit(final.failed || results.some((r) => !r.mutationCaught) ? 1 : 0)
