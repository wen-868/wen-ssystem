import { get, post, put, del } from '../request'
import { API_BASE_H5, API_BASE_NATIVE } from '../../config/env'

/** API 基础地址（与 request.ts 保持一致） */
const API_BASE: string = (() => {
  // #ifdef H5
  return API_BASE_H5
  // #endif
  // #ifndef H5
  return API_BASE_NATIVE
  // #endif
})()

/**
 * ── QODER-26 · SKU/SPU 维度守卫（路径参数收口）────────────────────────────────
 * 后端商品域的两组路径段是**两个不同维度**（以后端真实注册为准，非前端变量名）：
 *   · `admin-product.routes.ts:35` GET  /products                → **SKU 粒度**行（`product.service.ts:259-273` 从 t_product_sku 出发，同查 `p.id AS spuId` 与 `s.id AS skuId`）
 *   · `:46` GET  /products/:spuId(\\d+)              → SPU
 *   · `:60` PUT  /products/:id                      → SPU（controller `:118` 读 req.params.spuId）
 *   · `:63` PUT  /products/:skuId/price             → SKU（controller `:256` 读 req.params.skuId）
 *   · `:69` PUT  /products/skus/:skuId              → SKU（controller `:152`）
 *   · `:74` PUT  /products/:spuId/marketing-tags    → SPU（controller `:296`）
 * 喂错维度＝写错对象（把 A 规格的价格改到同 SPU 的 B 规格上），所以这里把维度钉死。
 *
 * 为什么守卫不用 console 打日志：`scripts/gates-baseline.json` 的 `lint.warningsByRule.no-console`
 * 冻结为 225 条，新增任一 console.* 都会让 lint 门红（红线禁止调整 lint.* 基线）。
 * 故守卫采用两件事：①**可断言的结构化守卫日志** `skuGuardLog`（单测直接读数，页面亦可展示）；
 * ②**抛错**，由调用点**既有**的 console.error 打印（batch-price.vue 的失败分支），
 * 消息里带 id/spuId/skuId 三个读数，运维侧照样看得到。
 * ────────────────────────────────────────────────────────────────────────────
 */

/** 守卫日志环形缓冲（上限 200 条，防长跑内存泄漏）；只追加字符串，不参与业务判定 */
export const skuGuardLog: string[] = []
const GUARD_LOG_CAP = 200

function guardNote(msg: string): string {
  if (skuGuardLog.length >= GUARD_LOG_CAP) skuGuardLog.shift()
  skuGuardLog.push(msg)
  return msg
}

/**
 * 数字主键归一：只有**正整数**才算有效身份。
 * NaN / 0 / 负数 / 编码串（skuCode、条码、名称）一律归 0（＝无效身份），
 * 对应本卡红线：不得用空格、名称或条码当唯一身份替代 SKU 主键。
 */
function toNumericId(value: unknown): number {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isInteger(n) && n > 0 ? n : 0
  }
  return 0
}

/** SKU 维度断言：拿到真实 skuId 才放行，否则抛错（不发请求＝不写错对象） */
export function assertSkuId(value: unknown, ctx: string): number {
  const id = toNumericId(value)
  if (!id) {
    throw new Error(
      guardNote(
        `[SKU维度守卫] ${ctx}: 参数不是正整数 skuId（收到 ${JSON.stringify(value ?? null)}）⇒ 拒发 PUT /admin/products/:skuId/price`
      )
    )
  }
  return id
}

/** SPU 维度断言：详情/SPU 更新/营销标签只认 spuId */
export function assertSpuId(value: unknown, ctx: string): number {
  const id = toNumericId(value)
  if (!id) {
    throw new Error(
      guardNote(
        `[SPU维度守卫] ${ctx}: 参数不是正整数 spuId（收到 ${JSON.stringify(value ?? null)}）⇒ 拒发 /admin/products/:spuId 请求`
      )
    )
  }
  return id
}

/**
 * 从商品行取改价用的 skuId，并校验 `ProductInfo.id` 与 `ProductInfo.skuId` 同值。
 * 两者不同值只可能是「有人又把 SPU 主键塞进 id」＝本卡根因，宁可抛错也不发请求。
 */
