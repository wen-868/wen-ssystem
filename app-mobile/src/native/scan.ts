/**
 * 条码扫码原生插件封装
 *
 * 功能：
 *  1. 封装 uni.requireNativePlugin('ZXing-Scanner') 为 Promise 接口
 *  2. 实现 ScanResult 类型识别（barcode / qrcode / trace_code）
 *  3. 实现 handleScanResult 路由分发：
 *     - 追溯码 → 跳转 /pages/admin/trace-query?code=xxx
 *     - 商品条码 → 优先本地 SQLite（R51-04 完成后接入），未命中走网络 /admin/products?keyword=xxx
 *     - 未知码 → toast 提示 + 可选手动录入
 *  4. 支持连续扫码（盘点场景），间隔可配置（默认 1s）
 *
 * 注意：
 *  - 使用 IIFE 包裹 uni-app 条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *  - 非APP-PLUS环境下扫码功能不可用，会返回 reject 或 null
 *
 * @author 阿澈
 */

import { get } from '@/api/request'
import { productsApi, type ProductInfo } from '@/api/modules/products'
import { getTenant } from '@/api/storage'

// ====================== 类型定义 ======================

/** 扫码结果类型（自动识别） */
export type ScanCodeType = 'barcode' | 'qrcode' | 'trace_code'

/**
 * 扫码结果
 */
export interface ScanResult {
    /** 扫码内容 */
    code: string
    /**
     * 扫码类型（自动识别）
     * - barcode: 商品条码（EAN-13/EAN-8/UPC）
     * - qrcode: 二维码（URL/文本）
     * - trace_code: 追溯码（TRC- 前缀）
     */
    type: ScanCodeType
    /** 条码格式：EAN_13 / EAN_8 / UPC_A / CODE_128 / QR_CODE 等 */
    format?: string
    /** 扫码时间戳（毫秒） */
    timestamp: number
}

/** 扫码类型过滤选项 */
export type ScanTypeFilter = 'barcode' | 'qrcode' | 'all'

/**
 * 扫码选项
 */
export interface ScanOptions {
    /** 是否连续扫码（盘点场景），默认 false */
    continuous?: boolean
    /** 连续扫码间隔（毫秒），默认 1000 */
    interval?: number
    /** 扫码类型过滤，默认 ['all'] */
    types?: Array<ScanTypeFilter>
    /** 扫码框标题文本 */
    title?: string
}

/** 扫码处理动作 */
export type ScanHandleAction = 'product' | 'trace' | 'unknown'

/**
 * 扫码处理结果
 */
export interface ScanHandleResult {
    /** 处理动作：product 商品查询 / trace 追溯查询 / unknown 未知码 */
    action: ScanHandleAction
    /** 查询到的数据（商品信息或追溯链），未找到时为 null */
    data: ProductInfo | TraceChainData | null
}

/**
 * 追溯链数据（简化类型，实际字段以后端 /api/admin/trace/query/:traceCode 返回为准）
 */
export interface TraceChainData {
    /** 追溯码 */
    traceCode: string
    /** 商品名称 */
    productName?: string
    /** SKU 名称 */
    skuName?: string
    /** 批次号 */
    batchNo?: string
    /** 生产日期 */
    productionDate?: string
    /** 过期日期 */
    expireDate?: string
    /** 追溯链环节 */
    stages?: Array<TraceStage>
    /** 原始数据（后端返回的完整对象） */
    [key: string]: unknown
}

/**
 * 追溯链环节
 */
export interface TraceStage {
    /** 环节代码 */
    stage: string
    /** 环节名称 */
    stageName: string
    /** 操作时间 */
    operationTime: string
    /** 操作人 */
    operator?: string
    /** 操作地点 */
    location?: string
    /** 备注 */
    remark?: string
}

// ====================== 常量定义 ======================

/** 追溯码前缀（与后端 trace-code 生成规则一致） */
const TRACE_CODE_PREFIX = 'TRC-'

/** 默认连续扫码间隔（毫秒） */
const DEFAULT_INTERVAL = 1000

/** 商品条码格式集合 */
const BARCODE_FORMATS: ReadonlySet<string> = new Set<string>([
    'EAN_13',
    'EAN_8',
    'UPC_A',
    'UPC_E',
    'CODE_128',
    'CODE_39',
    'ITF',
    'CODABAR',
])

