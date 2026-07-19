/**
 * 蓝牙热敏打印原生插件封装
 *
 * 功能：
 *  1. 封装 uni.requireNativePlugin('PrintManager') 为 Promise 接口
 *  2. 实现 PrintManager 接口：
 *     - searchPrinters()        搜索蓝牙打印机（返回设备列表）
 *     - connectPrinter(mac)     连接指定 MAC 的打印机
 *     - disconnectPrinter()     断开连接
 *     - isConnected()           查询连接状态
 *     - printSaleBill(billData) 打印销售单（58mm 热敏）
 *     - printSaleBillDot(billData) 针式三联打印
 *     - printRaw(lines)         原始打印指令（自定义模板）
 *  3. 实现 PrintLine 联合类型：text / divider / table / barcode / qrcode / feed
 *  4. 实现 58mm 热敏打印模板 buildSaleBillLines(billData)（对齐方案 2.2.3 节模板格式）
 *  5. 打印成功/失败均调用后端 POST /api/admin/print/records 保存打印记录
 *
 * 注意：
 *  - 使用 IIFE 包裹 uni-app 条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *  - 非 APP-PLUS 环境下蓝牙打印功能不可用，会 reject 错误
 *  - 后端 bill_type 枚举：SALE_BILL / SALE_RETURN / SHIFT / DAILY_SETTLE / REPRINT
 *  - 后端 status 枚举：SUCCESS / FAILED / PENDING（对齐 print.service.ts）
 *
 * @author 阿澈
 */

import { post } from '@/api/request'
import { getUser } from '@/api/storage'

// ====================== 类型定义 ======================

/** 文本对齐方式 */
export type PrintAlign = 'left' | 'center' | 'right'

/** 文本字号 */
export type PrintFontSize = 'normal' | 'double'

/**
 * 打印行联合类型
 * - text:    文本行（可配置对齐/加粗/字号）
 * - divider: 分隔线（默认 '-'，58mm 纸宽 32 字符）
 * - table:   表格行（多列，每列指定宽度比例和对其方式）
 * - barcode: 一维码
 * - qrcode:  二维码
 * - feed:    走纸（默认 3 行）
 */
export type PrintLine =
    | { type: 'text'; content: string; align?: PrintAlign; bold?: boolean; size?: PrintFontSize }
    | { type: 'divider'; char?: string }
    | { type: 'table'; columns: Array<{ text: string; width: number; align?: PrintAlign }> }
    | { type: 'barcode'; content: string; height?: number }
    | { type: 'qrcode'; content: string; size?: number }
    | { type: 'feed'; lines?: number }

/** 打印机类型 */
export type PrinterType = 'thermal' | 'dot'

/**
 * 蓝牙打印机设备信息
 */
export interface PrinterDevice {
    /** 蓝牙 MAC 地址（XX:XX:XX:XX:XX:XX 格式） */
    mac: string
    /** 设备名称 */
    name: string
    /** 信号强度（dBm，负值，越接近 0 越强） */
    rssi?: number
    /** 是否已配对 */
    bonded?: boolean
    /** 打印机类型（热敏/针式），默认 thermal */
    type?: PrinterType
    /** 纸宽 mm（58/80），默认 58 */
    paperWidth?: number
}

/**
 * 销售单商品明细
 */
export interface SaleBillItem {
    /** 商品名称（含规格） */
    name: string
    /** 数量 */
    qty: number
    /** 单价（元） */
    price: number
    /** 小计金额（元） */
    subtotal: number
}

/**
 * 销售单打印数据
 * 对齐方案 2.2.3 节 58mm 热敏打印模板字段
 */
export interface SaleBillData {
    /** 单据编号 */
    billNo: string
    /** 店铺名称 */
    storeName: string
    /** 店铺地址 */
    storeAddress?: string
    /** 店铺电话 */
    storePhone?: string
    /** 收银员姓名 */
    cashierName: string
    /** 会员姓名（可选） */
    memberName?: string
    /** 商品明细 */
    items: SaleBillItem[]
    /** 商品总数量 */
    totalQty: number
    /** 商品总额（元） */
    totalAmount: number
    /** 优惠金额（元） */
    discount: number
    /** 应付金额（元） */
    payable: number
    /** 支付方式（现金/微信/支付宝/银行卡/混合等） */
    paymentMethod: string
    /** 实付金额（元） */
    paidAmount: number
    /** 找零金额（元） */
    changeAmount: number
    /** 单据生成时间（ISO 字符串或 yyyy-MM-dd HH:mm:ss） */
    createdAt: string
    /** 备注（可选） */
    remark?: string
    /** 底部二维码内容（可选，如店铺小程序码） */
    qrcodeContent?: string
}

