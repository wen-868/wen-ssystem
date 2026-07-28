import request from '../utils/request'

// ==================== 类型定义 ====================

export interface SpuListItem {
  id: number
  spuCode: string
  name: string
  brandId: number | null
  brandName: string
  specs: string
  unit: string
  mainImage: string
  status: string
  source: string
  hitCount: number
  createdAt: string
  updatedAt: string
}

export interface SpuDetail {
  id: number
  spuCode: string
  name: string
  brandId: number | null
  brandName: string
  specs: string
  unit: string
  mainImage: string
  imageUrls: string
  properties: string
  description: string
  detail: string
  suggestedRetailPrice: string
  status: string
  source: string
  hitCount: number
  createdAt: string
  updatedAt: string
  skus: SkuItem[]
}

export interface SkuItem {
  id: number
  spuId: number
  skuCode: string
  barcode: string
  skuName: string
  volume: string
  packaging: string
  baseUnit: string
  boxUnit: string
  boxRatio: string
  skuImage: string
  status: string
  createdAt: string
}

export interface BrandItem {
  id: number
  name: string
  logo: string
  description: string
  originCountry: string
  sortNo: number
  status: number
  spuCount: number
  createdAt: string
}

export interface ApiKeyItem {
  id: number
  appName: string
  apiKey: string
  allowedIps: string
  dailyLimit: number
  todayCount: number
  status: number
  remark: string
  createdAt: string
  lastUsedAt: string
}

// ==================== SPU 接口 ====================

export function listSpusApi(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  brandId?: number
}) {
  return request.get('/platform/library/spus', { params })
}

export function getSpuApi(id: number) {
  return request.get(`/platform/library/spus/${id}`)
}

export function createSpuApi(data: any) {
  return request.post('/platform/library/spus', data)
}

export function updateSpuApi(id: number, data: any) {
  return request.put(`/platform/library/spus/${id}`, data)
}

export function updateSpuStatusApi(id: number, status: string) {
  return request.put(`/platform/library/spus/${id}/status`, { status })
}

export function deleteSpuApi(id: number) {
  return request.delete(`/platform/library/spus/${id}`)
}

export function importSpusApi(data: any[]) {
  return request.post('/platform/library/spus/import', data)
}

// ==================== SKU 接口 ====================

export function listSkusApi(spuId: number) {
  return request.get(`/platform/library/spus/${spuId}/skus`)
}

export function createSkuApi(spuId: number, data: any) {
  return request.post(`/platform/library/spus/${spuId}/skus`, data)
}

export function updateSkuApi(id: number, data: any) {
  return request.put(`/platform/library/skus/${id}`, data)
}

export function deleteSkuApi(id: number) {
  return request.delete(`/platform/library/skus/${id}`)
}

// ==================== 品牌接口 ====================

export function listBrandsApi(params: {
  page: number
  pageSize: number
  keyword?: string
}) {
  return request.get('/platform/library/brands', { params })
}

export function createBrandApi(data: any) {
  return request.post('/platform/library/brands', data)
}

export function updateBrandApi(id: number, data: any) {
  return request.put(`/platform/library/brands/${id}`, data)
}

export function deleteBrandApi(id: number) {
  return request.delete(`/platform/library/brands/${id}`)
}

// ==================== API Key 接口 ====================

export function listApiKeysApi() {
  return request.get('/platform/library/api-keys')
}

export function createApiKeyApi(data: {
  appName: string
  allowedIps?: string
  dailyLimit?: number
  remark?: string
}) {
  return request.post('/platform/library/api-keys', data)
}

export function updateApiKeyApi(id: number, data: any) {
  return request.put(`/platform/library/api-keys/${id}`, data)
}

export function deleteApiKeyApi(id: number) {
  return request.delete(`/platform/library/api-keys/${id}`)
}

export function getApiKeyStatsApi(id: number) {
  return request.get(`/platform/library/api-keys/${id}/stats`)
}
