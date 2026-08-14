import { get, post } from '../request'

/** API 基础地址（与 request.ts 保持一致） */
const API_BASE: string = (() => {
  // #ifdef H5
  return (import.meta.env.VITE_API_BASE as string | undefined) || '/api'
  // #endif
  // #ifndef H5
  return 'https://api.onepan.cn'
  // #endif
})()

/** 创建商品（后端 POST /admin/products） */
export async function createProduct(data: Record<string, any>): Promise<any> {
  return post('/admin/products', data)
}

export interface ProductInfo {
  id: number
  skuId: string
  name: string
  categoryId?: number
  categoryName?: string
  price: number
  stock: number
  unit: string
  image?: string
  specs?: string
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
      price: Number(r.retailPrice ?? r.price ?? 0),
      stock: Number(r.availableQty ?? r.stock ?? 0),
      unit: r.unit ?? '',
      image: r.mainImage ?? r.image,
      specs: r.specs,
      safetyStock: r.warningThreshold != null ? Number(r.warningThreshold) : undefined,
      status: r.status === 'ON' || r.status === 'on_sale' ? 'ON' : 'OFF',
      // 后端商品列表当前未返回该字段， undefined 时由前端按分类映射兜底
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
