/**
 * QODER-13F2 · `src/utils/pin-ssl.ts` 在册事实静态守卫（独立 spec）
 *
 * 为什么独立成文件：QODER-13F1 曾把这几条断言塞进 `storage-crypto.spec.ts` 的
 * 「tag 校验失败即抛（密文/认证标签被篡改时绝不返回明文）」用例里，凌舟裁定**不认可**——
 * 测试名与守护对象不一致，红了看不出守的是谁。本文件只守 pin-ssl 一件事，`storage-crypto.spec.ts`
 * 已还原为纯 AES/GCM 往返用例。
 *
 * 守的四条（任一破即红，且红点只落在这一个 `it`）：
 *  1. 文件头**不得残留**已失效旧事实 `2026-09-15`。该日期属 TrustAsia 时代的叶子到期口径；自 `1b61811b`
 *     起在册指纹已换成 2026-10-21 采集的现网 Let's Encrypt 值，再写"已于 2026-09-15 过期"就是假话。
 *  2. 文件头**不得残留**旧签发机构名 `TrustAsia`（大小写不敏感）。
 *  3. 文件头**必须保留**现网两条叶子的实际到期日（api.onepan.cn 2026-11-11、m.onepan.cn 2026-12-22）。
 *     只删假话而不写真值，后续维护者同样无从判断在册指纹是否仍在有效期内——这属于卡 §二.3 的"正向"半边。
 *  4. `installSslPinning(` 在 `src` 下的调用点必须恒为 0（本模块**仍未接线**；接线是另一张卡的动作面）。
 *
 * 求值时机：静态事实与调用点清单一律在**模块加载期（import 阶段）**求值，用例体内只做常数比较。
 * 扫全 `src`（189 个 .ts/.vue、约 2.2 MB）本机实测 1.1~1.8 s，写进 `it` 体内会吃掉 vitest 默认
 * 5000 ms 用例超时的大半预算，在并发负载下随机假红（QODER-13F1 踩坑实录：
 * `docs/evidence/qoder-13f1/raw/32-timeout-before-fix.log`）。
 *
 * 反测（须能红）：把旧文案原样注回文件头 / 只注 `TrustAsia` / 抹掉叶子到期日 / 在任意 src 文件加一处
 * `installSslPinning()` 调用 ⇒ 本 `it` 红并点名对应断言行；`cp` 复原后同形态 SHA256 与注入前逐字节一致 ⇒ 复跑转绿。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const PIN_SSL = join(SRC_DIR, 'utils', 'pin-ssl.ts')

/**
 * 取文件的**起始块注释**内容（首个块注释结束符之前的部分）。
 * 断言只作用于文件头：叶子到期日在 `PINNED_CERTS` 常量旁注释里也各出现一次，
 * 若按全文比对，常量旁注释会替文件头"顶包"——文件头被改坏也可能读到绿。
 */
function headBlock(text: string): string {
  const end = text.indexOf('*/')
  return end === -1 ? text : text.slice(0, end)
}

/**
 * 收集 `src` 下 `installSslPinning(` 的**调用点**（返回 `文件:行号` 清单）。
 * 与人工判据 `rg -n 'installSslPinning\(' app-mobile/src` 同语义：定义行
 * （`export function installSslPinning`）与注释行（以双斜线、块注释起始符或星号开头）一律不计。
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

const PIN_SSL_HEAD = headBlock(readFileSync(PIN_SSL, 'utf8'))
const INSTALL_CALL_SITES = collectInstallCallSites(SRC_DIR)

describe('pin-ssl 在册事实静态守卫（QODER-13F2）', () => {
  it('文件头无失效旧文案、保留现网叶子到期日，且 installSslPinning 调用点恒为 0', () => {
    // ① 旧日期表述不得回潮
    expect(PIN_SSL_HEAD.includes('2026-09-15'), 'pin-ssl.ts 文件头又出现已失效的 2026-09-15 过期表述').toBe(false)
    // ② 旧签发机构名不得回潮
    expect(PIN_SSL_HEAD.toLowerCase().includes('trustasia'), 'pin-ssl.ts 文件头又出现 TrustAsia 旧签发链表述').toBe(false)
    // ③ 现网叶子到期日必须在册（api / m 两条）
    expect(PIN_SSL_HEAD.includes('2026-11-11'), 'pin-ssl.ts 文件头缺少 api.onepan.cn 叶子到期日 2026-11-11').toBe(true)
    expect(PIN_SSL_HEAD.includes('2026-12-22'), 'pin-ssl.ts 文件头缺少 m.onepan.cn 叶子到期日 2026-12-22').toBe(true)
    // ④ 未接线：调用点必须为空
    expect(
      INSTALL_CALL_SITES,
      `installSslPinning 出现调用点（本模块仍未接线）：${INSTALL_CALL_SITES.join(', ')}`
    ).toEqual([])
  })
})
