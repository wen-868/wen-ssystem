/**
 * C6-3-0 页面级反测（最小运行时，B 级证据）
 *
 * 沙箱限制：esbuild/浏览器进程被拒（spawn EPERM）⇒ vite build / Playwright 不可用。
 * 本 harness 用「真实源码」在 jsdom 里跑页面：
 *   · 真实 .vue（@vue/compiler-sfc + typescript 编译）
 *   · 真实 saas-admin/src/api.ts（axios 实例 + 拦截器）与 utils/http-error.ts
 *   · 仅替换 'axios'（注入自定义 adapter，仍走真实 axios 拦截器链）、'element-plus'、'echarts' 三个模块
 * 断言：给定端点返回 404 / 空集时，页面呈现后端业务文案 / 诚实空态，而非静默成功或假数据。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

const ROOT = path.resolve(process.argv[2] ?? '.')
/** 生成物一律落在系统临时目录，不污染仓库工作树 */
const GEN = path.join(os.tmpdir(), 'c630-reverse-test-gen')
/** 生成物在临时目录 ⇒ 裸包名必须改写为绝对 URL（否则 Node 从 tmp 起找不到 node_modules） */
const BARE_URLS = {
  vue: pathToFileURL(path.join(ROOT, 'node_modules/vue/dist/vue.runtime.esm-bundler.js')).href,
  'vue-router': pathToFileURL(path.join(ROOT, 'node_modules/vue-router/dist/vue-router.mjs')).href,
}
fs.rmSync(GEN, { recursive: true, force: true })
fs.mkdirSync(GEN, { recursive: true })

const messages = []
const state = { handler: null, calls: [] }
globalThis.__C630__ = { messages, state }

/* ── 桩模块 ── */
const stubs = {
  'stub-element.mjs': [
    'const rec = (level, m) => globalThis.__C630__.messages.push({ level, message: String(m) });',
    'export const ElMessage = {',
    "  error: (m) => rec('error', m), success: (m) => rec('success', m),",
    "  info: (m) => rec('info', m), warning: (m) => rec('warning', m),",
    '};',
    'export const ElMessageBox = {',
    "  prompt: async () => ({ value: 'harness-reply-content' }),",
    "  confirm: async () => 'confirm',",
    '};',
    'export default { ElMessage, ElMessageBox };',
  ].join('\n'),
  'stub-icons.mjs': [
    "const icon = { name: 'StubIcon', render: () => null };",
    'export const Download = icon; export const Loading = icon;',
    'export default new Proxy({}, { get: () => icon });',
  ].join('\n'),
  'stub-echarts.mjs': [
    'const chart = { setOption: () => {}, resize: () => {}, dispose: () => {} };',
    'export const init = () => chart;',
    'export default { init };',
  ].join('\n'),
  'stub-axios.mjs': [
    `import realAxios from '${pathToFileURL(path.join(ROOT, 'node_modules/axios/index.js')).href}';`,
    'const adapter = async (config) => {',
    '  const h = globalThis.__C630__.state.handler;',
    "  if (!h) throw new Error('no adapter handler');",
    '  return h(config);',
    '};',
    'export default { create: (cfg = {}) => realAxios.create({ ...cfg, adapter }) };',
  ].join('\n'),
}
for (const [name, code] of Object.entries(stubs)) fs.writeFileSync(path.join(GEN, name), code, 'utf8')

