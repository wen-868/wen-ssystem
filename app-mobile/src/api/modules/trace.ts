/**
 * 追溯码 API 封装
 *
 * 后端路由前缀：/api/admin/trace（request.ts BASE_URL 已含 /api，此处只需 /admin/trace/...）
 * 后端实现：backend/src/routes/trace.routes.ts + services/admin/trace-records.service.ts
 * 关联任务：R95-02 功能中心三入口接入真实后端（溯源查询）
 *
 * @author 阿澈
 */

import { get, post } from '../request'

// ====================== 类型定义 ======================

/** 追溯状态枚举（对齐后端 current_status） */
export type TraceStatus =
  | 'PRODUCED'
  | 'PURCHASED'
  | 'TRANSFERRED'
  | 'ALLOCATED'
  | 'ON_SHELF'
  | 'SOLD'
  | 'WHOLESALE_SOLD'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'RETURNED'
  | 'DESTROYED'
  | 'EXPIRED'
  | 'RECALLED'

/** 质检结果 */
export type QualityCheckResult = 'PASS' | 'FAIL' | 'PENDING' | null

/** 追溯链事件（对齐后端 TraceEventLogBriefRow） */
export interface TraceChainEvent {
  id: number
  traceCode: string
  eventType: string
  fromStatus: string | null
  toStatus: string | null
  operatorType: string | null
  operatorName: string | null
  location: string | null
  remark: string | null
  createdAt: string | Date
}

/** 追溯码详情（getTraceCodeDetail 返回） */
export interface TraceCodeDetail {
  id: number
  traceCode: string
  skuId: number | string
  skuName: string
  batchNo: string
  productionDate: string | null
  expiryDate: string | null
  shelfLifeDays: number | string | null
  codeMode: string
  categoryId: number | string | null
  currentStatus: TraceStatus
  currentLocation: string | null
  storeId: number | string | null
  warehouseId: number | string | null
  orderId: number | string | null
  supplierId: number | string | null
  qualityCheckResult: QualityCheckResult
  firstScanAt: string | Date | null
  firstScanIp: string | null
  scanCount: number | string
  fraudAlert: number | string
  producedAt: string | Date | null
  version: number | string
  createdAt: string | Date
  updatedAt: string | Date | null
  events?: TraceChainEvent[]
}

/** 追溯链查询结果（queryTraceChain 返回） */
export interface TraceChainResult {
  id: number
  traceCode: string
  skuId: number | string
  skuName: string
  batchNo: string
  productionDate: string | null
  expiryDate: string | null
  shelfLifeDays: number | string | null
  codeMode: string
  categoryId: number | string | null
  currentStatus: TraceStatus
  currentLocation: string | null
  storeId: number | string | null
  warehouseId: number | string | null
  qualityCheckResult: QualityCheckResult
  scanCount: number | string
  fraudAlert: number | string
  producedAt: string | Date | null
  createdAt: string | Date
  events: TraceChainEvent[]
}

/** 防伪验证入参（对齐后端 verifyTraceCodeSchema） */
export interface TraceVerifyParams {
  traceCode: string
  scanType?: 'CONSUMER' | 'BUSINESS' | 'PDA' | 'ADMIN'
  userId?: number
}

/** 防伪验证结果 */
export interface TraceVerifyResult {
  result: 'SUCCESS' | 'INVALID' | 'NOT_FOUND' | 'FRAUD_ALERT' | 'EXPIRED'
  message: string
  traceCode: string
  skuName: string | null
  batchNo: string | null
  currentStatus: string | null
  qualityCheckResult: string | null
  scanCount?: number
}

// ====================== API 封装 ======================

const traceApi = {
  /**
   * 查询追溯码详情
   * GET /api/admin/trace/codes/:traceCode
   *
   * @param traceCode 追溯码
   * @returns 追溯码详情（含事件日志，不存在时后端返回 404）
   */
  async getCodeDetail(traceCode: string): Promise<TraceCodeDetail> {
    return get(`/admin/trace/codes/${encodeURIComponent(traceCode)}`)
  },

  /**
   * 查询追溯链
   * GET /api/admin/trace/query/:traceCode
   *
   * @param traceCode 追溯码
   * @returns 追溯码 + 追溯链事件列表（不存在时后端返回 404）
   */
  async queryChain(traceCode: string): Promise<TraceChainResult> {
    return get(`/admin/trace/query/${encodeURIComponent(traceCode)}`)
  },

  /**
   * 防伪验证
   * POST /api/admin/trace/verify
   *
   * @param params 追溯码 + 扫描类型（默认 ADMIN）
   * @returns 验证结果（SUCCESS/INVALID/NOT_FOUND/FRAUD_ALERT/EXPIRED）
   */
  async verify(params: TraceVerifyParams): Promise<TraceVerifyResult> {
    return post('/admin/trace/verify', params)
  },
}

export { traceApi }
