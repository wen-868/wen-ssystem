/**
 * 后端打印记录 API 封装
 *
 * 用途：app-mobile 蓝牙打印小票留痕审计
 * 后端路由前缀：/api/admin/print（request.ts BASE_URL 已含 /api，此处只需 /admin/print/...）
 *
 * 关联任务：R51-02 蓝牙热敏打印插件封装
 * 后端实现：backend/src/routes/print.routes.ts + services/admin/print.service.ts
 *
 * @author 阿澈
 */

import { get, post } from '../request'

// ====================== 类型定义 ======================

/** 打印记录单据类型（对齐后端 BILL_TYPE_VALUES） */
export type PrintBillType = 'SALE_BILL' | 'SALE_RETURN' | 'SHIFT' | 'DAILY_SETTLE' | 'REPRINT'

/** 打印记录状态（对齐后端 STATUS_VALUES） */
export type PrintRecordStatus = 'SUCCESS' | 'FAILED' | 'PENDING'

/**
 * 打印记录行（后端返回结构，snake_case）
 */
export interface PrintRecord {
    id: number
    tenant_id: string
    store_id: number | null
    bill_type: PrintBillType
    bill_no: string
    printer_mac: string | null
    print_content: string | null
    copies: number
    operator_id: number | null
    status: PrintRecordStatus
    error_msg: string | null
    original_id: number | null
    created_at: string
    updated_at: string
}

/**
 * 创建打印记录入参（对齐后端 createRecordSchema）
 */
export interface CreatePrintRecordParams {
    storeId?: number | null
    billType: PrintBillType
    billNo: string
    printerMac?: string | null
    printContent?: string | null
    copies?: number
    operatorId?: number | null
    status?: PrintRecordStatus
    errorMsg?: string | null
    originalId?: number | null
}

/**
 * 创建打印记录响应
 */
export interface CreatePrintRecordResult {
    id: number
}

/**
 * 打印记录列表查询参数
 */
export interface PrintRecordListParams {
    page?: number
    pageSize?: number
    billType?: PrintBillType
    billNo?: string
    storeId?: number
    status?: PrintRecordStatus
    operatorId?: number
    startDate?: string
    endDate?: string
}

/**
 * 打印记录列表响应
 */
export interface PrintRecordListResult {
    total: number
    page: number
    pageSize: number
    records: PrintRecord[]
}

// ====================== API 封装 ======================

const printApi = {
    /**
     * 保存打印记录
     * POST /api/admin/print/records
     *
     * @param params 打印记录入参
     * @returns 新建记录 ID
     */
    async createRecord(params: CreatePrintRecordParams): Promise<CreatePrintRecordResult> {
        return post('/admin/print/records', params)
    },

    /**
     * 查询打印记录列表（支持筛选 + 分页）
     * GET /api/admin/print/records
     *
     * @param params 查询参数
     * @returns 分页记录列表
     */
    async listRecords(params?: PrintRecordListParams): Promise<PrintRecordListResult> {
        // 过滤空值：uni.request 会把 undefined 序列化为字符串 "undefined"，
        // 后端 zod 枚举校验会报 400（如 status=undefined），空值一律不下发
        const query: Record<string, any> = {}
        if (params) {
            for (const key of Object.keys(params)) {
                const value = (params as Record<string, any>)[key]
                if (value !== undefined && value !== null && value !== '') {
                    query[key] = value
                }
            }
        }
        const res = (await get('/admin/print/records', query)) as any
        // 兼容后端直接返回 { total, records, ... } 或 { data: { ... } } 两种结构
        const raw = res?.result ?? res
        return (raw ?? {
            total: 0,
            page: params?.page ?? 1,
            pageSize: params?.pageSize ?? 20,
            records: [],
        }) as PrintRecordListResult
    },

    /**
     * 查询单条打印记录详情
     * GET /api/admin/print/records/:id
     *
     * @param id 记录ID
     * @returns 记录详情
     */
    async getRecordDetail(id: number): Promise<PrintRecord> {
        const res = (await get(`/admin/print/records/${id}`)) as any
        return (res?.result ?? res) as PrintRecord
    },

    /**
     * 重打 — 复制原记录生成新记录
     * POST /api/admin/print/records/:id/reprint
     *
     * @param id 原记录ID
     * @returns 新记录ID + 原记录ID
     */
    async reprint(id: number): Promise<{ id: number; originalId: number }> {
        return post(`/admin/print/records/${id}/reprint`)
    },
}

export { printApi }