export function skuIdOfProduct(p: ProductInfo, ctx: string): number {
  const skuId = assertSkuId(p?.skuId, `${ctx}.skuId`)
  const rowId = toNumericId(p?.id)
  if (rowId !== skuId) {
    throw new Error(
      guardNote(
        `[SKU维度守卫] ${ctx}: ProductInfo.id=${rowId} 与 skuId=${skuId} 不同值（疑似 spuId 顶替 SKU 主键）⇒ 拒发改价`
      )
    )
  }
  return skuId
}

/** 创建商品（后端 POST /admin/products） */
export async function createProduct(data: Record<string, any>): Promise<any> {
  return post('/admin/products', data)
}

/**
 * 商品详情（含 SKU 与单位换算链）——**SPU 维度**
 * 后端注册：`backend/src/routes/admin-product.routes.ts:46` `GET /products/:spuId(\d+)`
 * → controller `:36` `getProductDetail(Number(req.params.spuId))`。只准喂 `ProductInfo.spuId`。
 */
export async function getProductDetail(spuId: number): Promise<ProductDetail> {
  const id = assertSpuId(spuId, 'getProductDetail')
  const res: any = await get(`/admin/products/${id}`)
  return (res?.result ?? res) as ProductDetail
}

/**
 * 更新商品 SPU 字段（价格/单位属 SKU 域，后端 update 不含，详情页价格表格只读展示）
 * 后端注册：`admin-product.routes.ts:60` `PUT /products/:id` → controller `:118` 读 `spuId` ⇒ SPU 维度
 */
export async function updateProduct(spuId: number, data: ProductUpdateParams): Promise<any> {
  const id = assertSpuId(spuId, 'updateProduct')
  return put(`/admin/products/${id}`, data)
}

/** SKU 五档价格更新契约（product.controller.ts#updateProductPrice，zod 校验）
 *  miniappPrice / storePrice 允许传 null（前端清空该档价格时即传 null，后端已接受） */
export interface SkuPriceParams {
  costPrice?: number
  retailPrice?: number
  wholesalePrice?: number
  miniappPrice?: number | null
  storePrice?: number | null
}

/**
 * 更新 SKU 价格（PUT /admin/products/:skuId/price）——**SKU 维度**
 * 后端注册：`admin-product.routes.ts:63` → controller `:256` `Number(req.params.skuId)`
 * ⇒ 路径段是 skuId，喂 SPU 主键＝把价格改到同 SPU 的别的规格上（写错对象）。
 * QODER-26：入参先过 `assertSkuId` 守卫（非正整数直接抛错，不发请求），
 * 调用点请用 `skuIdOfProduct(product, ctx)` 取号，可一并校验 `ProductInfo.id` 与 `skuId` 同值。
 */
export async function updateSkuPrice(skuId: number, data: SkuPriceParams): Promise<any> {
  const id = assertSkuId(skuId, 'updateSkuPrice')
  return put(`/admin/products/${id}/price`, data)
}

/** SKU 配置更新入参（traceEnabled/warningThreshold 等可选，配合下方 PUT /admin/products/skus/:skuId） */
export interface SkuUpdateParams {
  skuName?: string
  baseUnit?: string
  boxUnit?: string
  boxRatio?: number
  traceEnabled?: boolean
  warningThreshold?: number
}
/** 更新 SKU 配置（PUT /admin/products/skus/:skuId，traceEnabled/warningThreshold 等可选）
 *  ——**SKU 维度**：后端 `admin-product.routes.ts:69` → controller `:152` `Number(req.params.skuId)` */
export async function updateSku(skuId: number, data: SkuUpdateParams): Promise<any> {
  const id = assertSkuId(skuId, 'updateSku')
  return put(`/admin/products/skus/${id}`, data)
}

/** 新增辅单位（POST /admin/products/skus/:skuId/units，units 无 costPrice 字段） */
export interface SkuUnitParams {
  unitName: string
  ratio?: number
  barcode?: string
  retailPrice?: number | null
  wholesalePrice?: number | null
  storePrice?: number | null
  miniappPrice?: number | null
}
export async function addSkuUnit(skuId: number, data: SkuUnitParams): Promise<any> {
  return post(`/admin/products/skus/${skuId}/units`, data)
}

