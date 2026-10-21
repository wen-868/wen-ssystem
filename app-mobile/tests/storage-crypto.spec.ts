/**
 * QODER-1 门 3 · 测试② 存储加解密往返（`src/utils/crypto.ts`：PBKDF2 派生密钥 + AES-256-GCM）
 * ⚠️ 该文件带 uni 条件编译双份导出（S3-245 修复前现状），本仓测试依赖
 *    `vitest.config.ts` 的 `uni-ifdef-shim` 插件按 **H5 分支**真实代码加载。
 * 反测面：改动 encrypt/decrypt/deriveKey 任一导致密文不还原或 tag 校验失效 ⇒ 本用例必红并点名。
 * QODER-23 追加反测面：`aesGcmDecrypt` 的**认证标签长度守卫**（tag.length !== 16 即返回 null）
 *   ⇒ 摘掉守卫则「非规范长度标签（18 字节）」用例必红并点名；「确定性翻转 tag[0]」用例守的是
 *   常量时间比较本身（与长度守卫无关），两条各守一处，红了可直接定位是哪一面坏。
 * QODER-23F1 追加反测面：`aesGcmDecrypt` 的**IV 规范长度守卫**（iv.length !== 12 即在构造 J0 前返回 null）
 *   与**短 tag（15 字节）拒绝**。两条守卫分别可摘、红各归各的：
 *   · 摘 IV 守卫（反测 R-IV）⇒「13 字节零填充同型」「11 字节截尾同型」两条解密成功不抛错必红，
 *     「17 字节」条抛的是未分类 RangeError（消息不匹配 /解密失败/）同样必红；
 *   · 摘 tag 守卫（反测 R-TAG）⇒「18 字节」与「15 字节」两条静默通过必红并点名。
 *   短 tag / 短 IV 用例采用**确定性构造**（加密侧重采样直到关键字节为 0x00，命中即停），
 *   原因：越界读 undefined 经 ToInt32 归 0，只有期望字节恰为 0 时摘守卫才静默通过——
 *   不钉这个巧合，摘守卫轮会"碰巧仍抛错"而假绿（守卫前形态实测见 docs/evidence/qoder-23f1/raw/02c 与 anti/）。
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

  // ———————— 以下四条为 QODER-23F1 追加（IV 规范长度守卫 + 短 tag 拒绝） ————————

  /**
   * 断言"已分类解密失败"：必须抛 Error（非 RangeError 等未分类异常）且消息为 crypto.ts decrypt()
   * 的『AES-256-GCM 解密失败』原文前缀；绝不接受"解密成功返回明文"或异常类型漂移。
   */
  function expectClassifiedDecryptFailure(bad: { iv: string; ciphertext: string; tag: string }): void {
    let err: unknown = null
    let outcome: string | null = null
    try {
      outcome = decrypt(bad, key)
    } catch (e) {
      err = e
    }
    expect(outcome, '非规范输入绝不许解密成功返回明文').toBe(null)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe('Error') // 必须是 decrypt() 抛的已分类 Error，不是 RangeError
    expect((err as Error).message).toContain('AES-256-GCM 解密失败')
  }

  /** 加密侧重采样直到 pred 命中（0 起算返回命中序号；超上限返回 -1，由调用方断言命中） */
  function encryptUntil(pred: (enc: ReturnType<typeof encrypt>) => boolean, cap = 20000) {
    for (let n = 0; n < cap; n++) {
      const enc = encrypt('top-secret', key)
      if (pred(enc)) return { n, enc }
    }
    return { n: -1, enc: null as unknown as ReturnType<typeof encrypt> }
  }

  it('短 tag 一律拒绝（解码 15 字节、且期望 tag[15]===0 的标签必须抛已分类解密失败）', () => {
    // 确定性构造（反测 R-TAG 的点名依据）：定长比较只扫 tag[0..15]，tag 截为 15 字节后越界读
    // undefined ⇒ ToInt32 归 0 ⇒ 该轮 diff 完全取决于 expectedTag[15]。加密侧重采样直到 tag[15]===0
    //（实测约 1/256 命中，2026-10-22 探针 237 次内命中），此时若摘掉 tag 长度守卫必静默通过
    // ⇒ 本用例必红；守卫在场则 15≠16 一律返回 null ⇒ 恒抛已分类解密失败。
    const hit = encryptUntil((e) => b64ToBytes(e.tag)[15] === 0)
    expect(hit.n, '重采样上限内必须命中 tag[15]===0 的样本（实测约 256 次内）').toBeGreaterThanOrEqual(0)
    const legit = b64ToBytes(hit.enc.tag)
    expect(legit.length).toBe(16)
    expect(legit[15]).toBe(0)
    const short = legit.slice(0, 15)
    const bad = { ...hit.enc, tag: bytesToB64(short) }
    expect(b64ToBytes(bad.tag).length).toBe(15) // 钉死解码长度确为 15（15 字节 base64 无填充位，换算确定）
    expectClassifiedDecryptFailure(bad)
  })

  it('短 IV 即拒（11 字节、截尾后零填充与规范 J0 同型的 IV 必须抛已分类解密失败）', () => {
    // 确定性构造（反测 R-IV 的点名依据之一）：随机 IV 重采样直到 iv[11]===0，则截为 11 字节后
    // j0.set 零填充还原的 J0 与规范 12 字节 IV 的完全相同 ⇒ 摘掉 IV 守卫必静默解密成功、本用例必红。
    const hit = encryptUntil((e) => b64ToBytes(e.iv)[11] === 0)
    expect(hit.n, '重采样上限内必须命中 iv[11]===0 的样本（实测约 256 次内）').toBeGreaterThanOrEqual(0)
    const iv = b64ToBytes(hit.enc.iv)
    expect(iv.length).toBe(12)
    expect(iv[11]).toBe(0)
    const bad = { ...hit.enc, iv: bytesToB64(iv.slice(0, 11)) }
    expect(b64ToBytes(bad.iv).length).toBe(11)
    expectClassifiedDecryptFailure(bad)
  })

  it('长 IV 即拒·13 字节（守卫前实测静默零填充解密成功，守卫后必须抛已分类解密失败）', () => {
    // 破口本体（探针 P1 行，docs/evidence/qoder-23f1/raw/02c）：13<16 不触发 set 溢出，
    // 第 13 字节取 0x00 时零填充后的 J0 与规范 12 字节 IV 完全相同 ⇒ 守卫前解密"成功"返回原文。
    // 摘掉 IV 守卫本用例必红（不抛错）；守卫在场 ⇒ 13≠12 一律返回 null ⇒ 抛已分类解密失败。
    const enc = encrypt('top-secret', key)
    const iv = b64ToBytes(enc.iv)
    const iv13 = new Uint8Array(13)
    iv13.set(iv)
    iv13[12] = 0x00
    const bad = { ...enc, iv: bytesToB64(iv13) }
    expect(b64ToBytes(bad.iv).length).toBe(13)
    expectClassifiedDecryptFailure(bad)
  })

  it('长 IV 即拒·17 字节（守卫前实测抛未分类 RangeError，守卫后必须抛已分类解密失败）', () => {
    // 破口本体（探针 P4 行）：17>16 ⇒ j0.set(iv) 溢出抛 RangeError("offset is out of bounds")，
    // 是未分类异常、不经过 decrypt() 的解密失败口径。摘掉 IV 守卫后本用例红在 name!=='Error'/
    // 消息不含 /解密失败/；守卫在场 ⇒ 根本走不到 set，抛的是已分类解密失败。
    const enc = encrypt('top-secret', key)
    const iv17 = new Uint8Array(17)
    iv17.set(b64ToBytes(enc.iv))
    const bad = { ...enc, iv: bytesToB64(iv17) }
    expect(b64ToBytes(bad.iv).length).toBe(17)
    expectClassifiedDecryptFailure(bad)
  })
})
