/**
 * QODER-15 · 静态断言门 —— 价格异常页禁止对原始 API 值直接 .toFixed()
 *
 * 断言对象：src/pages-sub/product/price-anomaly/price-anomaly.vue（模板文本，非编译产物）。
 * 这是反测目标门：任何人把页面金额显示改回裸 `.toFixed()`，本文件立刻变红并点名到字段。
 * 运行方式见回传卡 §五（harness 借入自 9fd90257）。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