/** 更新辅单位（PUT /admin/products/skus/:skuId/units/:unitId） */
export async function updateSkuUnit(skuId: number, unitId: number, data: Partial<SkuUnitParams>): Promise<any> {
  return put(`/admin/products/skus/${skuId}/units/${unitId}`, data)
}

/** 删除辅单位（DELETE /admin/products/skus/:skuId/units/:unitId） */
export async function deleteSkuUnit(skuId: number, unitId: number): Promise<any> {
  return del(`/admin/products/skus/${skuId}/units/${unitId}`)
}

/** 设置商品营销标签（PUT /admin/products/:spuId/marketing-tags，body {tags: string[]}）
 *  ——**SPU 维度**：后端 `admin-product.routes.ts:74` → controller `:296` `Number(req.params.spuId)` */
export async function setMarketingTags(spuId: number, tags: string[]): Promise<any> {
  const id = assertSpuId(spuId, 'setMarketingTags')
  return put(`/admin/products/${id}/marketing-tags`, { tags })
}

/** 商品详情（GET /admin/products/:spuId，含 SKU 单位换算链与四档价格） */
export interface ProductDetail {
  id: number
  name: string
  categoryId: number
  categoryName: string
  brandName?: string
  unit: string
  specs?: string
  origin?: string
  alcoholContent?: string | null
  mainImage?: string
  marketingTags?: string[]
  saleChannels?: string[]
  status: string
  isNew?: number
  isRecommend?: number
  enabled?: number
  shelfLifeOn?: number
  batchOn?: number
  createdAt?: string
  updatedAt?: string
  skus: Array<{
    id: number
    skuCode: string
    barcode?: string
    baseUnit: string
    boxUnit?: string
    boxRatio?: number
    traceEnabled?: number
    warningThreshold?: number
    costPrice: string
    retailPrice: string
    wholesalePrice: string
    miniappPrice?: string
    storePrice?: string
    availableQty: number
    units: Array<{
      id: number
      unitName: string
      ratio: string
      barcode?: string
      retailPrice: string
      wholesalePrice: string
      miniappPrice?: string
      storePrice?: string
      isBase: number
    }>
  }>
}

/** 商品更新契约（PUT /admin/products/:id，product.service.ts#updateProduct） */
export interface ProductUpdateParams {
  name?: string
  barcode?: string
  category?: string
  /** 后端 zod 只接收 brand 字符串（非 brandId），service 亦按品牌名更新 */
  brand?: string
  unit?: string
  boxRatio?: number
  specs?: string
  alcoholContent?: number | null
  origin?: string
  saleChannels?: string[]
  status?: 'DRAFT' | 'ON_SALE' | 'OFF_SALE'
  isNew?: boolean
  isRecommend?: boolean
  /** 商品启用（停用后开单/采购不可选） */
  enabled?: boolean
  /** 保质期开关（开单需录入生产日期与保质期） */
  shelfLifeOn?: boolean
  /** 批次开关（开单需选择商品批次） */
  batchOn?: boolean
  mainImage?: string
}

export interface ProductInfo {
  /**
   * **SKU 行主键**（= 后端 `s.id AS skuId`，与 `skuId` 同源同值）。
   * 商品列表 `:key`、加购去重、待选数量、销售明细 `productId`、批量改价选择集全部用它。
   * QODER-26 根因：原先写作 `id: r.spuId ?? r.id` ⇒ 同 SPU 的多 SKU 撞同一个 id（重复 :key、
   * 跨规格合并库存、改价写错对象）。**不得**再用 spuId／skuCode／条码／名称顶替它。
   */
  id: number
  /** **SPU 主键**（= 后端 `p.id AS spuId`）：点商品卡/扫码进详情用它，对齐 GET /admin/products/:spuId */
  spuId: number
  /** **SKU 主键**（数值，后端 `s.id`）：PUT /admin/products/:skuId/price 与 skus/:skuId 只认它 */
  skuId: number
  name: string
  categoryId?: number
  categoryName?: string
  brandName?: string
  barcode?: string
  price: number
  wholesalePrice?: number
  retailPrice?: number
  /** 门店售价（线下门店档，列表接口已返回，核价页需展示） */
  storePrice?: number
  /** 小程序渠道价 */
  miniappPrice?: number
  /** 成本价：受 priceResponseFilter 权限控制，无权限时为 null（须如实显示，不造假） */
  costPrice?: number | null
  stock: number
  unit: string
  image?: string
  specs?: string
  origin?: string
  safetyStock?: number
  status: 'ON' | 'OFF'
  allowOnlineSale?: number
}

