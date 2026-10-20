/**
 * QODER-15 · 静态断言门 —— 价格异常页禁止对原始 API 值直接 .toFixed()
 * QODER-15F1 · 追加「低价标红」静态门 + :class 表达式行为门（反测目标门）
 *
 * 断言对象：src/pages-sub/product/price-anomaly/price-anomaly.vue（模板文本，非编译产物）。
 * 这是反测目标门：任何人把页面金额显示改回裸 `.toFixed()`、或把标红判定改回原始 `<` 比较，
 * 本文件立刻变红并点名到具体写法。
 * 运行方式：cd app-mobile && npm run test（基线 dfeedbc0 起为常驻门禁）
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isBelowCost } from '@/utils/format'

const VUE_PATH = fileURLToPath(
  new URL('../src/pages-sub/product/price-anomaly/price-anomaly.vue', import.meta.url),
)

function readPage(): string {
  // latin1 逐字节读取，与 vitest/编辑器换行无关
  return readFileSync(VUE_PATH, 'latin1')
}

describe('price-anomaly.vue 金额显示静态门', () => {
  const fields = ['costPrice', 'retailPrice', 'storePrice', 'miniappPrice'] as const

  it('fmtAmount( 在页面中出现且仅出现 4 次（四处金额显示）', () => {
    const count = (readPage().match(/fmtAmount\(/g) ?? []).length
    expect(count).toBe(4)
  })

  it.each(fields)('页面不再对原始 API 值 %s 直接调用 .toFixed()', (field) => {
    const text = readPage()
    const bare = new RegExp(`item\\.${field}\\.toFixed\\s*\\(`)
    expect(bare.test(text)).toBe(false)
    expect(text).toContain(`fmtAmount(item.${field})`)
  })

  it('页面引入了公共工具 @/utils/format 的 fmtAmount', () => {
    expect(readPage()).toContain("import { fmtAmount } from '@/utils/format'")
  })

  it('全页不存在任何对 item.*Price 的裸 .toFixed() 调用', () => {
    const text = readPage()
    expect(/item\.[A-Za-z]*Price\.toFixed\s*\(/.test(text)).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * QODER-15F1 · 低价标红判定门
 *   静态门：:class 必须调用 isBelowCost，不得再出现原始 `<` 直接比较
 *   行为门：把模板里 :class 的真实表达式抠出来求值——改回裸 `<` 时，
 *          字符串低价用例必红（'9.00' < '12.00' 字典序为 false ⇒ 漏标红）
 * ------------------------------------------------------------------ */

describe('price-anomaly.vue 低价标红静态门（QODER-15F1）', () => {
  const CALL = 'isBelowCost(item.retailPrice, item.costPrice)'
  const RAW = 'item.retailPrice < item.costPrice'

  it(':class 标红判定调用 isBelowCost，且全页恰好出现 1 次', () => {
    const count = (readPage().match(/isBelowCost\(/g) ?? []).length
    expect(count).toBe(1)
    expect(readPage()).toContain(CALL)
  })

  it('页面不再直接比较原始 API 值 item.retailPrice < item.costPrice', () => {
    expect(readPage()).not.toContain(RAW)
  })

  it('全页不存在任何 item.*Price < item.*Price 形态的裸价格比较', () => {
    const text = readPage()
    expect(/item\.[A-Za-z]*Price\s*<\s*item\.[A-Za-z]*Price/.test(text)).toBe(false)
  })

  it('页面从 @/utils/format 引入 isBelowCost（判定与显示同源）', () => {
    const text = readPage()
    expect(text).toContain("import { isBelowCost } from '@/utils/format'")
    expect(text).toContain("import { fmtAmount } from '@/utils/format'")
  })
})

describe('price-anomaly.vue :class 表达式行为门（QODER-15F1 反测目标）', () => {
  /** 抠出模板里 'price-danger' 的实际绑定表达式（不复制代码，防止口径漂移） */
  function priceDangerExpr(): string {
    const m = readPage().match(/'price-danger':\s*([\s\S]+?)\s*\}"/)
    if (!m) {
      throw new Error(
        "模板里找不到 { 'price-danger': ... } 绑定 ⇒ 标红判定入口被删除/改动，门必须红",
      )
    }
    return m[1]
  }

  /** 以模板表达式 + 真实 isBelowCost 复现页面标红结果（作用域 = item + 页面 import 的工具） */
  function isMarkedDanger(item: { retailPrice: any; costPrice: any }): boolean {
    // eslint-disable-next-line no-new-func
    const fn = new Function('item', 'isBelowCost', 'return (' + priceDangerExpr() + ')')
    return Boolean(fn(item, isBelowCost))
  }

  it('绑定表达式确实走归一化工具（而非裸 `<`）', () => {
    expect(priceDangerExpr()).toBe('isBelowCost(item.retailPrice, item.costPrice)')
  })

  it.each([
    ['字符串低价 retail "9.00" / cost "12.00" ⇒ 必须标红（卡点名复现）', '9.00', '12.00', true],
    ['字符串高价 retail "12.00" / cost "9.00" ⇒ 不标红', '12.00', '9.00', false],
    ['字典序反向 retail "1000.00" / cost "999.00" ⇒ 不得误标红', '1000.00', '999.00', false],
    ['相等 retail "9.00" / cost "9" ⇒ 不标红', '9.00', '9', false],
    ['千分位 retail "1,234.56" / cost "2,000.00" ⇒ 标红', '1,234.56', '2,000.00', true],
    ['number retail 9 / cost 12 ⇒ 标红', 9, 12, true],
    ['number retail 12 / cost 9 ⇒ 不标红', 12, 9, false],
    ['retail null / cost "12.00" ⇒ 无效值不标红', null, '12.00', false],
    ['retail "9.00" / cost null ⇒ 无效值不标红', '9.00', null, false],
    ['retail undefined / cost undefined ⇒ 无效值不标红', undefined, undefined, false],
    ['retail 空串 / cost "" ⇒ 无效值不标红', '', '', false],
    ['retail NaN / cost 12 ⇒ 无效值不标红', NaN, 12, false],
  ] as const)('%s', (_label, retail, cost, expected) => {
    expect(isMarkedDanger({ retailPrice: retail, costPrice: cost })).toBe(expected)
  })
})