/** 后端打印记录单据类型（对齐 print.service.ts BILL_TYPE_VALUES） */
export type PrintBillType = 'SALE_BILL' | 'SALE_RETURN' | 'SHIFT' | 'DAILY_SETTLE' | 'REPRINT'

/** 后端打印记录状态（对齐 print.service.ts STATUS_VALUES） */
export type PrintRecordStatus = 'SUCCESS' | 'FAILED' | 'PENDING'

/**
 * 打印记录保存入参（对齐后端 POST /api/admin/print/records 入参）
 */
export interface PrintRecordPayload {
    billType: PrintBillType
    billNo: string
    printerMac?: string | null
    printContent?: string | null
    copies?: number
    status?: PrintRecordStatus
    errorMsg?: string | null
    storeId?: number | null
    operatorId?: number | null
}

/** 打印记录保存响应 */
export interface PrintRecordResult {
    id: number
}

// ====================== 常量定义 ======================

/** 58mm 热敏纸每行字符数（半角字符） */
const PAPER_58MM_CHARS = 32

/** 默认分隔线字符 */
const DEFAULT_DIVIDER_CHAR = '-'

/** 默认走纸行数 */
const DEFAULT_FEED_LINES = 3

/** 后端打印记录 API 路径（request.ts BASE_URL 已含 /api，此处只需 /admin/print/...） */
const PRINT_RECORD_API = '/admin/print/records'

/** 已连接打印机的 MAC 地址缓存 key */
const CONNECTED_PRINTER_MAC_KEY = 'merchant_connected_printer_mac'

/** 已连接打印机的名称缓存 key */
const CONNECTED_PRINTER_NAME_KEY = 'merchant_connected_printer_name'

// ====================== 原生插件接口 ======================

/** 原生搜索打印机结果 */
interface NativeSearchResult {
    devices?: Array<{
        mac?: string
        address?: string
        name?: string
        rssi?: number
        bonded?: boolean
    }>
    success?: boolean
    error?: string
}

/** 原生连接/断开/状态查询结果 */
interface NativeSimpleResult {
    success?: boolean
    error?: string
    connected?: boolean
}

/** 原生打印结果 */
interface NativePrintResult {
    success?: boolean
    error?: string
}

/**
 * PrintManager 原生插件接口（callback 风格）
 *
 * 实际原生模块（io.zhixiang.print.PrintManagerModule）使用 UniJSMethod 注解，
 * 接收 JSONObject 参数 + JSONObject callback 回调。
 * 本接口仅描述 JS 侧调用的方法签名，便于 TypeScript 类型推导。
 */
interface PrintManagerNativeModule {
    /** 搜索蓝牙打印机（约 10s 超时） */
    searchPrinters(callback: (result: NativeSearchResult) => void): void
    /** 连接指定 MAC 的打印机 */
    connectPrinter(options: { mac: string }, callback: (result: NativeSimpleResult) => void): void
    /** 断开当前连接 */
    disconnectPrinter(callback: (result: NativeSimpleResult) => void): void
    /** 查询当前连接状态 */
    isConnected(callback: (result: NativeSimpleResult) => void): void
    /** 打印销售单（58mm 热敏） */
    printSaleBill(options: { lines: PrintLine[] }, callback: (result: NativePrintResult) => void): void
    /** 打印销售单（针式三联） */
    printSaleBillDot(options: { lines: PrintLine[] }, callback: (result: NativePrintResult) => void): void
    /** 原始打印指令 */
    printRaw(options: { lines: PrintLine[] }, callback: (result: NativePrintResult) => void): void
}

// ====================== 工具函数 ======================

/**
 * 获取当前操作员 ID（用于打印记录 operatorId 字段）
 * @returns 操作员 ID，未登录返回 null
 */
function getCurrentOperatorId(): number | null {
    const user = getUser()
    return user?.id ?? null
}

/**
 * 获取当前门店 ID（用于打印记录 storeId 字段）
 * @returns 门店 ID，未配置返回 null
 */