/** 二维码格式集合 */
const QRCODE_FORMATS: ReadonlySet<string> = new Set<string>([
    'QR_CODE',
    'DATA_MATRIX',
    'AZTEC',
    'PDF_417',
])

/** 追溯查询页路径 */
const TRACE_QUERY_PAGE = '/pages/admin/trace-query'

/** 追溯码查询 API 路径（后端 prefix=/api/admin/trace，request.ts BASE_URL 已含 /api） */
const TRACE_QUERY_API = (traceCode: string): string =>
    `/admin/trace/query/${encodeURIComponent(traceCode)}`

// ====================== 原生插件接口 ======================

/** 原生扫码结果回调结构 */
interface NativeScanResult {
    code: string
    type?: string
    format?: string
}

/** ZXing-Scanner 原生插件接口（callback 风格） */
interface ZXingScannerNativeModule {
    /** 发起扫码 */
    scan(options: ScanOptions, callback: (result: NativeScanResult) => void): void
    /** 停止连续扫码 */
    stopScan(): void
    /** 检查扫码功能是否可用（相机权限等） */
    isAvailable(callback: (available: boolean) => void): void
}

// ====================== 工具函数 ======================

/**
 * 获取当前租户 ID
 * @returns 当前租户 ID 字符串，未登录返回空字符串
 */
function getCurrentTenantId(): string {
    const tenant = getTenant()
    return tenant ? String(tenant.id) : ''
}

/**
 * 判断是否为追溯码
 * 追溯码格式：TRC- 开头，后接数字/字母
 * @param code 扫码内容
 * @returns 是否为追溯码
 */
export function isTraceCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false
    return code.startsWith(TRACE_CODE_PREFIX) && code.length > TRACE_CODE_PREFIX.length
}

/**
 * 根据扫码结果识别类型
 * 优先级：追溯码 > 二维码 > 商品条码
 *
 * 识别策略：
 *  1. 追溯码前缀判断（TRC- 开头）
 *  2. 按 format 字段判断（原生插件返回的格式信息）
 *  3. 兜底按内容特征判断（URL / 纯数字条码）
 *  4. 默认视为二维码（普通文本）
 *
 * @param code 扫码内容
 * @param format 条码格式
 * @returns 识别出的类型
 */
