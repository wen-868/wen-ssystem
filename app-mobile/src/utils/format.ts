/**
 * 数值/金额显示格式化工具（QODER-15 · 价格异常页数值入口止血）
 *
 * 背景：后端 DECIMAL 字段可能以**字符串**（如 '12.34'）或 **null** 下发，
 * 模板若直接对原始 API 值调用 `.toFixed()`，字符串/null 会抛 TypeError 导致页面白屏。
 * 本工具是所有金额显示的唯一安全入口：先归一化为 number，再格式化；
 * 无法识别的值统一返回占位符 `—`，有效 0 输出 `0.00`（0 是合法价格，不得当无效吞掉）。
 *
 * 与 `utils/price.ts` 的分工：price.ts 负责**价格可见性/权限判断**（客户类型 → 可见字段），
 * 本文件只负责**原始数值的归一化与显示格式化**，两者互不依赖、互不越界。
 */

/** 金额入参：兼容后端 DECIMAL 下发的全部形态（number / 数字字符串 / null / undefined） */
export type NumericInput = number | string | null | undefined

/**
 * 把任意下发形态归一化为有限 number；无法识别时返回 null（绝不返回 NaN，避免污染显示）。
 *
 * 取值规则（QODER-15 裁定口径）：
 * - `null` / `undefined` → null（字段缺失，显示占位符）
 * - `number`：有限数原样；`NaN` / `±Infinity` → null（无效数值）
 * - `-0`（含 `'-0'`）→ 归一为 `0`，否则 `(-0).toFixed(2)` 会显示 `-0.00`
 * - `string`：先 trim（容忍 `' 12.34 '`），再剥千分位逗号（容忍 `'1,234.56'`），
 *   空串/纯空白 → null（注意 `Number('') === 0`，必须显式拦截，否则空值会被显示成 0.00）；
 *   其余交给 `Number()`（可同时覆盖 `'12.34'`、科学计数等合法数字串），结果非有限 → null（如 `'abc'`）
 * - 其它类型（boolean / 对象 / 数组）→ null：不做隐式转换（`Number(true) === 1` 会造出假价格）
 */
export function toNum(value: NumericInput): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value === 0 ? 0 : value
  }
  if (typeof value === 'string') {
    const s = value.trim().replace(/,/g, '')
    if (s === '') return null
    const n = Number(s)
    if (!Number.isFinite(n)) return null
    return n === 0 ? 0 : n
  }
  return null
}

/**
 * 金额显示格式化：有效值输出两位小数（0 → `'0.00'`），无效值统一输出 `'—'`。
 * 不携带货币符号——`¥` 前缀属于页面模板的展示层，由各页面自行拼接。
 */
export function fmtAmount(value: NumericInput): string {
  const n = toNum(value)
  return n === null ? '—' : n.toFixed(2)
}
