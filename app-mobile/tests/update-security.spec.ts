/**
 * QODER-24（MO-14）· 热更新安全判据单测（`src/config/update-security.ts` + `src/utils/update.ts` 接线面）
 *
 * 覆盖任务书 §二 的六件交付物，逐条对应四组反测（每轮只摘一个判据，目标用例必须红并点名）：
 *  ① semver 判断 —— 摘 `isRemoteVersionNewer` 的严格更高（`cmp > 0` → `cmp !== 0`）⇒ describe① 的
 *     「远端版本更低（降级）必须不提示」红；
 *  ② 同源判断 —— 摘 `validatePackageUrl` 的 `parsed.host !== apiHost` ⇒ describe② 的
 *     「主机与 API 不同源的 .wgt 必须拒装」红；
 *  ③ 摘要比较 —— 摘 `digestMatches` 的 `e === a` ⇒ describe③ 的
 *     「实算与下发不一致 / 中间字节被改 必须拒装」红；
 *  ④ 白名单 —— 摘 `isAllowedUpdateHost` 的 `includes(...)` ⇒ describe④ 的
 *     「未命中白名单的 updateUrl 禁止打开」红。
 *
 * 失败关闭口径（凌舟裁定级要求）：后端 `LatestAppVersion` **没有摘要字段**，"无摘要"不是通过 ——
 * describe⑤ 固定「缺 packageSha256 ⇒ 绝不给出 wgt 直装决策」，并要求在契约补齐前该通道保持关闭。
 *
 * 求值时机：describe⓪⓰ 的源码静态断言在**模块 import 阶段**读文件（vitest 5000ms 用例超时预算不吃进 I/O），
 * 用例体内只做常数比较（协议 §四.7）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareSemver,
  dataUrlToBytes,
  decideUpdateAction,
  deriveApiHost,
  digestMatches,
  isAllowedUpdateHost,
  isDomainHost,
  isIpAddress,
  isRemoteVersionNewer,
  isValidSemver,
  normalizeSha256Hex,
  parseHttpUrl,
  parseSemver,
  sha256HexFromBytes,
  updateHostAllowlist,
  validatePackageUrl,
  validateUpdateUrl,
  verifyPackageBytes,
} from '../src/config/update-security'

const API_BASE = 'https://api.onepan.cn/api'
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const SHA_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function utf8(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'utf8'))
}

/** 与 Node 的 SHA-256 交叉对账：证明"实算的是文件全部原始字节"，不是长度或首尾片段 */
function nodeSha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function decide(
  data: unknown,
  patch: Partial<{ currentVersion: string; apiBase: string; runtimeOrigin: string }> = {}
) {
  return decideUpdateAction(data, {
    currentVersion: '1.0.0',
    apiBase: API_BASE,
    runtimeOrigin: '',
    ...patch,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

const GOOD_PACKAGE = 'https://api.onepan.cn/download/app-1.0.1.wgt'
const GOOD_PAGE = 'https://www.onepan.cn/download'

// ==========================================================================
// ⓪ update.ts 接线面静态守卫（import 阶段求值）
// ==========================================================================
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const UPDATE_TS_TEXT = readFileSync(join(SRC_DIR, 'utils', 'update.ts'), 'utf8')

/** 取顶层函数体文本：从 `function <name>(` 到下一个顶层 `function ` 声明之前 */
function topLevelFunctionSlice(text: string, name: string): string {
  const start = text.indexOf(`function ${name}(`)
  if (start === -1) return ''
  const rest = text.slice(start + 1)
  const next = rest.search(/\n(?:export )?function /)
  return next === -1 ? text.slice(start) : text.slice(start, start + next + 1)
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1
}

const INSTALL_SLICE = topLevelFunctionSlice(UPDATE_TS_TEXT, 'installVerifiedWgt')
const DOWNLOAD_SLICE = topLevelFunctionSlice(UPDATE_TS_TEXT, 'downloadAndVerify')
const DECIDE_SLICE = topLevelFunctionSlice(UPDATE_TS_TEXT, 'handleAppUpdate')
const OPEN_URL_SLICE = topLevelFunctionSlice(UPDATE_TS_TEXT, 'promptOpenUrl')
const FORCE_INSTALL_CALLS = countOccurrences(UPDATE_TS_TEXT, 'plus.runtime.install(')
const OPEN_URL_CALLS = countOccurrences(UPDATE_TS_TEXT, 'plus.runtime.openURL(')

// ==========================================================================
// ① 纯函数 semver
// ==========================================================================
describe('QODER-24① semver：仅合法 semver 且严格更高才提示', () => {
  it('合法 semver 解析成功（含 prerelease 与 build 元数据）', () => {
    const p = parseSemver('1.2.3-alpha.1+build.5')
    expect(p).not.toBeNull()
    expect(p?.major).toBe(1)
    expect(p?.minor).toBe(2)
    expect(p?.patch).toBe(3)
    expect(p?.prerelease).toEqual(['alpha', '1'])
  })

  it('非法版本一律解析为 null（v 前缀 / 缺位 / 前导零 / 四段 / 空 / 非字符串）', () => {
    for (const bad of ['v1.0.0', '1.0', '1', '1.0.0.0', '01.0.0', '1.0.0-', '', '   ', 'abc', '1.0.0_1']) {
      expect(parseSemver(bad), `应判非法：${JSON.stringify(bad)}`).toBeNull()
      expect(isValidSemver(bad), `应判非法：${JSON.stringify(bad)}`).toBe(false)
    }
    for (const notString of [null, undefined, 1.0, { versionName: '1.0.1' }]) {
      expect(parseSemver(notString), `非字符串应判非法：${String(notString)}`).toBeNull()
    }
  })

  it('compareSemver 按数值比而非词典序（1.10.0 > 1.9.0，2.0.0 < 10.0.0）', () => {
    expect(compareSemver(parseSemver('1.10.0')!, parseSemver('1.9.0')!)).toBe(1)
    expect(compareSemver(parseSemver('2.0.0')!, parseSemver('10.0.0')!)).toBe(-1)
    expect(compareSemver(parseSemver('1.0.10')!, parseSemver('1.0.9')!)).toBe(1)
  })

  it('预发布版低于同版本正式版，且按 semver §11 逐标识符比较', () => {
    expect(isRemoteVersionNewer('1.0.0-alpha', '1.0.0')).toBe(false)
    expect(isRemoteVersionNewer('1.0.0', '1.0.0-alpha')).toBe(true)
    expect(isRemoteVersionNewer('1.0.0-alpha.1', '1.0.0-alpha')).toBe(true)
    expect(isRemoteVersionNewer('1.0.0-alpha', '1.0.0-alpha.1')).toBe(false)
    expect(isRemoteVersionNewer('1.0.0-alpha', '1.0.0-beta')).toBe(false)
    // 数字标识符按数值比：2 < 10（词典序会反过来）
    expect(isRemoteVersionNewer('1.0.0-10', '1.0.0-2')).toBe(true)
    // 数字标识符 < 字母数字标识符
    expect(isRemoteVersionNewer('1.0.0-alpha', '1.0.0-1')).toBe(true)
  })

  it('build 元数据不参与优先级（1.0.0+b 对 1.0.0+a 不算更新）', () => {
    expect(isRemoteVersionNewer('1.0.0+build.2', '1.0.0+build.1')).toBe(false)
  })

  it('★ 远端版本更低（降级）必须不提示【反测①目标用例】', () => {
    expect(isRemoteVersionNewer('0.9.9', '1.0.0')).toBe(false)
    expect(isRemoteVersionNewer('1.0.0', '1.0.1')).toBe(false)
    expect(decide({ versionName: '0.9.9', packageUrl: GOOD_PACKAGE, packageSha256: SHA_ABC }).prompt).toBe(false)
  })

  it('★ 等值版本必须不提示【反测①目标用例】', () => {
    expect(isRemoteVersionNewer('1.0.0', '1.0.0')).toBe(false)
    expect(decide({ versionName: '1.0.0', packageUrl: GOOD_PACKAGE, packageSha256: SHA_ABC }).prompt).toBe(false)
  })

  it('★ 任一侧非法 semver 必须不提示（旧实现是"名字不等就提示"）【反测①目标用例】', () => {
    for (const bad of ['', 'garbage', 'v1.0.0', '1.0.0.0', '01.0.0']) {
      expect(isRemoteVersionNewer(bad, '1.0.0'), `远端非法 ${JSON.stringify(bad)} 不应提示`).toBe(false)
      expect(decide({ versionName: bad, packageUrl: GOOD_PACKAGE, packageSha256: SHA_ABC }).prompt).toBe(false)
    }
    expect(isRemoteVersionNewer('1.0.1', 'not-a-version')).toBe(false)
  })

  it('严格更高才提示（1.0.1 > 1.0.0 ⇒ prompt=true）', () => {
    expect(isRemoteVersionNewer('1.0.1', '1.0.0')).toBe(true)
    expect(decide({ versionName: '1.0.1', updateUrl: GOOD_PAGE }).prompt).toBe(true)
  })
})

// ==========================================================================
// ② packageUrl 同源与形态
// ==========================================================================
describe('QODER-24② packageUrl：https + 无凭据 + 同源 + .wgt，否则拒装', () => {
  it('parseHttpUrl 正确切分 scheme/userinfo/host/port/path/query/hash', () => {
    const p = parseHttpUrl('HTTPS://User:Pwd@Example.COM:8443/a/b.wgt?x=1#frag')!
    expect(p.protocol).toBe('https:')
    expect(p.userinfo).toBe('User:Pwd')
    expect(p.host).toBe('example.com')
    expect(p.port).toBe('8443')
    expect(p.path).toBe('/a/b.wgt')
    expect(p.query).toBe('?x=1')
    expect(p.hash).toBe('#frag')
  })

  it('parseHttpUrl 拒绝非绝对形态（相对路径、缺 //、空主机、非法端口、非法 scheme）', () => {
    for (const bad of ['/download/app.wgt', 'https:/app.wgt', 'https://', 'https://:443/a.wgt', 'http://a.com:80x/a', '1http://a.com/a', '', '   ']) {
      expect(parseHttpUrl(bad), `应解析失败：${JSON.stringify(bad)}`).toBeNull()
    }
  })

  it('IP / 域名判定：IPv4、IPv6 字面量不得进入白名单；单标签主机与 xn-- 仿冒域名不得进入', () => {
    expect(isIpAddress('127.0.0.1')).toBe(true)
    expect(isIpAddress('[::1]')).toBe(true)
    expect(isIpAddress('api.onepan.cn')).toBe(false)
    expect(isDomainHost('127.0.0.1')).toBe(false)
    expect(isDomainHost('localhost')).toBe(false)
    expect(isDomainHost('xn--pple-43d.com')).toBe(false)
    expect(isDomainHost('api.onepan.cn')).toBe(true)
    expect(isDomainHost('onepan.cn')).toBe(true)
  })

  it('同源判定从运行时 API 基址解析主机（不做字面量比对：换基址就换结论）', () => {
    expect(deriveApiHost(API_BASE)).toBe('api.onepan.cn')
    expect(deriveApiHost('https://api.test.example.cn:443/api')).toBe('api.test.example.cn')
    expect(deriveApiHost('/api')).toBe('')
    expect(deriveApiHost('/api', 'https://m.onepan.cn')).toBe('m.onepan.cn')
    expect(deriveApiHost('', 'https://m.onepan.cn')).toBe('')
    expect(deriveApiHost(undefined)).toBe('')
    expect(validatePackageUrl('https://api.test.example.cn/app-1.0.1.wgt', 'https://api.test.example.cn/api').ok).toBe(true)
    expect(validatePackageUrl('https://api.test.example.cn/app-1.0.1.wgt', API_BASE).ok).toBe(false)
  })

  it('合法 .wgt 包地址通过（默认端口、显式 443、大小写后缀、带 query 的签名地址）', () => {
    expect(validatePackageUrl(GOOD_PACKAGE, API_BASE).ok).toBe(true)
    expect(validatePackageUrl('https://api.onepan.cn:443/dl/app.wgt', API_BASE).ok).toBe(true)
    expect(validatePackageUrl('https://api.onepan.cn/dl/APP-1.0.1.WGT', API_BASE).ok).toBe(true)
    expect(validatePackageUrl('https://api.onepan.cn/dl/app.wgt?sig=abc123', API_BASE).ok).toBe(true)
  })

  it('★ 主机与 API 不同源的 .wgt 必须拒装【反测②目标用例】', () => {
    for (const cross of [
      'https://evil.example/app-1.0.1.wgt',
      'https://api.onepan.cn.evil.example/app.wgt',
      'https://download.onepan.cn/app.wgt',
      'https://onepan.cn/app.wgt',
    ]) {
      const v = validatePackageUrl(cross, API_BASE)
      expect(v.ok, `跨主机包地址必须拒装：${cross}`).toBe(false)
      expect((v as { reason: string }).reason, `必须点名同源判据：${cross}`).toMatch(/同源/)
    }
    // 同源解析不出来（H5 相对基址且没有运行时来源）⇒ 失败关闭，连绝对包地址也不给装
    const rel = validatePackageUrl('https://m.onepan.cn/dl/app.wgt', '/api')
    expect(rel.ok).toBe(false)
    expect((rel as { reason: string }).reason).toMatch(/解析出主机/)
    // 相对包地址本身就过不了 https 绝对 URL 硬闸
    const relativeUrl = validatePackageUrl('/dl/app.wgt', API_BASE)
    expect(relativeUrl.ok).toBe(false)
    expect((relativeUrl as { reason: string }).reason).toMatch(/不是可解析的绝对 URL/)
  })

  it('协议、凭据、IP、端口、路径形态不合规一律拒装', () => {
    const denied: Array<[unknown, RegExp]> = [
      ['http://api.onepan.cn/app.wgt', /https:/],
      ['https://user:pwd@api.onepan.cn/app.wgt', /userinfo/],
      ['https://api.onepan.cn@evil.example/app.wgt', /userinfo/],
      ['https://127.0.0.1/app.wgt', /IP 字面量/],
      ['https://[::1]/app.wgt', /IP 字面量/],
      ['https://api.onepan.cn:8443/app.wgt', /非标准 443/],
      ['https://api.onepan.cn/app.apk', /\.wgt 结尾/],
      ['https://api.onepan.cn/app.wgt.exe', /\.wgt 结尾/],
      ['https://api.onepan.cn/', /\.wgt 结尾/],
      ['https://api.onepan.cn/a/../app.wgt', /归一化片段/],
      ['javascript:alert(1)', /不是可解析的绝对 URL/],
      ['https://api.onepan.cn\\.evil.example/app.wgt', /不是可解析的绝对 URL/],
      ['https://api.onepan.cn/a p.wgt', /不是可解析的绝对 URL/],
      ['', /不是可解析的绝对 URL/],
      [undefined, /不是可解析的绝对 URL/],
      [{ url: GOOD_PACKAGE }, /不是可解析的绝对 URL/],
    ]
    for (const [raw, re] of denied) {
      const v = validatePackageUrl(raw, API_BASE)
      expect(v.ok, `必须拒装：${String(raw)}`).toBe(false)
      expect((v as { reason: string }).reason, `原因须点名判据：${String(raw)}`).toMatch(re)
    }
  })

  it('非 .wgt 的包地址不会变成 wgt 直装决策（改走白名单下载页）', () => {
    const d = decide({ versionName: '1.0.1', packageUrl: 'https://evil.example/app.apk', packageSha256: SHA_ABC, updateUrl: GOOD_PAGE })
    expect(d.kind).toBe('open-url')
    expect(d.openUrl).toBe(GOOD_PAGE)
  })
})

// ==========================================================================
// ③ SHA-256 摘要（实算原始字节）
// ==========================================================================
describe('QODER-24③ 摘要：实算文件字节，缺失/非法/不一致全部拒装', () => {
  it('纯 JS sha256 与 Node crypto 逐一对账（空、单块、跨块、边界、1KB 伪随机）', () => {
    const cases: Uint8Array[] = [
      new Uint8Array(0),
      utf8('abc'),
      utf8('a'.repeat(55)),
      utf8('a'.repeat(56)),
      utf8('a'.repeat(63)),
      utf8('a'.repeat(64)),
      utf8('a'.repeat(65)),
      utf8('a'.repeat(119)),
      utf8('a'.repeat(120)),
      utf8('中文与 emoji 🍻 — uni-app'),
    ]
    for (let i = 0; i < 1024; i++) cases.push(new Uint8Array([(i * 37) % 256]))
    for (const bytes of cases) {
      expect(sha256HexFromBytes(bytes), `字节长度 ${bytes.length} 的摘要必须与 Node 一致`).toBe(nodeSha256Hex(bytes))
    }
    expect(sha256HexFromBytes(new Uint8Array(0))).toBe(SHA_EMPTY)
    expect(sha256HexFromBytes(utf8('abc'))).toBe(SHA_ABC)
  })

  it('normalizeSha256Hex 只接受整串 64 位 hex（大小写均可，前后空格可容忍）', () => {
    expect(normalizeSha256Hex(SHA_ABC)).toBe(SHA_ABC)
    expect(normalizeSha256Hex(SHA_ABC.toUpperCase())).toBe(SHA_ABC)
    expect(normalizeSha256Hex(`  ${SHA_ABC}  `)).toBe(SHA_ABC)
    const bad = [
      '',
      '   ',
      SHA_ABC.slice(0, 63),
      `${SHA_ABC}0`,
      SHA_ABC.replace(/f/g, 'g'),
      `sha256:${SHA_ABC}`,
      `${SHA_ABC} ${SHA_ABC}`,
      'z'.repeat(64),
      undefined,
      null,
      123,
      { sha: SHA_ABC },
    ]
    for (const item of bad) {
      expect(normalizeSha256Hex(item), `摘要必须判非法：${String(item)}`).toBeNull()
    }
  })

  it('digestMatches 任一侧非法即 false；合法且相等才 true', () => {
    expect(digestMatches(SHA_ABC, SHA_ABC)).toBe(true)
    expect(digestMatches(SHA_ABC, SHA_ABC.toUpperCase())).toBe(true)
    expect(digestMatches(SHA_ABC, SHA_EMPTY)).toBe(false)
    expect(digestMatches(SHA_ABC, SHA_ABC.slice(0, 63))).toBe(false)
    expect(digestMatches(null, SHA_ABC)).toBe(false)
    expect(digestMatches(SHA_ABC, undefined)).toBe(false)
  })

  it('★ 实算与下发不一致必须拒装（改首字节 / 改中间字节 / 改尾字节 / 改长度四种都得红）【反测③目标用例】', () => {
    const file = utf8('WGT-PACKAGE-CONTENT-000112233445566778899aabbccddeeff')
    const digest = sha256HexFromBytes(file)
    expect(verifyPackageBytes(file, digest).ok).toBe(true)
    const tamper = (bytes: Uint8Array, idx: number): Uint8Array => {
      const copy = new Uint8Array(bytes)
      copy[idx] = copy[idx] ^ 0xff
      return copy
    }
    const variants: Array<[string, Uint8Array]> = [
      ['首字节被改', tamper(file, 0)],
      ['中间字节被改', tamper(file, Math.floor(file.length / 2))],
      ['尾字节被改', tamper(file, file.length - 1)],
      ['长度被改（尾部追加）', new Uint8Array([...file, 0x41])],
      ['长度被改（截掉尾部）', file.slice(0, file.length - 1)],
    ]
    for (const [label, bytes] of variants) {
      const v = verifyPackageBytes(bytes, digest)
      expect(v.ok, `${label} ⇒ 必须拒装（摘要实算覆盖全部字节，不是长度或首尾片段）`).toBe(false)
      expect((v as { reason: string }).reason).toMatch(/不一致/)
    }
    // 同长度不同内容也必须拒（只校验长度是假校验）
    const sameLenDiffContent = new Uint8Array(file.length).fill(0x42)
    expect(verifyPackageBytes(sameLenDiffContent, digest).ok).toBe(false)
  })

  it('★ 摘要缺失 / 格式非 64 位 hex ⇒ 失败关闭，拒装（"无摘要"不是通过）', () => {
    const file = utf8('wgt-bytes')
    for (const missing of [undefined, null, '', '   ', 'abc', SHA_ABC.slice(0, 63), `${SHA_ABC}0`, 'zz'.repeat(32)]) {
      const v = verifyPackageBytes(file, missing)
      expect(v.ok, `摘要 ${String(missing)} 必须拒装`).toBe(false)
      expect((v as { reason: string }).reason, `必须点名摘要判据：${String(missing)}`).toMatch(/packageSha256/)
    }
  })

  it('★ 读不到原始字节 ⇒ 失败关闭不安装（禁止用 toast"提示不支持"冒充校验完成）', () => {
    const v1 = verifyPackageBytes(null, SHA_ABC)
    expect(v1.ok).toBe(false)
    expect((v1 as { reason: string }).reason).toMatch(/读不到/)
    const v2 = verifyPackageBytes(new Uint8Array(0), SHA_ABC)
    expect(v2.ok).toBe(false)
    expect((v2 as { reason: string }).reason).toMatch(/读不到/)
  })

  it('dataUrlToBytes 还原 plus.io.FileReader.readAsDataURL 的 base64 为原始字节', () => {
    const b64 = Buffer.from('abc', 'utf8').toString('base64')
    expect(dataUrlToBytes(`data:application/octet-stream;base64,${b64}`)).toEqual(utf8('abc'))
    expect(sha256HexFromBytes(dataUrlToBytes(`data:;base64,${b64}`)!)).toBe(SHA_ABC)
    const big = new Uint8Array(300).map((_, i) => i % 251)
    const bigUrl = `data:application/octet-stream;base64,${Buffer.from(big).toString('base64')}`
    expect(Array.from(dataUrlToBytes(bigUrl)!)).toEqual(Array.from(big))
    for (const bad of ['', 'data:;base64,', 'not-base64!!!', `data:;base64,${b64.slice(0, 2)}`, undefined, null, 42]) {
      expect(dataUrlToBytes(bad), `应判读不到字节：${String(bad)}`).toBeNull()
    }
  })
})

// ==========================================================================
// ④ updateUrl 白名单
// ==========================================================================
describe('QODER-24④ updateUrl：仅 https 且主机命中集中白名单', () => {
  it('白名单集中配置且至少覆盖 API 主机与官网下载主机', () => {
    const hosts = updateHostAllowlist(API_BASE)
    expect(hosts).toContain('api.onepan.cn')
    expect(hosts).toContain('www.onepan.cn')
    expect(hosts).toContain('onepan.cn')
    expect(updateHostAllowlist('https://api.other.cn/api')).toContain('api.other.cn')
  })

  it('API 主机由运行时基址派生进入白名单（基址换主机，白名单跟着换）', () => {
    const base = 'http://127.0.0.1:8080/api'
    expect(updateHostAllowlist(base)).not.toContain('127.0.0.1')
    const custom = 'https://api.qoder24-test.cn/api'
    expect(isAllowedUpdateHost('api.qoder24-test.cn', custom)).toBe(true)
    expect(validateUpdateUrl('https://api.qoder24-test.cn/download', custom).ok).toBe(true)
  })

  it('H5 相对基址：同源主机来自运行时 location.origin，解析不出主机即失败关闭', () => {
    expect(updateHostAllowlist('/api', 'https://m.onepan.cn')).toContain('m.onepan.cn')
    // 运行时来源主机是"派生"进白名单的（不是写死的字面量）
    const derived = updateHostAllowlist('/api', 'https://h5.qoder24-test.cn')
    expect(derived).toContain('h5.qoder24-test.cn')
    expect(derived.length).toBe(updateHostAllowlist('/api', '').length + 1)
    // 没有运行时来源 ⇒ 相对基址派生不出主机，白名单只剩集中配置那三条
    expect(updateHostAllowlist('/api', '')).toEqual(['www.onepan.cn', 'onepan.cn', 'm.onepan.cn'])
    expect(validateUpdateUrl(GOOD_PAGE, '/api', 'https://m.onepan.cn').ok).toBe(true)
    expect(validateUpdateUrl('https://m.onepan.cn/dl/app-1.0.1.wgt', '/api', 'https://m.onepan.cn').ok).toBe(true)
    expect(validatePackageUrl('https://h5.qoder24-test.cn/dl/app.wgt', '/api', 'https://h5.qoder24-test.cn').ok).toBe(true)
  })

  it('VITE_UPDATE_HOSTS 可追加主机（非法条目丢弃，不参与白名单）', () => {
    vi.stubEnv('VITE_UPDATE_HOSTS', ' dl.example.com , BAD_HOST, onepan.cn ,')
    const hosts = updateHostAllowlist(API_BASE)
    expect(hosts).toContain('dl.example.com')
    expect(hosts.some((h) => h.includes('bad_host'))).toBe(false)
    expect(validateUpdateUrl('https://dl.example.com/app', API_BASE).ok).toBe(true)
    vi.unstubAllEnvs()
    expect(updateHostAllowlist(API_BASE)).not.toContain('dl.example.com')
  })

  it('★ 未命中白名单的 updateUrl 禁止打开【反测④目标用例】', () => {
    for (const raw of [
      'https://evil.example/download',
      'https://www.onepan.cn.evil.example/x',
      'https://onepan.cn.evil.example/x',
      'https://api.onepan.cn.evil.example/x',
    ]) {
      const v = validateUpdateUrl(raw, API_BASE)
      expect(v.ok, `未命中白名单必须拒绝：${raw}`).toBe(false)
      expect((v as { reason: string }).reason).toMatch(/白名单/)
    }
    // 后缀/子串式仿冒不得被当成命中（全等比较）
    expect(isAllowedUpdateHost('onepan.cn.attacker.io', API_BASE)).toBe(false)
    expect(isAllowedUpdateHost('WWW.ONEPAN.CN', API_BASE)).toBe(true)
    expect(isAllowedUpdateHost('', API_BASE)).toBe(false)
    expect(isAllowedUpdateHost(undefined, API_BASE)).toBe(false)
  })

  it('updateUrl 的 https / 凭据 / IP / 端口硬闸同样生效', () => {
    const denied: Array<[string, RegExp]> = [
      ['http://www.onepan.cn/download', /https:/],
      ['https://a:b@www.onepan.cn/download', /userinfo/],
      ['https://47.111.22.33/download', /IP 字面量/],
      ['https://www.onepan.cn:8443/download', /非标准 443/],
      ['javascript://www.onepan.cn/%0aalert(1)', /协议为 javascript/],
      ['mailto:ops@onepan.cn', /不是可解析的绝对 URL/],
    ]
    for (const [raw, re] of denied) {
      const v = validateUpdateUrl(raw, API_BASE)
      expect(v.ok, `必须拒绝：${raw}`).toBe(false)
      expect((v as { reason: string }).reason, `原因须点名判据：${raw}`).toMatch(re)
    }
    expect(validateUpdateUrl('https://www.onepan.cn/download?ch=app', API_BASE).ok).toBe(true)
    expect(validateUpdateUrl('https://onepan.cn/download', API_BASE).ok).toBe(true)
    expect(validateUpdateUrl('https://api.onepan.cn/version/latest', API_BASE).ok).toBe(true)
  })

  it('★ 未命中白名单的 updateUrl 不会进入 open-url 决策', () => {
    const d = decide({ versionName: '1.0.1', updateUrl: 'https://evil.example/pay' })
    expect(d.kind).toBe('none')
    expect(d.openUrl).toBe('')
    expect(d.prompt).toBe(true)
  })
})

// ==========================================================================
// ⑤ 决策接线：四组判据串成唯一结论（失败关闭）
// ==========================================================================
describe('QODER-24⑤ 决策：失败关闭与通道选择', () => {
  it('合法 semver + 同源 .wgt + 合法摘要 ⇒ 才给出 wgt 直装决策', () => {
    const d = decide({ versionName: '1.0.1', packageUrl: GOOD_PACKAGE, packageSha256: SHA_ABC, isForce: false, updateNote: 'x' })
    expect(d.prompt).toBe(true)
    expect(d.kind).toBe('wgt')
    expect(d.packageUrl).toBe(GOOD_PACKAGE)
    expect(d.expectedSha256).toBe(SHA_ABC)
  })

  it('★ 后端无摘要字段（现状）⇒ wgt 直装通道必须关闭，改走白名单下载页（本单预期结果）', () => {
    for (const row of [
      { versionName: '1.0.1', packageUrl: GOOD_PACKAGE, updateUrl: GOOD_PAGE },
      { versionName: '1.0.1', packageUrl: GOOD_PACKAGE, packageSha256: null, updateUrl: GOOD_PAGE },
      { versionName: '1.0.1', packageUrl: GOOD_PACKAGE, packageSha256: '', updateUrl: GOOD_PAGE },
      { versionName: '1.0.1', packageUrl: GOOD_PACKAGE, packageSha256: 'abc', updateUrl: GOOD_PAGE },
    ]) {
      const d = decide(row)
      expect(d.kind, `缺/非法摘要绝不能给 wgt：${JSON.stringify(row)}`).not.toBe('wgt')
      expect(d.kind).toBe('open-url')
      expect(d.reason).toMatch(/packageSha256/)
    }
  })

  it('缺摘要且 updateUrl 也不可信 ⇒ 只提示，不做任何自动动作', () => {
    const d = decide({ versionName: '1.0.1', packageUrl: GOOD_PACKAGE, updateUrl: 'http://www.onepan.cn/dl' })
    expect(d.prompt).toBe(true)
    expect(d.kind).toBe('none')
    expect(d.openUrl).toBe('')
    expect(d.packageUrl).toBe('')
  })

  it('响应异常（null / 非对象 / versionName 非字符串）⇒ 不提示', () => {
    expect(decide(null).prompt).toBe(false)
    expect(decide(undefined).prompt).toBe(false)
    expect(decide('1.0.1').prompt).toBe(false)
    expect(decide({}).prompt).toBe(false)
    expect(decide({ versionName: 101 }).prompt).toBe(false)
  })

  it('无 packageUrl 但 updateUrl 在白名单 ⇒ open-url；两者皆无 ⇒ 只提示', () => {
    const a = decide({ versionName: '1.0.1', updateUrl: 'https://m.onepan.cn/download' })
    expect(a.kind).toBe('open-url')
    const b = decide({ versionName: '1.0.1' })
    expect(b.kind).toBe('none')
    expect(b.prompt).toBe(true)
  })

  it('版本判据先于通道判据：等值版本即使包与摘要都合法也不提示', () => {
    const d = decide({ versionName: '1.0.0', packageUrl: GOOD_PACKAGE, packageSha256: SHA_ABC })
    expect(d.prompt).toBe(false)
    expect(d.kind).toBe('none')
  })
})

// ==========================================================================
// ⓰ update.ts 接线静态守卫（无 force 直装、install 只在校验之后、openURL 只吃决策结果）
// ==========================================================================
describe('QODER-24⓰ update.ts 接线静态守卫', () => {
  it('不再存在 force 直装：plus.runtime.install 只有一处且位于 installVerifiedWgt 内、options 为 force:false', () => {
    expect(UPDATE_TS_TEXT.includes('force: true'), 'update.ts 仍出现 force: true 直装').toBe(false)
    expect(FORCE_INSTALL_CALLS, `plus.runtime.install 调用点必须恰为 1，实测 ${FORCE_INSTALL_CALLS}`).toBe(1)
    expect(INSTALL_SLICE.includes('plus.runtime.install(')).toBe(true)
    expect(INSTALL_SLICE.includes('{ force: false }')).toBe(true)
  })

  it('下载入口只有一处，且安装必须经 verifyPackageBytes 与失败删除临时文件', () => {
    expect(countOccurrences(UPDATE_TS_TEXT, 'uni.downloadFile(')).toBe(1)
    expect(DOWNLOAD_SLICE.includes('readPackageBytes(')).toBe(true)
    expect(DOWNLOAD_SLICE.includes('verifyPackageBytes(')).toBe(true)
    expect(DOWNLOAD_SLICE.includes('installVerifiedWgt(tempFilePath)')).toBe(true)
    expect(DOWNLOAD_SLICE.includes('removeTempPackage(tempFilePath')).toBe(true)
    // 校验失败分支必须在删临时文件之后才提示，且绝不进入安装
    expect(DOWNLOAD_SLICE.indexOf('verifyPackageBytes(') < DOWNLOAD_SLICE.indexOf('installVerifiedWgt(')).toBe(true)
  })

  it('plus.runtime.openURL 只有一处，且参数只能是决策产出的白名单 URL（不吃后端原始 updateUrl）', () => {
    expect(OPEN_URL_CALLS, `plus.runtime.openURL 调用点必须恰为 1，实测 ${OPEN_URL_CALLS}`).toBe(1)
    expect(OPEN_URL_SLICE.includes('plus.runtime.openURL(decision.openUrl)')).toBe(true)
    expect(UPDATE_TS_TEXT.includes('openURL(data.updateUrl)')).toBe(false)
    expect(UPDATE_TS_TEXT.includes('openURL(row.updateUrl)')).toBe(false)
  })

  it('提示与否只由纯函数 decideUpdateAction 的 prompt 决定，update.ts 内不再自写版本比较', () => {
    expect(DECIDE_SLICE.includes('decideUpdateAction(')).toBe(true)
    expect(DECIDE_SLICE.includes('if (!decision.prompt) return')).toBe(true)
    expect(UPDATE_TS_TEXT.includes('versionName === currentVersion()')).toBe(false)
    expect(UPDATE_TS_TEXT.includes("from '../config/update-security'"), 'update.ts 必须复用集中判据模块，不得自行实现').toBe(true)
  })
})
