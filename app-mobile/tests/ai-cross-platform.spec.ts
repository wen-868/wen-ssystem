/**
 * QODER-25 · AI Chat 三端条件编译与自绘 tabBar 的**静态配对守卫**
 *
 * 守的是"平台边界必须是真的"这一条红线（任务书 §四），共九组判据：
 *  G1 图片读取按端分派：`uni.getFileSystemManager` / `wx.env` 只允许出现在
 *     `#ifdef MP-WEIXIN` 块内。App 端若被注回 `#ifndef H5` 或直接写进
 *     `#ifdef APP-PLUS`，本条即红（R96-04 与本卡 §一 的同一病灶）。
 *  G2 中止模型按端收口：`AbortController` 只允许出现在 `#ifdef H5` 块内。
 *     非 H5 端注回 `new AbortController()` ⇒ 红。
 *  G3 小程序不得调用只有 H5/APP 实现的 `speakSystem`：每个调用点必须落在
 *     `#ifdef H5` 或 `#ifdef APP-PLUS` 内。
 *  G4 小程序播报失败必须有确定行为：`notifyMpSpeakUnsupported` 既要定义在
 *     `#ifdef MP-WEIXIN` 内，也要在该块内被真实调用。
 *  G5 App 端必须有 `plus.io` 读图分支（`#ifdef APP-PLUS` 内的 resolveLocalFileSystemURL）。
 *  G6 自绘栏必须挂到 AI 页（模板标签 + 组件导入两处都在）。
 *  G7 原生 tabBar 隐藏口径必须是 `#ifndef MP-WEIXIN`（只盖 APP-PLUS ⇒ H5 双栏 ⇒ 红），
 *     custom-tab-bar.vue 与 App.vue 两个兜底点都守。
 *  G8 非 H5 的取消必须落到真实 API：`ai.ts` 的降级实现里要持有 RequestTask 并调 `abort()`，
 *     且 `streamChat` 要把 `registerCancel` 透传进去（否则"停止"只是 UI）。
 *  G9 红线自证：`ai-chat.vue` / `ai.ts` 里不得用 `typeof uni.` / `typeof wx` / `typeof plus`
 *     这类探测吞掉平台错配。
 *
 * 求值时机：全部静态事实在**模块加载期（import 阶段）**读文件并算好，用例体内只做常数比较。
 * 扫源码写进 `it` 体内会吃掉 vitest 默认 5000 ms 用例超时的大半预算，在并发负载下随机假红
 * （同类踩坑见 tests/pin-ssl-static.spec.ts 文件头说明）。
 *
 * 反测（须能红，逐条对应判据编号）：
 *  ① 把 `const fs = uni.getFileSystemManager()` 注回 `#ifndef H5` 块 ⇒ 红，点名 G1；
 *  ② 把 `abortController = new AbortController()` 改成无条件（移出 `#ifdef H5`）⇒ 红，点名 G2；
 *  ③ 把小程序兜底 `notifyMpSpeakUnsupported()` 换回 `speakSystem(clean)` ⇒ 红，点名 G3；
 *  ④ 摘掉 AI 页的 `<custom-tab-bar>` 标签 ⇒ 红，点名 G6；
 *  ⑤ 把 custom-tab-bar.vue 的隐藏口径改回 `#ifdef APP-PLUS` ⇒ 红，点名 G7。
 * `cp` 复原后同形态 SHA256 与注入前逐字节一致 ⇒ 复跑转绿。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const AI_CHAT = join(SRC_DIR, 'pages', 'ai-chat', 'ai-chat.vue')
const AI_API = join(SRC_DIR, 'api', 'modules', 'ai.ts')
const TAB_BAR = join(SRC_DIR, 'components', 'custom-tab-bar.vue')
const APP_VUE = join(SRC_DIR, 'App.vue')

/** uni-app 条件编译指令帧（`#ifdef X` / `#ifndef X`；`#endif` 出栈） */
interface IfFrame {
  kind: 'ifdef' | 'ifndef'
  platform: string
}

/**
 * 逐行计算该行**所处的条件编译上下文**（由外到内的指令栈快照）。
 * 指令行本身写成 `// #ifdef H5` / `/* #ifdef H5 *\/` / `<!-- #ifdef H5 -->` 三种注释形态，
 * 这里都识别；块注释里的星号续行（`* xxx`）与双斜线注释行一律不当作指令。
 */
