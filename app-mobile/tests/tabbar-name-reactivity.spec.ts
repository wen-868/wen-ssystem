/**
 * QODER-25F1 · 自绘 tabBar 撞名守卫 + AI 流式消息响应式守卫
 *
 * 守两件上一轮被判返工的事（派单 QODER-25F1 §一 A/B）：
 *
 *  S1 静态撞名守卫：`custom-tab-bar` 是 uni-app 的**平台保留组件名**
 *     （实测锚点：node_modules/@dcloudio/uni-cli-shared/dist/easycom.js:212
 *      `const H5_ONLY_COMPONENTS = ['custom-tab-bar']`，:213 命中即
 *      `console.warn('[uni-app] 组件 <'+tag+'> 是 H5 平台专用组件…')`，且 :185 matchEasycom
 *      对**每个模板标签**都会跑，src/components 默认在 easycom 自动扫描目录里，
 *      所以哪怕页面里是显式 import，标签名撞保留名照样报警）。
 *     ⇒ src 下任何 .vue/.ts 都不得再出现 `<custom-tab-bar` 或 `components/custom-tab-bar.vue`，
 *       组件文件本身也不得叫 `src/components/custom-tab-bar.vue`。
 *  S2 挂载配对守卫：自绘栏必须在 tabBar.list 的 5 个页面**各挂一次**（模板标签 + import 都在册）。
 *     派单口径写"5 个既有 tab 页和 AI 页"，实测口径是 **4 个 tab 页 + AI 页 = 5 个挂载文件**
 *     （pages.json:834 tabBar.list 是 home/products/ai-chat/functions/profile 共 5 项）；
 *     本守卫按实测的"5 个挂载文件"钉死，两者差异已在回传卡 §九 登记。
 *  S3 tabBar 路线互斥守卫：`custom:true` 与"每页手动挂载"必须同时成立；
 *     一旦源码里出现微信原生自定义栏目录 `src/custom-tab-bar/`（uni-mp-weixin 的 copy 目标，
 *     实测锚点 node_modules/@dcloudio/uni-mp-weixin/dist/uni.compiler.js:267），
 *     每页挂载就必须同时收回微信端，否则微信出现双栏 ⇒ 本条红并点名。
 *  R1 响应式创建守卫：ai-chat.vue 的流式消息必须由 `reactive(...)` 先进代理再入数组，
 *     不得回到 `const aiMsg: ChatMessage = {…}` 的裸对象写法（那是本卡点名缺陷本体）。
 *  R2 假响应式禁绝守卫：不得用 location.reload / forceUpdate / 整表重新赋值 / nextTick 轮询
 *     这类"重挂载冒充响应式"的写法糊弄过去（派单 §三 红线）。
 *  R3 机制自证：在本仓同款 `ref<ChatMessage[]>` 形态上实测两条 Vue 语义
 *     —— ① 裸对象 push 后写裸对象 ⇒ 不触发任何依赖；② reactive 对象 push 后写代理 ⇒ 触发，
 *     且 `arr[idx]` 与入队前拿到的代理是**同一身份**（reactiveMap 缓存）。
 *     R1 的修法可靠性完全押在这三条上，故把它写成用例而不是写在注释里。
 *
 * 求值时机：全部静态事实在**模块加载期（import 阶段）**读文件并算好，用例体内只做常数比较
 * （vitest 默认 5000 ms 用例超时会把"it 体内扫源码"打成随机假红，见 pin-ssl-static.spec.ts）。
 *
 * 反测（须能红，逐条点名句柄）：
 *  Ⓐ 把 ai-chat.vue 的 `const aiMsg = reactive<ChatMessage>(` 注回裸对象写法 ⇒ 红，点名 R1；
 *  Ⓑ 把 AI 页标签与 import 注回旧名 custom-tab-bar ⇒ 红，点名 S1（并连带 S2 红）。
 * `cp` 树外备份复原后同形态 SHA256 与注入前一致 ⇒ 复跑转绿。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reactive, ref, watch } from 'vue'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const AI_CHAT = join(SRC_DIR, 'pages', 'ai-chat', 'ai-chat.vue')
const TAB_BAR_VUE = join(SRC_DIR, 'components', 'app-tab-bar.vue')
const PAGES_JSON = join(SRC_DIR, 'pages.json')

/** uni-app 平台保留组件名（与 uni-cli-shared easycom.js:212 的 H5_ONLY_COMPONENTS 同源） */
const RESERVED_TAG_NAMES = ['custom-tab-bar']

/** 遍历 src 下的 .vue / .ts（不跟 node_modules，本目录内没有） */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(p))
    else if (/\.(vue|ts)$/.test(ent.name)) out.push(p)
  }
  return out
}

