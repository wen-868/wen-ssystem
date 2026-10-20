/**
 * QODER-15 · utils/format.ts 单元测试（表驱动）
 *
 * 运行方式（本工作树基线无门禁设施，harness 借入自 9fd90257，见回传卡 §五）：
 *   cd <工作树>/app-mobile
 *   git show 9fd90257:app-mobile/vitest.config.ts > vitest.config.ts
 *   node ../node_modules/vitest/vitest.mjs run
 *
 * 覆盖任务书点名的 7 类输入：12.34 / '12.34' / 0 / null / undefined / '' / NaN，
 * 另加边界：'-0'、'abc'、1e-7、' 12.34 '、千分位串、±Infinity、boolean、数组、负价。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { toNum, fmtAmount } from '@/utils/format'

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
