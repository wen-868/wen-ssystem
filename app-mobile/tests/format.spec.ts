/**
 * QODER-15 · utils/format.ts 单元测试（表驱动）
 * QODER-15F1 · 追加 isBelowCost 低价判定用例（字符串字典序误判复现 + 无效值口径）
 *
 * 运行方式（基线 dfeedbc0 起 app-mobile 常驻门禁，直接走包装器，不要再手拼 vitest）：
 *   cd <工作树>/app-mobile
 *   npm run test
 *
 * 覆盖任务书点名的 7 类输入：12.34 / '12.34' / 0 / null / undefined / '' / NaN，
 * 另加边界：'-0'、'abc'、1e-7、' 12.34 '、千分位串、±Infinity、boolean、数组、负价。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { toNum, fmtAmount, isBelowCost } from '@/utils/format'

describe('toNum — 归一化为有限 number | null', () => {
  it.each([
    ['number 有效值 12.34', 12.34, 12.34],
    ['数字字符串 "12.34"', '12.34', 12.34],
    ['有效 0（合法价格，不得吞掉）', 0, 0],
    ['字符串 "0"', '0', 0],
    ['null', null, null],
    ['undefined', undefined, null],
    ['空字符串', '', null],
    ['NaN', NaN, null],
    ['+Infinity', Infinity, null],
    ['-Infinity', -Infinity, null],
    ['负零 -0 归一为 0（避免 "-0.00"）', -0, 0],
    ['字符串 "-0" 归一为 0', '-0', 0],
    ['前后空白 " 12.34 "', ' 12.34 ', 12.34],
    ['千分位 "1,234.56"', '1,234.56', 1234.56],
    ['纯空白串 "   "（Number 会转 0，必须拦截）', '   ', null],
    ['非数字字符串 "abc"', 'abc', null],
    ['科学计数极小值 1e-7', 1e-7, 1e-7],
    ['负价格 -12.5', -12.5, -12.5],
  ] as const)('%s', (_label, input, expected) => {
    const actual = toNum(input)
    if (expected === null) {
      expect(actual).toBeNull()
    } else {
      expect(actual).toBe(expected)
      // Object.is 语义校验，确保 -0 与 0 不混淆
      expect(Object.is(actual, expected)).toBe(true)
    }
  })

  it('boolean / 对象 / 数组等类型不做隐式转换，一律 null', () => {
    expect(toNum(true as never)).toBeNull()
    expect(toNum({} as never)).toBeNull()
    expect(toNum([1] as never)).toBeNull()
  })
})

describe('fmtAmount — 无效值统一 "—"，有效 0 输出 "0.00"', () => {
  it.each([
    ['有效值 12.34', 12.34, '12.34'],
    ['数字字符串 "12.34"', '12.34', '12.34'],
    ['有效 0 → 0.00', 0, '0.00'],
    ['字符串 "0" → 0.00', '0', '0.00'],
    ['null → —', null, '—'],
    ['undefined → —', undefined, '—'],
    ['空字符串 → —', '', '—'],
    ['NaN → —', NaN, '—'],
    ['-0 → 0.00（不出现 -0.00）', -0, '0.00'],
    ['"abc" → —', 'abc', '—'],
    ['" 12.34 " → 12.34', ' 12.34 ', '12.34'],
    ['"1,234.56" → 1234.56', '1,234.56', '1234.56'],
    ['1e-7 舍入到两位小数 → 0.00', 1e-7, '0.00'],
    ['负价格 -12.5 → -12.50', -12.5, '-12.50'],
    ['DECIMAL 字符串 99.999 四舍五入 → 100.00', '99.999', '100.00'],
  ] as const)('%s', (_label, input, expected) => {
    expect(fmtAmount(input)).toBe(expected)
  })
})

describe('白屏回归实证 — 旧写法崩溃 / 新写法安全', () => {
  // 模拟后端 DECIMAL 以字符串/null 下发时的四种价格字段
  const apiRows = [
    { costPrice: '12.34', retailPrice: null, storePrice: '0', miniappPrice: undefined },
    { costPrice: 12.34, retailPrice: 0, storePrice: null, miniappPrice: '88.88' },
  ]

  it('旧模板写法 x.toFixed(2) 对 null/undefined 直接抛 TypeError（即白屏根因）', () => {
    for (const row of apiRows) {
      for (const v of Object.values(row)) {
        if (v === null || v === undefined || typeof v === 'string') {
          expect(() => (v as any).toFixed(2)).toThrow(TypeError)
        }
      }
    }
  })

  it('新模板写法 fmtAmount(x) 全部不抛，且 null/undefined 显示 —、0 显示 0.00', () => {
    const rendered = apiRows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, `¥${fmtAmount(v as any)}`]),
      ),
    )
    expect(rendered[0]).toEqual({
      costPrice: '¥12.34',
      retailPrice: '¥—',
      storePrice: '¥0.00',
      miniappPrice: '¥—',
    })
    expect(rendered[1]).toEqual({
      costPrice: '¥12.34',
      retailPrice: '¥0.00',
      storePrice: '¥—',
      miniappPrice: '¥88.88',
    })
  })

  it('真实 Vue 模板文本与 fmtAmount 渲染口径一致（防口径漂移）', () => {
    const vuePath = fileURLToPath(
      new URL('../src/pages-sub/product/price-anomaly/price-anomaly.vue', import.meta.url),
    )
    const text = readFileSync(vuePath, 'latin1')
    for (const field of ['costPrice', 'retailPrice', 'storePrice', 'miniappPrice']) {
      expect(text).toContain(`¥{{ fmtAmount(item.${field}) }}`)
    }
  })
})

/* ------------------------------------------------------------------ *
 * QODER-15F1 · isBelowCost —— 低价标红判定归一化
 * ------------------------------------------------------------------ */

