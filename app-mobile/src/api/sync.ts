/**
 * 增量同步 API 调用层 — 对齐阿坚 R51-04 后端 4 个端点
 *
 * 端点契约（对齐 backend/src/services/sync/delta-sync.service.ts）：
 *  - GET  /api/sync/products/delta?since=&page=1&pageSize=100
 *      返回: { since, until, hasMore, changes: [{ action: 'UPSERT'|'DELETE'|'STATUS_CHANGE', skuId, spuId, data? }] }
 *  - GET  /api/sync/inventory/delta?since=&page=1&pageSize=100
 *      返回: { since, until, hasMore, changes: [{ action, skuId, data }] }
 *  - GET  /api/sync/members/delta?since=&page=1&pageSize=100
 *      返回: { since, until, hasMore, changes: [{ action, skuId, data }] }
 *  - POST /api/sync/offline-orders
 *      入参: { orders: Array<{ draftNo, customerName, customerMobile, customerId, items, totalAmount, remark, createdAt }> }
 *      返回: { results: Array<{ draftNo, success, billNo?, errorMsg? }> }
 *
 * 注意：
 *  - request.ts BASE_URL 在 H5 下含 /api，在 APP-PLUS 下为完整域名，路径以 /sync 开头
 *  - 后端响应统一 { code, msg, data, traceId, apiCost }，request.ts 已 resolve(res.data.data)
 *  - 所有类型对齐后端 delta-sync.service.ts 中的导出接口
 *
 * @author 阿澈
 */

import { get, post } from './request'
import type {
    ProductDeltaData,
    InventoryDeltaData,
    MemberDeltaData,
    SaleDraftItem,
    DeltaAction,
} from './local-db'

// ====================== 类型定义（对齐后端 delta-sync.service.ts） ======================

/**
 * 通用增量同步响应（对齐后端 SyncDeltaResponse）
 */
export interface SyncDeltaResponse<T = unknown> {
    /** 本次请求的 since 值 */
    since: string
    /** 本次返回数据的最新时间戳 */
    until: string
    /** 是否还有更多数据 */
    hasMore: boolean
    /** 变更条目列表 */
    changes: Array<{
        /** 变更动作：UPSERT 新增/更新、DELETE 删除、STATUS_CHANGE 状态变更 */
        action: DeltaAction
        /** SKU ID（商品/库存场景）或 0（客户场景） */
        skuId: number
        /** SPU ID（商品场景）或 0 */
        spuId: number
        /** 变更数据（DELETE 时无） */
        data?: T
    }>
}

/** 商品增量同步响应 */
export type ProductDeltaResponse = SyncDeltaResponse<ProductDeltaData>

/** 库存增量同步响应 */
export type InventoryDeltaResponse = SyncDeltaResponse<InventoryDeltaData>

/** 客户增量同步响应 */
export type MemberDeltaResponse = SyncDeltaResponse<MemberDeltaData>

// ====================== 离线订单提交类型 ======================

/**
 * 离线销售单（提交给后端，对齐后端 OfflineOrder）
 */
export interface OfflineOrder {
    /** App 端本地草稿单号，用于幂等 */
    draftNo: string
    customerName?: string
    customerMobile?: string
    customerId?: number
    items: SaleDraftItem[]
    totalAmount: number
    remark?: string
    /** 离线创建时间（ISO 8601） */
    createdAt: string
}

/** 离线订单批量请求 */
export interface OfflineOrderBatch {
    orders: OfflineOrder[]
}

/** 离线订单单条结果（对齐后端 OfflineOrderResult） */
export interface OfflineOrderResult {
    /** App 端本地草稿单号 */
    draftNo: string
    /** 是否成功 */
    success: boolean
    /** 成功时返回服务端单号 */
    billNo?: string
    /** 失败时返回错误信息 */
    errorMsg?: string
}

/** 离线订单批量提交响应（对齐后端 OfflineOrderBatchResult） */
export interface OfflineOrderBatchResult {
    totalCount: number
    successCount: number
    failureCount: number
    results: OfflineOrderResult[]
}

// ====================== 分页参数 ======================

/** 分页参数 */
export interface DeltaPagingParams {
    /** 页码（从 1 开始，默认 1） */
    page?: number
    /** 每页大小（默认 100，最大 500） */
    pageSize?: number
}

// ====================== API 函数 ======================

