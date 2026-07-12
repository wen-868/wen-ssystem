import { get } from '../request'

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
    return get(`/admin/products/batch/${batchNo}`)
  }
}

export { productsApi }
