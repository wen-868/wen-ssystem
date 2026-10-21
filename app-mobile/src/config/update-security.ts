/**
 * QODER-24（MO-14）· 热更新安全策略：主机白名单**集中配置** + 全量**纯函数**校验
 *
 * 为什么要独立成文件（基线 bc1087ee 实测现状，任务书 §一）：
 *  - `src/utils/update.ts:42-80` 下载 `.wgt` 后直接 `plus.runtime.install(..., { force: true })`，**无任何摘要校验**；
 *  - `src/utils/update.ts:131` 只做版本名**等值**比较 ⇒ 后端下发更低版本、非法版本照样提示；
 *  - `src/utils/update.ts:106` 对后端下发的 `updateUrl` 直接 `plus.runtime.openURL`，**无主机白名单**；
 *  - `src/utils/update.ts:126` 的 `packageUrl` 未校验协议/凭据/IP/端口/主机/路径 ⇒ 可指向 http 明文、任意主机、任意文件；
 *  - 后端 `LatestAppVersion`（`backend/src/services/platform/app-version.service.ts:20-27`，只读）**没有摘要字段**
 *    ⇒ 本卡按**失败关闭**落地：无合法摘要即关闭 `.wgt` 自动直装（这是本单预期结果，不是"通过"），
 *      后端补字段记为外部前置，本单禁止改后端。
 *
 * 设计口径（三条硬约束）：
 *  1. 全部判据都是**纯函数**（入参进、结论出），不碰 `uni` / `plus` / `window` / 网络
 *     ⇒ `tests/update-security.spec.ts` 能逐条单测，反测才能"摘掉一个判据就红"。
 *  2. 主机判定一律**从运行时 API 基址解析主机**（`deriveApiHost`），不做字面量比对
 *     ——`config/env.ts:7` 明令"请勿在本文件硬编码真实生产域名"，同源口径必须跟着 `VITE_API_BASE` 走。
 *  3. 跳转白名单**集中在本文件**的 `OFFICIAL_UPDATE_HOSTS`（唯一配置点，页面与 update.ts 不得散落主机字面量），
 *     构建期可用 `VITE_UPDATE_HOSTS`（逗号分隔）追加；API 主机由运行时基址自动纳入，
 *     因此白名单**至少**覆盖「API 主机 + 官网下载主机」两项（来源见该常量旁注释）。
 *
 * 反测面（任务书 §二.6 四组，每轮只摘一个判据，目标用例必须红并点名）：
 *  ① semver：`isRemoteVersionNewer` 里 `return cmp > 0` 改成 `return cmp !== 0` ⇒ 「远端版本更低（降级）不得提示」红；
 *  ② 同源：`validatePackageUrl` 里 `if (parsed.host !== apiHost)` 短路 ⇒ 「跨主机 .wgt 必须拒装」红；
 *  ③ 摘要：`digestMatches` 里 `return e === a` 改成 `return true` ⇒ 「下载后实算不一致必须拒装」红；
 *  ④ 白名单：`isAllowedUpdateHost` 改成 `return true` ⇒ 「未命中白名单的 updateUrl 禁止打开」红。
 */
import { sha256, base64ToBytes } from '../utils/crypto'

/** 校验结论：通过 ⇒ `ok:true`（reason 为空串）；不通过 ⇒ 必须带**可点名**的原因（供 UI/日志与单测断言） */
export type Verdict = { ok: true; reason: '' } | { ok: false; reason: string }

const PASS: Verdict = { ok: true, reason: '' }

function deny(reason: string): Verdict {
  return { ok: false, reason }
}

// ====================== ① 纯函数 semver 比较 ======================

/** 合法 semver（严格 `MAJOR.MINOR.PATCH`，可带 `-prerelease` 与 `+build`；**不接受**前缀 `v`、不接受前导零） */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export interface Semver {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

/** 解析 semver；非法（含空串、非字符串、带 `v` 前缀、缺位、前导零）⇒ `null`，不抛异常 */
export function parseSemver(input: unknown): Semver | null {
  if (typeof input !== 'string') return null
  const s = input.trim()
  const m = SEMVER_RE.exec(s)
  if (!m) return null
  const pre = m[4]
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: pre === undefined ? [] : pre.split('.'),
  }
}