function getCurrentStoreId(): number | null {
    const user = getUser()
    return user?.storeId ?? null
}

/**
 * 缓存已连接打印机的 MAC 地址
 * @param mac MAC 地址
 * @param name 设备名称
 */
function cacheConnectedPrinter(mac: string, name: string): void {
    try {
        uni.setStorageSync(CONNECTED_PRINTER_MAC_KEY, mac)
        uni.setStorageSync(CONNECTED_PRINTER_NAME_KEY, name)
    } catch {
        // 缓存失败忽略，不影响主流程
    }
}

/**
 * 读取缓存的已连接打印机 MAC
 * @returns MAC 地址，未缓存返回空字符串
 */
function getCachedPrinterMac(): string {
    try {
        return uni.getStorageSync(CONNECTED_PRINTER_MAC_KEY) || ''
    } catch {
        return ''
    }
}

/**
 * 清除已连接打印机缓存
 */
function clearConnectedPrinterCache(): void {
    try {
        uni.removeStorageSync(CONNECTED_PRINTER_MAC_KEY)
        uni.removeStorageSync(CONNECTED_PRINTER_NAME_KEY)
    } catch {
        // 清除失败忽略
    }
}

/**
 * 规范化打印机设备字段（兼容原生层返回的 mac/address 双字段）
 * @param raw 原生返回的设备对象
 * @returns 规范化后的 PrinterDevice
 */
function normalizeDevice(raw: {
    mac?: string
    address?: string
    name?: string
    rssi?: number
    bonded?: boolean
}): PrinterDevice {
    return {
        mac: String(raw.mac || raw.address || ''),
        name: String(raw.name || '未知设备'),
        rssi: typeof raw.rssi === 'number' ? raw.rssi : undefined,
        bonded: !!raw.bonded,
        type: 'thermal',
        paperWidth: 58,
    }
}

// ====================== 原生插件实例获取 ======================

/**
 * 获取 PrintManager 原生插件实例
 *
 * - APP-PLUS 环境：通过 uni.requireNativePlugin 获取原生插件
 * - 其他环境（H5/小程序）：返回 null
 *
 * 使用 IIFE 包裹条件编译，避免 vue-tsc 看到两个 return 语句造成问题（踩坑日志 [15]）
 *
 * @returns 原生插件实例，不可用时返回 null
 */
function getPrintManager(): PrintManagerNativeModule | null {
    return (() => {
        // #ifdef APP-PLUS
        return uni.requireNativePlugin('PrintManager') as PrintManagerNativeModule | null
        // #endif
        // #ifndef APP-PLUS
        return null
        // #endif
    })()
}

// ====================== 后端打印记录保存 ======================

/**
 * 保存打印记录到后端
 * 调用 POST /api/admin/print/records，打印成功/失败均保存
 *
 * @param payload 打印记录入参
 * @returns 新建记录 ID（保存失败时返回 0，不抛错以保证不阻塞主流程）
 */
async function savePrintRecord(payload: PrintRecordPayload): Promise<number> {
    try {
        const result = await post<PrintRecordResult | { id: number }>(PRINT_RECORD_API, payload)
        // 兼容后端直接返回 { id } 或 { id } 嵌套在 data 中的两种情况
        const id = (result as PrintRecordResult)?.id ?? 0
        return Number(id) || 0
    } catch {
        // 打印记录保存失败不影响主流程，仅返回 0
        return 0
    }
}

/**
 * 构造并保存打印记录（内部便捷方法）
 *
 * @param billType 单据类型
 * @param billNo 单据编号
 * @param lines 打印内容（PrintLine 数组）
 * @param status 打印状态
 * @param errorMsg 错误信息（失败时）
 * @returns 新建记录 ID
 */
async function persistPrintRecord(
    billType: PrintBillType,
    billNo: string,
    lines: PrintLine[],
    status: PrintRecordStatus,
    errorMsg?: string
): Promise<number> {
    const printerMac = getCachedPrinterMac() || null
    const payload: PrintRecordPayload = {
        billType,
        billNo,
        printerMac,
        printContent: JSON.stringify(lines),
        copies: 1,
        status,
        errorMsg: errorMsg ? String(errorMsg).slice(0, 1000) : null,
        storeId: getCurrentStoreId(),
        operatorId: getCurrentOperatorId(),
    }
    return savePrintRecord(payload)
}

// ====================== 核心打印 API ======================