const SOURCE_FILES = walk(SRC_DIR)
/** 撞名字面量：<标签开头> 与 <组件路径 import>。两类都算注册面，注释里也不许留（防审计误读） */
const FORBIDDEN_NEEDLES = RESERVED_TAG_NAMES.flatMap((n) => [`<${n}`, `components/${n}.vue`])
const NAME_HITS = SOURCE_FILES.flatMap((f) => {
  const text = readFileSync(f, 'utf8')
  return FORBIDDEN_NEEDLES
    .map((needle) => {
      if (!text.includes(needle)) return null
      const line = text.split(/\r?\n/).find((l) => l.includes(needle)) ?? ''
      return `${relative(SRC_DIR, f)} :: ${needle} :: ${line.trim().slice(0, 72)}`
    })
    .filter((x): x is string => x !== null)
})

const LEGACY_COMPONENT_FILE = join(SRC_DIR, 'components', 'custom-tab-bar.vue')

const aiChatText = readFileSync(AI_CHAT, 'utf8')
const tabBarText = readFileSync(TAB_BAR_VUE, 'utf8')

// ---- S2 挂载配对（tabBar.list 的每个页面都要挂一次自绘栏）----
interface PagesJson {
  tabBar?: { custom?: boolean; list?: { pagePath: string }[] }
}
const pagesJson = JSON.parse(readFileSync(PAGES_JSON, 'utf8')) as PagesJson
const TAB_LIST = (pagesJson.tabBar?.list ?? []).map((i) => i.pagePath)
const TAB_BAR_CUSTOM = pagesJson.tabBar?.custom === true
/** 页面源文件里 `<app-tab-bar` 与 import 的行数（模板标签行不算注释） */
const MOUNTS = TAB_LIST.map((pagePath) => {
  const file = join(SRC_DIR, `${pagePath}.vue`)
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : null
  const tag = lines ? lines.filter((l) => l.includes('<app-tab-bar')).length : 0
  const imp = lines ? lines.filter((l) => l.includes("components/app-tab-bar.vue'")).length : 0
  return { pagePath, exists: !!lines, tag, imp }
})
const MOUNT_BAD = MOUNTS.filter((m) => !m.exists || m.tag !== 1 || m.imp !== 1)

// ---- S3 两条路线互斥 ----
const MP_NATIVE_DIR = join(SRC_DIR, 'custom-tab-bar')
/** 微信原生自定义栏目录存在时，每页挂载必须收回 MP 端；本仓走的是"每页挂载"这一条 ⇒ 目录必须不存在 */
const MOUNTS_ON_MP_TOO = MOUNTS.every((m) => m.tag === 1) && aiChatText.includes('<app-tab-bar')

// ---- R1 响应式创建 ----
const REACTIVE_CREATE = 'const aiMsg = reactive<ChatMessage>({'
const RAW_LITERAL_CREATE = 'const aiMsg: ChatMessage = {'
const PUSH_SAME_BINDING = 'messages.value.push(aiMsg)'
const HAS_REACTIVE_IMPORT = /\bimport\s*\{[^}]*\breactive\b[^}]*\}\s*from\s*'vue'/.test(aiChatText)

// ---- R2 假响应式禁绝 ----
const FAKE_ESCAPES = ['location.reload(', 'forceUpdate(', 'messages.value = [...messages.value]', 'nextTick(']
const FAKE_HITS = FAKE_ESCAPES
  .filter((needle) => aiChatText.includes(needle))
  .map((needle) => {
    const line = aiChatText.split(/\r?\n/).find((l) => l.includes(needle)) ?? ''
    return `${needle} :: ${line.trim().slice(0, 72)}`
  })

interface ChatMessageLike {
  id: number
  content: string
  streaming?: boolean
}

describe('QODER-25F1 自绘 tabBar 撞名守卫（S1/S2/S3）', () => {
  it('S1 src 全量扫描不得出现 uni-app 平台保留组件名 custom-tab-bar 的标签/导入', () => {
    expect(SOURCE_FILES.length, 'src 下没扫到任何 .vue/.ts ⇒ 扫描根配错了').toBeGreaterThan(0)
    expect(FORBIDDEN_NEEDLES.length, '保留名清单为空 ⇒ 守卫失去对象').toBeGreaterThan(0)
    expect(NAME_HITS, `组件注册面撞平台保留名（mp-weixin 构建会打"是 H5 平台专用组件"警告）：${NAME_HITS.join(' | ')}`).toEqual([])
    expect(
      existsSync(LEGACY_COMPONENT_FILE),
      'src/components/custom-tab-bar.vue 仍在册：easycom 自动扫描会把它映射回保留名标签'
    ).toBe(false)
    expect(existsSync(TAB_BAR_VUE), '改名后的 src/components/app-tab-bar.vue 必须存在').toBe(true)
    expect(tabBarText.includes('uni.hideTabBar'), 'app-tab-bar.vue 必须仍带非微信端 hideTabBar 兜底').toBe(true)
  })

  it('S2 tabBar.list 的 5 个页面各挂一次 app-tab-bar（模板标签与 import 同时为 1）', () => {
    expect(TAB_LIST.length, `pages.json tabBar.list 应为 5 项，实测 ${TAB_LIST.length}`).toBe(5)
    expect(MOUNT_BAD, `页面挂载次数不等于 1 标签 + 1 导入：${JSON.stringify(MOUNT_BAD)}`).toEqual([])
  })

  it('S3 custom:true 与「每页手动挂载」互斥配对：出现微信原生 custom-tab-bar 目录必须同时收回 MP 端挂载', () => {
    // 产物级结论（raw/02、raw/04）：app.json 里 tabBar.custom 落成 true；uni-mp-weixin 只把
    // src/custom-tab-bar 当**原样拷贝**目标（uni.compiler.js:267），不会从 Vue 组件生成它。
    // ⇒ 微信端可见栏只能来自"每页挂载"这一条路线；两条路线并存 = 双栏 = 本条红。
    expect(TAB_BAR_CUSTOM, 'pages.json 的 tabBar.custom 必须是 true（非微信端另有 hideTabBar 兜底）').toBe(true)
    if (existsSync(MP_NATIVE_DIR)) {
      expect(
        MOUNTS_ON_MP_TOO,
        'src/custom-tab-bar 原生目录已存在，但每页仍无条件挂载 app-tab-bar ⇒ 微信双栏；须把挂载包进 #ifndef MP-WEIXIN'
      ).toBe(false)
    } else {
      expect(MOUNTS_ON_MP_TOO, '每页挂载路线要求 5 个 tab 页都挂 app-tab-bar（否则微信端一条栏都没有）').toBe(true)
    }
  })
})