function contexts(lines: string[]): IfFrame[][] {
  const stack: IfFrame[] = []
  return lines.map((raw) => {
    const t = raw.trim()
    const m = /^(?:\/\/|\/\*|<!--)\s*#(ifdef|ifndef|endif)\b\s*([A-Z0-9_-]*)/.exec(t)
    if (m) {
      if (m[1] === 'endif') stack.pop()
      else stack.push({ kind: m[1], platform: m[2] })
    }
    return stack.map((f) => ({ ...f }))
  })
}

function inBlock(ctx: IfFrame[], kind: IfFrame['kind'], platform: string): boolean {
  return ctx.some((f) => f.kind === kind && f.platform === platform)
}

/** 注释行（双斜线开头、块注释续行、块注释/HTML 注释起头）不参与"引用/调用"判定 */
function isCommentLine(t: string): boolean {
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('<!--')
}

/**
 * 收集源码里某串的引用点（`文件:行号` + 所处条件编译上下文），跳过注释行。
 * `except` 用于把定义行等非调用点排除。
 */
function collect(
  lines: string[],
  ctxs: IfFrame[][],
  needle: string,
  except?: (t: string) => boolean
): { no: number; text: string; ctx: IfFrame[][] }[] {
  const hits: { no: number; text: string; ctx: IfFrame[][] }[] = []
  lines.forEach((raw, i) => {
    if (!raw.includes(needle)) return
    const t = raw.trim()
    if (isCommentLine(t)) return
    if (except && except(t)) return
    hits.push({ no: i + 1, text: t, ctx: [ctxs[i]] })
  })
  return hits
}

/** 该引用点是否**只**落在指定平台块内（栈里含该 ifdef 即视为本端代码） */
function outsideBlock(hit: { ctx: IfFrame[][] }, kind: IfFrame['kind'], platform: string): boolean {
  return !inBlock(hit.ctx[0], kind, platform)
}

const aiChatLines = readFileSync(AI_CHAT, 'utf8').split(/\r?\n/)
const aiChatCtx = contexts(aiChatLines)
const aiApiText = readFileSync(AI_API, 'utf8')
const tabBarLines = readFileSync(TAB_BAR, 'utf8').split(/\r?\n/)
const tabBarCtx = contexts(tabBarLines)
const appLines = readFileSync(APP_VUE, 'utf8').split(/\r?\n/)
const appCtx = contexts(appLines)

// ---- G1 小程序专属文件 API 的引用点 ----
const FS_HITS = collect(aiChatLines, aiChatCtx, 'getFileSystemManager')
const WXENV_HITS = collect(aiChatLines, aiChatCtx, 'wx.env')
const FS_OUTSIDE_MP = [...FS_HITS, ...WXENV_HITS].filter((h) =>
  outsideBlock(h, 'ifdef', 'MP-WEIXIN')
)

// ---- G2 AbortController 的引用点 ----
const AC_HITS = collect(aiChatLines, aiChatCtx, 'AbortController')
const AC_OUTSIDE_H5 = AC_HITS.filter((h) => outsideBlock(h, 'ifdef', 'H5'))

// ---- G3 speakSystem 调用点（定义行除外）----
const SPEAK_CALLS = collect(aiChatLines, aiChatCtx, 'speakSystem(', (t) =>
  /^function\s+speakSystem\b/.test(t)
)
const SPEAK_BAD = SPEAK_CALLS.filter(
  (h) => !inBlock(h.ctx[0], 'ifdef', 'H5') && !inBlock(h.ctx[0], 'ifdef', 'APP-PLUS')
)

// ---- G4 小程序确定行为 ----
const MPGUARD_DEF = collect(aiChatLines, aiChatCtx, 'function notifyMpSpeakUnsupported')
const MPGUARD_CALLS = collect(aiChatLines, aiChatCtx, 'notifyMpSpeakUnsupported()', (t) =>
  /^function\s+notifyMpSpeakUnsupported\b/.test(t)
)
const MPGUARD_CALLS_IN_MP = MPGUARD_CALLS.filter((h) => inBlock(h.ctx[0], 'ifdef', 'MP-WEIXIN'))

// ---- G5 App 端 plus.io 读图分支 ----
const PLUSIO_HITS = collect(aiChatLines, aiChatCtx, 'plus.io.resolveLocalFileSystemURL')
const PLUSIO_IN_APP = PLUSIO_HITS.filter((h) => inBlock(h.ctx[0], 'ifdef', 'APP-PLUS'))

