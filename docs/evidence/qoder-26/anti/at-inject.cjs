/*
 * QODER-26 反测注入器（唯一注入装置；四轮反测共用）
 *
 * 用法：node docs/evidence/qoder-26/anti/at-inject.cjs --at=AT1|AT2|AT2b|AT3
 *   ⚠ 参数必须是 `--at=ATn` 形态（缺 `=` 会被判未知 ⇒ EXIT=9 拒写，见 QODER-13F1 坑）
 *
 * 硬闸（缺一即整轮作废）：
 *   1) 读写一律 utf8（needle 含 `⇒`/中文，latin1 读会命中 0 ⇒ 假注入，见协议 ⑤）；
 *   2) needle 命中数必须 === 1，否则 EXIT=9 且不写一字节；
 *   3) 注入后回读校验「replacement 出现 1 次且 needle 消失」，否则 EXIT=8；
 *   4) 行尾符按现场探测（本仓工作树 CRLF），needle 用数组按行 join，不硬写 \n。
 * 复原由驱动脚本用 `cp` 完成（禁 sed -i：会把 CRLF 文件整篇归一 LF）。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const PRODUCTS = 'app-mobile/src/api/modules/products.ts'
const BATCH_PRICE = 'app-mobile/src/pages-sub/product/batch-price/batch-price.vue'

const CASES = {
  /** AT1：列表映射的 SKU 行主键改回「SPU 顶替」——多 SKU 夹具必红 */
  AT1: {
    file: PRODUCTS,
    needle: ['    const skuId = toNumericId(r.skuId)'],
    replace: ['    const skuId = toNumericId(r.spuId ?? r.id)'],
  },
  /** AT2：批量改价实参改回 spuId（不再经 skuIdOfProduct 取号）——静态源门 E8/E9 必红 */
  AT2: {
    file: BATCH_PRICE,
    needle: [
      '      const skuId = skuIdOfProduct(p, `batch-price 第${i + 1}笔`)',
      '      await updateSkuPrice(skuId, payload)',
    ],
    replace: ['      await updateSkuPrice(Number(p.spuId), payload)'],
  },
  /** AT2b：skuIdOfProduct 本体改读 spuId ⇒ 运行期路径断言（D 组）必红 */
  AT2b: {
    file: PRODUCTS,
    needle: ['  const skuId = assertSkuId(p?.skuId, `${ctx}.skuId`)'],
    replace: ['  const skuId = toNumericId(p?.spuId)'],
  },
  /** AT3：把批次号字符串包装注回数字 :id 路径段——静态源门 E6 必红 */
  AT3: {
    file: PRODUCTS,
    needle: ['export { productsApi, uploadImage }'],
    replace: [
      '/** 反测 AT3 注入体（由 at-inject.cjs 写入，取证后立即 cp 复原） */',
      'export async function batchTrace(batchNo: string): Promise<any> {',
      '  return get(`/admin/products/batch/' +
        '${batchNo}' +
        '`)',
      '}',
      '',
      'export { productsApi, uploadImage }',
    ],
  },
}

function count(hay, needle) {
  return hay.split(needle).length - 1
}

function main() {
  const raw = process.argv.slice(2)
  const atArg = raw.find((a) => /^--at=AT/.test(a))
  if (!atArg) {
    console.log('INJECT_ABORT unknown argv; usage: node at-inject.cjs --at=AT1|AT2|AT2b|AT3')
    process.exit(9)
  }
  const key = atArg.slice('--at='.length)
  const c = CASES[key]
  if (!c) {
    console.log('INJECT_ABORT unknown case ' + key)
    process.exit(9)
  }
  const abs = path.join(ROOT, c.file)
  const text = fs.readFileSync(abs, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const needle = c.needle.join(eol)
  const replace = c.replace.join(eol)
  const hits = count(text, needle)
  console.log('INJECT_CASE=' + key + ' FILE=' + c.file + ' EOL=' + (eol === '\r\n' ? 'CRLF' : 'LF') + ' NEEDLE_HITS=' + hits)
  if (hits !== 1) {
    console.log('INJECT_ABORT needle hits !== 1 ⇒ 不写一字节')
    process.exit(9)
  }
  fs.writeFileSync(abs, text.replace(needle, replace), 'utf8')
  const after = fs.readFileSync(abs, 'utf8')
  const rHits = count(after, replace)
  const needleGone = count(after, needle) === 0
  console.log('INJECT_READBACK replace_hits=' + rHits + ' needle_gone=' + needleGone + ' bytes_before=' + Buffer.byteLength(text) + ' bytes_after=' + Buffer.byteLength(after))
  if (rHits !== 1 || (key !== 'AT3' && !needleGone)) {
    console.log('INJECT_ABORT readback mismatch ⇒ 本轮作废（驱动须按 INJECT_EXIT!=0 判 VOID）')
    process.exit(8)
  }
  console.log('INJECT_OK')
}

main()
