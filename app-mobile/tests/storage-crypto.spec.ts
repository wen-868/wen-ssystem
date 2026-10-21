/**
 * QODER-1 门 3 · 测试② 存储加解密往返（`src/utils/crypto.ts`：PBKDF2 派生密钥 + AES-256-GCM）
 * ⚠️ 该文件带 uni 条件编译双份导出（S3-245 修复前现状），本仓测试依赖
 *    `vitest.config.ts` 的 `uni-ifdef-shim` 插件按 **H5 分支**真实代码加载。
 * 反测面：改动 encrypt/decrypt/deriveKey 任一导致密文不还原或 tag 校验失效 ⇒ 本用例必红并点名。
 * QODER-23 追加反测面：`aesGcmDecrypt` 的**认证标签长度守卫**（tag.length !== 16 即返回 null）
 *   ⇒ 摘掉守卫则「非规范长度标签（18 字节）」用例必红并点名；「确定性翻转 tag[0]」用例守的是
 *   常量时间比较本身（与长度守卫无关），两条各守一处，红了可直接定位是哪一面坏。
 */
import { describe, it, expect } from 'vitest'
import { deriveKey, encrypt, decrypt } from '../src/utils/crypto'

/**
 * 测试用 base64 ↔ 字节换算（Node 全局 atob/btoa）。
 * 与 `crypto.ts` 自研 codec 对同一串的解码结果已逐字节核对一致，见
 * `docs/evidence/qoder-23/probe/probe-b64.txt`（C2/C3/E2 三行）。
 * 之所以在测试侧独立换算：要把"tag 解码长度"和"翻转第几个字节"写成**可断言的确定量**，
 * 不能靠 base64 字符串尾部的概率性位移。
 */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

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

  it('tag 校验失败即抛（确定性翻转 tag[0]，绝不返回明文）', () => {
    const enc = encrypt('top-secret', key)
    // ① 先钉住"合法 tag 解码后恰为 16 字节"，保证下面翻转的字节一定落在被比较的 16 字节内
    const tagBytes = b64ToBytes(enc.tag)
    expect(tagBytes.length).toBe(16)
    // ② 翻转 tag[0] 最低位 ⇒ 与期望 tag 必定在 1 个字节上不同（diff 恒非 0，不依赖随机数与概率）
    tagBytes[0] ^= 0x01
    const bad = { ...enc, tag: bytesToB64(tagBytes) }
    expect(b64ToBytes(bad.tag).length).toBe(16) // 长度仍是规范 16 字节 ⇒ 本用例考的是比较逻辑而非长度守卫
    expect(() => decrypt(bad, key)).toThrow()
    const wrongKey = deriveKey('another-fingerprint')
    expect(() => decrypt(enc, wrongKey)).toThrow()
  })

  it('非规范长度 tag 一律拒绝（可解码为 18 字节的标签不得进入定长比较）', () => {
    const enc = encrypt('top-secret', key)
    const legit = b64ToBytes(enc.tag)
    expect(legit.length).toBe(16)
    // 在合法 tag 之后追加 2 字节：解码长度变 18，而**前 16 字节与合法 tag 逐字节相同**。
    // 因此若摘掉长度守卫，定长比较只会扫 tag[0..15] ⇒ diff 恒为 0 ⇒ 静默返回明文（本用例必红）。
    const padded = new Uint8Array(18)
    padded.set(legit)
    const bad = { ...enc, tag: bytesToB64(padded) }
    expect(b64ToBytes(bad.tag).length).toBe(18)
    expect(() => decrypt(bad, key)).toThrow()
  })
})
