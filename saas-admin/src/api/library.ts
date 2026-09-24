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

/**
 * 审核通过（D1 修复，2026-09-25）
 *
 * 旧实现打的 `POST /platform/library/spus/{id}/approve|reject` 是**动作式自拟路径**，
 * 后端只注册了 `PUT /api/platform/library/spus/:id/status`
 * （backend/src/routes/platform-library.routes.ts:29 → controller.reviewSpu → library.service.ts:517 reviewSpu）
 * ⇒ 旧实现运行时必然 404（证据：saas-admin/scripts/check-api-paths.mjs 改前输出）。
 *
 * 后端口径：仅允许 PENDING → APPROVED / REJECTED；驳回原因暂**无落库列**
 * （审核流水表 T5 见 R101-C6-2 立项清单），故 reason 随请求体一并下发但后端不持久化。
 */
export function approveSpuApi(id: number) {
  return request.put(`/platform/library/spus/${id}/status`, { status: 'APPROVED' })
}

export function rejectSpuApi(id: number, data: { reason?: string }) {
  return request.put(`/platform/library/spus/${id}/status`, { status: 'REJECTED', reason: data?.reason })
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

// D2 同类清理（零调用点且后端无对应方法）：原 getBrandApi(id) 打 `GET /platform/library/brands/{id}`，
// 但后端该路径只注册了 PUT/DELETE（无 GET）⇒ 调用即 404；`rg -n 'getBrandApi' saas-admin/src` 仅命中定义处，已删除。

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

// D2 同类清理（零调用点且后端无对应方法）：原 getApiKeyApi(id) 打 `GET /platform/library/api-keys/{id}`，
// 后端同路径只注册 PUT/DELETE（无 GET）⇒ 调用即 404；全仓无调用点，已删除。

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

// D2（凌舟裁定 §六）：已删除「商品库统计」，理由是自拟路径 `/platform/library/api-keys/stats/summary`
// 在后端 0 命中、且全仓无调用点。KPI 汇总的真实数据源登记为 T3/T5 等立项项（见 R101-C6-2 立项清单）。
