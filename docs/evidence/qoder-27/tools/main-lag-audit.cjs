// QODER-27 收尾复算 3：main 侧落后度（前一笔脚本用 `; echo $?` 走 cmd.exe 被吃参数 ⇒ 改 try/catch 判 ancestor）
const { execSync } = require('node:child_process')
const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const G = (c) => execSync(`git -C "${TREE}" ${c}`, { encoding: 'utf8', maxBuffer: 1 << 26 })
const isAnc = (a, b) => {
  try { G(`merge-base --is-ancestor ${a} ${b}`); return true } catch { return false }
}
const countLines = (s) => (s.trim() === '' ? 0 : s.trim().split('\n').length)

console.log('## 祖先关系')
for (const [a, b] of [['21b465e5', 'bc1087ee'], ['bc1087ee', '7dda80b8'], ['21b465e5', '7dda80b8'], ['71b248c8', '167979aa'], ['dd44e321', '167979aa'], ['317e421d', '167979aa'], ['1b6da083', '167979aa'], ['7dda80b8', '167979aa'], ['bc1087ee', '167979aa']]) {
  console.log(`${a.slice(0, 8)} 是 ${b.slice(0, 8)} 的祖先 ? ${isAnc(a, b)}`)
}

console.log('\n## main 落后度（只读实测）')
console.log(`main 的 app-mobile/tests 文件数 : ${countLines(G('ls-tree -r --name-only 7dda80b8 app-mobile/tests'))}`)
console.log(`HEAD 的 app-mobile/tests 文件数 : ${countLines(G('ls-tree -r --name-only 167979aa app-mobile/tests'))}`)
console.log(`bc1087ee 的 app-mobile/tests 文件数 : ${countLines(G('ls-tree -r --name-only bc1087ee app-mobile/tests'))}`)
console.log(`git diff --numstat 21b465e5..7dda80b8 -- app-mobile 行数 : ${countLines(G('diff --numstat 21b465e5..7dda80b8 -- app-mobile'))}  (main 自 merge-base 起的自带 app-mobile 改动面)`)
console.log(`git diff --numstat bc1087ee..7dda80b8 -- app-mobile/scripts/gates-baseline.json :`)
console.log(G('diff --numstat bc1087ee..7dda80b8 -- app-mobile/scripts/gates-baseline.json').trim())
console.log(`git diff --numstat 7dda80b8..HEAD -- app-mobile/scripts/gates-baseline.json :`)
console.log(G('diff --numstat 7dda80b8..HEAD -- app-mobile/scripts/gates-baseline.json').trim())
console.log(`git diff --numstat bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json :`)
console.log(G('diff --numstat bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json').trim())

console.log('\n## main → HEAD 的 lint 段差异正文（谁改的，逐行）')
console.log(G('diff 7dda80b8..167979aa -- app-mobile/scripts/gates-baseline.json').replace(/^/gm, '  ').split('\n').slice(0, 40).join('\n'))
console.log('\nMAIN_LAG_AUDIT=DONE')