export interface ProductListParams {
  page?: number
  pageSize?: number
  keyword?: string
  categoryId?: number
}

export interface ProductListResult {
  list: ProductInfo[]
  total: number
  page: number
  pageSize: number
}

/**
 * 后端商品列表行 → `ProductInfo`（**SKU 粒度：一条 SKU 一行**）
 *
 * 依据（只读后端）：`backend/src/services/admin/product.service.ts:258-301`（有关键词）
 * 与 `:307-339`（无关键词）两条 SQL 都是 `FROM t_product_sku s JOIN t_product_spu p ...`，
 * select 同时给出 `p.id AS spuId` 与 `s.id AS skuId`，`total` 也按 `COUNT(*) FROM t_product_sku` 算
 * ⇒ **列表本身就不是 SPU 维度**，前端按 spuId 合并会造出"一行代表多个规格"的假行。
 *
 * 处置（QODER-26）：
 * 1. `id`/`skuId` 取 `r.skuId`（SKU 行主键），`spuId` 取 `r.spuId`，三者语义分离；
 * 2. 不再按 spuId 合并、不再跨 SKU 累加库存（原 :319-328 的 merged 逻辑整段废除）；
 * 3. 缺正整数 skuId 的行**跳过并写守卫日志**——宁可少一行，也不让"没有 SKU 主键的行"
 *    用 spuId/skuCode/条码/名称凑身份（那样会重新长出重复 :key 与写错对象）；
 * 4. 同 skuId 重复出现只保留首行（分页边界/后端 JOIN 放大时的防御），同样写守卫日志。
 */
export function mapProductRecords(records: any[]): ProductInfo[] {
  const out: ProductInfo[] = []
  const seen = new Set<number>()
  for (const r of records) {
    const skuId = toNumericId(r.skuId)
    const spuId = toNumericId(r.spuId)
    if (!skuId) {
      guardNote(
        `[SKU维度守卫] 列表行缺正整数 skuId，已跳过（不得用 spuId/skuCode/barcode/name 顶替 SKU 主键）：spuId=${spuId || '-'} skuCode=${r?.skuCode ?? '-'} name=${r?.name ?? '-'}`
      )
      continue
    }
    if (seen.has(skuId)) {
      guardNote(`[SKU维度守卫] 列表内 skuId=${skuId} 重复出现，仅保留首行（不跨 SKU 合并库存/价格）`)
      continue
    }
    seen.add(skuId)
    out.push({
      id: skuId,
      spuId,
      skuId,
      name: r.name ?? '',
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      brandName: r.brandName ?? '',
      barcode: r.barcode ?? '',
      price: Number(r.retailPrice ?? r.price ?? 0),
      wholesalePrice: r.wholesalePrice != null ? Number(r.wholesalePrice) : Number(r.price ?? 0),
      retailPrice: r.retailPrice != null ? Number(r.retailPrice) : Number(r.price ?? 0),
      // 门店价 / 小程序价：与后端五档价格体系一致（列表接口已返回）
      storePrice: r.storePrice != null ? Number(r.storePrice) : undefined,
      miniappPrice: r.miniappPrice != null ? Number(r.miniappPrice) : undefined,
      // 成本价：权限剥离后为 null，由页面如实展示（不能当作 0）
      costPrice: r.costPrice != null ? Number(r.costPrice) : null,
      // 库存取该 SKU 行自己的 available_qty（t_inventory_balance 按 ib.sku_id JOIN），不得累加别的规格
      stock: Number(r.availableQty ?? r.stock ?? 0),
      unit: r.unit ?? '',
      image: r.mainImage ?? r.image,
      specs: r.specs,
      origin: r.origin,
      safetyStock: r.warningThreshold != null ? Number(r.warningThreshold) : undefined,
      // 后端状态枚举为大写 ON_SALE / OFF_SALE / DRAFT，上架 → ON，其余 → OFF
      status: r.status === 'ON_SALE' ? 'ON' : 'OFF',
      // 分类级 allow_online_sale：0 = 该分类商品仅线下销售
      allowOnlineSale: r.allowOnlineSale,
    })
  }
  return out
}