// ---- G6 自绘栏挂载 ----
const TABBAR_TAG = collect(aiChatLines, aiChatCtx, '<custom-tab-bar')
const TABBAR_IMPORT = collect(aiChatLines, aiChatCtx, "components/custom-tab-bar.vue'")

// ---- G7 原生栏隐藏口径 ----
const HIDE_BAR = collect(tabBarLines, tabBarCtx, 'uni.hideTabBar')
const HIDE_BAR_NOT_UNION = HIDE_BAR.filter(
  (h) => !inBlock(h.ctx[0], 'ifndef', 'MP-WEIXIN') || inBlock(h.ctx[0], 'ifdef', 'APP-PLUS')
)
const HIDE_BAR_APP = collect(appLines, appCtx, 'uni.hideTabBar')
const HIDE_BAR_APP_NOT_UNION = HIDE_BAR_APP.filter(
  (h) => !inBlock(h.ctx[0], 'ifndef', 'MP-WEIXIN') || inBlock(h.ctx[0], 'ifdef', 'APP-PLUS')
)

// ---- G8 非 H5 取消落到真实 abort ----
const LEGACY_ABORT = aiApiText.includes('task.abort()')
const LEGACY_KEEPS_TASK = /const task = uni\.request\(/.test(aiApiText)
const ENTRY_PASSES_CANCEL = aiApiText.includes(
  'streamChatLegacy(params, handlers, controls.registerCancel)'
)

// ---- G9 typeof 平台探测红线自证 ----
// 只拦**运行期**探测（`typeof uni.xxx !== 'undefined'` 之类用来掩盖平台错配的写法）；
// `ReturnType<typeof uni.getRecorderManager>` 是类型位置的 typeof，编译后不存在，不属拦阻对象。
const AI_API_LINES = readFileSync(AI_API, 'utf8').split(/\r?\n/)
const AI_API_CTX = contexts(AI_API_LINES)
const isTypeLevel = (t: string) => t.includes('ReturnType<') || t.includes('typeof import(')
const TYPEOF_PROBES = [
  ...collect(aiChatLines, aiChatCtx, 'typeof uni.', isTypeLevel),
  ...collect(aiChatLines, aiChatCtx, 'typeof wx', isTypeLevel),
  ...collect(aiChatLines, aiChatCtx, 'typeof plus', isTypeLevel),
  ...collect(AI_API_LINES, AI_API_CTX, 'typeof uni.', isTypeLevel),
  ...collect(AI_API_LINES, AI_API_CTX, 'typeof wx', isTypeLevel),
  ...collect(AI_API_LINES, AI_API_CTX, 'typeof plus', isTypeLevel)
]

const fmt = (hits: { no: number; text: string }[]) =>
  hits.map((h) => `${h.no}:${h.text.slice(0, 72)}`).join(' | ')

describe('QODER-25 AI Chat 三端条件编译与自绘 tabBar 静态配对守卫', () => {
  it('G1 小程序专属文件 API（getFileSystemManager / wx.env）只出现在 #ifdef MP-WEIXIN 块内', () => {
    expect(FS_HITS.length, 'ai-chat.vue 已不再引用 uni.getFileSystemManager（守卫失去对象）').toBeGreaterThan(0)
    expect(FS_OUTSIDE_MP, `小程序专属 API 落到非 MP-WEIXIN 分支（App 会走进小程序 API）：${fmt(FS_OUTSIDE_MP)}`).toEqual([])
  })

  it('G1b App 端有独立的 plus.io 读取分支（不得只靠 H5 fetch 与小程序 FS）', () => {
    expect(PLUSIO_IN_APP.length, 'ai-chat.vue 的 #ifdef APP-PLUS 块内没有 plus.io.resolveLocalFileSystemURL 读图分支').toBeGreaterThan(0)
    expect(
      PLUSIO_HITS.filter((h) => !inBlock(h.ctx[0], 'ifdef', 'APP-PLUS')),
      `plus.io 出现在非 APP-PLUS 分支：${fmt(PLUSIO_HITS)}`
    ).toEqual([])
  })

  it('G2 AbortController 只出现在 #ifdef H5 块内（非 H5 不得引用）', () => {
    expect(AC_HITS.length, 'ai-chat.vue 已不再出现 AbortController（守卫失去对象）').toBeGreaterThan(0)
    expect(AC_OUTSIDE_H5, `AbortController 出现在非 H5 分支：${fmt(AC_OUTSIDE_H5)}`).toEqual([])
  })

  it('G3 speakSystem 的每个调用点都落在有该系统 TTS 实现的平台块内', () => {
    expect(SPEAK_CALLS.length, 'ai-chat.vue 已无 speakSystem 调用点（守卫失去对象）').toBeGreaterThan(0)
    expect(SPEAK_BAD, `MP / 无条件分支调用了只有 H5/APP 实现的 speakSystem：${fmt(SPEAK_BAD)}`).toEqual([])
  })

  it('G4 小程序播报失败走 notifyMpSpeakUnsupported 的确定行为', () => {
    expect(MPGUARD_DEF.length, '缺少 notifyMpSpeakUnsupported 定义').toBe(1)
    expect(
      MPGUARD_DEF.filter((h) => !inBlock(h.ctx[0], 'ifdef', 'MP-WEIXIN')),
      `notifyMpSpeakUnsupported 定义不在 #ifdef MP-WEIXIN 块内：${fmt(MPGUARD_DEF)}`
    ).toEqual([])
    expect(MPGUARD_CALLS_IN_MP.length, '小程序分支没有调用 notifyMpSpeakUnsupported()（播报失败仍会静默）').toBeGreaterThan(0)
    expect(
      MPGUARD_CALLS.filter((h) => !inBlock(h.ctx[0], 'ifdef', 'MP-WEIXIN')),
      `notifyMpSpeakUnsupported 被非小程序端调用：${fmt(MPGUARD_CALLS)}`
    ).toEqual([])
  })

  it('G6 AI 页挂载自绘 tabBar（模板标签与组件导入同时在册）', () => {
    expect(TABBAR_TAG.length, 'ai-chat.vue 模板未挂载 <custom-tab-bar> ⇒ AI 页没有底栏').toBe(1)
    expect(TABBAR_IMPORT.length, 'ai-chat.vue 未 import components/custom-tab-bar.vue').toBe(1)
  })

  it('G7 原生 tabBar 隐藏口径为 #ifndef MP-WEIXIN（覆盖 H5 与 APP 双端）', () => {
    expect(HIDE_BAR.length, 'custom-tab-bar.vue 已无 uni.hideTabBar 兜底').toBeGreaterThan(0)
    expect(HIDE_BAR_NOT_UNION, `自绘栏隐藏原生栏的口径不是 #ifndef MP-WEIXIN：${fmt(HIDE_BAR_NOT_UNION)}`).toEqual([])
    expect(HIDE_BAR_APP.length, 'App.vue 已无启动期 uni.hideTabBar 兜底').toBeGreaterThan(0)
    expect(HIDE_BAR_APP_NOT_UNION, `App.vue 隐藏原生栏的口径不是 #ifndef MP-WEIXIN：${fmt(HIDE_BAR_APP_NOT_UNION)}`).toEqual([])
  })

  it('G8 非 H5 降级实现持有 RequestTask 并暴露真实 abort()', () => {
    expect(LEGACY_KEEPS_TASK, 'ai.ts 没有接住 uni.request 的返回值（RequestTask 被丢弃）').toBe(true)
    expect(LEGACY_ABORT, 'ai.ts 的小程序/App 路径没有调用 RequestTask.abort()').toBe(true)
    expect(ENTRY_PASSES_CANCEL, 'ai.ts 的 streamChat 未把 registerCancel 透传给降级实现').toBe(true)
  })

  it('G9 未用 typeof 探测吞掉平台错配（红线自证）', () => {
    expect(TYPEOF_PROBES, `出现 typeof 平台探测：${fmt(TYPEOF_PROBES)}`).toEqual([])
  })

  it('G10 图片读取三端互斥：小程序分支用 FS、App 分支用 plus.io、H5 用 fetch', () => {
    // 判据：不能再把 getFileSystemManager 包在「非 H5」这一整块里 —— 那正是本卡根因
    // （写法上用 inBlock 判定，避免在本文件里出现真指令行被测试期的 uni-ifdef shim 吃掉）
    expect(
      FS_HITS.filter((h) => inBlock(h.ctx[0], 'ifndef', 'H5') && !inBlock(h.ctx[0], 'ifdef', 'MP-WEIXIN')),
      `getFileSystemManager 被包在非 H5 指令块内（App 端会一并落进小程序分支）：${fmt(FS_HITS)}`
    ).toEqual([])
    expect(aiChatLines.join('\n').includes('fetch(filePath)'), 'H5 读图分支（fetch）不应消失').toBe(true)
  })
})
