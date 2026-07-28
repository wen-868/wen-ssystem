/**
 * 条码扫码原生插件封装
 *
 * 功能：
 *  1. 封装 uni.requireNativePlugin('ZXing-Scanner') 为 Promise 接口
 *  2. 实现 ScanResult 类型识别（barcode / qrcode / trace_code）
 *  3. 实现 handleScanResult 路由分发：
 *     - 追溯码 → 跳转 /pages-sub/admin/trace/trace-query?code=xxx
 *     - 商品条码 → 优先本地 SQLite（R51-04 已接入 LocalProductDb），未命中走网络 /admin/products?keyword=xxx
 *     - 未知码 / 二维码 → toast 提示 + 可选手动录入
 *  4. 支持连续扫码（盘点场景），间隔可配置（默认 1s）
 *  5. 错误处理：相机权限拒绝、设备不支持、扫码超时（默认 30s）
 *
 * 注意：
 *  - 使用 IIFE 包裹 uni-app 条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *  - 非APP-PLUS环境下扫码功能不可用，会 reject ScanError(device_not_supported)
 *  - 调用方推荐通过 ScanError.errorType 区分错误类型，给出对应提示
 *
 * @author 阿澈
 */

import { get } from '@/api/request'
import { productsApi, type ProductInfo } from '@/api/modules/products'
import { getTenant } from '@/api/storage'
import { LocalProductDb, type ProductDeltaData } from '@/api/local-db'

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
    /** 是否连续扫码（盘点场景），默认 false。scan() 单次扫码会忽略此字段 */
    continuous?: boolean
    /** 连续扫码间隔（毫秒），默认 1000 */
    interval?: number
    /** 扫码类型过滤，默认 ['all'] */
    types?: Array<ScanTypeFilter>
    /** 扫码框标题文本 */
    title?: string
    /** 单次扫码超时（毫秒），默认 30000。超时后 reject ScanError(timeout) */
    timeout?: number
}

/** 扫码处理动作 */
export type ScanHandleAction = 'product' | 'trace' | 'unknown'

/**
 * 扫码处理结果（仅供 scanAndHandle 使用，handleScanResult 自身仅返回 Promise<void>）
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

// ====================== 错误类型 ======================

/**
 * 扫码错误类型枚举
 *
 * 用于精细化的错误处理：调用方可以根据错误类型给出不同的用户提示。
 */
export type ScanErrorType =
    | 'device_not_supported'     // 设备不支持（非 App 端 / 原生插件未加载）
    | 'camera_permission_denied' // 相机权限被拒绝
    | 'timeout'                  // 扫码超时
    | 'scan_failed'              // 扫码调用失败（其他错误）
    | 'no_content'               // 扫码未识别到内容

/**
 * 扫码错误（携带错误类型，便于调用方区分处理）
 *
 * @example
 * ```ts
 * try {
 *   const result = await scan()
 * } catch (err) {
 *   if (err instanceof ScanError) {
 *     switch (err.errorType) {
 *       case 'camera_permission_denied': // 引导用户去系统设置开启权限
 *       case 'timeout':                  // 提示重试
 *       case 'device_not_supported':    // 提示仅 App 端可用
 *     }
 *   }
 * }
 * ```
 */
export class ScanError extends Error {
    readonly errorType: ScanErrorType

    constructor(errorType: ScanErrorType, message: string) {
        super(message)
        this.name = 'ScanError'
        this.errorType = errorType
        // 维持 instanceof 行为（ES5 编译目标下的兼容）
        Object.setPrototypeOf(this, ScanError.prototype)
    }
}

// ====================== 常量定义 ======================

/** 追溯码前缀（与后端 trace-code 生成规则一致） */
const TRACE_CODE_PREFIX = 'TRC-'

/** 默认连续扫码间隔（毫秒） */
const DEFAULT_INTERVAL = 1000

/** 默认单次扫码超时（毫秒） */
const DEFAULT_TIMEOUT = 30000

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

/**
 * 追溯查询页路径（R51-06 分包后位于 pages-sub/admin/trace/）
 *
 * 注意：trace-query 页面由后续任务创建，未创建前 navigateTo 会失败，
 * 但 handleScanResult 仍会先调用后端查询接口，调用方可在 catch 中处理导航失败。
 */