export interface CategoryInfo {
  id: number
  name: string
  parentId?: number
  children?: CategoryInfo[]
  allowOnlineSale?: number
}

/**
 * 平台商品库查询结果（新建商品流程扫码命中时返回）
 * category 字段故意留空（不填充），由商户在创建页手动选择
 */
export interface LibraryLookupResult {
  /** 是否命中平台商品库 */
  matched: boolean
  /** SPU 信息（命中时返回） */
  spu?: {
    id: number
    spuCode: string
    /** 商品名称（自动填充） */
    name: string
    brandId: number
    /** 品牌名称（自动填充） */
    brandName: string
    /** 规格（自动填充） */
    specs: string
    /** 单位（自动填充） */
    unit: string
    /** 主图 URL（自动填充） */
    mainImage: string
    /** 多图 JSON */
    imageUrls: string | object
    /** 扩展属性 JSON，含酒精度/产地/香型等（自动填充） */
    properties: string | object
    /** 商品简介（自动填充） */
    description: string
    /** 建议零售价 */
    suggestedRetailPrice: string
  }
  /** SKU 信息（命中时返回） */
  sku?: {
    id: number
    spuId: number
    skuCode: string
    /** 条码（自动填充） */
    barcode: string
    /** SKU 名称（自动填充） */
    skuName: string
    /** 容量/酒规格（自动填充） */
    volume: string
    /** 包装（自动填充） */
    packaging: string
    /** 基础单位（自动填充） */
    baseUnit: string
    /** 箱单位（自动填充） */
    boxUnit: string
    /** 箱规比例（自动填充） */
    boxRatio: number
    /** SKU 主图（自动填充） */
    skuImage: string
  }
  /** 品牌信息（命中时返回） */
  brand?: {
    id: number
    name: string
    logo: string
  }
}

const productsApi = {
  /**
   * 创建商品（POST /admin/products）
   * R96-04：本模块顶层原本就有独立导出的 createProduct()，但 productsApi 对象漏收，
   * create-sale.vue 快速添加商品调 productsApi.createProduct(...) 拿到 undefined，
   * 一点保存即 TypeError「createProduct is not a function」。此处收编修复。
   */
  async createProduct(data: Record<string, any>): Promise<any> {
    return createProduct(data)
  },

  async list(params?: ProductListParams): Promise<ProductListResult> {
    const res = (await get('/admin/products', params)) as any
    const raw = res?.result ?? res
    // 后端返回 records 数组（SKU 粒度），映射见 mapProductRecords：id=skuId（SKU 行主键）、spuId 另存
    const records: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    const list = mapProductRecords(records)
    return {
      list,
      total: raw?.total ?? list.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  /** 商品详情（GET /admin/products/:spuId）——**SPU 维度**，参数名收口为 spuId（原 `id` 易被误喂 SKU 主键） */
  async detail(spuId: number): Promise<ProductInfo> {
    const id = assertSpuId(spuId, 'productsApi.detail')
    const res = (await get(`/admin/products/${id}`)) as any
    return (res as any)?.result ?? res
  },

  async categories(): Promise<CategoryInfo[]> {
    // 后端分类路由 prefix 为 /api/admin/products/categories
    const res = (await get('/admin/products/categories')) as any
    const rows: any[] = res?.list ?? res ?? []
    // 后端返回下划线命名 allow_online_sale，统一映射为驼峰 allowOnlineSale
    return rows.map((c: any) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId ?? c.parent_id,
      allowOnlineSale: c.allowOnlineSale ?? c.allow_online_sale,
    }))
  },

  /**
   * QODER-26（交付物 5）· 批次追踪死包装已删除。
   * 原包装收**批次号字符串**却拼进数字主键段（后端 `inventory-batch.routes.ts:26` 注册的是
   * `GET /batches/:id/trace`，controller 按数字 `:id` 查 ⇒ 字符串进段就是 NaN），
   * 且全仓零调用点（`rg -n` 实测仅本文件定义处 1 命中，页面侧 0 命中，详见 QODER-26 证据树），
   * 正确封装已在册：`api/modules/batches.ts` 的 `batchApi.trace(id: number)` ⇒ 本处不再留第二份。
   */

  /**
   * 按条码查询平台商品库（仅用于"新建商品流程"扫码命中自动填充）
   *
   * POST /api/admin/library/lookup
   * Body: { barcode: string }
   * 返回：{ matched: boolean, spu?, sku?, brand? }
   * 注意：返回结果不含 category 字段，命中后分类留空不填充，由商户在创建页手动选择
   *
   * @param barcode 扫码得到的条码
   * @returns 商品库查询结果
   */
  async libraryLookup(barcode: string): Promise<LibraryLookupResult> {
    const res = (await post('/admin/library/lookup', { barcode })) as any
    // request.ts 的 post() 已解包 res.data，这里再兼容一层
    const raw = res?.data ?? res
    const matched: boolean = !!(raw?.matched)
    const result: LibraryLookupResult = { matched }
    if (matched) {
      result.spu = raw.spu
      result.sku = raw.sku
      result.brand = raw.brand
    }
    return result
  },
}

