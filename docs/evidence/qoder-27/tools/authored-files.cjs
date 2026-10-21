/**
 * QODER-27「本卡到底写了哪些文件」的机读判据：
 * 对 main..HEAD 的每个改动文件，比较 HEAD 的 blob 是否等于 {main, 23F1, 24, 25F1, 26} 中任意一个的 blob；
 * 全不相等 ⇒ 该文件的内容是本卡产生（含 git 自动合并的并集形态），必须逐个人工交代。
 * 两处量具更正：
 *   ① `git diff --name-only` 会把含中文的路径 C 转义 ⇒ 必须 `-c core.quotepath=false` 且 `-z` 按 NUL 切；
 *   ② execSync 默认把子进程 stderr 透到父 stderr ⇒ 不存在的 blob 会刷一屏 fatal，需 stdio 静音。
 */
const cp = require('node:child_process')
const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const G = (a) =>
  cp.execSync(`git -C "${TREE}" ${a}`, { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] })
const REFS = { main: '7dda80b8', '23F1': '71b248c8', '24': 'dd44e321', '25F1': '317e421d', '26': '1b6da083' }

// 取 blob：用 ls-tree（路径不存在时输出空，不抛错），CJK 路径直接原样传（-c core.quotepath 只影响输出不影响输入）
const blobOf = (rev, path) => {
  const out = G(`ls-tree ${rev} -- ${JSON.stringify(path)}`).trim()
  const m = out.match(/^[0-9]+ blob ([0-9a-f]{40})\t/)
  return m ? m[1] : null
}

const files = G('diff --name-only -z 7dda80b8 HEAD').split('\0').filter(Boolean)
const code = files.filter((f) => !f.startsWith('docs/'))
const docs = files.filter((f) => f.startsWith('docs/'))
console.log(`main..HEAD 改动文件数=${files.length}（代码面 ${code.length}／docs 面 ${docs.length}）`)

const authored = []
const inherited = []
for (const f of code) {
  const mine = blobOf('HEAD', f)
  const same = Object.entries(REFS)
    .filter(([, r]) => blobOf(r, f) === mine)
    .map(([k]) => k)
  if (same.length === 0) authored.push(f)
  else inherited.push(`${f}  ← 与 ${same.join('/')} 同 blob（原样继承）`)
}
console.log(`\n代码面中「HEAD blob 与五个输入面全不同」= 本卡产生：${authored.length} 个`)
authored.forEach((f) => console.log(`  ${f}`))
console.log(`\n代码面中原样继承某个输入面的文件：${inherited.length} 个`)
inherited.forEach((l) => console.log(`  ${l}`))
console.log(`\nAUTHORED_CODE_FILES=${authored.length} INHERITED_CODE_FILES=${inherited.length}`)
