/**
 * QODER-27 卡 §二.3 合并后静态检查四项（只读源码，不写文件）
 * 1) 旧 custom-tab-bar 组件文件名/标签为 0
 * 2) aiMsg 为 reactive
 * 3) ProductInfo.id 与 skuId 分离
 * 4) IV/tag 双守卫在位
 * 附带：共同触碰文件（home.vue / products.vue）自动合并后两卡改动是否都还在
 */
const fs = require('node:fs')
const { execSync } = require('node:child_process')

const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const SRC = TREE + '/app-mobile/src/'
const read = (rel) => fs.readFileSync(SRC + rel, 'latin1')
/**
 * 取「代码视图」：注释行/行尾注释剥掉后再计数。
 * 口径对齐 app-mobile/scripts/check-contract.mjs 与本仓 tests/*.spec.ts 的 codeOf()：
 * 26 卡**故意把旧缺陷字面量写进注释作根因留痕**（products.ts:274 就在块注释里），
 * 连注释一起扫会自撞红；注入到真代码里照样红（由 raw/41 反测证）。
 */
const codeOf = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\/\/|\*|\/\*|<!--|import\b)/.test(line))
    .map((line) => line.replace(/\/\/[^'"`]*$/, '').replace(/<!--.*?-->/g, ''))
    .join('\n')
const lines = (t) => t.split(/\r?\n/)
const findLine = (t, needle) => {
  const i = lines(t).findIndex((l) => l.includes(needle))
  return i === -1 ? 0 : i + 1
}
/** 同上但只在 fromLine（含）之后找——加密侧有同名语句，全局首次命中会落到 encrypt() 里 */
const findLineFrom = (t, needle, fromLine) => {
  const ls = lines(t)
  for (let i = Math.max(0, fromLine - 1); i < ls.length; i++) if (ls[i].includes(needle)) return i + 1
  return 0
}
/** 只认代码行：23F1 把 `j0.set(iv)` 的字面写进了 :612 的根因注释，全局首命中会落到注释上 */
const findCodeLineFrom = (t, needle, fromLine) => {
  const ls = lines(t)
  for (let i = Math.max(0, fromLine - 1); i < ls.length; i++) {
    if (/^\s*(?:\/\/|\*|\/\*)/.test(ls[i])) continue
    if (ls[i].includes(needle)) return i + 1
  }
  return 0
}
// Windows 下 execSync 走 cmd.exe，JSON.stringify 的双引号不会反转义反斜杠 ⇒
// 带 \. 的正则会原样进 rg 并报 parse error。全部改用 -F -e（固定串），需要"或"就多传几个 -e。
const rg = (patterns, glob, dir = 'src') => {
  const arr = Array.isArray(patterns) ? patterns : [patterns]
  // -F 是布尔开关（fixed-strings），模式必须逐个用 -e 传，否则第二个 -e 后的串被当路径
  const args = arr.map((p) => `-e ${JSON.stringify(p)}`).join(' ')
  try {
    const out = execSync(`rg --no-heading -n -F ${args} ${dir} ${glob ? '--glob ' + JSON.stringify(glob) : ''}`, {
      cwd: TREE + '/app-mobile',
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    })
    return out.trim() ? out.trim().split(/\r?\n/) : []
  } catch (e) {
    // rg EXIT=1 = 0 命中（正面结果），其它异常才算量具坏
    if (e.status === 1) return []
    console.log(`RG_TOOL_ERROR ${JSON.stringify(arr)} status=${e.status} msg=${e.message}`)
    process.exit(2)
  }
}

let fail = 0
const T = (name, pass, detail) => {
  console.log(`${pass ? '✓' : '✗'} ${name} :: ${detail}`)
  if (!pass) fail++
}

/* ── 1 · 旧 custom-tab-bar 组件文件名 / 标签为 0 ───────────────────────── */
const tabFiles = execSync(`git -C "${TREE}" ls-files app-mobile`, { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((p) => /custom-tab-bar/i.test(p))
T('1a 文件名含 custom-tab-bar 的在册文件', tabFiles.length === 0, `count=${tabFiles.length} ${JSON.stringify(tabFiles)}`)

const tagHits = rg('<custom-tab-bar', '*.vue')
T('1b `<custom-tab-bar` 标签命中', tagHits.length === 0, `count=${tagHits.length} ${JSON.stringify(tagHits)}`)
const importHits = rg(['CustomTabBar', 'custom-tab-bar.vue'], '*.vue')
T('1c CustomTabBar 标识符/导入命中', importHits.length === 0, `count=${importHits.length} ${JSON.stringify(importHits)}`)

const appTabBarExists = fs.existsSync(SRC + 'components/app-tab-bar.vue')
const mountHits = rg('<app-tab-bar', '*.vue')
T('1d 新组件在册且被挂载', appTabBarExists && mountHits.length === 5, `app-tab-bar.vue=${appTabBarExists} mounts=${mountHits.length}`)
mountHits.forEach((h) => console.log(`     ${h}`))
// 允许的残留：组件自身根节点的 CSS 类名（不是组件标签/文件名）
const cssResidual = rg('class="custom-tab-bar"', '*.vue')
console.log(`   ℹ 允许残留（CSS 类名，非组件名）count=${cssResidual.length}: ${JSON.stringify(cssResidual)}`)

/* ── 2 · aiMsg 为 reactive ─────────────────────────────────────────────── */
const ai = read('pages/ai-chat/ai-chat.vue')
const reactLine = findLine(ai, 'const aiMsg = reactive<ChatMessage>(')
const pushLine = findLine(ai, 'messages.value.push(aiMsg)')
// 负向靶必须是 25F1 真正修掉的那个形态：`const aiMsg: ChatMessage = {…}` 裸字面量 ⇒ 回调写原始对象。
// 用户消息 `messages.value.push({ id: nextId(), role: 'user', … })`（:626，旧形态同在 :542）
// 是一次性写入、后续无人持引用改它 ⇒ 合法，不是缺陷；把它当靶是我量具口径过宽（首轮实测 2c 即因此假红）。
const oldRawLiteral = rg('const aiMsg: ChatMessage = {', '*.vue')
T('2a aiMsg 以 reactive 构造', reactLine > 0, `ai-chat.vue:${reactLine}`)
T('2b push 的是 reactive 代理对象', pushLine > 0 && pushLine > reactLine && reactLine > 0, `reactive@${reactLine} push@${pushLine}`)
T('2c 旧"裸字面量 aiMsg"形态归零', oldRawLiteral.length === 0, `count=${oldRawLiteral.length} ${JSON.stringify(oldRawLiteral)}`)

/* ── 3 · ProductInfo.id 与 skuId 分离 ──────────────────────────────────── */
const products = read('api/modules/products.ts')
const productsCode = codeOf(products)
const skuIdSource = findLine(products, 'const skuId = toNumericId(r.skuId)')
const idFromSku = findLine(products, '      id: skuId,')
const spuField = /spuId,\r?\n\s*skuId,/.test(products)
const oldSpuTop = productsCode.split('id: r.spuId ?? r.id').length - 1
const oldCodeMix = productsCode.split('skuId: r.skuId ?? r.skuCode').length - 1
const oldMerge = productsCode.split('merged.set(').length - 1
T('3a SKU 行主键来源在位', skuIdSource > 0, `products.ts:${skuIdSource}`)
T('3b id 取自 skuId（与 skuId 分离于 SPU）', idFromSku > 0, `products.ts:${idFromSku}`)
T('3c spuId 与 skuId 两字段并列在册', spuField, 'regex /spuId,\\n\\s*skuId,/')
T('3d 旧缺陷字面量在代码视图归零', oldSpuTop === 0 && oldCodeMix === 0 && oldMerge === 0, `spuTop=${oldSpuTop} codeMix=${oldCodeMix} mergedSet=${oldMerge}`)
console.log(
  `   ℹ 全文口径对照（含注释，26 卡刻意留的根因痕）：spuTop=${products.split('id: r.spuId ?? r.id').length - 1}` +
    ` codeMix=${products.split('skuId: r.skuId ?? r.skuCode').length - 1} mergedSet=${products.split('merged.set(').length - 1}`
)
const guards = ['export function assertSkuId', 'export function assertSpuId', 'export function skuIdOfProduct']
  .map((g) => `${g.split(' ').pop()}@${findLine(products, g)}`)
T('3e SKU/SPU 双守卫三件套在位', guards.every((g) => !g.endsWith('@0')), guards.join(' '))

/* ── 4 · IV / tag 双守卫在位 ───────────────────────────────────────────── */
const crypto = read('utils/crypto.ts')
const gcmFn = findLine(crypto, 'function aesGcmDecrypt(')
const ivGuard = findCodeLineFrom(crypto, 'if (iv.length !== 12) return null', gcmFn)
const tagGuard = findCodeLineFrom(crypto, 'if (tag.length !== 16) return null', gcmFn)
// 签名是多行 `function aesGcmDecrypt(` 直到 :~617 才闭合，"首条语句"不能用 fnLine+1 判；
// 且 aesKeyExpansion / j0.set(iv) 在 encrypt 侧同名、又在 23F1 的根因注释里同形 ⇒ 必须限定"函数体内 + 非注释行"。
const keyExpand = findCodeLineFrom(crypto, 'aesKeyExpansion(key)', gcmFn)
const j0Set = findCodeLineFrom(crypto, 'j0.set(iv)', gcmFn)
const j0Build = findCodeLineFrom(crypto, 'const j0 = new Uint8Array(16)', gcmFn)
T('4a IV 长度守卫在位', ivGuard > 0, `crypto.ts:${ivGuard}（aesGcmDecrypt 起于 ${gcmFn}）`)
T('4b tag 长度守卫在位', tagGuard > 0, `crypto.ts:${tagGuard}`)
T('4c IV 守卫早于密钥扩展与 J0 构造（不靠 set 的巧合行为）', ivGuard > 0 && keyExpand > ivGuard && j0Build > ivGuard && j0Set > ivGuard, `iv@${ivGuard} < keyExpand@${keyExpand} / j0声明@${j0Build} < j0.set@${j0Set}`)
T('4d IV 守卫早于 tag 守卫', ivGuard > 0 && tagGuard > 0 && ivGuard < tagGuard, `iv@${ivGuard} < tag@${tagGuard}`)

/* ── 5 · 共同触碰文件自动合并后两卡改动都在 ───────────────────────────── */
const home = read('pages/home/home.vue')
T('5a home.vue 同时含 25F1 tabBar 挂载 与 26 spuId 深链', /<app-tab-bar/.test(home) && home.includes('product-detail?id=${matched.spuId}'), `tabBar=${/<app-tab-bar/.test(home)} spuIdDeepLink=${home.includes('product-detail?id=${matched.spuId}')}`)
const pl = read('pages/products/products.vue')
T('5b products.vue 同时含 25F1 tabBar 挂载 与 26 :key/详情维度', /<app-tab-bar/.test(pl) && pl.includes(':key="item.id"') && pl.includes('@tap="goDetail(item.spuId)"'), `tabBar=${/<app-tab-bar/.test(pl)} key=${pl.includes(':key="item.id"')} detail=${pl.includes('@tap="goDetail(item.spuId)"')}`)
const oldHome = home.includes('product-detail?id=${matched.id}')
const oldPl = pl.includes('@tap="goDetail(item.id)"')
T('5c 旧维度写法未被"合并覆盖"复活', !oldHome && !oldPl, `homeOld=${oldHome} productsOld=${oldPl}`)

console.log(`STATIC_CHECK=${fail === 0 ? 'PASS' : 'FAIL'} failures=${fail}`)
process.exit(fail === 0 ? 0 : 1)