const TRACE_QUERY_PAGE = '/pages-sub/admin/trace/trace-query'

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

/**
 * HMS Core Scan Kit 原生插件接口（HarmonyOS）
 *
 * 对应 @hms/core/scan 模块，HarmonyOS 平台通过 HBuilderX 打包鸿蒙包时
 * 由原生层注入 __global__.HMSɨScanKit 全局对象。本接口仅描述 JS 侧调用签名。
 */
interface HMSScanKitNativeModule {
    /** 发起扫码（HarmonyOS Scan Kit startScan） */
    startScan(options: { types?: Array<ScanTypeFilter>; title?: string }, callback: (result: NativeScanResult) => void): void
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

/** 原生扫码模块统一接口（ZXing-Scanner + HMS Scan Kit 共同实现） */
interface ScannerUnifiedModule {
    /** 发起扫码 */
    scan(options: ScanOptions, callback: (result: NativeScanResult) => void): void
    /** 停止连续扫码 */
    stopScan(): void
    /** 检查扫码功能是否可用（相机权限等） */
    isAvailable(callback: (available: boolean) => void): void
}

/** HarmonyOS HMS Scan Kit 全局对象键名（HBuilderX 打包鸿蒙包时由原生层注入） */
const HMS_SCAN_KIT_KEY = 'HMSɨScanKit'

/**
 * 从 globalThis 安全读取 HMS Scan Kit 原生实例
 *
 * HarmonyOS 平台通过 HBuilderX 打包鸿蒙包时由原生层注入 globalThis.HMSɨScanKit。
 * 使用方括号访问避免特殊字符 `ɨ`（U+0268）在 TypeScript 标识符中引起解析问题。
 *
 * @returns HMS Scan Kit 原生实例，未注入返回 null
 */
function readHMSScanKitRaw(): HMSScanKitNativeModule | null {
    try {
        const kit = (globalThis as Record<string, unknown>)[HMS_SCAN_KIT_KEY]
        return kit ? (kit as HMSScanKitNativeModule) : null
    } catch {
        return null
    }
}

/**
 * 获取 HMS Scan Kit 适配器（统一为 ScannerUnifiedModule 接口）
 *
 * 将 HMS Scan Kit 的 startScan 方法适配为统一的 scan 方法，
 * 使 isScanAvailable / startContinuousScan 等函数无需感知平台差异。
 *
 * @returns 适配后的统一扫码模块，未注入返回 null
 */
function getHMSScanAdapter(): ScannerUnifiedModule | null {
    const kit = readHMSScanKitRaw()
    if (!kit) return null
    return {
        scan(options: ScanOptions, callback: (result: NativeScanResult) => void): void {
            // HMS Scan Kit 的 startScan 不需要 continuous/interval 字段，仅透传 types/title
            const hmsOptions: { types?: Array<ScanTypeFilter>; title?: string } = {}
            if (options?.types) hmsOptions.types = options.types
            if (options?.title) hmsOptions.title = options.title
            kit.startScan(hmsOptions, callback)
        },
        stopScan(): void {
            kit.stopScan()
        },
        isAvailable(callback: (available: boolean) => void): void {
            kit.isAvailable(callback)
        },
    }
}

/**
 * 获取原生扫码插件实例（统一接口）
 *
 * 平台分支：
 *  - APP-PLUS && !HARMONYOS：使用 uni.requireNativePlugin('ZXing-Scanner')
 *  - HARMONYOS：使用 HMS Core Scan Kit（globalThis.HMSɨScanKit）
 *  - 其他平台（H5/小程序）：返回 null
 *
 * 使用 IIFE 包裹条件编译，避免 vue-tsc 看到多个 return 语句造成问题（踩坑日志 [15]）
 *
 * @returns 原生插件实例，不可用时返回 null
 */
function getScanner(): ScannerUnifiedModule | null {
    return (() => {
        // #ifdef APP-PLUS && !HARMONYOS
        return uni.requireNativePlugin('ZXing-Scanner') as ZXingScannerNativeModule | null
        // #endif
        // #ifdef HARMONYOS
        // HarmonyOS Scan Kit：HBuilderX 打包鸿蒙包时由原生层注入 globalThis 全局对象
        return getHMSScanAdapter()
        // #endif
        // #ifndef APP-PLUS
        return null
        // #endif
    })()
}

// ====================== HarmonyOS HMS Scan Kit 适配 ======================

/**
 * HarmonyOS HMS Scan Kit 扫码适配
 *
 * 使用 HMS Core Scan Kit 的 startScan API，支持条码、二维码、追溯码识别。
 * 复用现有的 identifyScanType 和 handleScanResult 逻辑。
 *
 * 注意：
 *  - 仅在 HARMONYOS 平台下有效，其他平台调用会 reject
 *  - HMS Scan Kit 的 startScan 选项中 types 字段兼容 ScanTypeFilter
 *  - 实际 API 调用在 HBuilderX 打包鸿蒙包时由原生层处理
 *
 * @param options 扫码选项（continuous 字段会被忽略，强制为 false）
 * @returns 扫码结果 Promise
 */
async function scanWithHMSScan(options?: Omit<ScanOptions, 'continuous'>): Promise<ScanResult> {
    const scanKit = readHMSScanKitRaw()

    if (!scanKit) {
        uni.showToast({ title: 'HMS Scan Kit 不可用', icon: 'none' })
        return Promise.reject(new ScanError('device_not_supported', 'HMS Scan Kit 不可用'))
    }

    const scanOptions: { types?: Array<ScanTypeFilter>; title?: string } = {
        title: options?.title || '扫一扫',
    }
    if (options?.types) {
        scanOptions.types = options.types
    }

    return new Promise<ScanResult>((resolve, reject) => {
        try {
            scanKit.startScan(scanOptions, (res: NativeScanResult) => {
                if (!res || !res.code) {
                    reject(new ScanError('no_content', '扫码未识别到内容'))
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
            reject(
                err instanceof ScanError
                    ? err
                    : new ScanError('scan_failed', err instanceof Error ? err.message : 'HMS Scan Kit 调用失败'),
            )
        }
    })
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
 * 检查相机权限是否已授予
 *
 * APP-PLUS 平台使用 uni.getSetting 判断相机授权状态；
 * 其他平台直接返回 true（不支持原生扫码的设备已在 getScanner() 处过滤）。
 *
 * 注意：若用户从未见过权限弹窗，authSetting 中不会有 scope.camera 字段，
 * 此时返回 true 让原生插件自行发起权限请求。
 *
 * @returns true 表示已授权或尚未拒绝，false 表示权限被明确拒绝
 */
function checkCameraPermission(): Promise<boolean> {
    // #ifndef APP-PLUS
    return Promise.resolve(true)
    // #endif

    // #ifdef APP-PLUS
    return new Promise<boolean>((resolve) => {
        try {
            // 使用官方 GetSettingSuccessResult 类型，避免自定义类型与 @dcloudio/types 冲突
            uni.getSetting({
                success(res) {
                    const authSetting = res?.authSetting
                    // 官方 AuthSetting 中 'scope.camera' 类型为 boolean，
                    // 实际运行时若用户从未见过权限弹窗则为 undefined（与类型声明不符，故用 === false 严格判断）
                    if (authSetting && authSetting['scope.camera'] === false) {
                        // 用户明确拒绝过相机权限
                        resolve(false)
                        return
                    }
                    // 未授权过（首次扫码）或已授权，让原生插件自行处理
                    resolve(true)
                },
                fail() {
                    // getSetting 失败时不阻断扫码（让原生插件自行处理权限请求）
                    resolve(true)
                },
            })
        } catch {
            resolve(true)
        }
    })
    // #endif
}

/**
 * 发起单次扫码
 *
 * 平台分支：
 *  - HARMONYOS：调用 HMS Scan Kit 的 scanWithHMSScan
 *  - APP-PLUS && !HARMONYOS：调用 ZXing-Scanner 的 scan
 *  - 其他平台：reject ScanError(device_not_supported)
 *
 * 错误处理（对齐任务要求：相机权限拒绝、设备不支持、扫码超时）：
 *  - 设备不支持：reject ScanError(device_not_supported)
 *  - 相机权限拒绝：reject ScanError(camera_permission_denied)
 *  - 扫码超时：reject ScanError(timeout)
 *  - 未识别到内容：reject ScanError(no_content)
 *  - 其他异常：reject ScanError(scan_failed)
 *
 * @param options 扫码选项（continuous 字段会被忽略，强制为 false）
 * @returns 扫码结果 Promise
 *
 * @example
 * ```ts
 * try {
 *   const result = await scan({ title: '扫一扫商品条码', timeout: 30000 })
 *   logger.info(result.code, result.type, result.format)
 * } catch (err) {
 *   if (err instanceof ScanError) {
 *     if (err.errorType === 'camera_permission_denied') {
 *       // 引导用户去系统设置开启权限
 *     }
 *   }
 * }
 * ```
 */
export function scan(options?: ScanOptions): Promise<ScanResult> {
    // HarmonyOS 平台走 HMS Scan Kit 分支
    // #ifdef HARMONYOS
    return scanWithHMSScan(options)
    // #endif

    // #ifndef HARMONYOS
    const scanner = getScanner()
    if (!scanner) {
        uni.showToast({ title: '扫码功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new ScanError('device_not_supported', '扫码功能仅在 App 端可用'))
    }

    const scanOptions: ScanOptions = {
        continuous: false,
        title: '扫一扫',
        ...options,
    }
    const timeout = Math.max(0, Number(options?.timeout ?? DEFAULT_TIMEOUT))

    // 单次扫码 Promise：封装原生插件回调
    const scanPromise = new Promise<ScanResult>((resolve, reject) => {
        try {
            // 条件编译指令会干扰 vue-tsc 控制流分析，使用非空断言（上方已 null 检查）
            scanner!.scan(scanOptions, (res: NativeScanResult) => {
                if (!res || !res.code) {
                    reject(new ScanError('no_content', '扫码未识别到内容'))
                    return
                }
                resolve({
                    code: res.code,
                    type: identifyScanType(res.code, res.format),
                    format: res.format,
                    timestamp: Date.now(),
                })
            })
        } catch (err) {
            reject(
                err instanceof ScanError
                    ? err
                    : new ScanError('scan_failed', err instanceof Error ? err.message : '扫码调用失败'),
            )
        }
    })

    // 超时控制：先检查相机权限，再用 Promise.race 实现扫码超时
    const racePromise = (async (): Promise<ScanResult> => {
        // 相机权限预检查（仅在 APP-PLUS 平台生效，H5/小程序始终返回 true）
        const hasCameraPermission = await checkCameraPermission()
        if (!hasCameraPermission) {
            uni.showToast({ title: '相机权限被拒绝，请在系统设置中开启', icon: 'none' })
            throw new ScanError('camera_permission_denied', '相机权限被拒绝')
        }

        if (timeout <= 0) {
            return scanPromise
        }

        // 超时计时器：在 Promise.race 中确保清理
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
                reject(new ScanError('timeout', `扫码超时（${timeout}ms）`))
            }, timeout)
        })

        try {
            return await Promise.race([scanPromise, timeoutPromise])
        } finally {
            if (timeoutTimer) clearTimeout(timeoutTimer)
        }
    })()

    return racePromise
    // #endif
}

// ====================== 连续扫码 ======================

/**
 * 当前连续扫码会话的停止函数（模块级状态）
 *
 * 设计说明：
 *  - 任务规范要求 startContinuousScan 返回 void，stopContinuousScan 也返回 void
 *  - 因此使用模块级状态保存当前会话的 stop 函数，供 stopContinuousScan 调用
 *  - 同一时间只允许一个连续扫码会话，重复调用 startContinuousScan 会先停止之前的会话
 */
let currentContinuousStop: (() => void) | null = null

/**
 * 连续扫码（盘点场景）
 *
 * 每次扫码后等待 interval 毫秒再发起下一次，直到 stopContinuousScan 被调用。
 * 单次扫码失败（包括超时、未识别等）不会中断连续扫码流程，会继续下一次。
 *
 * 注意：
 *  - 函数同步返回 void，调用方需通过 stopContinuousScan() 主动停止
 *  - 同一时间只允许一个连续扫码会话，重复调用会先停止之前的会话
 *  - 扫码失败的具体原因（如相机权限拒绝）只通过控制台 warn 输出，不传给 callback
 *
 * @param callback 每次扫码成功的回调
 * @param options 扫码选项（interval 默认 1000ms；timeout 默认 30000ms）
 *
 * @example
 * ```ts
 * // 启动连续扫码
 * startContinuousScan(
 *   (result) => { logger.info('扫码到:', result.code) },
 *   { interval: 1500, title: '盘点扫码' }
 * )
 * // 用户点击停止按钮时
 * stopContinuousScan()
 * ```
 */
export function startContinuousScan(
    callback: (result: ScanResult) => void,
    options?: ScanOptions,
): void {
    // 先停止已有的连续扫码会话（避免重复扫码造成回调混乱）
    if (currentContinuousStop) {
        try {
            currentContinuousStop()
        } catch {
            // 停止失败忽略
        }
        currentContinuousStop = null
    }

    const scanner = getScanner()
    if (!scanner) {
        uni.showToast({ title: '扫码功能仅在 App 端可用', icon: 'none' })
        return
    }

    const interval = Math.max(0, Number(options?.interval ?? DEFAULT_INTERVAL))
    // 解构出 continuous 字段（连续扫码由本函数控制，单次扫码调用不需要透传）
    const { continuous: _ignoredContinuous, ...scanOptions } = options ?? {}
    let stopped = false

    const scanOnce = async (): Promise<void> => {
        if (stopped) return
        try {
            const result = await scan(scanOptions)
            if (!stopped) callback(result)
        } catch (err) {
            // 单次扫码失败时不中断连续扫码，继续下一次
            // 相机权限拒绝等严重错误也只 warn，避免日志被淹没；调用方应在 stopContinuousScan 后处理
            console.error('[scan] 连续扫码单次失败:', err)
        }
        if (!stopped) {
            setTimeout(scanOnce, interval)
        }
    }

    // 启动第一次扫码
    scanOnce()

    // 保存停止函数到模块级状态
    currentContinuousStop = () => {
        stopped = true
        try {
            scanner.stopScan()
        } catch {
            // 停止失败忽略
        }
        currentContinuousStop = null
    }
}

/**
 * 停止连续扫码
 *
 * 主动调用原生插件的 stopScan 方法，并清理模块级状态。
 * 如果当前没有连续扫码会话，调用此函数是空操作（无副作用）。
 */
export function stopContinuousScan(): void {
    if (currentContinuousStop) {
        try {
            currentContinuousStop()
        } catch {
            // 停止失败忽略
        }
        // currentContinuousStop 已在闭包内置 null，但兜底再清一次
        currentContinuousStop = null
        return
    }
    // 兼容直接调用 stopContinuousScan 的场景（无 active 会话也尝试 stopScan）
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
 * 查询策略（R51-04 已接入本地 SQLite）：
 *  1. 优先查询本地 SQLite（LocalProductDb.findByBarcode）— 离线场景快速命中
 *  2. 本地未命中 → 走网络 GET /admin/products?keyword=${barcode}
 *  3. 网络查询成功后可异步触发增量同步（由调用方决定）
 *
 * @param barcode 商品条码
 * @returns 商品信息，未找到返回 null
 */
async function findProductByBarcode(barcode: string): Promise<ProductInfo | null> {
    const tenantId = getCurrentTenantId()

    // 1. 优先查询本地 SQLite（离线场景快速命中）
    if (tenantId) {
        try {
            const localProduct = await LocalProductDb.findByBarcode(barcode, tenantId)
            if (localProduct) {
                return mapDeltaToProductInfo(localProduct)
            }
        } catch (err) {
            // 本地查询失败不阻断流程，降级到网络查询
            console.error('[scan] 本地商品查询失败，降级到网络查询:', err)
        }
    }

    // 2. 本地未命中 → 走网络查询（对齐后端 product.service.ts 的 s.barcode LIKE ? 搜索）
    const res = await productsApi.list({ keyword: barcode, page: 1, pageSize: 10 })
    if (res.list && res.list.length > 0) {
        return res.list[0]
    }
    return null
}

/**
 * 将本地 SQLite 的 ProductDeltaData 转换为 ProductInfo（对齐网络返回结构）
 *
 * 用于扫码场景下统一数据格式，避免上层调用方区分本地/网络数据源。
 *
 * @param delta 本地 SQLite 商品数据
 * @returns 转换后的 ProductInfo
 */
function mapDeltaToProductInfo(delta: ProductDeltaData): ProductInfo {
    return {
        id: delta.spuId,
        skuId: String(delta.skuId),
        name: delta.skuName || delta.spuName,
        categoryId: delta.categoryId || undefined,
        categoryName: delta.categoryName || undefined,
        price: Number(delta.retailPrice ?? 0),
        stock: Number(delta.availableQty ?? 0),
        unit: delta.baseUnit || '瓶',
        image: delta.mainImage || undefined,
        specs: delta.volume || undefined,
        safetyStock: delta.warningThreshold || undefined,
        status: delta.status === 1 ? 'ON' : 'OFF',
        allowOnlineSale: undefined,
    }
}

/**
 * 处理扫码结果 - 路由分发
 *
 * 分发逻辑：
 *  1. 追溯码（TRC- 前缀）→ 调用后端查询追溯链 + 跳转 /pages-sub/admin/trace/trace-query?code=xxx
 *  2. 商品条码 → 优先查本地 SQLite（R51-04 已接入），未命中走网络 /admin/products?keyword=xxx
 *  3. 未知码 / 二维码 → toast 提示
 *
 * 返回 Promise<void>：调用方可 await 等待路由完成，也可不 await（fire-and-forget）。
 * 如需获取处理结果数据（商品信息或追溯链），请使用 scanAndHandle() 便捷方法。
 *
 * @param result 扫码结果
 *
 * @example
 * ```ts
 * const result = await scan()
 * await handleScanResult(result) // 等待路由完成
 * ```
 */
export async function handleScanResult(result: ScanResult): Promise<void> {
    await handleScanResultInternal(result)
}

/**
 * handleScanResult 的内部实现，返回 ScanHandleResult 供 scanAndHandle 使用
 *
 * 与 handleScanResult 的区别：返回带 action 和 data 的结果对象，
 * 便于 scanAndHandle 在调用方拿到处理结果（如商品已查到则加入销售单）。
 */
async function handleScanResultInternal(result: ScanResult): Promise<ScanHandleResult> {
    const code = result.code.trim()

    if (!code) {
        return { action: 'unknown', data: null }
    }

    // 1. 追溯码 → 跳转追溯查询页
    if (result.type === 'trace_code' || isTraceCode(code)) {
        try {
            const traceData = await queryTraceChain(code)
            // 跳转到追溯查询页（页面由后续任务创建，路径以 R51 方案 2.1 节为准）
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
 * 等同于先调用 scan()，再调用 handleScanResult()，并返回处理结果。
 * 适合需要拿到商品信息或追溯链的调用方（如收银扫码加入销售单）。
 *
 * @param options 扫码选项
 * @returns 处理结果（包含 action 和 data）
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
    options?: Omit<ScanOptions, 'continuous'>,
): Promise<ScanHandleResult> {
    const result = await scan(options)
    return handleScanResultInternal(result)
}

// ====================== 兼容别名（向后兼容） ======================

/**
 * 发起单次扫码（兼容别名）
 *
 * @deprecated 请使用 scan() 代替。R51-01 重构前的旧名称，保留以兼容旧调用方。
 * @param options 扫码选项
 * @returns 扫码结果 Promise
 */
export function scanCode(options?: Omit<ScanOptions, 'continuous'>): Promise<ScanResult> {
    return scan(options)
}

/**
 * 停止扫码（兼容别名）
 *
 * @deprecated 请使用 stopContinuousScan() 代替。R51-01 重构前的旧名称，保留以兼容旧调用方。
 */
export function stopScan(): void {
    stopContinuousScan()
}