describe('QODER-25F1 AI 流式消息响应式守卫（R1/R2/R3）', () => {
  it('R1 流式消息必须先入响应式代理再入 ref 数组，回调写的就是那个代理', () => {
    expect(
      aiChatText.includes(REACTIVE_CREATE),
      'ai-chat.vue 的 aiMsg 不是由 reactive(...) 创建的 ⇒ onText/onDone/finally 写的是未进过代理的裸对象'
    ).toBe(true)
    expect(
      aiChatText.includes(RAW_LITERAL_CREATE),
      'ai-chat.vue 回退到 `const aiMsg: ChatMessage = {…}` 裸对象写法（本卡点名缺陷）'
    ).toBe(false)
    expect(aiChatText.includes(PUSH_SAME_BINDING), 'push 进 messages.value 的对象必须是代理绑定的同一个 aiMsg').toBe(true)
    expect(HAS_REACTIVE_IMPORT, "ai-chat.vue 未从 'vue' 导入 reactive").toBe(true)
  })

  it('R2 不得用重挂载/整表重赋值/nextTick 轮询冒充响应式（红线自证）', () => {
    expect(FAKE_HITS, `出现"靠重挂载糊弄响应式"的写法：${FAKE_HITS.join(' | ')}`).toEqual([])
    // 模板 v-for 的 key 必须是稳定 id（不是自增 refreshKey），否则每次流式都整表重挂载
    expect(aiChatText.includes('v-for="msg in messages" :key="msg.id"'), '消息列表 key 必须是稳定的 msg.id').toBe(true)
  })

  it('R3 机制自证：裸对象入数组后写裸对象不触发；reactive 入数组后写代理触发且代理身份一致', () => {
    // 同款形态：ref<ChatMessage[]>（生产代码 ai-chat.vue:245 就是它）
    const rawList = ref<ChatMessageLike[]>([])
    const rawMsg = { id: 1, content: '', streaming: true }
    rawList.value.push(rawMsg)
    let rawWrites = 0
    watch(
      () => rawList.value[0].content,
      () => {
        rawWrites += 1
      },
      // flush: 'sync' 是让"写入当帧就计数"，否则默认 'pre' 会把回调排进微任务，
      // 断言会在 flush 前读到 0，把"触发了"也测成"没触发"（假绿）。
      { flush: 'sync' }
    )
    // 缺陷写法：继续写**未进过代理的原始对象** ⇒ 依赖不触发（DOM 停在空气泡）
    rawMsg.content = '第一段'
    expect(rawWrites, '裸对象写入竟然触发了依赖 ⇒ Vue 语义与守卫前提不符，R1 的修法依据需要重裁').toBe(0)

    // 修法：对象先 reactive() 再 push ⇒ 回调写的就是代理，代理触发依赖
    const okList = ref<ChatMessageLike[]>([])
    const okMsg = reactive<ChatMessageLike>({ id: 2, content: '', streaming: true })
    okList.value.push(okMsg)
    let okWrites = 0
    watch(
      () => okList.value[0].content,
      () => {
        okWrites += 1
      },
      { flush: 'sync' }
    )
    okMsg.content = '第一段'
    expect(okWrites, 'reactive 对象入 ref 数组后写代理没有触发依赖 ⇒ 修法不成立').toBe(1)
    // 身份一致：数组下标读回来的代理与入队前的代理是同一个（reactiveMap 缓存）
    expect(okList.value[0] === okMsg, 'messages.value[idx] 与 aiMsg 不是同一代理 ⇒ 回调写的不是渲染读的那份').toBe(true)
    expect(okList.value[0].content, '代理写入没有反映到下标读取').toBe('第一段')
  })
})