/* ── 编译：SFC / TS → 可直接 import 的 ESM ── */
const emitted = new Map()
function outName(absFile) {
  return absFile.replace(ROOT, '').replace(/[\\/]/g, '_').replace(/^_/, '') + '.mjs'
}
/** 相对路径解析：'./api' 可能是 api.ts / api/index.ts / api.vue，逐个试（Node ESM 不含扩展名解析） */
function resolveRelative(absDir, spec) {
  const base = path.resolve(absDir, spec)
  for (const cand of [base, base + '.ts', base + '.js', path.join(base, 'index.ts'), path.join(base, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
  }
  throw new Error(`无法解析相对导入：${spec}（base=${base}）`)
}
function emit(absFile) {
  if (emitted.has(absFile)) return emitted.get(absFile)
  const name = outName(absFile)
  emitted.set(absFile, name)
  let code
  if (absFile.endsWith('.vue')) {
    const source = fs.readFileSync(absFile, 'utf8')
    const { descriptor, errors } = parse(source, { filename: absFile })
    if (errors.length) throw new Error(`SFC parse error: ${errors[0].message}`)
    code = compileScript(descriptor, { id: name, inlineTemplate: true }).content
  } else {
    code = fs.readFileSync(absFile, 'utf8')
  }
  const js = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      useDefineForClassFields: false,
      jsx: ts.JsxEmit.Preserve,
    },
    fileName: absFile,
  }).outputText
  const fixed = js
    .replace(/(from\s*|import\s*)(['"])([^'"]+)\2/g, (all, kw, q, spec) => {
      let out = spec
      if (spec === 'element-plus') out = './stub-element.mjs'
      else if (spec === '@element-plus/icons-vue') out = './stub-icons.mjs'
      else if (spec === 'echarts') out = './stub-echarts.mjs'
      else if (spec === 'axios') out = './stub-axios.mjs'
      else if (BARE_URLS[spec]) out = BARE_URLS[spec]
      else if (spec.startsWith('.')) out = './' + emit(resolveRelative(path.dirname(absFile), spec))
      return `${kw}${q}${out}${q}`
    })
    // api.ts 读 import.meta.env（Node 下为 undefined）⇒ 注入空环境
    .replace(/import\.meta\.env/g, '(globalThis.__C630_ENV__ || {})')
  fs.writeFileSync(path.join(GEN, name), fixed, 'utf8')
  return name
}

/* ── 浏览器环境 ── */
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost:5174/',
})
const w = dom.window
const gl = {
  window: w, document: w.document, HTMLElement: w.HTMLElement, Element: w.Element,
  SVGElement: w.SVGElement, Node: w.Node, MouseEvent: w.MouseEvent, Event: w.Event,
  CustomEvent: w.CustomEvent, localStorage: w.localStorage, DOMParser: w.DOMParser,
  getComputedStyle: w.getComputedStyle.bind(w),
}
for (const [k, v] of Object.entries(gl)) Object.defineProperty(globalThis, k, { value: v, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true })
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
w.localStorage.setItem('platform_token', 'harness-token')

const vueUrl = pathToFileURL(path.join(ROOT, 'node_modules/vue/dist/vue.runtime.esm-bundler.js')).href
const { createApp } = await import(vueUrl)

/* ── 断言工具 ── */
const results = []
function check(label, okFlag, detail = '') {
  results.push({ label, ok: okFlag })
  console.log(`${okFlag ? 'PASS' : 'FAIL'} · ${label}${detail ? ' · ' + detail : ''}`)
}
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms))
const bodyText = () => w.document.body.textContent.replace(/\s+/g, ' ')
const errors = () => messages.filter((m) => m.level === 'error').map((m) => m.message)
const successes = () => messages.filter((m) => m.level === 'success').map((m) => m.message)
function clickText(txt) {
  const hit = [...w.document.querySelectorAll('span,div,button')].find((el) => el.textContent.trim() === txt)
  if (!hit) throw new Error(`未找到可点击元素：${txt}`)
  hit.dispatchEvent(new w.MouseEvent('click', { bubbles: true }))
  return hit
}
const okRes = (data) => ({ data: { code: '0', msg: '成功', data }, status: 200, statusText: 'OK', headers: {}, config: {} })
function httpError(status, body) {
  const err = new Error(`Request failed with status code ${status}`)
  err.response = { status, data: body, statusText: '', headers: {}, config: {} }
  err.isAxiosError = true
  return err
}
async function mount(vueRelPath) {
  const name = emit(path.join(ROOT, vueRelPath))
  const mod = await import(pathToFileURL(path.join(GEN, name)).href + `?t=${Date.now()}`)
  w.document.body.innerHTML = '<div id="app"></div>'
  const app = createApp(mod.default)
  app.config.warnHandler = () => {}
  app.mount(w.document.getElementById('app'))
  await wait(120)
  return app
}

const DASHBOARD = 'saas-admin/src/views/Dashboard.vue'
const ADMINS = 'saas-admin/src/views/platform/AdminPermissions.vue'
const TICKETS = 'saas-admin/src/views/ops/TicketSystem.vue'
const SETTINGS = 'saas-admin/src/views/Settings.vue'