export function isValidSemver(input: unknown): boolean {
  return parseSemver(input) !== null
}

/** semver §11：数字标识符按数值比（前导零已被正则挡掉），数字 < 字母数字，其余按 ASCII 词典序 */
function comparePrereleaseIdentifier(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a)
  const bNumeric = /^\d+$/.test(b)
  if (aNumeric && bNumeric) {
    if (a.length !== b.length) return a.length < b.length ? -1 : 1
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (aNumeric) return -1
  if (bNumeric) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

function comparePrerelease(a: string[], b: string[]): number {
  // 无 prerelease 的正式版本 **高于** 同版本号带 prerelease 的预发布版（1.0.0 > 1.0.0-alpha）
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const c = comparePrereleaseIdentifier(a[i], b[i])
    if (c !== 0) return c
  }
  if (a.length === b.length) return 0
  return a.length < b.length ? -1 : 1
}

/** 返回 a 相对 b 的高低（-1/0/1）；调用方必须先用 `parseSemver` 保证两侧都合法 */
export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return comparePrerelease(a.prerelease, b.prerelease)
}

/**
 * 唯一版本判据：**两侧都必须是合法 semver 且 remote 严格高于 current** 才返回 true。
 * 等值、降级、任一侧非法 ⇒ false（不提示）。build 元数据按 semver §10 不参与优先级。
 */
export function isRemoteVersionNewer(remote: unknown, current: unknown): boolean {
  const r = parseSemver(remote)
  const c = parseSemver(current)
  if (!r || !c) return false
  const cmp = compareSemver(r, c)
  return cmp > 0
}

// ====================== URL 解析与硬闸 ======================

export interface ParsedUrl {
  /** 小写含冒号，如 `https:` */
  protocol: string
  /** `@` 之前的原始片段；非空即"带用户名/口令" */
  userinfo: string
  /** 小写主机；IPv6 字面量保留方括号 */
  host: string
  /** 显式端口（空串表示 URL 未写端口） */
  port: string
  /** 以 `/` 开头（authority 后、`?`/`#` 前） */
  path: string
  /** 含前导 `?`，无则空串 */
  query: string
  /** 含前导 `#`，无则空串 */
  hash: string
}

/**
 * URL 字面量硬校验：只允许 **可打印 ASCII（0x21–0x7E）**，并额外拒绝反斜杠。
 * 为什么不用正则：`[\s\x00-\x1f]` 这类写法会被 eslint `no-control-regex`（error 位）判红；
 * 逐字符比码点既无 lint 风险，也顺带拒绝了空白、控制字符与所有非 ASCII（IDN/同形字）字符。
 * 反斜杠必须单独拒：WHATWG 归一化会把 `\` 当 `/`，`https://api.onepan.cn\.evil.example/` 可伪造主机边界。
 */
function isStrictAsciiUrl(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code < 0x21 || code > 0x7e) return false
    if (code === 0x5c) return false
  }
  return true
}

/**
 * 手工解析 `scheme://[userinfo@]host[:port][/path][?query][#hash]`。
 * 不用 `new URL()`：App 端 JS 运行时无保证提供该构造器，且 WHATWG 归一化会把 `\` 当 `/`、
 * 会接受前导/尾随空白——本函数一律按**更严**口径处理（出现即判非法），避免归一化绕过主机判定。
 */
