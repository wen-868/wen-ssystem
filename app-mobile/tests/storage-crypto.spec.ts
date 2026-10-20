/**
 * QODER-1 门 3 · 测试② 存储加解密往返（`src/utils/crypto.ts`：PBKDF2 派生密钥 + AES-256-GCM）
 * ⚠️ 该文件带 uni 条件编译双份导出（S3-245 修复前现状），本仓测试依赖
 *    `vitest.config.ts` 的 `uni-ifdef-shim` 插件按 **H5 分支**真实代码加载。
 * 反测面：改动 encrypt/decrypt/deriveKey 任一导致密文不还原或 tag 校验失效 ⇒ 本用例必红并点名。
 */
import { describe, it, expect } from 'vitest'
import { deriveKey, encrypt, decrypt } from '../src/utils/crypto'

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
  })
})