/* ═══ 反测 ①：下载端点 404 ⇒ 必须给出后端业务文案，而不是静默成功 ═══ */
{
  const MSG = '导出文件尚未生成（生成器待接入）'
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.endsWith('/download')) {
      throw httpError(404, { code: '404', msg: MSG, traceId: 'harness' })
    }
    if (config.url.includes('/platform/dashboard/overview')) return okRes({})
    if (config.url.endsWith('/platform/reports/export')) {
      return okRes({ total: 1, page: 1, pageSize: 20, records: [
        { id: 9, taskNo: 'EXP202609270001', exportType: 'tenantFinance', period: '本月', format: 'XLSX',
          status: 'PENDING', progress: 0, fileUrl: null, fileSize: null, errorMessage: null,
          createdAt: '2026-09-27T10:00:00.000Z', startedAt: null, finishedAt: null },
      ] })
    }
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(DASHBOARD)
  check('①-a 列表渲染出真实任务行（taskNo/period 非假数据）', bodyText().includes('EXP202609270001') && bodyText().includes('本月'))
  clickText('下载')
  await wait(120)
  check('①-b 404 业务文案原样出现在内容区', bodyText().includes(MSG), MSG)
  check('①-c 404 业务文案原样出现在提示通道（拦截器）', errors().includes(MSG), JSON.stringify(errors()))
  check('①-d 未出现任何成功提示（无"假成功"）', successes().length === 0, JSON.stringify(successes()))
}

/* ═══ 反测 ②：空集 ⇒ 诚实空态，不补假数据 ═══ */
{
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.includes('/platform/dashboard/overview')) return okRes({})
    if (config.url.endsWith('/platform/reports/export')) {
      return okRes({ total: 0, page: 1, pageSize: 20, records: [] })
    }
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(DASHBOARD)
  const rows = w.document.querySelectorAll('.export-tbl tbody tr').length
  check('②-a 导出任务空集 ⇒ 单行空态、无假记录', rows === 1 && bodyText().includes('暂无导出任务'), `rows=${rows}`)
  check('②-b 页面无旧文案"导出记录将在接口对接后展示"', !bodyText().includes('导出记录将在接口对接后展示'))
}

/* ═══ 反测 ③：管理权限页 —— 目录/管理员/角色空集 ⇒ 空态；角色矩阵按目录渲染 ═══ */
{
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.endsWith('/platform/admins')) return okRes({ total: 0, page: 1, pageSize: 50, records: [] })
    if (config.url.endsWith('/platform/admins/roles')) return okRes({ roles: [] })
    if (config.url.endsWith('/platform/permissions/catalog')) return okRes({ modules: [] })
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(ADMINS)
  check('③-a 管理员空集 ⇒ 暂无管理员账号', bodyText().includes('暂无管理员账号'))
  check('③-b 角色空集 ⇒ 暂无角色', bodyText().includes('暂无角色'))
  check('③-c 目录空集 ⇒ 明确空态（不内置兜底清单）', bodyText().includes('权限点目录未加载'))
  check('③-d 目录空集时不再出现写死的 7 个功能域', !bodyText().includes('AI 能力管控'))
}

/* ═══ 反测 ④：工单看板空集 + 报表 definitionPending ⇒ 空态/口径待定义 ═══ */
{
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.endsWith('/platform/support/ticket-categories')) return okRes({ categories: [] })
    if (config.url.endsWith('/platform/support/tickets')) {
      return okRes({ groups: { pending: [], processing: [], resolved: [] }, summary: { pending: 0, processing: 0, resolved: 0, closed: 0 } })
    }
    if (config.url.endsWith('/platform/support/tickets/report')) {
      return okRes({ items: [], definitionPending: true })
    }
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(TICKETS)
  const kmpties = (bodyText().match(/暂无工单/g) || []).length
  check('④-a 三列看板空集 ⇒ 三处"暂无工单"', kmpties === 3, `count=${kmpties}`)
  check('④-b 页头四指标无数据源 ⇒ 显示 —（不造数）', bodyText().includes('今日新增 —'))
  clickText('服务报表')
  await wait(150)
  check('④-c definitionPending ⇒ 显式"口径待定义"提示', bodyText().includes('报表口径待定义') && bodyText().includes('暂无报表数据（口径待定义）'))
}

