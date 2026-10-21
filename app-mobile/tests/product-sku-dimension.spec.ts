/**
 * QODER-26 · SKU/SPU 维度与路径参数门禁（映射单测 + 维度守卫 + 请求路径实证 + 静态源门）
 *
 * 覆盖任务书 §二 的交付物 6 与反测三组：
 *  · 交付物 6「映射单测」：同一 SPU 两个 SKU ⇒ 两个不同 `id`、`spuId` 相同、`skuId` 各自正确
 *    （describe A/B，直接跑 `mapProductRecords` 本体，不是复制一份逻辑）；
 *  · 交付物 4「改价必须拿真实 skuId + 守卫」：describe C（守卫行为）与 D（**请求路径逐条断言**，
 *    在 request 层 mock 上取真实 URL —— 不看任何 UI 成功提示）；
 *  · 反测三组的落点：describe E 的静态源门（E1/E8/E6）。
 *    AT1 把列表映射的 `const skuId = toNumericId(r.skuId)` 改回 `r.spuId ?? r.id` ⇒ A2/A3/E1/E2 红；
 *    AT2 把改价实参改回 `updateSkuPrice(Number(p.id)` ⇒ E8/E9 红；
 *    AT3 把批次号包装注回数字 id 路径 ⇒ E6 红。
 *
 * ⚠️ 静态扫描一律在 **import 阶段**求值（模块顶层读文件并把计数算成常数），
 *    `it` 体内只做常数比较——否则冷跑时 import 阶段可 ~200s，vitest 默认 5000ms 用例会随机假红。
 *    运行：cd 工作树根 && npm --workspace app-mobile run test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* ────────────────────────────────────────────────────────────────────────────
 * request 层装置：把"真实发出去的路径"变成可断言读数（本卡验收要求逐条实证 skuId）
 * ──────────────────────────────────────────────────────────────────────────── */
const reqMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))
vi.mock('../src/api/request', () => ({
  get: reqMock.get,
  post: reqMock.post,
  put: reqMock.put,
  del: reqMock.del,
}))

import {
  mapProductRecords,
  assertSkuId,
  assertSpuId,
  skuIdOfProduct,
  updateSkuPrice,
  updateSku,
  getProductDetail,
  setMarketingTags,
  productsApi,
  skuGuardLog,
  type ProductInfo,
} from '../src/api/modules/products'

/* ────────────────────────────────────────────────────────────────────────────
 * 确定性夹具：一个 SPU（spuId=7）下挂两个 SKU（skuId=41/42），字段名逐字对齐
 * 后端 product.service.ts:259-273 的列表 SQL 别名（spuId / skuId / skuCode / availableQty …）
 * ──────────────────────────────────────────────────────────────────────────── */
const SKU_A = {
  spuId: 7,
  skuId: 41,
  skuCode: 'SPU007-500ML',
  barcode: '6901000000041',
  name: '验收用酒·同SPU双规格',
  categoryId: 3,
  categoryName: '白酒',
  brandName: '验收品牌',
  unit: '瓶',
  specs: '500ml 瓶装',
  retailPrice: '100.00',
  wholesalePrice: '90.00',
  storePrice: '95.00',
  miniappPrice: '98.00',
  costPrice: '60.00',
  availableQty: 10,
  warningThreshold: 5,
  status: 'ON_SALE',
  allowOnlineSale: 1,
}
const SKU_B = {
  ...SKU_A,
  skuId: 42,
  skuCode: 'SPU007-BOX',
  barcode: '6901000000042',
  specs: '500ml*6 整箱',
  retailPrice: '560.00',
  wholesalePrice: '520.00',
  storePrice: '540.00',
  miniappPrice: '550.00',
  costPrice: '350.00',
  availableQty: 8,
  warningThreshold: 2,
}
/** 列表两行的 SKU 行主键（夹具常数，红了即知是哪一行被顶替） */
const ID_A = 41
const ID_B = 42
/** 同 SPU 的 SPU 主键（详情维度） */
const SPU = 7