describe('isBelowCost — 字符串价格必须按数值比（QODER-15F1 卡点名缺陷复现）', () => {
  it.each([
    // ★ 卡点名的那一条：JS 字符串比较 '9.00' < '12.00' 为 false（首字符 '9' > '1'），数值上 9 < 12 应为 true
    ['字符串低价 "9.00" vs "12.00"（字典序会漏判）', '9.00', '12.00', true],
    ['字符串高价反向 "12.00" vs "9.00"', '12.00', '9.00', false],
    ['字典序另一向 "1000.00" vs "999.00"（字典序会误标红）', '1000.00', '999.00', false],
    ['同值字符串 "9.00" vs "9"（相等不算低于成本）', '9.00', '9', false],
    ['前后空白串 " 9.00 " vs " 12.00 "', ' 9.00 ', ' 12.00 ', true],
    ['千分位串 "1,234.56" vs "2,000.00"', '1,234.56', '2,000.00', true],
    ['千分位串反向 "2,000.00" vs "1,234.56"', '2,000.00', '1,234.56', false],
    ['字符串 vs number 混合 "9.00" vs 12', '9.00', 12, true],
  ] as const)('%s', (_label, retail, cost, expected) => {
    expect(isBelowCost(retail, cost)).toBe(expected)
  })
})

describe('isBelowCost — number 侧数值语义与边界', () => {
  it.each([
    ['9 < 12 为 true', 9, 12, true],
    ['12 < 9 为 false', 12, 9, false],
    ['12 < 12 相等为 false', 12, 12, false],
    ['0 < 1 为 true（有效 0 不当无效吞掉）', 0, 1, true],
    ['0 < 0 相等为 false', 0, 0, false],
    ['-0 与 0 视为相等，为 false', -0, 0, false],
    ['负价 -1 < 0 为 true', -1, 0, true],
    ['极小差值 11.999 < 12 为 true', 11.999, 12, true],
  ] as const)('%s', (_label, retail, cost, expected) => {
    expect(isBelowCost(retail, cost)).toBe(expected)
  })
})

describe('isBelowCost — 任一侧无效值一律 false（不得依赖隐式转换）', () => {
  const invalid: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['空字符串', ''],
    ['纯空白字符串', '   '],
    ['NaN', NaN],
    ['非数字字符串 "abc"', 'abc'],
    ['+Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['boolean true（Number(true)===1 会造出假判定）', true],
    ['空对象 {}', {}],
    ['数组 [9]', [9]],
  ]

  it.each(invalid)('retail = %s ⇒ false（cost 给有效值 12）', (_label, retail) => {
    expect(isBelowCost(retail as never, 12)).toBe(false)
  })

  it.each(invalid)('cost = %s ⇒ false（retail 给有效值 9）', (_label, cost) => {
    expect(isBelowCost(9, cost as never)).toBe(false)
  })

  it('两侧都无效 ⇒ false', () => {
    expect(isBelowCost(null, undefined)).toBe(false)
    expect(isBelowCost('', NaN)).toBe(false)
  })

  it('无效值不参与比较的反例对照：裸 `<` 会因隐式转换造出错判', () => {
    // 记录 JS 原生行为（模板里直接写 `<` 的真实结果），说明为什么必须走 isBelowCost：
    // null < 12 → true（null 被隐式转成 0，凭空标红）；'9.00' < '12.00' → false（字典序漏判）
    const rawLt = (a: any, b: any) => a < b
    expect(rawLt(null, 12)).toBe(true)
    expect(rawLt('9.00', '12.00')).toBe(false)
    expect(isBelowCost(null, 12)).toBe(false)
    expect(isBelowCost('9.00', '12.00')).toBe(true)
  })

  it('判定口径与显示口径同源：fmtAmount 能出数值的组合，isBelowCost 必按该数值比较', () => {
    // 页面同时用 fmtAmount 显示与 isBelowCost 标红，两者共用 toNum，不允许"显示 9.00/12.00 却不标红"
    expect(fmtAmount('9.00')).toBe('9.00')
    expect(fmtAmount('12.00')).toBe('12.00')
    expect(isBelowCost('9.00', '12.00')).toBe(true)
    expect(toNum('9.00')).toBe(9)
    expect(toNum('12.00')).toBe(12)
  })
})