/* ═══ 反测 ⑤：矩阵 PUT 被后端 400 拒绝 ⇒ 原样提示、不吞错 ═══ */
{
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.endsWith('/platform/admins')) return okRes({ total: 0, page: 1, pageSize: 50, records: [] })
    if (config.url.endsWith('/platform/admins/roles')) {
      return okRes({ roles: [{ id: 3, name: '客服组', code: 'cs', type: 'custom', domainCount: 1 }] })
    }
    if (config.url.endsWith('/platform/permissions/catalog')) {
      return okRes({ modules: [
        { moduleCode: 'tenant', moduleName: '租户管理', permissions: [{ permCode: 'tenant:view', permName: '查看租户管理', permLevel: 'MENU' }] },
        { moduleCode: 'common', moduleName: '数据范围档位', permissions: [{ permCode: 'scope:all', permName: '全部租户', permLevel: 'DATA' }] },
      ] })
    }
    if (config.url.endsWith('/platform/roles/3/permissions') && config.method === 'get') {
      return okRes({ roleId: 3, matrix: [{ moduleCode: 'tenant', canMenu: true, canPageBtn: false, dataScope: '' }] })
    }
    if (config.url.endsWith('/platform/roles/3/permissions') && config.method === 'put') {
      throw httpError(400, { code: '400', msg: '数据范围不在 4 档内：全部租户X', traceId: 'harness' })
    }
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(ADMINS)
  check('⑤-a 角色列表与目录来自接口（1 个域行）', bodyText().includes('客服组') && bodyText().includes('租户管理'))
  clickText('客服组')
  await wait(120)
  check('⑤-b 选中角色后回显已保存矩阵（菜单已勾选）', !!w.document.querySelector('.ck.on'))
  clickText('保存权限矩阵')
  await wait(150)
  check('⑤-c PUT 400 ⇒ 页面原样显示后端文案', bodyText().includes('数据范围不在 4 档内'), errors().join('|'))
}

/* ═══ 反测 ⑥：Logo 上传两步 ⇒ 先 POST /config/logo 取 URL，再 PUT /config/sys-config 持久化 ═══ */
{
  let putBody = null
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.endsWith('/platform/config/sys-config') && config.method === 'get') {
      return okRes({ platformName: '智享全链', servicePhone: '400-000-0000', switches: null, channels: null, _unconfigured: ['switches'] })
    }
    if (config.url.endsWith('/platform/config/logo') && config.method === 'post') {
      return okRes({ url: 'http://localhost:5174/uploads/platform-logo/x.png', path: '/uploads/platform-logo/x.png', persisted: false, persistedNote: '需另存' })
    }
    if (config.url.endsWith('/platform/config/sys-config') && config.method === 'put') {
      putBody = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      return okRes({ updated: true })
    }
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(SETTINGS)
  const inputs = [...w.document.querySelectorAll('input')].map((i) => i.value)
  check('⑥-a 系统配置加载（后端真实字段回显到输入框）', inputs.includes('智享全链'), JSON.stringify(inputs))
  const input = w.document.querySelector('.logo-file')
  const file = new w.File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new w.Event('change', { bubbles: true }))
  await wait(200)
  check('⑥-b 上传后 PUT sys-config 带 logoUrl 整包提交', !!putBody && putBody.logoUrl === 'http://localhost:5174/uploads/platform-logo/x.png', JSON.stringify(putBody))
  check('⑥-c 持久化包保留页面其它真实字段（platformName）', !!putBody && putBody.platformName === '智享全链')
  check('⑥-d 只读元字段 _unconfigured 未回写', !!putBody && !('_unconfigured' in putBody))
  check('⑥-e 徽标区渲染上传后的 Logo <img>', !!w.document.querySelector('.logo-img'))
}

