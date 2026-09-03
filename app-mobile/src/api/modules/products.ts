import { get, post, put, del } from '../request'

/** API 基础地址（与 request.ts 保持一致） */
const API_BASE: string = (() => {
  // #ifdef H5
  return (import.meta.env.VITE_API_BASE as string | undefined) || '/api'
  // #endif
  // #ifndef H5
  return 'https://api.onepan.cn/api'
  // #endif
})()

/** 创建商品（后端 POST /admin/products） */
export async function createProduct(data: Record<string, any>): Promise<any> {
  return post('/admin/products', data)
}

/** 商品详情（含 SKU 与单位换算链） */
export async function getProductDetail(spuId: number): Promise<ProductDetail> {
  const res: any = await get(`/admin/products/${spuId}`)
  return (res?.result ?? res) as ProductDetail
}

/** 更新商品 SPU 字段（价格/单位属 SKU 域，后端 update 不含，详情页价格表格只读展示） */
export async function updateProduct(spuId: number, data: ProductUpdateParams): Promise<any> {
  return put(`/admin/products/${spuId}`, data)
}

/** SKU 五档价格更新契约（product.controller.ts#updateProductPrice，zod 校验） */
export interface SkuPriceParams {
  costPrice?: number
  retailPrice?: number
  wholesalePrice?: number
  miniappPrice?: number
  storePrice?: number
}

/** 更新 SKU 价格（PUT /admin/products/:skuId/price） */
export async function updateSkuPrice(skuId: number, data: SkuPriceParams): Promise<any> {
  return put(`/admin/products/${skuId}/price`, data)
}

/** 更新 SKU 配置（PUT /admin/products/skus/:skuId，traceEnabled/warningThreshold 等可选） */
export interface SkuUpdateParams {
  skuName?: string
  baseUnit?: string
  boxUnit?: string
  boxRatio?: number
  traceEnabled?: boolean
  warningThreshold?: number
}
export async function updateSku(skuId: number, data: SkuUpdateParams): Promise<any> {
  return put(`/admin/products/skus/${skuId}`, data)
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

/** 设置商品营销标签（PUT /admin/products/:spuId/marketing-tags，body {tags: string[]}） */
export async function setMarketingTags(spuId: number, tags: string[]): Promise<any> {
  return put(`/admin/products/${spuId}/marketing-tags`, { tags })
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
  id: number
  skuId: string
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
  async list(params?: ProductListParams): Promise<ProductListResult> {
    const res = (await get('/admin/products', params)) as any
    const raw = res?.result ?? res
    // 后端返回 records 数组，统一映射为前端 ProductInfo 结构
    const records: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    const list: ProductInfo[] = records.map((r: any) => ({
      id: r.spuId ?? r.id,
      skuId: r.skuId ?? r.skuCode ?? '',
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
    }))
    return {
      list,
      total: raw?.total ?? list.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(id: number): Promise<ProductInfo> {
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

  async batchTrace(batchNo: string): Promise<any> {
    // R94-03：原 /admin/products/batch/:batchNo 不存在；后端真实批次追踪接口为 /admin/inventory-batch/batches/:id/trace（按批次 id）
    return get(`/admin/inventory-batch/batches/${batchNo}/trace`)
  },

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