/**
 * 获取增量商品变更
 *
 * 调用后端 GET /api/sync/products/delta?since=&page=1&pageSize=100
 *
 * 联合查询 t_product_sku / t_product_spu / t_product_price / t_inventory_balance，
 * 任意一张表的 updated_at > since 即视为变更。
 *
 * @param since    ISO 8601 时间戳（空字符串视为 1970-01-01）
 * @param paging   分页参数（可选）
 * @returns 商品增量同步响应
 *
 * @example
 * ```ts
 * const res = await getProductDelta('2026-07-19T00:00:00Z', { page: 1, pageSize: 100 })
 * if (res.hasMore) {
 *   // 拉取下一页
 * }
 * ```
 */
export async function getProductDelta(
    since: string,
    paging?: DeltaPagingParams
): Promise<ProductDeltaResponse> {
    const params: Record<string, string | number> = {
        since: since || '',
    }
    if (paging?.page) params.page = paging.page
    if (paging?.pageSize) params.pageSize = paging.pageSize
    return get<ProductDeltaResponse>('/sync/products/delta', params)
}

/**
 * 获取增量库存变更
 *
 * 调用后端 GET /api/sync/inventory/delta?since=&page=1&pageSize=100
 *
 * 读取 t_inventory_balance WHERE updated_at > since，返回库存快照。
 *
 * @param since    ISO 8601 时间戳
 * @param paging   分页参数（可选）
 * @returns 库存增量同步响应
 */
export async function getInventoryDelta(
    since: string,
    paging?: DeltaPagingParams
): Promise<InventoryDeltaResponse> {
    const params: Record<string, string | number> = {
        since: since || '',
    }
    if (paging?.page) params.page = paging.page
    if (paging?.pageSize) params.pageSize = paging.pageSize
    return get<InventoryDeltaResponse>('/sync/inventory/delta', params)
}

/**
 * 获取增量客户变更
 *
 * 调用后端 GET /api/sync/members/delta?since=&page=1&pageSize=100
 *
 * 读取 t_member WHERE updated_at > since。
 *
 * @param since    ISO 8601 时间戳
 * @param paging   分页参数（可选）
 * @returns 客户增量同步响应
 */
export async function getMemberDelta(
    since: string,
    paging?: DeltaPagingParams
): Promise<MemberDeltaResponse> {
    const params: Record<string, string | number> = {
        since: since || '',
    }
    if (paging?.page) params.page = paging.page
    if (paging?.pageSize) params.pageSize = paging.pageSize
    return get<MemberDeltaResponse>('/sync/members/delta', params)
}

/**
 * 批量提交离线销售单
 *
 * 调用后端 POST /api/sync/offline-orders
 *
 * 后端实现：
 *  - 逐条处理，单条失败不影响其他订单（错误隔离）
 *  - 单条订单使用事务保证原子性（sale_bill + sale_bill_item 同时成功或同时回滚）
 *  - 通过 draftNo 唯一性实现幂等：重复 draftNo 直接返回失败 errorMsg
 *  - 使用服务端 makeBizNo("XS") 生成 billNo，不依赖客户端时间
 *
 * @param orders 离线订单列表
 * @returns 批量提交结果（含每条订单的成功/失败状态）
 *
 * @example
 * ```ts
 * const result = await submitOfflineOrders([
 *   {
 *     draftNo: 'DRAFT-20260720-001',
 *     customerName: '张三',
 *     items: [{ skuId: 1001, skuName: '茅台', boxQty: 1, bottleQty: 0, totalBottleQty: 6, unitPrice: 1499, priceType: 'RETAIL', subtotalAmount: 8994 }],
 *     totalAmount: 8994,
 *     createdAt: new Date().toISOString(),
 *   }
 * ])
 * result.results.forEach(r => {
 *   if (r.success) { /* 单号 r.draftNo 提交成功，服务端单号 r.billNo */ }
 *   else console.error(`单号 ${r.draftNo} 提交失败：${r.errorMsg}`)
 * })
 * ```
 */
export async function submitOfflineOrders(
    orders: OfflineOrder[]
): Promise<OfflineOrderBatchResult> {
    return post<OfflineOrderBatchResult>('/sync/offline-orders', { orders })
}

// ====================== 导出 ======================

export const syncApi = {
    getProductDelta,
    getInventoryDelta,
    getMemberDelta,
    submitOfflineOrders,
}