export function parseHttpUrl(raw: unknown): ParsedUrl | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (s === '') return null
  if (!isStrictAsciiUrl(s)) return null
  const colon = s.indexOf(':')
  if (colon <= 0) return null
  const protocol = s.slice(0, colon).toLowerCase()
  if (!/^[a-z][a-z0-9+.-]*$/.test(protocol)) return null
  const rest = s.slice(colon + 1)
  if (!rest.startsWith('//')) return null
  const head = rest.slice(2)
  let authority = head
  let path = ''
  let query = ''
  let hash = ''
  let delim = -1
  for (let i = 0; i < head.length; i++) {
    const c = head[i]
    if (c === '/' || c === '?' || c === '#') {
      delim = i
      break
    }
  }
  if (delim >= 0) {
    authority = head.slice(0, delim)
    const tail = head.slice(delim)
    const hashIdx = tail.indexOf('#')
    let beforeHash = tail
    if (hashIdx >= 0) {
      hash = tail.slice(hashIdx)
      beforeHash = tail.slice(0, hashIdx)
    }
    const queryIdx = beforeHash.indexOf('?')
    if (queryIdx >= 0) {
      path = beforeHash.slice(0, queryIdx)
      query = beforeHash.slice(queryIdx)
    } else {
      path = beforeHash
    }
  }
  let userinfo = ''
  const at = authority.lastIndexOf('@')
  if (at >= 0) {
    userinfo = authority.slice(0, at)
    authority = authority.slice(at + 1)
  }
  let host = authority.toLowerCase()
  let port = ''
  if (host.startsWith('[')) {
    const close = host.indexOf(']')
    if (close === -1) return null
    host = host.slice(0, close + 1)
    const remainder = authority.slice(authority.indexOf(']') + 1)
    if (remainder.startsWith(':')) port = remainder.slice(1)
    else if (remainder !== '') return null
  } else {
    const hostColon = host.indexOf(':')
    if (hostColon >= 0) {
      port = host.slice(hostColon + 1)
      host = host.slice(0, hostColon)
    }
  }
  if (host === '') return null
  if (port !== '' && !/^\d+$/.test(port)) return null
  if (path !== '' && !path.startsWith('/')) return null
  return { protocol: `${protocol}:`, userinfo, host, port, path, query, hash }
}

/** IPv4 / IPv6 字面量判定（含带方括号的 IPv6） */
export function isIpAddress(host: string): boolean {
  const h = host.replace(/^\[+|\]+$/g, '')
  if (h.includes(':')) return /^[0-9a-f:.]+$/i.test(h)
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h)
}

/** 可入白名单的公网域名主机：非 IP、至少两段、纯 ASCII 标签、禁 `xn--`（同形字/国际化域名仿冒） */
export function isDomainHost(host: unknown): boolean {
  if (typeof host !== 'string' || host === '') return false
  if (isIpAddress(host)) return false
  if (host.includes('xn--')) return false
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)
}

/**
 * **从运行时 API 基址解析主机**（不做字面量比对）：
 *  - 绝对基址（`https://api.example.com/api`）⇒ 取其主机；
 *  - 相对基址（`/api`）⇒ 只有同时给出运行时来源（H5 的 `window.location.origin`）才能解析；
 *  - 其余（空、非法、相对且无 origin、基址非 https/http）⇒ 返回空串，调用方**必须失败关闭**。
 */
export function deriveApiHost(apiBase: unknown, runtimeOrigin = ''): string {
  if (typeof apiBase !== 'string') return ''
  const base = apiBase.trim()
  if (base === '') return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(base)) {
    const parsed = parseHttpUrl(base)
    return parsed ? parsed.host : ''
  }
  if (base.startsWith('/')) {
    const parsed = parseHttpUrl(runtimeOrigin)
    return parsed ? parsed.host : ''
  }
  return ''
}

interface HardenedResult {
  parsed: ParsedUrl | null
  reason: string
}