/**
 * 搜索蓝牙打印机
 *
 * 启动蓝牙扫描，约 10 秒后返回搜索到的设备列表。
 * Android 12+ 需要用户授予 BLUETOOTH_SCAN + BLUETOOTH_CONNECT 权限，
 * Android 11 及以下需要 ACCESS_FINE_LOCATION 权限。
 *
 * @returns 搜索到的打印机设备列表
 *
 * @example
 * ```ts
 * const devices = await searchPrinters()
 * if (devices.length === 0) {
 *   uni.showToast({ title: '未发现蓝牙打印机', icon: 'none' })
 * }
 * ```
 */
export function searchPrinters(): Promise<PrinterDevice[]> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new Error('蓝牙打印功能仅在 App 端可用'))
    }

    return new Promise<PrinterDevice[]>((resolve, reject) => {
        try {
            manager.searchPrinters((res: NativeSearchResult) => {
                if (!res) {
                    reject(new Error('搜索打印机返回为空'))
                    return
                }
                if (res.success === false) {
                    reject(new Error(res.error || '搜索打印机失败'))
                    return
                }
                const devices = (res.devices || []).map(normalizeDevice).filter((d) => d.mac)
                resolve(devices)
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('搜索打印机调用失败'))
        }
    })
}

/**
 * 连接指定 MAC 的打印机
 *
 * @param mac 蓝牙 MAC 地址（XX:XX:XX:XX:XX:XX）
 * @returns 连接成功返回 true，失败抛错
 *
 * @example
 * ```ts
 * await connectPrinter('00:11:22:33:44:55')
 * uni.showToast({ title: '打印机已连接', icon: 'success' })
 * ```
 */
export function connectPrinter(mac: string): Promise<boolean> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new Error('蓝牙打印功能仅在 App 端可用'))
    }
    if (!mac || typeof mac !== 'string') {
        return Promise.reject(new Error('MAC 地址不能为空'))
    }

    return new Promise<boolean>((resolve, reject) => {
        try {
            manager.connectPrinter({ mac }, (res: NativeSimpleResult) => {
                if (res && res.success) {
                    cacheConnectedPrinter(mac, mac)
                    resolve(true)
                } else {
                    reject(new Error(res?.error || '连接打印机失败'))
                }
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('连接打印机调用失败'))
        }
    })
}

/**
 * 断开当前打印机连接
 *
 * 断开后会清除已连接打印机的本地缓存。
 *
 * @returns 断开成功 resolve，失败 reject
 */
export function disconnectPrinter(): Promise<void> {
    const manager = getPrintManager()
    if (!manager) {
        // 非App端直接清除缓存并resolve
        clearConnectedPrinterCache()
        return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
        try {
            manager.disconnectPrinter((res: NativeSimpleResult) => {
                clearConnectedPrinterCache()
                if (res && res.success) {
                    resolve()
                } else {
                    // 即使原生断开失败也清除本地缓存，避免状态卡死
                    resolve()
                }
            })
        } catch (err) {
            clearConnectedPrinterCache()
            reject(err instanceof Error ? err : new Error('断开打印机调用失败'))
        }
    })
}

/**
 * 查询当前打印机连接状态
 *
 * @returns 已连接返回 true，未连接返回 false
 *
 * @example
 * ```ts
 * if (await isConnected()) {
 *   // 已连接，可以直接打印
 *   await printSaleBill(billData)
 * } else {
 *   // 引导用户连接打印机
 *   uni.showToast({ title: '请先连接打印机', icon: 'none' })
 * }
 * ```
 */
export function isConnected(): Promise<boolean> {
    const manager = getPrintManager()
    if (!manager) {
        return Promise.resolve(false)
    }

    return new Promise<boolean>((resolve) => {
        try {
            manager.isConnected((res: NativeSimpleResult) => {
                resolve(!!(res && (res.connected || res.success)))
            })
        } catch {
            resolve(false)
        }
    })
}

/**
 * 打印销售单（58mm 热敏）
 *
 * 内部流程：
 *  1. 调用 buildSaleBillLines(data) 构造打印模板
 *  2. 调用原生 printSaleBill 发送打印指令
 *  3. 无论成功/失败，调用后端 POST /api/admin/print/records 保存打印记录
 *
 * @param data 销售单数据
 * @returns 打印成功 resolve，失败 reject
 *
 * @example
 * ```ts
 * try {
 *   await printSaleBill(billData)
 *   uni.showToast({ title: '打印成功', icon: 'success' })
 * } catch (err) {
 *   uni.showToast({ title: err.message, icon: 'none' })
 * }
 * ```
 */
