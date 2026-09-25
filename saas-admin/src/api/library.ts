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

/**
 * 类目只读聚合行（S3-110 ① / S3-111 ①）
 * 契约见 docs/API接口文档.md「平台域新增端点」§3：一行 = 一个「租户 × 类目」，
 * productCount = 该租户挂在该类目下的 t_product_spu 行数（不额外过滤商品状态）。
 */
export interface PlatformCategoryItem {
  tenantId: string
  tenantName: string | null
  categoryId: number
  name: string
  parentId: number | null
  status: number | string
  productCount: number
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
 * （backend/src/routes/platform-library.routes.ts:42 → controller.reviewSpu → library.service.ts:576 reviewSpu）
 * ⇒ 旧实现运行时必然 404（证据：saas-admin/scripts/check-api-paths.mjs 改前输出）。
 *
 * 后端口径（S3-110 ② 放开后）：审核仍为 `PENDING → APPROVED / REJECTED`；
 * **上下架**为 `APPROVED ↔ OFFLINE`（下架 / 重新上架，见 offlineSpuApi / relistSpuApi）；
 * `PENDING → OFFLINE`、`APPROVED → REJECTED` 仍 400（流转表 library.service.ts:561-565）。
 * 驳回原因暂**无落库列**
 * （审核流水表 T5 见 R101-C6-2 立项清单），故 reason 随请求体一并下发但后端不持久化。
 */
export function approveSpuApi(id: number) {
  return request.put(`/platform/library/spus/${id}/status`, { status: 'APPROVED' })
}

export function rejectSpuApi(id: number, data: { reason?: string }) {
  return request.put(`/platform/library/spus/${id}/status`, { status: 'REJECTED', reason: data?.reason })
}

/**
 * 下架（APPROVED → OFFLINE，S3-111 ②）：同端点 `PUT /platform/library/spus/:id/status`。
 * 后端只允许 APPROVED 态下架（library.service.ts:561-565），前端亦只对 APPROVED 行展示入口。
 */
export function offlineSpuApi(id: number) {
  return request.put(`/platform/library/spus/${id}/status`, { status: 'OFFLINE' })
}

/** 重新上架（OFFLINE → APPROVED，S3-111 ②）：同端点，且仅 OFFLINE 态可上架 */
export function relistSpuApi(id: number) {
  return request.put(`/platform/library/spus/${id}/status`, { status: 'APPROVED' })
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

// ==================== 类目接口（只读聚合，S3-110 ① / S3-111 ①） ====================

/**
 * 租户类目只读聚合：`GET /api/platform/library/categories`
 * （backend/src/routes/platform-library.routes.ts:62 → library.service.ts:672 getCategoryOverview）
 * 无入参；返回一行 = 一个「租户 × 类目」，含 tenantName 与 productCount（挂载商品数）。
 * 平台侧跨租户**只读**，无任何写入口（新增/编辑/删除类目按裁定 R3(甲) 不建平台类目表）。
 */
export function listCategoriesApi() {
  return request.get('/platform/library/categories')
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