/** 协议/凭据/IP/端口/路径的公共硬闸；任何一条不过 ⇒ `parsed:null` + 点名原因 */
function hardenedHttpsUrl(raw: unknown, label: string): HardenedResult {
  const parsed = parseHttpUrl(raw)
  if (!parsed) return { parsed: null, reason: `${label} 不是可解析的绝对 URL（空白、反斜杠、缺主机、缺 // 一律判非法）` }
  if (parsed.protocol !== 'https:') {
    return { parsed: null, reason: `${label} 协议为 ${parsed.protocol}，非 https: ⇒ 拒绝（HTTP 明文不可信）` }
  }
  if (parsed.userinfo !== '') {
    return { parsed: null, reason: `${label} 带用户名/口令（userinfo）⇒ 拒绝` }
  }
  if (isIpAddress(parsed.host)) {
    return { parsed: null, reason: `${label} 主机 ${parsed.host} 是 IP 字面量 ⇒ 拒绝` }
  }
  if (!isDomainHost(parsed.host)) {
    return { parsed: null, reason: `${label} 主机 ${parsed.host} 不是合法公网域名（单标签/非法字符/xn-- 仿冒）⇒ 拒绝` }
  }
  if (parsed.port !== '' && parsed.port !== '443') {
    return { parsed: null, reason: `${label} 端口 ${parsed.port} 非标准 443 ⇒ 拒绝` }
  }
  if (parsed.path.split('/').some((seg) => seg === '..' || seg === '.')) {
    return { parsed: null, reason: `${label} 路径含 . 或 .. 归一化片段 ⇒ 拒绝` }
  }
  return { parsed, reason: '' }
}

// ====================== ② packageUrl（.wgt 直装地址） ======================

/**
 * `.wgt` 包地址判据：`https:` + 无凭据 + 非 IP + 标准端口 + **主机与运行时 API 基址同源** +
 * 路径以 `.wgt` 结尾。任何一条不满足 ⇒ 拒装（返回原因）。
 */
export function validatePackageUrl(raw: unknown, apiBase: unknown, runtimeOrigin = ''): Verdict {
  const hard = hardenedHttpsUrl(raw, 'packageUrl')
  if (!hard.parsed) return deny(hard.reason)
  const parsed = hard.parsed
  const apiHost = deriveApiHost(apiBase, runtimeOrigin)
  if (apiHost === '') {
    return deny(`无法从运行时 API 基址 ${String(apiBase)} 解析出主机 ⇒ 同源判定失败关闭，拒装`)
  }
  if (parsed.host !== apiHost) {
    return deny(`packageUrl 主机 ${parsed.host} 与 API 主机 ${apiHost} 不同源 ⇒ 拒装`)
  }
  if (!parsed.path.toLowerCase().endsWith('.wgt')) {
    return deny(`packageUrl 路径 ${parsed.path} 不以 .wgt 结尾 ⇒ 拒装`)
  }
  return PASS
}

// ====================== ③ SHA-256 摘要 ======================

const SHA256_HEX_RE = /^[0-9a-f]{64}$/

/** 归一化后端下发的摘要：非字符串 / 去空格后不是**整串** 64 位 hex ⇒ `null`（缺失与格式非法同等对待） */
export function normalizeSha256Hex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (!SHA256_HEX_RE.test(s)) return null
  return s
}

/** 字节数组转小写 hex（仅格式化，摘要本体复用 utils/crypto 的纯 JS sha256，不另写实现） */
export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/** 对**下载文件的原始字节**实算 SHA-256（hex 小写） */
export function sha256HexFromBytes(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes))
}

/** 摘要比较：任一侧不是合法 64 位 hex ⇒ false（缺失摘要永远比不中）；否则整串逐字节比较 */
export function digestMatches(expectedHex: unknown, actualHex: unknown): boolean {
  const e = normalizeSha256Hex(expectedHex)
  const a = normalizeSha256Hex(actualHex)
  if (e === null || a === null) return false
  return e === a
}

/**
 * `plus.io.FileReader.readAsDataURL` 的结果（`data:<mime>;base64,xxxx`）⇒ 原始字节。
 * 只做**结构性校验 + 复用 crypto 的 base64ToBytes**；非法/空 ⇒ null（调用方据此失败关闭）。
 */
export function dataUrlToBytes(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== 'string') return null
  const comma = dataUrl.indexOf(',')
  const payload = (comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl).replace(/\s/g, '')
  if (payload === '') return null
  if (payload.length % 4 !== 0) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null
  const bytes = base64ToBytes(payload)
  return bytes.length === 0 ? null : bytes
}

