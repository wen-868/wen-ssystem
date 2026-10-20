/**
 * QODER-1 门 3 · 测试② 存储加解密往返（`src/utils/crypto.ts`：PBKDF2 派生密钥 + AES-256-GCM）
 * ⚠️ 该文件带 uni 条件编译双份导出（S3-245 修复前现状），本仓测试依赖
 *    `vitest.config.ts` 的 `uni-ifdef-shim` 插件按 **H5 分支**真实代码加载。
 * 反测面：改动 encrypt/decrypt/deriveKey 任一导致密文不还原或 tag 校验失效 ⇒ 本用例必红并点名。
 * QODER-13F1 追加静态断言（挂在下方「tag 校验失败即抛」用例的断言列表里，不新增 describe/it、用例数不变）：
 * `src/utils/pin-ssl.ts` 文件头不得残留已失效旧事实，且 `installSslPinning(` 在 src 下不得出现调用点。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deriveKey, encrypt, decrypt } from '../src/utils/crypto'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const PIN_SSL = join(SRC_DIR, 'utils', 'pin-ssl.ts')

/**
 * 收集 src 下 `installSslPinning(` 的**调用点**（定义行 `export function installSslPinning` 与
 * 注释/文档块提及一律不计），返回 `文件:行号` 清单。与 `rg -n 'installSslPinning\(' app-mobile/src`
 * 的人工判据同语义：调用点必须恒为 0（本卡未接线）。
 */
function collectInstallCallSites(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectInstallCallSites(p, out)
      continue
    }
    if (!/\.(ts|vue)$/.test(entry.name)) continue
    readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (!line.includes('installSslPinning(')) return
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return
      if (t.startsWith('export function installSslPinning')) return
      out.push(`${p}:${i + 1}`)
    })
  }
  return out
}

/**
 * 求值时机说明（QODER-13F1 首版踩坑后更正）：静态事实与调用点清单一律在**模块加载期（import 阶段）**
 * 一次性求值，用例体内只做常数比较。原因：扫全 `src`（189 个 .ts/.vue、约 2.2 MB）本机实测
 * 1.1~1.8 s，叠加同一用例内的 GCM 篡改/错误密钥运算后偶发越过 vitest 默认 5000 ms 用例超时
 * （⇒ 门 3 红「Test timed out in 5000ms」）。移到 import 阶段后断言语义、"注入旧文案即红"与
 * 用例数 5/56 均不变，只消除超时抖动。
 */
const PIN_SSL_TEXT = readFileSync(PIN_SSL, 'utf8')
const INSTALL_CALL_SITES = collectInstallCallSites(SRC_DIR)

describe('存储加解密往返（AES-256-GCM）', () => {
  const key = deriveKey('unit-test-fingerprint')

  it('派生密钥为 32 字节且同输入可复现', () => {
    expect(key.length).toBe(32)
    const again = deriveKey('unit-test-fingerprint')
    expect(Array.from(again)).toEqual(Array.from(key))
  })

  it('明文往返一致（含中文与 JSON 结构）', () => {
    const payload = JSON.stringify({ token: 'abc-中文-token', n: 42 })
    const enc = encrypt(payload, key)
    expect(enc.iv && enc.ciphertext && enc.tag).toBeTruthy()
    expect(decrypt(enc, key)).toBe(payload)
  })

  it('同一条明文两次加密得到不同密文（IV 随机）', () => {
    const a = encrypt('same-text', key)
    const b = encrypt('same-text', key)
    expect(a.ciphertext === b.ciphertext && a.iv === b.iv).toBe(false)
    expect(decrypt(a, key)).toBe('same-text')
    expect(decrypt(b, key)).toBe('same-text')
  })

  it('tag 校验失败即抛（密文/认证标签被篡改时绝不返回明文）', () => {
    const enc = encrypt('top-secret', key)
    const bad = { ...enc, tag: enc.tag.slice(0, -4) + 'AAAA' }
    expect(() => decrypt(bad, key)).toThrow()
    const wrongKey = deriveKey('another-fingerprint')
    expect(() => decrypt(enc, wrongKey)).toThrow()

    // —— QODER-13F1 静态断言（同属「被篡改/失效内容绝不静默放行」契约，不新增 it；
    //    求值已在上方模块加载期完成，此处仅常数比较）——
    expect(PIN_SSL_TEXT.includes('2026-09-15')).toBe(false)
    expect(PIN_SSL_TEXT.toLowerCase().includes('trustasia')).toBe(false)
    expect(INSTALL_CALL_SITES).toEqual([])
  })
})