/** 品牌库（GET /admin/brands，租户隔离）—— 商品详情/新建的品牌下拉数据源 */
export interface BrandItem {
  id: number
  name: string
  logo?: string
  description?: string
  sortNo?: number
  status?: number
}
export async function listBrands(): Promise<BrandItem[]> {
  const res: any = await get('/admin/brands')
  const rows: any[] = Array.isArray(res) ? res : res?.list ?? res?.data ?? []
  return rows.map((b: any) => ({
    id: b.id,
    name: b.name ?? '',
    logo: b.logo,
    description: b.description,
    sortNo: b.sortNo ?? b.sort_no,
    status: b.status,
  }))
}

/** 单位库（GET /admin/units，租户隔离）—— 商品详情/新建的单位下拉数据源 */
export interface UnitItem {
  id: number
  name: string
  code?: string
  type?: string
  sortNo?: number
  status?: number
}
export async function listUnits(): Promise<UnitItem[]> {
  const res: any = await get('/admin/units')
  const rows: any[] = Array.isArray(res) ? res : res?.list ?? res?.data ?? []
  return rows.map((u: any) => ({
    id: u.id,
    name: u.name ?? '',
    code: u.code,
    type: u.type,
    sortNo: u.sortNo ?? u.sort_no,
    status: u.status,
  }))
}

/** 库存预警（GET /admin/stock-warnings，返回全部预警 SKU 行；无配置时默认 physical_qty<=5 判 LOW） */
export interface StockWarningItem {
  skuId: number
  skuName: string
  storeId?: number
  storeName?: string
  currentStock: number
  minQty: number
  maxQty: number
  warningLevel: 'LOW' | 'HIGH' | 'NORMAL'
  safetyStock?: number
}

/** 拉取全量库存预警（用于列表页预警/缺货真实统计，不依赖分页） */
export async function listStockWarnings(): Promise<StockWarningItem[]> {
  const res: any = await get('/admin/stock-warnings')
  const rows: any[] = Array.isArray(res) ? res : res?.data ?? res?.list ?? []
  return rows as StockWarningItem[]
}

/** 上传商品主图（multipart 字段名 image，后端 POST /admin/products/upload-image） */
function uploadImage(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('merchant_token') || ''
    const tenantId = uni.getStorageSync('merchant_tenant_id') || ''
    const csrfToken = uni.getStorageSync('merchant_csrf_token') || ''
    const header: Record<string, string> = {}
    if (token) header['Authorization'] = `Bearer ${token}`
    if (tenantId) header['X-Tenant-Id'] = tenantId
    if (csrfToken) header['x-csrf-token'] = csrfToken
    uni.uploadFile({
      url: `${API_BASE}/admin/products/upload-image`,
      filePath,
      name: 'image',
      header,
      success: (res: any) => {
        try {
          const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          const url = body?.data?.url ?? body?.url
          if (res.statusCode === 200 && url) {
            resolve(url)
          } else {
            reject(new Error(body?.msg || '图片上传失败'))
          }
        } catch (err) {
          reject(new Error('图片上传响应解析失败'))
        }
      },
      fail: (err: any) => reject(new Error(err?.errMsg || '图片上传失败')),
    })
  })
}

export { productsApi, uploadImage }