export async function printSaleBill(data: SaleBillData): Promise<void> {
    const lines = buildSaleBillLines(data)
    await executePrint('printSaleBill', data.billNo, lines, async (manager, callback) => {
        manager.printSaleBill({ lines }, callback)
    })
}

/**
 * 打印销售单（针式三联）
 *
 * 针式打印机三联复写纸打印，模板与 58mm 热敏一致，由原生层处理三联走纸。
 *
 * @param data 销售单数据
 * @returns 打印成功 resolve，失败 reject
 */
export async function printSaleBillDot(data: SaleBillData): Promise<void> {
    const lines = buildSaleBillLines(data)
    await executePrint('printSaleBillDot', data.billNo, lines, async (manager, callback) => {
        manager.printSaleBillDot({ lines }, callback)
    })
}

/**
 * 原始打印指令（自定义模板）
 *
 * 调用方自行构造 PrintLine[] 数组，直接发送给原生打印层。
 * 不自动保存打印记录（保存由调用方决定）。
 *
 * @param lines 打印行数组
 * @returns 打印成功 resolve，失败 reject
 *
 * @example
 * ```ts
 * await printRaw([
 *   { type: 'text', content: '测试打印', align: 'center', bold: true },
 *   { type: 'divider' },
 *   { type: 'feed', lines: 3 },
 * ])
 * ```
 */
export function printRaw(lines: PrintLine[]): Promise<void> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new Error('蓝牙打印功能仅在 App 端可用'))
    }
    if (!Array.isArray(lines) || lines.length === 0) {
        return Promise.reject(new Error('打印内容不能为空'))
    }

    return new Promise<void>((resolve, reject) => {
        try {
            manager.printRaw({ lines }, (res: NativePrintResult) => {
                if (res && res.success) {
                    resolve()
                } else {
                    reject(new Error(res?.error || '打印失败'))
                }
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('原始打印调用失败'))
        }
    })
}

/**
 * 执行打印并保存打印记录（内部统一流程）
 *
 * @param _method 打印方法名（仅用于日志，不参与逻辑）
 * @param billNo 单据编号（保存打印记录用）
 * @param lines 打印内容（保存打印记录用）
 * @param invoke 调用原生打印方法的封装
 */
async function executePrint(
    _method: 'printSaleBill' | 'printSaleBillDot',
    billNo: string,
    lines: PrintLine[],
    invoke: (
        manager: PrintManagerNativeModule,
        callback: (result: NativePrintResult) => void
    ) => void
): Promise<void> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        // 即使非App端也尝试保存 FAILED 记录
        await persistPrintRecord('SALE_BILL', billNo, lines, 'FAILED', '蓝牙打印功能仅在 App 端可用')
        throw new Error('蓝牙打印功能仅在 App 端可用')
    }

    return new Promise<void>((resolve, reject) => {
        try {
            invoke(manager, async (res: NativePrintResult) => {
                if (res && res.success) {
                    // 打印成功，保存 SUCCESS 记录
                    await persistPrintRecord('SALE_BILL', billNo, lines, 'SUCCESS')
                    resolve()
                } else {
                    const errMsg = res?.error || '打印失败'
                    // 打印失败，保存 FAILED 记录
                    await persistPrintRecord('SALE_BILL', billNo, lines, 'FAILED', errMsg)
                    reject(new Error(errMsg))
                }
            })
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : '打印调用失败'
            // 调用异常，保存 FAILED 记录
            void persistPrintRecord('SALE_BILL', billNo, lines, 'FAILED', errMsg)
            reject(err instanceof Error ? err : new Error('打印调用失败'))
        }
    })
}

// ====================== 58mm 热敏打印模板 ======================

/**
 * 格式化金额（保留 2 位小数，去尾）
 * @param amount 金额（元）
 * @returns 格式化后的字符串，如 "12.34"
 */
function formatMoney(amount: number): string {
    if (typeof amount !== 'number' || !isFinite(amount)) return '0.00'
    return amount.toFixed(2)
}

