/**
 * QODER-4（S3-239）· 三态原始输出装置
 *
 * 用途：不起 vue/uni 运行时，直接把**单一定义源**（permission-view-state.ts）与其消费方
 * （permission-gates.ts / function-menu.ts）用 esbuild 打成临时 ESM 后加载，逐态打印**原始输出**：
 *   · 三态契约：resolvePermissionViewState 在 ①/②/③/ready/无登录态 下的完整返回值；
 *   · 菜单端：最小可见集在兼容态口径下的真实渲染结果（filterGroupsByCodes，全量/空集双向对照）；
 *   · 入口端：isEntryVisible 在三态下对 gated / registered / pending-code / 未知 id 的显隐；
 *   · 注入点自检：生产路径的 policy 取值集合（'showAll' 必须不在其中）。
 *
 * 为什么打包：`permission-gates.ts` 现以相对路径无扩展名引 `permission-view-state`（Vite 口径），
 * Node 原生 `import('...ts')` 的类型剥离不解析无扩展名 specifier；证据装置必须加载**源码本体**
 * （不另写一套判定），故用仓内既有 esbuild 打临时包（与 S3-136-F1 grid.mjs 转译加载同一精神）。
 *
 * 用法（仓库根）：node docs/evidence/qoder-4/tools/tristate-raw-output.mjs
 */
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const SRC = join(REPO_ROOT, 'app-mobile', 'src', 'config')
const require = createRequire(join(REPO_ROOT, 'package.json'))
const esbuild = require('esbuild')

const outDir = mkdtempSync(join(tmpdir(), 'qoder4-'))
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  rmSync(outDir, { recursive: true, force: true })
  process.exit(1)
}

try {
  const build = await esbuild.build({
    entryPoints: ['permission-view-state.ts', 'permission-gates.ts', 'function-menu.ts'].map((f) =>
      join(SRC, f)
    ),
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: outDir,
    logLevel: 'silent',
  })
  if (build.errors?.length) fail(`esbuild 打包失败：${JSON.stringify(build.errors)}`)

  const view = await import(pathToFileURL(join(outDir, 'permission-view-state.js')).href)
  const gates = await import(pathToFileURL(join(outDir, 'permission-gates.js')).href)
  const fnMenu = await import(pathToFileURL(join(outDir, 'function-menu.js')).href)

  const line = (s) => console.log(s)
  line('═══ QODER-4 · S3-239 三态原始输出 ═══')
  line(`注册表规模：gated=${gates.GATED_ENTRY_IDS.length} registered=${gates.REGISTERED_ENTRY_IDS.length} pending-code=${gates.PENDING_CODE_ENTRY_IDS.length}`)
  const gatedId = gates.GATED_ENTRY_IDS[0]
  const registeredId = gates.REGISTERED_ENTRY_IDS[0]
  const pendingId = gates.PENDING_CODE_ENTRY_IDS[0]
  const gatedCodes = gates.ENTRY_GATE_BY_ID[gatedId].codes

  line('\n── 一、resolvePermissionViewState 逐态返回（原始 JSON）──')
  const cases = [
    ['① 加载中（有登录态，请求在途）', { hasSession: true, requestState: 'pending', permissions: null }],
    ['② 确实无码（成功返回空数组）', { hasSession: true, requestState: 'ok', permissions: [] }],
    ['③ 未取到（请求失败/超时）', { hasSession: true, requestState: 'failed', permissions: null }],
    ['③b 未取到（成功但缺字段/老缓存）', { hasSession: true, requestState: 'ok', permissions: undefined }],
    ['ready（持有非空码数组）', { hasSession: true, requestState: 'ok', permissions: ['sale:*'] }],
    ['无登录态（失败关闭）', { hasSession: false, requestState: 'pending', permissions: null }],
  ]
  const policiesSeen = new Set()
  for (const [label, input] of cases) {
    const r = view.resolvePermissionViewState(input)
    policiesSeen.add(r.policy)
    line(`${label}\n  => ${JSON.stringify(r)}`)
  }
  if (policiesSeen.has('showAll')) fail("注入点 showAll 出现在生产返回值集合中（不该发生）")
  line(`\n生产 policy 取值集合 = [${[...policiesSeen].sort().join(', ')}]（'showAll' 不在其中 = 反测注入点仅反测可达）`)

  line('\n── 二、菜单端 · 最小可见集在兼容态口径下的渲染 ──')
  const minimal = view.MINIMUM_VISIBLE_MENU_CODES
  const v = fnMenu.buildMenuVisibility(new Set(minimal))
  const rendered = fnMenu.filterGroupsByCodes(v, true).flatMap((g) => g.items.map((it) => it.code))
  const allCount = fnMenu.filterGroupsByCodes(null, true).flatMap((g) => g.items).length
  line(`MINIMUM_VISIBLE_MENU_CODES(${minimal.length}) = ${JSON.stringify(minimal)}`)
  line(`渲染可见页(${rendered.length}) = ${JSON.stringify(rendered.sort())}`)
  line(`对照：全量(null 放全量旧语义)=${allCount} 页 / 空集(失败关闭)=${fnMenu.filterGroupsByCodes(fnMenu.buildMenuVisibility(new Set()), true).length} 组`)
  line(`需码写页抽样：sale:bill 可见=${fnMenu.isPageVisible('sale:bill', v)}，goods:stock-check 可见=${fnMenu.isPageVisible('goods:stock-check', v)}`)
  if (rendered.length === 0) fail('最小可见集渲染为空（等于把 ①③ 做成失败关闭，反向于三态口径）')
  if (rendered.length === allCount) fail('最小可见集渲染成全量（红线：不得把最小可见集实现成全量放行）')

  line('\n── 三、入口端 · isEntryVisible 三态显隐 ──')
  for (const [label, q] of [
    ['①', { hasSession: true, requestState: 'pending', permissions: null }],
    ['②', { hasSession: true, requestState: 'ok', permissions: [] }],
    ['③', { hasSession: true, requestState: 'failed', permissions: null }],
    ['ready 持码', { hasSession: true, requestState: 'ok', permissions: gatedCodes }],
    ['ready 不持码', { hasSession: true, requestState: 'ok', permissions: ['nothing:match'] }],
  ]) {
    line(
      `${label}: gated=${gates.isEntryVisible(gatedId, q)} registered=${gates.isEntryVisible(registeredId, q)}` +
        ` pending-code=${gates.isEntryVisible(pendingId, q)} 未知id=${gates.isEntryVisible('__no_such_id__', q)}`
    )
  }
  line(`入口最小可见集 MINIMUM_VISIBLE_ENTRY_IDS = ${JSON.stringify(view.MINIMUM_VISIBLE_ENTRY_IDS)}（空集：gated 全是写入口，①③ 不放）`)
  line(`③ 提示文案 = ${JSON.stringify(view.PERMISSION_UNAVAILABLE_NOTICE)}（showNotice=${view.resolvePermissionViewState({ hasSession: true, requestState: 'failed', permissions: null }).showNotice}）`)

  line('\n✔ 原始输出完成（EXIT=0）')
} catch (e) {
  fail(`装置执行异常：${e && e.stack ? e.stack : e}`)
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
