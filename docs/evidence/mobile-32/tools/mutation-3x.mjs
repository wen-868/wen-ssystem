import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const AM = 'D:/Users/ZXQL/wt-agents/MOBILE-32/app-mobile'
const sha = (s) => createHash('sha256').update(s).digest('hex')
const run = () => {
  const r = spawnSync(process.execPath, [`${AM}/scripts/test-gate.mjs`], { cwd: AM, encoding: 'utf8', maxBuffer: 8 << 20 })
  const plain = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '')
  return { code: r.status, out: plain }
}

/**
 * 三条 mutation —— 注入点全部落在**被单测真实加载**的模块上：
 *  M1 删按钮门（页面接线层）：把 transfer.vue 的 gateCancel 绑定改成"恒可用"，
 *     由 `page-wiring.spec.ts` 静态断言（读源码）捕获 ⇒ 红。
 *  M2 null 改放行：button-gates.ts 的 codes 空 ⇒ 改为 allowed，由 button-gates.spec 捕获。
 *  M3 多按钮绑同码：transfer.vue 的 gateReceive 改绑 goods:edit，
 *     由 `page-wiring.spec.ts` 的"按钮独立性"断言捕获 ⇒ 红。
 */
const MUTATIONS = [
  {
    id: 'M1-删按钮门(页面接线)',
    file: `${AM}/src/pages-sub/finance/transfer/transfer.vue`,
    // 真删门：把 gate 常量替换成"恒可用"对象（等价于按钮不再预判权限）
    from: `const gateCancel = buttonGate(['store:transfer'])`,
    to: `const gateCancel = { value: { enabled: true, showHint: false, hint: '' } } /* MUTATION: 按钮门被摘掉 */`,
    expect: /页面接线|page-wiring|缺少 gateCancel|gateCancel/i,
  },
  {
    id: 'M2-null改放行(纯函数)',
    file: `${AM}/src/config/button-gates.ts`,
    from: `  if (!codes || codes.length === 0) {
    return deny('blocked', BUTTON_HINTS.blocked, 'codes-empty ⇒ 后端无确定权限码，禁用并引导联系管理员')
  }`,
    to: `  if (!codes || codes.length === 0) {
    return { status: 'allowed', enabled: true, showHint: false, hint: '', stale: false, reason: 'MUTATION' } as any
  }`,
    expect: /button-gates|blocked|allowed/i,
  },
  {
    id: 'M3-多按钮绑同码(页面接线)',
    file: `${AM}/src/pages-sub/finance/transfer/transfer.vue`,
    from: `const gateReceive = buttonGate(['store:transfer'])`,
    to: `const gateReceive = buttonGate(['store:transfer', 'goods:edit'])`,
    expect: /页面接线|page-wiring|gateReceive|独立性/i,
  },
]

const results = []
for (const m of MUTATIONS) {
  const orig = readFileSync(m.file, 'utf8')
  const before = sha(orig)
  if (!orig.includes(m.from)) { results.push({ id: m.id, ok: false, why: 'anchor not found' }); continue }
  writeFileSync(m.file, orig.replace(m.from, m.to), 'utf8')
  const red = run()
  writeFileSync(m.file, orig, 'utf8')
  const after = sha(readFileSync(m.file, 'utf8'))
  const green = run()
  results.push({
    id: m.id,
    ok: red.code !== 0 && green.code === 0 && before === after && m.expect.test(red.out),
    redCode: red.code, greenCode: green.code, shaEqual: before === after,
    tail: red.out.split('\n').filter((l) => /✗|FAIL|AssertionError|expected|页面接线|独立性/.test(l)).slice(0, 5),
  })
}

for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.id}  红EXIT=${r.redCode} 绿EXIT=${r.greenCode} SHA一致=${r.shaEqual}`)
  if (r.why) console.log('    ' + r.why)
  if (r.tail) r.tail.forEach((l) => console.log('    ' + l.trim()))
}
process.exit(results.every((r) => r.ok) ? 0 : 1)