/**
 * 格式化日期时间
 * 接受 ISO 字符串 / yyyy-MM-dd HH:mm:ss / 时间戳，输出 yyyy-MM-dd HH:mm
 * @param input 日期时间输入
 * @returns 格式化后的字符串，解析失败原样返回
 */
function formatDateTime(input: string): string {
    if (!input) return ''
    // 已经是 yyyy-MM-dd HH:mm:ss 格式，截取到分钟
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(input)) {
        return input.replace('T', ' ').slice(0, 16)
    }
    // 尝试 Date 解析
    const date = new Date(input)
    if (!isNaN(date.getTime())) {
        const pad = (n: number): string => String(n).padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    return input
}

/**
 * 构造 58mm 热敏打印销售单模板
 *
 * 对齐方案 2.2.3 节模板格式：
 * ```
 * =================================
 *      智享全链 - 销售单
 * =================================
 * 单号: XS202607190001
 * 日期: 2026-07-19 14:30
 * 收银员: 李四
 * 会员: 张三
 * --------------------------------
 * 商品          数量  单价  金额
 * --------------------------------
 * 茅台飞天 500ml
 *   x1箱(6瓶)    6   1499  8994
 * 五粮液 52度
 *   x2瓶         2    899  1798
 * --------------------------------
 * 商品数: 8
 * 合计:                  10792.00
 * 优惠:                      0.00
 * 应付:                  10792.00
 * 支付方式: 微信支付
 * 实付:                  10792.00
 * 找零:                      0.00
 * --------------------------------
 * 电话: 400-xxx-xxxx
 * 欢迎再光临！
 * [二维码（可选）]
 * ```
 *
 * @param data 销售单数据
 * @returns PrintLine 数组
 */
export function buildSaleBillLines(data: SaleBillData): PrintLine[] {
    const lines: PrintLine[] = []

    // ============ 头部：店铺信息 ============
    // 店铺名（居中加粗双倍字号）
    lines.push({
        type: 'text',
        content: data.storeName || '智享全链',
        align: 'center',
        bold: true,
        size: 'double',
    })

    // 副标题（居中加粗）
    lines.push({
        type: 'text',
        content: '销售单',
        align: 'center',
        bold: true,
    })

    // 地址（可选）
    if (data.storeAddress) {
        lines.push({
            type: 'text',
            content: data.storeAddress,
            align: 'center',
        })
    }

    // 电话（可选）
    if (data.storePhone) {
        lines.push({
            type: 'text',
            content: `电话: ${data.storePhone}`,
            align: 'center',
        })
    }

    // 头部分隔线
    lines.push({ type: 'divider', char: '=' })

    // ============ 单据信息 ============
    lines.push({
        type: 'text',
        content: `单号: ${data.billNo}`,
        align: 'left',
    })
    lines.push({
        type: 'text',
        content: `日期: ${formatDateTime(data.createdAt)}`,
        align: 'left',
    })
    lines.push({
        type: 'text',
        content: `收银员: ${data.cashierName || '-'}`,
        align: 'left',
    })
    if (data.memberName) {
        lines.push({
            type: 'text',
            content: `会员: ${data.memberName}`,
            align: 'left',
        })
    }

    // 单据信息分隔线
    lines.push({ type: 'divider' })

    // ============ 商品明细表头 ============
    lines.push({
        type: 'table',
        columns: [
            { text: '商品', width: 14, align: 'left' },
            { text: '数量', width: 6, align: 'right' },
            { text: '单价', width: 6, align: 'right' },
            { text: '金额', width: 6, align: 'right' },
        ],
    })

    lines.push({ type: 'divider' })

    // ============ 商品明细行 ============
    for (const item of data.items) {
        // 商品名称行（左对齐独占一行，便于长名称展示）
        lines.push({
            type: 'text',
            content: item.name,
            align: 'left',
        })
        // 数量/单价/小计 表格行
        lines.push({
            type: 'table',
            columns: [
                { text: '', width: 14, align: 'left' },
                { text: String(item.qty), width: 6, align: 'right' },
                { text: formatMoney(item.price), width: 6, align: 'right' },
                { text: formatMoney(item.subtotal), width: 6, align: 'right' },
            ],
        })
    }

    // 合计区分隔线
    lines.push({ type: 'divider' })

    // ============ 合计区域 ============
    lines.push({
        type: 'text',
        content: `商品数: ${data.totalQty}`,
        align: 'left',
    })
    lines.push({
        type: 'table',
        columns: [
            { text: '合计:', width: 22, align: 'left' },
            { text: formatMoney(data.totalAmount), width: 10, align: 'right' },
        ],
    })
    if (data.discount > 0) {
        lines.push({
            type: 'table',
            columns: [
                { text: '优惠:', width: 22, align: 'left' },
                { text: '-' + formatMoney(data.discount), width: 10, align: 'right' },
            ],
        })
    }
    lines.push({
        type: 'table',
        columns: [
            { text: '应付:', width: 22, align: 'left' },
            { text: formatMoney(data.payable), width: 10, align: 'right' },
        ],
    })

    // ============ 支付信息 ============
    lines.push({ type: 'divider' })
    lines.push({
        type: 'text',
        content: `支付方式: ${data.paymentMethod || '-'}`,
        align: 'left',
    })
    lines.push({
        type: 'table',
        columns: [
            { text: '实付:', width: 22, align: 'left' },
            { text: formatMoney(data.paidAmount), width: 10, align: 'right' },
        ],
    })
    if (data.changeAmount > 0) {
        lines.push({
            type: 'table',
            columns: [
                { text: '找零:', width: 22, align: 'left' },
                { text: formatMoney(data.changeAmount), width: 10, align: 'right' },
            ],
        })
    }

    // 备注（可选）
    if (data.remark) {
        lines.push({
            type: 'text',
            content: `备注: ${data.remark}`,
            align: 'left',
        })
    }

    // ============ 底部 ============
    lines.push({ type: 'divider', char: '=' })
    if (data.storePhone) {
        lines.push({
            type: 'text',
            content: `门店电话: ${data.storePhone}`,
            align: 'center',
        })
    }
    lines.push({
        type: 'text',
        content: '欢迎再光临！',
        align: 'center',
        bold: true,
    })

    // 二维码（可选，如店铺小程序码）
    if (data.qrcodeContent) {
        lines.push({
            type: 'qrcode',
            content: data.qrcodeContent,
            size: 6,
        })
    }

    // 走纸 3 行（便于撕纸）
    lines.push({ type: 'feed', lines: DEFAULT_FEED_LINES })

    return lines
}