/**
 * 安装前的**最后一道闸**：拿实算字节与后端下发摘要比对。
 *  - 摘要缺失/非 64 位 hex ⇒ 拒（后端契约未补齐时，`.wgt` 自动直装就是关的——本单预期结果）；
 *  - 字节读不到（null / 0 长度）⇒ 拒（**不得**用 toast"提示不支持"冒充校验完成）；
 *  - 比对不一致 ⇒ 拒，调用方必须删除临时文件。
 */
export function verifyPackageBytes(bytes: Uint8Array | null | undefined, expectedSha256: unknown): Verdict {
  const expected = normalizeSha256Hex(expectedSha256)
  if (expected === null) {
    return deny('后端未下发合法 packageSha256（缺失或非 64 位 hex）⇒ 失败关闭，不安装')
  }
  if (!bytes || bytes.length === 0) {
    return deny('读不到下载文件的原始字节 ⇒ 摘要无法实算，失败关闭，不安装')
  }
  const actual = sha256HexFromBytes(bytes)
  if (!digestMatches(expected, actual)) {
    return deny(`实算 SHA-256 ${actual} 与下发摘要 ${expected} 不一致 ⇒ 拒装并删除临时文件`)
  }
  return PASS
}

// ====================== ④ updateUrl 跳转白名单（集中配置） ======================

/**
 * 官网下载主机白名单（**唯一配置点**，来源可核对：`deploy/nginx-production.conf:127` 官网
 * `server_name www.onepan.cn onepan.cn`；`:85` H5/移动端站点 `m.onepan.cn`）。
 * API 主机不写在这里——由 `deriveApiHost` 从运行时基址解析后自动纳入（见 `updateHostAllowlist`）。
 * 需要追加主机时只改本常量，或用构建环境变量 `VITE_UPDATE_HOSTS`（逗号分隔）注入，禁止散落到页面。
 */
const OFFICIAL_UPDATE_HOSTS: readonly string[] = ['www.onepan.cn', 'onepan.cn', 'm.onepan.cn']

/** 环境变量追加的主机（非法主机名直接丢弃，不参与白名单） */
function extraUpdateHosts(): string[] {
  const raw = (import.meta.env?.VITE_UPDATE_HOSTS as string | undefined) ?? ''
  return String(raw)
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => isDomainHost(h))
}

/** 生效白名单 = 集中配置的官网下载主机 ∪ 运行时 API 主机（去重、全小写） */
export function updateHostAllowlist(apiBase: unknown, runtimeOrigin = ''): string[] {
  const apiHost = deriveApiHost(apiBase, runtimeOrigin)
  const hosts = [...OFFICIAL_UPDATE_HOSTS, ...extraUpdateHosts()]
  if (apiHost !== '' && isDomainHost(apiHost)) hosts.push(apiHost)
  return Array.from(new Set(hosts))
}

/** 主机是否命中显式白名单（全等比较、大小写不敏感；不做后缀/子域通配） */
export function isAllowedUpdateHost(host: unknown, apiBase: unknown, runtimeOrigin = ''): boolean {
  if (typeof host !== 'string') return false
  return updateHostAllowlist(apiBase, runtimeOrigin).includes(host.toLowerCase())
}

/** `updateUrl` 判据：`https:` 硬闸 + 主机必须命中白名单，否则禁止 `plus.runtime.openURL` */
export function validateUpdateUrl(raw: unknown, apiBase: unknown, runtimeOrigin = ''): Verdict {
  const hard = hardenedHttpsUrl(raw, 'updateUrl')
  if (!hard.parsed) return deny(hard.reason)
  const parsed = hard.parsed
  if (!isAllowedUpdateHost(parsed.host, apiBase, runtimeOrigin)) {
    return deny(`updateUrl 主机 ${parsed.host} 未命中集中白名单 ⇒ 禁止打开`)
  }
  return PASS
}

// ====================== 决策：把四组判据串成一次可单测的结论 ======================

export type UpdateActionKind = 'none' | 'wgt' | 'open-url'