/* ═══ 反测 ⑦：工单写路径（详情/时间线/公开回复）⇒ 真实 POST 并刷新 ═══ */
{
  let replyBody = null
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.endsWith('/platform/support/ticket-categories')) {
      return okRes({ categories: [{ id: 1, name: '故障排查', slug: 'fault', slaHours: 2, sortNo: 1, enabled: true }] })
    }
    if (config.url.endsWith('/platform/support/tickets')) {
      const card = { id: 1, ticketNo: 'TK202609270001', tenantId: 'T-001', categoryId: 1, title: '登录偶发失败',
        priority: 'HIGH', status: 'PENDING', assigneeId: null,
        createdAt: '2026-09-27T09:00:00.000Z', updatedAt: '2026-09-27T09:00:00.000Z' }
      return okRes({ groups: { pending: [card], processing: [], resolved: [] }, summary: { pending: 1, processing: 0, resolved: 0, closed: 0 } })
    }
    if (config.url.endsWith('/platform/support/tickets/1')) {
      return okRes({ id: 1, ticketNo: 'TK202609270001', tenantId: 'T-001', categoryId: 1, title: '登录偶发失败',
        priority: 'HIGH', status: 'PENDING', assigneeId: null, description: '租户反馈高峰期登录偶发失败',
        createdAt: '2026-09-27T09:00:00.000Z', updatedAt: '2026-09-27T09:00:00.000Z', resolvedAt: null, closedAt: null })
    }
    if (config.url.endsWith('/platform/support/tickets/1/timeline')) {
      return okRes({ items: [{ id: 5, senderType: 'PLATFORM', senderName: '何斌', bubbleType: 'INTERNAL', content: '内部定位中', createdAt: '2026-09-27T09:30:00.000Z' }] })
    }
    if (config.url.endsWith('/platform/support/tickets/1/reply') && config.method === 'post') {
      replyBody = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      return okRes({ id: 1, messageId: 6, status: 'PROCESSING' })
    }
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(TICKETS)
  check('⑦-a 分类字典命中 ⇒ 卡片显示类型名', bodyText().includes('故障排查'))
  check('⑦-b 真实优先级显示（priority=HIGH）', bodyText().includes('HIGH'))
  w.document.querySelector('.kcard').dispatchEvent(new w.MouseEvent('click', { bubbles: true }))
  await wait(200)
  check('⑦-c 详情抽屉取到问题描述', bodyText().includes('租户反馈高峰期登录偶发失败'))
  check('⑦-d 时间线渲染内部备注并标注租户不可见', bodyText().includes('内部定位中') && bodyText().includes('内部备注（租户不可见）'))
  check('⑦-e SLA 无数据源 ⇒ 诚实文案且无进度条', bodyText().includes('SLA 口径待定义') && !w.document.querySelector('.sla'))
  clickText('回复租户')
  await wait(220)
  check('⑦-f 公开回复真实 POST（带内容）', !!replyBody && replyBody.content === 'harness-reply-content', JSON.stringify(replyBody))
  check('⑦-g 回复成功后给出成功提示', successes().includes('已回复租户'), JSON.stringify(successes()))
}

/* ═══ 反测 ⑧：创建导出任务的格式映射与"后端不支持就不发请求"的诚实拦截 ═══ */
{
  let createBody = null
  let createCalls = 0
  state.handler = async (config) => {
    state.calls.push(`${config.method} ${config.url}`)
    if (config.url.includes('/platform/dashboard/overview')) return okRes({})
    if (config.url.endsWith('/platform/reports/export') && config.method === 'post') {
      createCalls += 1
      createBody = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      return okRes({ id: 11, taskNo: 'EXP202609270011', status: 'PENDING' })
    }
    if (config.url.endsWith('/platform/reports/export')) {
      return okRes({ total: 0, page: 1, pageSize: 20, records: [] })
    }
    return httpError(404, { code: '404', msg: 'harness: 未登记的端点' })
  }
  await mount(DASHBOARD)
  clickText('导出所选报表')
  await wait(200)
  check('⑧-a Excel ⇒ POST format=XLSX（后端枚举内）', !!createBody && createBody.format === 'XLSX', JSON.stringify(createBody))
  check('⑧-b 周期与报表类型按页面选择提交', !!createBody && createBody.period === '本月' && createBody.exportType === 'tenantFinance')
  check('⑧-c 创建成功提示带真实 taskNo', successes().some((m) => m.includes('EXP202609270011')), JSON.stringify(successes()))
  clickText('PDF')
  await wait(120)
  clickText('导出所选报表')
  await wait(150)
  check('⑧-d PDF 无后端枚举 ⇒ 不发请求 + 如实提示', createCalls === 1 && messages.some((m) => m.level === 'warning' && m.message.includes('PDF')), `createCalls=${createCalls}`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n—— 合计 ${results.length} 项，FAIL ${failed.length} 项`)
process.exit(failed.length ? 1 : 0)