// ====================== 便捷方法 ======================

/**
 * 一键打印销售单（自动连接缓存打印机）
 *
 * 流程：
 *  1. 检查当前打印机连接状态
 *  2. 未连接时尝试连接缓存的 MAC
 *  3. 连接成功后打印
 *
 * @param data 销售单数据
 * @returns 打印成功 resolve，失败 reject（错误信息提示用户）
 */
export async function printSaleBillAuto(data: SaleBillData): Promise<void> {
    const connected = await isConnected()
    if (!connected) {
        const cachedMac = getCachedPrinterMac()
        if (!cachedMac) {
            uni.showToast({ title: '请先连接打印机', icon: 'none' })
            // 未配置打印机，保存 FAILED 记录
            const lines = buildSaleBillLines(data)
            await persistPrintRecord('SALE_BILL', data.billNo, lines, 'FAILED', '未连接打印机')
            throw new Error('未连接打印机')
        }
        try {
            await connectPrinter(cachedMac)
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : '连接打印机失败'
            const lines = buildSaleBillLines(data)
            await persistPrintRecord('SALE_BILL', data.billNo, lines, 'FAILED', errMsg)
            throw err
        }
    }
    await printSaleBill(data)
}

/**
 * 获取当前已缓存的打印机 MAC
 * @returns MAC 地址，未缓存返回空字符串
 */
export function getCachedPrinter(): string {
    return getCachedPrinterMac()
}

// ====================== 导出清单 ======================

export {
    // 类型已通过 export interface / export type 导出：
    // PrintAlign, PrintFontSize, PrintLine,
    // PrinterType, PrinterDevice, SaleBillItem, SaleBillData,
    // PrintBillType, PrintRecordStatus, PrintRecordPayload, PrintRecordResult
    // 函数已通过 export function / export async function 导出：
    // searchPrinters, connectPrinter, disconnectPrinter, isConnected,
    // printSaleBill, printSaleBillDot, printRaw, buildSaleBillLines,
    // printSaleBillAuto, getCachedPrinter
    // 常量导出（便于外部模板构造时参考）
    PAPER_58MM_CHARS,
    DEFAULT_DIVIDER_CHAR,
    DEFAULT_FEED_LINES,
}