function twoSkuRecords(): any[] {
  return [structuredClone(SKU_A), structuredClone(SKU_B)]
}

/* ────────────────────────────────────────────────────────────────────────────
 * 静态源门读数：import 阶段一次性求值（协议 §四.7）
 * ──────────────────────────────────────────────────────────────────────────── */
function readSrc(rel: string): string {
  // latin1 逐字节读取，与换行形态（worktree-crlf）无关，只关心字符串是否在册
  return readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'latin1')
}
/**
 * 取「代码视图」：注释行/行尾注释/HTML 注释一律剥掉后再计数。
 * 口径对齐 `scripts/check-contract.mjs` 的 COMMENT_LINE_RE（注释行不算调用）；
 * 本卡实现里**故意把旧缺陷字面量写进注释作根因留痕**（例如 `id: r.spuId ?? r.id`），
 * 若连注释一起扫就会自撞红，故负向门只检代码视图——注入到真代码里照样红（反测已实测）。
 */
function codeOf(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\/\/|\*|\/\*|<!--|import\b)/.test(line))
    .map((line) => line.replace(/\/\/[^'"`]*$/, '').replace(/<!--.*?-->/g, ''))
    .join('\n')
}
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1
}
/** 跨行字面量用正则计数（CRLF/LF 通吃，避免 worktree-crlf 形态下漏匹配） */
function countRe(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

const SRC_PRODUCTS = codeOf(readSrc('api/modules/products.ts'))
const SRC_BATCHES = codeOf(readSrc('api/modules/batches.ts'))
const SRC_BATCH_PRICE = codeOf(readSrc('pages-sub/product/batch-price/batch-price.vue'))
const SRC_PRODUCTS_PAGE = codeOf(readSrc('pages/products/products.vue'))
const SRC_CREATE_SALE = codeOf(readSrc('pages/sales/create-sale.vue'))
const SRC_HOME = codeOf(readSrc('pages/home/home.vue'))
const SRC_PRICE_REVIEW = codeOf(readSrc('pages-sub/product/price-review/price-review.vue'))
/** 由 api 层修复收口的下游站点（不改文件，但必须钉住它们依赖的 id===skuId 不变式） */
const SRC_TRANSFER = codeOf(readSrc('pages-sub/finance/transfer/create.vue'))
const SRC_LOSS = codeOf(readSrc('pages-sub/finance/loss-gain/create-loss.vue'))
const SRC_GAIN = codeOf(readSrc('pages-sub/finance/loss-gain/create-gain.vue'))
const SRC_DETAIL = codeOf(readSrc('pages/products/product-detail.vue'))

/** 反测 AT1 的注入靶：列表映射里"SKU 行主键从哪来"的那一行 */
const SKU_ID_SOURCE_LINE = 'const skuId = toNumericId(r.skuId)'
/** 旧缺陷字面量（顶替 SKU / 编码混进 skuId） */
const OLD_SPU_TOP = 'id: r.spuId ?? r.id'
const OLD_CODE_MIX = 'skuId: r.skuId ?? r.skuCode'
/** 旧 SPU 合并（跨规格累加库存）残留 */
const OLD_SPU_MERGE = 'merged.set('
const OLD_STOCK_ACC = 'exist.stock'

const STATIC = {
  skuIdSourceLine: countOf(SRC_PRODUCTS, SKU_ID_SOURCE_LINE),
  oldSpuTop: countOf(SRC_PRODUCTS, OLD_SPU_TOP),
  oldCodeMix: countOf(SRC_PRODUCTS, OLD_CODE_MIX),
  oldSpuMerge: countOf(SRC_PRODUCTS, OLD_SPU_MERGE),
  oldStockAcc: countOf(SRC_PRODUCTS, OLD_STOCK_ACC),
  /** 映射对象必须以 SKU 行主键开头 */
  idFromSku: countOf(SRC_PRODUCTS, '      id: skuId,'),
  spuFieldKept: countRe(SRC_PRODUCTS, /spuId,\r?\n\s*skuId,/),
  /** 交付物 5：批次追踪死包装必须已从 products 模块消失（反测 AT3 靶） */
  batchTrace: countOf(SRC_PRODUCTS, 'batchTrace'),
  batchNo: countOf(SRC_PRODUCTS, 'batchNo'),
  invBatchInterp: countOf(SRC_PRODUCTS, 'inventory-batch/batches/${'),
  /** 数字批次追踪的唯一在册封装（batches.ts，与本模块去重） */
  batchesTraceNumeric: countOf(SRC_BATCHES, 'async trace(id: number)'),
  batchesTraceInterp: countOf(SRC_BATCHES, 'inventory-batch/batches/${id}/trace'),
  /** 交付物 4：批量改价调用点（反测 AT2 靶） */
  priceCall: countOf(SRC_BATCH_PRICE, 'updateSkuPrice('),
  priceCallViaGuard: countOf(SRC_BATCH_PRICE, 'skuIdOfProduct(p'),
  priceCallWithRowId: countOf(SRC_BATCH_PRICE, 'updateSkuPrice(Number(p.id)'),
  /** 交付物 2/3：商品列表 :key 用 SKU id，详情跳转用 spuId */
  listKeyItem: countOf(SRC_PRODUCTS_PAGE, ':key="item.id"'),
  detailTapSpu: countOf(SRC_PRODUCTS_PAGE, '@tap="goDetail(item.spuId)"'),
  detailTapRowId: countOf(SRC_PRODUCTS_PAGE, '@tap="goDetail(item.id)"'),
  scanDetailSpu: countOf(SRC_PRODUCTS_PAGE, 'goDetail(matched.spuId)'),
  homeDetailSpu: countOf(SRC_HOME, 'product-detail?id=${matched.spuId}'),
  homeDetailRowId: countOf(SRC_HOME, 'product-detail?id=${matched.id}'),
  /** 交付物 2：销售页加购去重/待选数量/明细 productId 均 SKU 维度 */
  saleProductId: countOf(SRC_CREATE_SALE, 'productId: product.id,'),
  salePickQtyKey: countOf(SRC_CREATE_SALE, 'pendingPicks[product.id]'),
  saleListKey: countOf(SRC_CREATE_SALE, ':key="product.id"'),
  saleNameIdentity: countOf(SRC_CREATE_SALE, 'p.name === name'),
  /** 核价列表 :key 收口为 SKU 行主键 */
  reviewKeyItem: countOf(SRC_PRICE_REVIEW, ':key="item.id"'),
  reviewKeySkuCode: countOf(SRC_PRICE_REVIEW, ':key="item.skuId"'),
  /** 下游"列表行 id 直接当 skuId 提交"的站点（依赖 id===skuId 不变式，必须钉住） */
  transferSkuId: countOf(SRC_TRANSFER, 'skuId: Number(p.skuId ?? p.id)'),
  lossSkuId: countOf(SRC_LOSS, 'skuId: product.id,'),
  gainSkuId: countOf(SRC_GAIN, 'skuId: product.id,'),
  /** 详情页：spuId 只用于 SPU 端点，改价/改 SKU 用 detail.skus[].id（后端 = t_product_sku.id） */
  detailSpuFromResponse: countOf(SRC_DETAIL, 'spuId.value = d.id'),
  detailPriceBySkuRowId: countOf(SRC_DETAIL, 'updateSkuPrice(skuItem.id'),
  detailSkuBySkuRowId: countOf(SRC_DETAIL, 'updateSku(skuItem.id'),
  detailPriceBySpuId: countOf(SRC_DETAIL, 'updateSkuPrice(spuId.value'),
  /** 守卫必须在册（防维度混用的三件套） */
  guardExports:
    countOf(SRC_PRODUCTS, 'export function assertSkuId') +
    countOf(SRC_PRODUCTS, 'export function assertSpuId') +
    countOf(SRC_PRODUCTS, 'export function skuIdOfProduct'),
}

beforeEach(() => {
  reqMock.get.mockReset()
  reqMock.post.mockReset()
  reqMock.put.mockReset()
  reqMock.del.mockReset()
})

/* ══════════════════════════════════════════════════════════════════════════
 * A · 交付物 6：同一 SPU 两个 SKU 的两个不同 id
 * ══════════════════════════════════════════════════════════════════════════ */
describe('A · 列表映射是 SKU 粒度（同 SPU 双 SKU ⇒ 两行不同 id）', () => {
  const rows = mapProductRecords(twoSkuRecords())

  it('返回 2 行（不得再按 spuId 合并成 1 行）', () => {
    expect(rows.length).toBe(2)
  })

  it('两行 id 互不相同，且等于各自的 SKU 行主键', () => {
    expect(rows.map((r) => r.id)).toEqual([ID_A, ID_B])
    expect(rows[0]!.id).not.toBe(rows[1]!.id)
  })

  it('两行 spuId 相同（详情维度仍是同一个 SPU）', () => {
    expect(rows.map((r) => r.spuId)).toEqual([SPU, SPU])
  })

  it('两行 skuId 各自正确（与 id 同值，不再是 skuCode）', () => {
    expect(rows.map((r) => r.skuId)).toEqual([ID_A, ID_B])
    expect(rows[0]!.skuId).not.toBe(SKU_A.skuCode)
    expect(rows[1]!.skuId).not.toBe(SKU_B.skuCode)
  })

  it('每行 id===skuId（财务调拨/报损/盘盈直接把列表行 id 当 skuId 提交，靠这条不变式才不会送 spuId）', () => {
    expect(rows.every((r) => r.id === r.skuId)).toBe(true)
  })

  it('库存按各自 SKU 行读数，不跨规格累加', () => {
    expect(rows.map((r) => r.stock)).toEqual([10, 8])
    // 旧实现按 spuId 合并会产出一行 stock=18；这里两行都必须各自独立
    expect(rows.some((r) => r.stock === 18)).toBe(false)
  })

  it('五档价格按各自 SKU 行读数（改价/核价才不会串档）', () => {
    expect(rows[0]!.retailPrice).toBe(100)
    expect(rows[1]!.retailPrice).toBe(560)
    expect(rows[0]!.wholesalePrice).toBe(90)
    expect(rows[1]!.wholesalePrice).toBe(520)
    expect(rows[0]!.costPrice).toBe(60)
    expect(rows[1]!.costPrice).toBe(350)
  })

  it('其余派生字段逐行独立（预警阈值/规格文案未被合并）', () => {
    expect(rows.map((r) => r.safetyStock)).toEqual([5, 2])
    expect(rows.map((r) => r.specs)).toEqual(['500ml 瓶装', '500ml*6 整箱'])
    expect(rows.map((r) => r.status)).toEqual(['ON', 'ON'])
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * B · 红线：不得用编码/条码/名称顶替 SKU 主键
 * ══════════════════════════════════════════════════════════════════════════ */
describe('B · 无效 SKU 主键的行被跳过并留守卫日志', () => {
  it('缺 skuId 的行被丢弃（即便带 skuCode 也不拿来当 id）', () => {
    const bad = { ...SKU_A, skuId: undefined, skuCode: 'SPU007-500ML', barcode: '6901000000041' }
    expect(mapProductRecords([bad, structuredClone(SKU_B)]).map((r) => r.id)).toEqual([ID_B])
  })

  it('丢弃时写守卫日志，点名不得用 spuId/skuCode/barcode/name 顶替', () => {
    mapProductRecords([{ ...SKU_A, skuId: null }])
    expect(skuGuardLog.some((l) => l.includes('缺正整数 skuId') && l.includes('顶替'))).toBe(true)
  })

  it('只有条码/名称的行被丢弃（条码不是唯一身份）', () => {
    expect(mapProductRecords([{ barcode: '6901000000041', name: '验收用酒' }]).length).toBe(0)
  })

  it('同一 skuId 重复出现只保留首行（防御 JOIN 放大，不做跨行合并）', () => {
    const dup = mapProductRecords([
      structuredClone(SKU_A),
      { ...structuredClone(SKU_A), availableQty: 99 },
    ])
    expect(dup.length).toBe(1)
    expect(dup[0]!.stock).toBe(10)
    expect(skuGuardLog.some((l) => l.includes('重复出现'))).toBe(true)
  })

  it('后端把 BIGINT 序列化成数字字符串时仍可判定为主键', () => {
    const rows = mapProductRecords([
      { ...SKU_A, skuId: '41', spuId: '7' },
      { ...SKU_B, skuId: '42', spuId: '7' },
    ])
    expect(rows.map((r) => r.id)).toEqual([ID_A, ID_B])
    expect(rows.map((r) => r.spuId)).toEqual([SPU, SPU])
  })

  it('skuCode/条码形态字符串一律判为无效主键', () => {
    for (const v of ['SPU007-500ML', '6901000000041X', '  ', '']) {
      expect(mapProductRecords([{ ...SKU_A, skuId: v }]).length).toBe(0)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * C · 维度守卫（防 id/spuId/skuId 混用）
 * ══════════════════════════════════════════════════════════════════════════ */
describe('C · 维度守卫行为', () => {
  it('assertSkuId 放行正整数（含数字字符串）', () => {
    expect(assertSkuId(ID_A, 't')).toBe(ID_A)
    expect(assertSkuId('41', 't')).toBe(ID_A)
  })

  it.each([0, -2, NaN, 'SPU007-500ML', undefined, null])('%# 非正整数 skuId ⇒ 抛错', (v) => {
    expect(() => assertSkuId(v, 'case')).toThrow(/SKU维度守卫/)
  })

  it.each([0, undefined, 'abc'])('%# 非正整数 spuId ⇒ 抛错', (v) => {
    expect(() => assertSpuId(v, 'case')).toThrow(/SPU维度守卫/)
  })

  it('skuIdOfProduct：id 与 skuId 同值时返回真实 skuId', () => {
    const rows = mapProductRecords(twoSkuRecords())
    expect(skuIdOfProduct(rows[1]!, 'case')).toBe(ID_B)
  })

  it('skuIdOfProduct：id 被换成 spuId（维度混用）⇒ 抛错点名"不同值"', () => {
    const rows = mapProductRecords(twoSkuRecords())
    const polluted = { ...rows[0]!, id: SPU } as ProductInfo
    expect(() => skuIdOfProduct(polluted, 'case')).toThrow(/不同值/)
  })

  it('抛错读数同时进 skuGuardLog（无 console 也可取证）', () => {
    try {
      assertSkuId(0, 'probe')
    } catch {
      /* 抛错即预期，读数在 skuGuardLog */
    }
    expect(skuGuardLog.some((l) => l.includes('probe'))).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * D · 请求路径逐条实证（在 request 层取真实 URL，不看 UI 提示）
 * ══════════════════════════════════════════════════════════════════════════ */
describe('D · 路径参数实证', () => {
  it('updateSkuPrice(41) ⇒ PUT 路径就是 /admin/products/41/price（SKU 维度）', async () => {
    reqMock.put.mockResolvedValue({ ok: 1 })
    await updateSkuPrice(ID_A, { retailPrice: 108 })
    expect(reqMock.put).toHaveBeenCalledTimes(1)
    expect(reqMock.put.mock.calls[0]![0]).toBe('/admin/products/41/price')
    expect(reqMock.put.mock.calls[0]![1]).toEqual({ retailPrice: 108 })
  })

  it('updateSkuPrice 对同 SPU 的两个 SKU 打两条不同路径（不会写同一行）', async () => {
    reqMock.put.mockResolvedValue({})
    const rows = mapProductRecords(twoSkuRecords())
    for (const p of rows) {
      await updateSkuPrice(skuIdOfProduct(p, 'case'), { retailPrice: 1 })
    }
    expect(reqMock.put.mock.calls.map((c) => c[0])).toEqual([
      '/admin/products/41/price',
      '/admin/products/42/price',
    ])
  })

  it('updateSkuPrice 拿到无效主键 ⇒ 拒发请求（0 次 PUT）', async () => {
    await expect(updateSkuPrice(0, { retailPrice: 1 })).rejects.toThrow(/SKU维度守卫/)
    expect(reqMock.put).toHaveBeenCalledTimes(0)
  })

  it('updateSku(42) ⇒ PUT /admin/products/skus/42（SKU 维度）', async () => {
    reqMock.put.mockResolvedValue({})
    await updateSku(ID_B, { traceEnabled: true })
    expect(reqMock.put.mock.calls[0]![0]).toBe('/admin/products/skus/42')
  })

  it('getProductDetail(7) ⇒ GET /admin/products/7（详情仍是 SPU 维度）', async () => {
    reqMock.get.mockResolvedValue({ result: { id: SPU, skus: [] } })
    await getProductDetail(SPU)
    expect(reqMock.get.mock.calls[0]![0]).toBe('/admin/products/7')
  })

  it('getProductDetail 拿到无效 spuId ⇒ 拒发请求', async () => {
    await expect(getProductDetail(0)).rejects.toThrow(/SPU维度守卫/)
    expect(reqMock.get).toHaveBeenCalledTimes(0)
  })

  it('setMarketingTags(7) ⇒ PUT /admin/products/7/marketing-tags（SPU 维度）', async () => {
    reqMock.put.mockResolvedValue({})
    await setMarketingTags(SPU, ['新品'])
    expect(reqMock.put.mock.calls[0]![0]).toBe('/admin/products/7/marketing-tags')
  })

  it('productsApi.list ⇒ GET /admin/products 并返回两行 SKU（id 41/42、spuId 同为 7）', async () => {
    reqMock.get.mockResolvedValue({ result: { records: twoSkuRecords(), total: 2 } })
    const res = await productsApi.list({ page: 1, pageSize: 20 })
    expect(reqMock.get.mock.calls[0]![0]).toBe('/admin/products')
    expect(res.list.map((r) => r.id)).toEqual([ID_A, ID_B])
    expect(res.list.map((r) => r.spuId)).toEqual([SPU, SPU])
    expect(res.list.map((r) => r.skuId)).toEqual([ID_A, ID_B])
  })

  it('productsApi.list 的 total 透传后端 COUNT(*)（按 SKU 行计数）', async () => {
    reqMock.get.mockResolvedValue({ result: { records: twoSkuRecords(), total: 57 } })
    expect((await productsApi.list()).total).toBe(57)
  })

  it('productsApi.detail 走 SPU 维度路径', async () => {
    reqMock.get.mockResolvedValue({ result: { id: SPU } })
    await productsApi.detail(SPU)
    expect(reqMock.get.mock.calls[0]![0]).toBe('/admin/products/7')
  })

  it('点卡片用的 spuId 与加购用的 id 是两个不同读数（同 SPU 双 SKU 夹具）', () => {
    const rows = mapProductRecords(twoSkuRecords())
    const spuKeys = new Set(rows.map((r) => r.spuId))
    const skuKeys = new Set(rows.map((r) => r.id))
    expect(spuKeys.size).toBe(1)
    expect(skuKeys.size).toBe(2)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * E · 静态源门（反测靶；全部为 import 阶段算好的常数比较）
 * ══════════════════════════════════════════════════════════════════════════ */
describe('E · 静态源门', () => {
  it('E1 列表映射的 SKU 主键来源行恰好 1 处（反测 AT1 靶）', () => {
    expect(STATIC.skuIdSourceLine).toBe(1)
  })

  it('E2 products.ts 不再用 spuId 顶替 id', () => {
    expect(STATIC.oldSpuTop).toBe(0)
  })

  it('E3 products.ts 不再把 skuCode 混进 skuId', () => {
    expect(STATIC.oldCodeMix).toBe(0)
  })

  it('E4 映射对象以 SKU 行主键开头，并保留 spuId/skuId 两字段', () => {
    expect(STATIC.idFromSku).toBe(1)
    expect(STATIC.spuFieldKept).toBe(1)
  })

  it('E5 SPU 合并/跨 SKU 累加库存的残留计数为 0', () => {
    expect(STATIC.oldSpuMerge).toBe(0)
    expect(STATIC.oldStockAcc).toBe(0)
  })

  it('E6 批次追踪死包装已从 products 模块消失（反测 AT3 靶）', () => {
    expect(STATIC.batchTrace).toBe(0)
    expect(STATIC.batchNo).toBe(0)
    expect(STATIC.invBatchInterp).toBe(0)
  })

  it('E7 数字批次追踪的唯一在册封装仍在 batches.ts（未长成第二份）', () => {
    expect(STATIC.batchesTraceNumeric).toBe(1)
    expect(STATIC.batchesTraceInterp).toBe(1)
  })

  it('E8 批量改价调用点恰好 1 处且必经 skuIdOfProduct 取号（反测 AT2 靶）', () => {
    expect(STATIC.priceCall).toBe(1)
    expect(STATIC.priceCallViaGuard).toBe(1)
  })

  it('E9 批量改价不再把行主键表达式裸传 updateSkuPrice', () => {
    expect(STATIC.priceCallWithRowId).toBe(0)
  })

  it('E10 商品列表 :key 用 SKU 行主键、进详情用 spuId', () => {
    expect(STATIC.listKeyItem).toBe(1)
    expect(STATIC.detailTapSpu).toBe(1)
    expect(STATIC.detailTapRowId).toBe(0)
    expect(STATIC.scanDetailSpu).toBe(1)
  })

  it('E11 首页扫码进详情同样用 spuId', () => {
    expect(STATIC.homeDetailSpu).toBe(1)
    expect(STATIC.homeDetailRowId).toBe(0)
  })

  it('E12 销售页加购去重/待选数量/明细 productId 均 SKU 维度', () => {
    expect(STATIC.saleProductId).toBe(2)
    expect(STATIC.salePickQtyKey).toBe(6)
    expect(STATIC.saleListKey).toBe(1)
  })

  it('E13 销售页不得再用名称当身份定位新商品', () => {
    expect(STATIC.saleNameIdentity).toBe(0)
  })

  it('E14 核价搜索结果 :key 收口为 SKU 行主键', () => {
    expect(STATIC.reviewKeyItem).toBe(1)
    expect(STATIC.reviewKeySkuCode).toBe(0)
  })

  it('E15 维度守卫三件套在 products 模块导出在册', () => {
    expect(STATIC.guardExports).toBe(3)
  })

  it('E16 财务三处"列表行 id ⇒ skuId"提交站点仍在册（本卡靠 api 层收口，未改文件）', () => {
    expect(STATIC.transferSkuId).toBe(1)
    expect(STATIC.lossSkuId).toBe(1)
    expect(STATIC.gainSkuId).toBe(1)
  })

  it('E17 详情页改价/改 SKU 走 detail.skus[].id，SPU 端点才用 spuId（不得反向）', () => {
    expect(STATIC.detailPriceBySkuRowId).toBe(1)
    expect(STATIC.detailSkuBySkuRowId).toBe(1)
    expect(STATIC.detailSpuFromResponse).toBe(1)
    expect(STATIC.detailPriceBySpuId).toBe(0)
  })
})