export function identifyScanType(code: string, format?: string): ScanCodeType {
    // 1. 追溯码前缀判断（优先级最高）
    if (isTraceCode(code)) return 'trace_code'

    // 2. 按格式判断
    if (format) {
        if (QRCODE_FORMATS.has(format)) return 'qrcode'
        if (BARCODE_FORMATS.has(format)) return 'barcode'
    }

    // 3. 兜底：按内容特征判断
    // URL 开头视为二维码
    if (/^https?:\/\//i.test(code) || /^www\./i.test(code)) return 'qrcode'

    // 纯数字且长度符合 EAN-13/EAN-8/UPC 视为商品条码
    if (/^\d{8,13}$/.test(code)) return 'barcode'

    // 4. 默认视为二维码（普通文本）
    return 'qrcode'
}

// ====================== 原生插件实例获取 ======================

/**
 * 获取 ZXing-Scanner 原生插件实例
 *
 * - APP-PLUS 环境：通过 uni.requireNativePlugin 获取原生插件
 * - 其他环境（H5/小程序）：返回 null
 *
 * 使用 IIFE 包裹条件编译，避免 vue-tsc 看到两个 return 语句造成问题（踩坑日志 [15]）
 *
 * @returns 原生插件实例，不可用时返回 null
 */
function getScanner(): ZXingScannerNativeModule | null {
    return (() => {
        // #ifdef APP-PLUS
        return uni.requireNativePlugin('ZXing-Scanner') as ZXingScannerNativeModule | null
        // #endif
        // #ifndef APP-PLUS
        return null
        // #endif
    })()
}

// ====================== 核心扫码 API ======================

/**
 * 检查扫码功能是否可用
 * - APP-PLUS 环境：检查原生插件是否加载 + 相机权限
 * - 其他环境：返回 false
 *
 * @returns 是否可用
 */
export async function isScanAvailable(): Promise<boolean> {
    const scanner = getScanner()
    if (!scanner) return false

    return new Promise<boolean>((resolve) => {
        try {
            scanner.isAvailable((available: boolean) => {
                resolve(!!available)
            })
        } catch {
            resolve(false)
        }
    })
}

/**
 * 发起单次扫码
 *
 * @param options 扫码选项（continuous 字段会被忽略，强制为 false）
 * @returns 扫码结果 Promise
 *
 * @example
 * ```ts
 * const result = await scanCode({ title: '扫一扫商品条码' })
 * console.log(result.code, result.type, result.format)
 * ```
 */
export function scanCode(options?: Omit<ScanOptions, 'continuous'>): Promise<ScanResult> {
    const scanner = getScanner()
    if (!scanner) {
        uni.showToast({ title: '扫码功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new Error('扫码功能仅在 App 端可用'))
    }

    const scanOptions: ScanOptions = {
        continuous: false,
        title: '扫一扫',
        ...options,
    }

    return new Promise<ScanResult>((resolve, reject) => {
        try {
            scanner.scan(scanOptions, (res: NativeScanResult) => {
                if (!res || !res.code) {
                    reject(new Error('扫码未识别到内容'))
                    return
                }
                const result: ScanResult = {
                    code: res.code,
                    type: identifyScanType(res.code, res.format),
                    format: res.format,
                    timestamp: Date.now(),
                }
                resolve(result)
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('扫码调用失败'))
        }
    })
}

/**
 * 连续扫码（盘点场景）
 *
 * 每次扫码后等待 interval 毫秒再发起下一次，直到返回的停止函数被调用。
 * 单次扫码失败不会中断连续扫码流程，会继续下一次。
 *
 * @param callback 每次扫码成功的回调
 * @param options 扫码选项（interval 默认 1000ms）
 * @returns 停止函数，调用后停止连续扫码
 *
 * @example
 * ```ts
 * const stop = startContinuousScan(
 *   (result) => { console.log('扫码到:', result.code) },
 *   { interval: 1500, title: '盘点扫码' }
 * )
 * // 用户点击停止按钮时
 * stop()
 * ```
 */
export function startContinuousScan(
    callback: (result: ScanResult) => void,
    options?: ScanOptions
): () => void {
    const scanner = getScanner()
    if (!scanner) {
        uni.showToast({ title: '扫码功能仅在 App 端可用', icon: 'none' })
        // 返回空函数，调用方无需判断
        return () => { }
    }

    const interval = options?.interval ?? DEFAULT_INTERVAL
    // 解构出 continuous 字段（连续扫码由本函数控制，单次扫码调用不需要透传）
    const { continuous: _ignoredContinuous, ...scanOptions } = options ?? {}
    let stopped = false

    const scanOnce = async (): Promise<void> => {
        if (stopped) return
        try {
            const result = await scanCode(scanOptions)
            if (!stopped) callback(result)
        } catch {
            // 单次扫码失败时不中断连续扫码，继续下一次
        }
        if (!stopped) {
            setTimeout(scanOnce, interval)
        }
    }

    // 启动第一次扫码
    scanOnce()

    // 返回停止函数
    return () => {
        stopped = true
        try {
            scanner.stopScan()
        } catch {
            // 停止失败忽略
        }
    }
}

/**
 * 停止连续扫码
 * 主动调用原生插件的 stopScan 方法
 */
export function stopScan(): void {
    const scanner = getScanner()
    if (scanner) {
        try {
            scanner.stopScan()
        } catch {
            // 停止失败忽略
        }
    }
}

// ====================== 路由分发 ======================

/**
 * 查询追溯链
 * 调用后端 GET /api/admin/trace/query/:traceCode
 *
 * @param traceCode 追溯码
 * @returns 追溯链数据
 */
async function queryTraceChain(traceCode: string): Promise<TraceChainData> {
    const res: unknown = await get(TRACE_QUERY_API(traceCode))
    // 后端统一响应结构 { code, msg, data, traceId, apiCost }，request.ts 已 resolve(resData.data)
    // 这里再兼容一次 result 字段（部分老接口返回 { result: ... }）
    const data = res as Record<string, unknown> | null
    return (data?.result ?? data ?? {}) as TraceChainData
}

/**
 * 通过条码查询商品
 *
 * 查询策略：
 *  1. 【预留】优先查询本地 SQLite（R51-04 完成后接入）
 *  2. 本地未命中 → 走网络 GET /admin/products?keyword=${barcode}
 *
 * @param barcode 商品条码
 * @returns 商品信息，未找到返回 null
 */
async function findProductByBarcode(barcode: string): Promise<ProductInfo | null> {
    const _tenantId = getCurrentTenantId()

    // TODO: R51-04 离线 SQLite 完成后，优先查询本地数据库
    // import { LocalProductDb } from '@/api/local-db'
    // if (_tenantId) {
    //   const localProduct = await LocalProductDb.findByBarcode(barcode, _tenantId)
    //   if (localProduct) return localProduct
    // }

    // 当前直接走网络查询（对齐后端 product.service.ts 的 s.barcode LIKE ? 搜索）
    const res = await productsApi.list({ keyword: barcode, page: 1, pageSize: 10 })
    if (res.list && res.list.length > 0) {
        return res.list[0]
    }
    return null
}

/**
 * 处理扫码结果 - 路由分发
 *
 * 分发逻辑：
 *  1. 追溯码（TRC- 前缀）→ 调用后端查询追溯链 + 跳转 /pages/admin/trace-query?code=xxx
 *  2. 商品条码 → 优先查本地 SQLite（R51-04 完成后），未命中走网络 /admin/products?keyword=xxx
 *  3. 未知码 / 二维码 → toast 提示
 *
 * @param result 扫码结果
 * @returns 处理结果
 *
 * @example
 * ```ts
 * const result = await scanCode()
 * const handleResult = await handleScanResult(result)
 * if (handleResult.action === 'product') {
 *   // 已查到商品，可加入销售单
 *   console.log(handleResult.data)
 * }
 * ```
 */
export async function handleScanResult(result: ScanResult): Promise<ScanHandleResult> {
    const code = result.code.trim()

    if (!code) {
        return { action: 'unknown', data: null }
    }

    // 1. 追溯码 → 跳转追溯查询页
    if (result.type === 'trace_code' || isTraceCode(code)) {
        try {
            const traceData = await queryTraceChain(code)
            // 跳转到追溯查询页（页面尚待新建，路径以 R51 方案 2.1 节为准）
            uni.navigateTo({
                url: `${TRACE_QUERY_PAGE}?code=${encodeURIComponent(code)}`,
            })
            return { action: 'trace', data: traceData }
        } catch (err) {
            const msg = err instanceof Error ? err.message : '追溯码查询失败'
            uni.showToast({ title: msg, icon: 'none' })
            return { action: 'trace', data: null }
        }
    }

    // 2. 商品条码 → 查询商品
    if (result.type === 'barcode') {
        try {
            const product = await findProductByBarcode(code)
            if (product) {
                return { action: 'product', data: product }
            }
            // 未找到商品，提示用户
            uni.showToast({ title: `未找到条码 ${code} 对应的商品`, icon: 'none' })
            return { action: 'unknown', data: null }
        } catch (err) {
            const msg = err instanceof Error ? err.message : '商品查询失败'
            uni.showToast({ title: msg, icon: 'none' })
            return { action: 'unknown', data: null }
        }
    }

    // 3. 二维码 / 未知码 → toast 提示
    // 二维码内容（URL/文本）当前不做自动处理，仅提示
    const preview = code.length > 20 ? `${code.slice(0, 20)}...` : code
    uni.showToast({
        title: `未识别的二维码内容：${preview}`,
        icon: 'none',
    })
    return { action: 'unknown', data: null }
}

// ====================== 便捷方法 ======================

/**
 * 扫码并自动处理结果（便捷方法）
 *
 * 等同于先调用 scanCode()，再调用 handleScanResult()
 *
 * @param options 扫码选项
 * @returns 处理结果
 *
 * @example
 * ```ts
 * // 一键扫码并自动路由
 * const result = await scanAndHandle({ title: '扫一扫' })
 * if (result.action === 'product' && result.data) {
 *   // 商品已查到，自动跳到商品详情或加入销售单
 * }
 * ```
 */
export async function scanAndHandle(
    options?: Omit<ScanOptions, 'continuous'>
): Promise<ScanHandleResult> {
    const result = await scanCode(options)
    return handleScanResult(result)
}

// ====================== 导出清单 ======================

export {
    // 类型已通过 export interface / export type 导出：
    // ScanResult, ScanOptions, ScanCodeType, ScanTypeFilter,
    // ScanHandleResult, ScanHandleAction, TraceChainData, TraceStage
    // 函数已通过 export function / export async function 导出：
    // isTraceCode, identifyScanType, isScanAvailable, scanCode,
    // startContinuousScan, stopScan, handleScanResult, scanAndHandle
}