export interface UpdateDecision {
  /** 是否提示"发现新版本"——**只由 semver 严格更高决定**（任务书 §二.1） */
  prompt: boolean
  /** 可执行动作：`.wgt` 直装 / 打开下载页 / 无可信动作 */
  kind: UpdateActionKind
  packageUrl: string
  expectedSha256: string
  openUrl: string
  /** 不提示 / 关闭某条通道的原因（单测与排障都要能点名） */
  reason: string
}

export interface UpdateDecisionContext {
  currentVersion: string
  apiBase: string
  runtimeOrigin?: string
}

function decide(kind: UpdateActionKind, prompt: boolean, reason: string, patch?: Partial<UpdateDecision>): UpdateDecision {
  return { prompt, kind, packageUrl: '', expectedSha256: '', openUrl: '', reason, ...patch }
}

/**
 * 后端下发的 `LatestAppVersion` ⇒ 唯一决策（纯函数，端上分支只负责展示，不再自行判据）。
 * 顺序即判据：① semver 严格更高才提示；② `.wgt` 直装必须**同时**过 packageUrl 同源硬闸与合法摘要，
 * 任一不过 ⇒ 自动直装关闭，转 ③；③ `updateUrl` 必须过白名单硬闸，否则连跳转也不做。
 */
export function decideUpdateAction(data: unknown, ctx: UpdateDecisionContext): UpdateDecision {
  if (!data || typeof data !== 'object') {
    return decide('none', false, '响应不是对象 ⇒ 不提示')
  }
  const row = data as Record<string, unknown>
  const versionName = typeof row.versionName === 'string' ? row.versionName.trim() : ''
  if (!isRemoteVersionNewer(versionName, ctx.currentVersion)) {
    return decide('none', false, `远端版本 ${versionName || '<空>'} 未严格高于本地 ${ctx.currentVersion || '<空>'}（等值/降级/非法 semver 均不提示）`)
  }
  const content = `新版本 v${versionName}`
  const packageUrl = typeof row.packageUrl === 'string' ? row.packageUrl.trim() : ''
  const updateUrl = typeof row.updateUrl === 'string' ? row.updateUrl.trim() : ''
  const origin = ctx.runtimeOrigin ?? ''

  if (packageUrl !== '') {
    const packageVerdict = validatePackageUrl(packageUrl, ctx.apiBase, origin)
    const expectedSha = normalizeSha256Hex(row.packageSha256)
    if (packageVerdict.ok && expectedSha !== null) {
      return decide('wgt', true, content, { packageUrl, expectedSha256: expectedSha })
    }
    // ★ 失败关闭：包地址不可信 **或** 摘要缺失/格式非法 ⇒ 一律不自动直装（后端补字段前 .wgt 通道就是关的）
    const blockedReason = !packageVerdict.ok
      ? packageVerdict.reason
      : `后端未下发合法 packageSha256（缺失或非 64 位 hex）⇒ .wgt 自动直装关闭，本单预期结果；联调阻塞于后端契约`
    const urlVerdict = validateUpdateUrl(updateUrl, ctx.apiBase, origin)
    if (updateUrl !== '' && urlVerdict.ok) {
      return decide('open-url', true, `${content}；${blockedReason}，改走白名单下载页`, { openUrl: updateUrl })
    }
    return decide('none', true, `${content}；${blockedReason}，且 updateUrl 不可信（${urlVerdict.ok ? '为空' : urlVerdict.reason}）⇒ 不做任何自动动作`)
  }

  const urlVerdict = validateUpdateUrl(updateUrl, ctx.apiBase, origin)
  if (updateUrl !== '' && urlVerdict.ok) {
    return decide('open-url', true, content, { openUrl: updateUrl })
  }
  // 只有新版本、没有任何可信的更新通道：仍提示（版本判据成立），但不执行自动动作
  return decide('none', true, `${content}；无可信更新通道（updateUrl ${updateUrl === '' ? '为空' : urlVerdict.reason}）⇒ 只提示不自动执行`)
}
