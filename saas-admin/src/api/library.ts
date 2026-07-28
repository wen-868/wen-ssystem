import request from '../utils/request'

// ==================== 类型定义 ====================

export interface SpuProperties {
  alcoholContent?: string
  origin?: string
  aromaType?: string
  [key: string]: string | undefined
}

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
  skuCount?: number
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
  alcoholContent?: string
  origin?: string
  aromaType?: string
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
  id?: number
  spuId?: number
  skuCode?: string
  barcode: string
  skuName: string
  volume: string | number
  packaging: string
  baseUnit: string
  boxUnit: string
  boxRatio: string | number
  skuImage?: string
  status?: string
  suggestedRetailPrice: string | number
  createdAt?: string
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

export interface BrandOption {
  id: number
  name: string
}

export interface ApiKeyItem {
  id: number
  name: string
  apiKey: string
  allowedIps: string
  dailyLimit: number
  usedToday: number
  status: number
  remark: string
  createdAt: string
  lastUsedAt: string
}

export interface ApiKeyCreatedResult {
  apiKey: string
  apiSecret: string
}

export interface ApiKeyStats {
  id: number
  name: string
  apiKey: string
  usedToday: number
  dailyLimit: number
  totalCount: number
  lastUsedAt: string
  last7Days: { date: string; count: number }[]
}

// ==================== SPU 接口 ====================

export function listSpusApi(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  brandId?: number
  barcode?: string
}) {
  return request.get('/platform/library/spus', { params })
}

export function getSpuApi(id: number) {
  return request.get(`/platform/library/spus/${id}`)
}

export function createSpuApi(data: {
  name: string
  brandId?: number | null
  specs: string
  unit?: string
  mainImage?: string
  imageUrls?: string
  properties?: string
  alcoholContent?: string
  origin?: string
  aromaType?: string
  description?: string
  detail?: string
  suggestedRetailPrice?: string | number
  skus: Partial<SkuItem>[]
}) {
  return request.post('/platform/library/spus', data)
}

export function updateSpuApi(id: number, data: {
  name: string
  brandId?: number | null
  specs: string
  unit?: string
  mainImage?: string
  imageUrls?: string
  properties?: string
  alcoholContent?: string
  origin?: string
  aromaType?: string
  description?: string
  detail?: string
  suggestedRetailPrice?: string | number
  skus?: Partial<SkuItem>[]
}) {
  return request.put(`/platform/library/spus/${id}`, data)
}

export function approveSpuApi(id: number) {
  return request.post(`/platform/library/spus/${id}/approve`)
}

export function rejectSpuApi(id: number, data: { reason?: string }) {
  return request.post(`/platform/library/spus/${id}/reject`, data)
}

export function deleteSpuApi(id: number) {
  return request.delete(`/platform/library/spus/${id}`)
}

// ==================== SKU 接口 ====================

export function listSkusApi(spuId: number) {
  return request.get(`/platform/library/spus/${spuId}/skus`)
}

export function createSkuApi(spuId: number, data: Partial<SkuItem>) {
  return request.post(`/platform/library/spus/${spuId}/skus`, data)
}

export function batchCreateSkusApi(spuId: number, data: Partial<SkuItem>[]) {
  return request.post(`/platform/library/spus/${spuId}/skus`, data)
}

export function updateSkuApi(id: number, data: Partial<SkuItem>) {
  return request.put(`/platform/library/skus/${id}`, data)
}

export function deleteSkuApi(id: number) {
  return request.delete(`/platform/library/skus/${id}`)
}

// ==================== 品牌接口 ====================

export function listBrandOptionsApi() {
  return request.get('/platform/library/brands', { params: { page: 1, pageSize: 9999 } })
}

export function listBrandsApi(params: {
  page: number
  pageSize: number
  keyword?: string
}) {
  return request.get('/platform/library/brands', { params })
}

export function getBrandApi(id: number) {
  return request.get(`/platform/library/brands/${id}`)
}

export function createBrandApi(data: {
  name: string
  logo?: string
  originCountry?: string
  sortNo?: number
  description?: string
  status?: number
}) {
  return request.post('/platform/library/brands', data)
}

export function updateBrandApi(id: number, data: {
  name: string
  logo?: string
  originCountry?: string
  sortNo?: number
  description?: string
  status?: number
}) {
  return request.put(`/platform/library/brands/${id}`, data)
}

export function toggleBrandStatusApi(id: number, status: number) {
  return request.put(`/platform/library/brands/${id}`, { status })
}

export function deleteBrandApi(id: number) {
  return request.delete(`/platform/library/brands/${id}`)
}

// ==================== API Key 接口 ====================

export function listApiKeysApi() {
  return request.get('/platform/library/api-keys')
}

export function getApiKeyApi(id: number) {
  return request.get(`/platform/library/api-keys/${id}`)
}

export function createApiKeyApi(data: {
  name: string
  allowedIps?: string
  dailyLimit?: number
  remark?: string
}) {
  return request.post('/platform/library/api-keys', data)
}

export function updateApiKeyApi(id: number, data: {
  name?: string
  allowedIps?: string
  dailyLimit?: number
  status?: number
  remark?: string
}) {
  return request.put(`/platform/library/api-keys/${id}`, data)
}

export function deleteApiKeyApi(id: number) {
  return request.delete(`/platform/library/api-keys/${id}`)
}

export function getApiKeyStatsApi(id: number) {
  return request.get(`/platform/library/api-keys/${id}/stats`)
}

export function getLibraryStatsApi() {
  return request.get('/platform/library/api-keys/stats/summary')
}
