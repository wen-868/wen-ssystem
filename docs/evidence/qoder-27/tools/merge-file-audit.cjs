/**
 * QODER-27 合并文件审计：combined-diff 文件的"两侧新增行都在结果里"机械化
 * （为什么需要：crypto.ts 被 23F1 与 24 同时改，home.vue/products.vue 被 25F1 与 26 同时改，
 *   git 自动合并"成功"不等于"两侧改动都保住"——必须逐行回证。）
 */
const cp = require('node:child_process')
const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const G = (a) => cp.execSync(`git -C "${TREE}" ${a}`, { encoding: 'utf8', maxBuffer: 1 << 26 })
const show = (rev, path) => G(`show ${rev}:${path}`).split(/\r?\n/)
// ★ Windows 坑：execSync 走 cmd.exe，`^` 是 cmd 的转义符 ⇒ `git rev-parse 57ccbfe9^1` 会被吃成 `57ccbfe91`。
//   取父必须用 `log -1 --format=%P`，不要用 `^`/`~` 形态的 revision。
const parents = (m) => G(`log -1 --format=%P ${m}`).trim().split(/\s+/)

const MERGES = ['57ccbfe9', '8835d11c', '167979aa']
const added = (a, b) => {
  const bs = new Set(b)
  return a.filter((l) => l.trim() !== '' && !bs.has(l))
}

let bad = 0
for (const m of MERGES) {
  const [p1, p2] = parents(m)
  const mb = G(`merge-base ${p1} ${p2}`).trim()
  const files = G(`show --format= --name-only ${m}`)
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((f) => /\.(ts|vue)$/.test(f))
  console.log(`\n== merge ${m}（P1 ${p1.slice(0, 8)} = 收敛支, P2 ${p2.slice(0, 8)} = 来源支, merge-base ${mb.slice(0, 8)}）`)
  if (files.length === 0) console.log('   无 combined-diff 代码文件（只 gates-baseline.json）')
  for (const f of files) {
    const merged = show(m, f)
    const base = show(mb, f)
    const ms = new Set(merged)
    for (const [tag, p] of [['P1', p1], ['P2', p2]]) {
      const a = added(show(p, f), base)
      const miss = a.filter((l) => !ms.has(l))
      console.log(
        `   ${f.split('/').pop()} ${tag} 新增行=${a.length} 结果中缺失=${miss.length} ${miss.length ? '✗' : '✓'}`
      )
      if (miss.length) {
        bad++
        miss.slice(0, 5).forEach((l) => console.log(`        缺: ${JSON.stringify(l.trim().slice(0, 80))}`))
      }
    }
  }
}
console.log(`\nMERGED_FILE_AUDIT=${bad === 0 ? 'PASS' : 'FAIL'} missing=${bad}`)
process.exit(bad === 0 ? 0 : 1)
