/**
 * 蓝牙热敏打印原生插件封装（R51-02）
 *
 * 功能：
 *  1. 封装 uni.requireNativePlugin('PrintManager') 为 Promise 接口
 *  2. 实现 PrintManager 接口（严格对齐 R51-02 任务接口定义）：
 *     - search()                 搜索蓝牙打印机（返回设备列表）
 *     - connect(mac)             连接指定 MAC 的打印机
 *     - disconnect()             断开连接
 *     - isConnected()            检查连接状态（同步，基于本地缓存）
 *     - printSaleBill(data)      打印销售单（58mm 热敏），返回 PrintResult
 *     - printSaleBillDot(data)   点阵打印（针式三联），返回 PrintResult
 *     - printRaw(data)           原始数据打印（Uint8Array），返回 PrintResult
 *  3. 实现 58mm 热敏打印模板 buildSaleBillLines(data)（对齐任务"修复方向 #2"模板要求）：
 *     - 店铺名称（居中大字）、单号/时间/收银员
 *     - 商品明细（名称、数量、单价、小计）
 *     - 合计、优惠、应付、支付方式、实付
 *     - 会员积分、二维码、切刀指令（走纸）
 *  4. 打印成功/失败均调用后端 POST /api/admin/print/records 保存打印记录（R51-03 已实现）
 *     - 对外暴露 savePrintRecord(record): Promise<void> 接口
 *  5. 错误处理（对齐任务"修复方向 #4"）：蓝牙未开启 / 设备未找到 / 连接失败 / 打印超时 / 缺纸
 *
 * 注意：
 *  - 使用 IIFE 包裹 uni-app 条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *  - 非 APP-PLUS 环境下蓝牙打印功能不可用，会 reject PrintError(device_not_supported)
 *  - 后端 bill_type 枚举：SALE_BILL / SALE_RETURN / SHIFT / DAILY_SETTLE / REPRINT
 *  - 后端 status 枚举：SUCCESS / FAILED / PENDING（对齐 print.service.ts）
 *  - 旧接口名（searchPrinters/connectPrinter/disconnectPrinter）保留为 @deprecated 别名，向后兼容（对齐 R51-01 scan.ts 做法）
 *
 * @author 阿澈
 */

import { post } from '@/api/request'
import { getUser } from '@/api/storage'

// ====================== 类型定义（严格对齐 R51-02 任务接口定义） ======================

/**
 * 蓝牙打印机设备信息（对齐任务接口定义 PrinterDevice）
 */
export interface PrinterDevice {
    /** 蓝牙 MAC 地址（XX:XX:XX:XX:XX:XX 格式） */
    mac: string
    /** 设备名称 */
    name: string
    /** 信号强度（dBm，负值，越接近 0 越强） */
    rssi?: number
    /** 是否已配对（扩展字段，原生层返回） */
    bonded?: boolean
    /** 打印机类型（热敏/针式），默认 thermal */
    type?: PrinterType
    /** 纸宽 mm（58/80），默认 58 */
    paperWidth?: number
}

/** 打印机类型 */
export type PrinterType = 'thermal' | 'dot'

/**
 * 销售单打印数据（严格对齐任务接口定义 SaleBillPrintData）
 */
export interface SaleBillPrintData {
    /** 店铺名称（居中大字显示） */
    storeName: string
    /** 单据编号 */
    billNo: string
    /** 单据生成时间（ISO 字符串或 yyyy-MM-dd HH:mm:ss） */
    createdAt: string
    /** 收银员姓名 */
    cashierName: string
    /** 商品明细 */
    items: Array<{
        /** 商品名称（含规格） */
        name: string
        /** 数量 */
        quantity: number
        /** 单价（元） */
        unitPrice: number
        /** 小计金额（元） */
        subtotal: number
    }>
    /** 合计金额（元，商品总额） */
    totalAmount: number
    /** 优惠金额（元） */
    discount: number
    /** 应付金额（元） */
    payableAmount: number
    /** 支付方式（现金/微信/支付宝/银行卡/混合等） */
    paymentMethod: string
    /** 实付金额（元） */
    paidAmount: number
    /** 会员积分（可选，显示在底部） */
    memberPoints?: number
    /** 底部二维码内容（可选，如店铺小程序码） */
    qrcode?: string
}

/**
 * 打印结果（严格对齐任务接口定义 PrintResult）
 */
export interface PrintResult {
    /** 是否打印成功 */
    success: boolean
    /** 失败时的错误信息 */
    error?: string
    /** 打印耗时（毫秒，成功时返回） */
    printTime?: number
}

/** 文本对齐方式 */
export type PrintAlign = 'left' | 'center' | 'right'

/** 文本字号 */
export type PrintFontSize = 'normal' | 'double'

/**
 * 打印行联合类型（用于 58mm 模板构造，扩展能力）
 * - text:    文本行（可配置对齐/加粗/字号）
 * - divider: 分隔线（默认 '-'，58mm 纸宽 32 字符）
 * - table:   表格行（多列，每列指定宽度比例和对其方式）
 * - barcode: 一维码
 * - qrcode:  二维码
 * - feed:    走纸（默认 3 行，配合切刀指令）
 */
export type PrintLine =
    | { type: 'text'; content: string; align?: PrintAlign; bold?: boolean; size?: PrintFontSize }
    | { type: 'divider'; char?: string }
    | { type: 'table'; columns: Array<{ text: string; width: number; align?: PrintAlign }> }
    | { type: 'barcode'; content: string; height?: number }
    | { type: 'qrcode'; content: string; size?: number }
    | { type: 'feed'; lines?: number }

/** 后端打印记录单据类型（对齐 print.service.ts BILL_TYPE_VALUES） */
export type PrintBillType = 'SALE_BILL' | 'SALE_RETURN' | 'SHIFT' | 'DAILY_SETTLE' | 'REPRINT'

/** 后端打印记录状态（对齐 print.service.ts STATUS_VALUES） */
export type PrintRecordStatus = 'SUCCESS' | 'FAILED' | 'PENDING'

/**
 * 打印记录保存入参（对齐后端 POST /api/admin/print/records 入参）
 *
 * 用于 savePrintRecord(record): Promise<void> 接口。
 * API 路径和参数对齐后端 POST /api/admin/print/records（R51-03 已实现）。
 */
export interface PrintRecordData {
    /** 单据类型 */
    billType: PrintBillType
    /** 单据编号 */
    billNo: string
    /** 打印机 MAC 地址 */
    printerMac?: string | null
    /** 打印内容（JSON 字符串或文本摘要） */
    printContent?: string | null
    /** 打印份数，默认 1 */
    copies?: number
    /** 打印状态，默认 SUCCESS */
    status?: PrintRecordStatus
    /** 错误信息（失败时） */
    errorMsg?: string | null
    /** 门店 ID */
    storeId?: number | null
    /** 操作员 ID */
    operatorId?: number | null
}

// ====================== 错误体系（对齐 scan.ts 的 ScanError 模式） ======================

/**
 * 打印错误类型枚举（对齐任务"修复方向 #4"错误处理要求）
 * - device_not_supported: 设备不支持（非 App 端 / 原生插件未加载）
 * - bluetooth_disabled:   蓝牙未开启
 * - device_not_found:     设备未找到
 * - connect_failed:       连接失败
 * - print_timeout:        打印超时
 * - out_of_paper:         缺纸
 * - print_failed:         其他打印失败
 */
export type PrintErrorType =
    | 'device_not_supported' // 设备不支持（非 App 端 / 原生插件未加载）
    | 'bluetooth_disabled'   // 蓝牙未开启
    | 'device_not_found'     // 设备未找到
    | 'connect_failed'       // 连接失败
    | 'print_timeout'        // 打印超时
    | 'out_of_paper'         // 缺纸
    | 'print_failed'         // 其他打印失败

/**
 * 打印错误类
 *
 * 调用方推荐通过 PrintError.errorType 区分错误类型，给出对应提示：
 * ```ts
 * try {
 *   await printSaleBill(data)
 * } catch (err) {
 *   if (err instanceof PrintError) {
 *     switch (err.errorType) {
 *       case 'bluetooth_disabled':   // 引导用户开启蓝牙
 *       case 'device_not_found':     // 提示搜索打印机
 *       case 'out_of_paper':         // 提示装纸后重试
 *       case 'print_timeout':        // 提示重试
 *       case 'connect_failed':       // 提示重新连接
 *     }
 *   }
 * }
 * ```
 */
export class PrintError extends Error {
    readonly errorType: PrintErrorType

    constructor(errorType: PrintErrorType, message: string) {
        super(message)
        this.name = 'PrintError'
        this.errorType = errorType
        // 维持 instanceof 行为（ES5 编译目标下的兼容）
        Object.setPrototypeOf(this, PrintError.prototype)
    }
}

// ====================== 常量定义 ======================

/** 58mm 热敏纸每行字符数（半角字符） */
const PAPER_58MM_CHARS = 32

/** 默认分隔线字符 */
const DEFAULT_DIVIDER_CHAR = '-'

/** 默认走纸行数（配合切刀指令，便于撕纸） */
const DEFAULT_FEED_LINES = 3

/** 打印超时时间（毫秒），默认 30s */
const DEFAULT_PRINT_TIMEOUT = 30000

/** 后端打印记录 API 路径（request.ts BASE_URL 已含 /api，此处只需 /admin/print/...） */
const PRINT_RECORD_API = '/admin/print/records'

/** 已连接打印机的 MAC 地址缓存 key */
const CONNECTED_PRINTER_MAC_KEY = 'merchant_connected_printer_mac'

/** 已连接打印机的名称缓存 key */
const CONNECTED_PRINTER_NAME_KEY = 'merchant_connected_printer_name'

/**
 * 缺纸错误关键词（原生层返回的错误消息中匹配这些关键词则判定为缺纸）
 * 兼容中英文：缺纸/无纸/请装纸/out of paper/no paper/paper out/paper empty
 */
const OUT_OF_PAPER_KEYWORDS = ['缺纸', '无纸', '请装纸', 'out of paper', 'no paper', 'paper out', 'paper empty', 'paper empty']

// ====================== 模块级连接状态（isConnected 同步返回依据） ======================

/**
 * 当前已连接打印机的 MAC 地址（模块级缓存状态）
 *
 * isConnected() 同步返回 `currentConnectedMac !== null`。
 * connect() 成功时设置，disconnect() 时清除。
 * App 重启后从 uni.getStorageSync 恢复（见 initConnectedState）。
 */
let currentConnectedMac: string | null = null

/**
 * 当前已连接打印机的名称
 */
let currentConnectedName: string | null = null

/**
 * 从本地 storage 恢复已连接打印机状态（模块加载时自动执行）
 *
 * 注意：storage 中有 MAC 不代表物理连接仍然有效（打印机可能已关机）。
 * 如需确认物理连接，请使用 checkConnected() 异步查询原生层。
 */
function initConnectedState(): void {
    try {
        const mac = uni.getStorageSync(CONNECTED_PRINTER_MAC_KEY)
        const name = uni.getStorageSync(CONNECTED_PRINTER_NAME_KEY)
        if (mac && typeof mac === 'string') {
            currentConnectedMac = mac
            currentConnectedName = (name && typeof name === 'string') ? name : mac
        }
    } catch {
        // storage 读取失败忽略，不影响主流程
    }
}

// 模块加载时恢复连接状态
initConnectedState()

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
    /** 蓝牙是否已开启（部分原生插件在搜索失败时返回此字段） */
    bluetoothEnabled?: boolean
}


/** 原生连接/断开/状态查询结果 */
interface NativeSimpleResult {
    success?: boolean
    error?: string
    connected?: boolean
    /** 蓝牙是否已开启 */
    bluetoothEnabled?: boolean
}

/** 原生打印结果 */
interface NativePrintResult {
    success?: boolean
    error?: string
    /** 缺纸标志（部分原生插件直接返回此字段） */
    outOfPaper?: boolean
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
    /** 原始打印指令（PrintLine 数组） */
    printRawLines(options: { lines: PrintLine[] }, callback: (result: NativePrintResult) => void): void
    /** 原始字节打印（ESC/POS 指令透传，data 为 number 数组） */
    printRawBytes(options: { data: Array<number> }, callback: (result: NativePrintResult) => void): void
}

/**
 * HMS Core Bluetooth Kit 原生插件接口（HarmonyOS）
 *
 * 对应 @hms/core/bluetooth 模块，HarmonyOS 平台通过 HBuilderX 打包鸿蒙包时
 * 由原生层注入 globalThis.HMSɨBluetoothKit 全局对象。
 * 接口与 PrintManagerNativeModule 对齐，便于统一适配。
 */
interface HMSBluetoothKitNativeModule {
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
    /** 原始打印指令（PrintLine 数组） */
    printRawLines(options: { lines: PrintLine[] }, callback: (result: NativePrintResult) => void): void
    /** 原始字节打印（ESC/POS 指令透传） */
    printRawBytes(options: { data: Array<number> }, callback: (result: NativePrintResult) => void): void
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
 * 缓存已连接打印机的 MAC 地址（同步更新模块级状态 + 持久化 storage）
 * @param mac MAC 地址
 * @param name 设备名称
 */
function cacheConnectedPrinter(mac: string, name: string): void {
    currentConnectedMac = mac
    currentConnectedName = name
    try {
        uni.setStorageSync(CONNECTED_PRINTER_MAC_KEY, mac)
        uni.setStorageSync(CONNECTED_PRINTER_NAME_KEY, name)
    } catch {
        // 持久化失败忽略，不影响主流程（模块级状态已更新）
    }
}

/**
 * 读取缓存的已连接打印机 MAC
 * @returns MAC 地址，未缓存返回空字符串
 */
function getCachedPrinterMac(): string {
    if (currentConnectedMac) return currentConnectedMac
    try {
        return uni.getStorageSync(CONNECTED_PRINTER_MAC_KEY) || ''
    } catch {
        return ''
    }
}

/**
 * 清除已连接打印机缓存（同步清除模块级状态 + storage）
 */
function clearConnectedPrinterCache(): void {
    currentConnectedMac = null
    currentConnectedName = null
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

/**
 * 判断错误消息是否为缺纸
 * @param errMsg 错误消息
 * @returns 是否缺纸
 */
function isOutOfPaperError(errMsg: string): boolean {
    if (!errMsg) return false
    const lower = errMsg.toLowerCase()
    return OUT_OF_PAPER_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

/**
     * 将原生错误消息转换为 PrintError
     *
     * 错误识别优先级：
     *  1. 缺纸（outOfPaper 标志或错误消息匹配关键词）→ out_of_paper
     *  2. 蓝牙未开启（bluetoothEnabled === false 或消息匹配）→ bluetooth_disabled
     *  3. 其他 → fallbackType（由调用方指定，如 connect_failed / print_failed）
     *
     * @param errMsg 错误消息
     * @param outOfPaper 原生层返回的缺纸标志
     * @param bluetoothEnabled 原生层返回的蓝牙开启标志
     * @param fallbackType 默认错误类型（当无法识别具体类型时使用）
     * @returns PrintError 实例
     */
function toPrintError(
    errMsg: string,
    fallbackType: PrintErrorType,
    outOfPaper?: boolean,
    bluetoothEnabled?: boolean,
): PrintError {
    // 缺纸
    if (outOfPaper || isOutOfPaperError(errMsg)) {
        return new PrintError('out_of_paper', errMsg || '打印机缺纸，请装纸后重试')
    }
    // 蓝牙未开启
    if (bluetoothEnabled === false || /蓝牙.*未.*开|bluetooth.*disabled|bluetooth.*off/i.test(errMsg)) {
        return new PrintError('bluetooth_disabled', errMsg || '蓝牙未开启，请先开启蓝牙')
    }
    return new PrintError(fallbackType, errMsg || '打印操作失败')
}

// ====================== 原生插件实例获取 ======================

/** HarmonyOS HMS Bluetooth Kit 全局对象键名（HBuilderX 打包鸿蒙包时由原生层注入） */
const HMS_BT_KIT_KEY = 'HMSɨBluetoothKit'

/**
 * 从 globalThis 安全读取 HMS Bluetooth Kit 原生实例
 *
 * HarmonyOS 平台通过 HBuilderX 打包鸿蒙包时由原生层注入 globalThis.HMSɨBluetoothKit。
 * 使用方括号访问避免特殊字符 `ɨ`（U+0268）在 TypeScript 标识符中引起解析问题。
 *
 * @returns HMS Bluetooth Kit 原生实例，未注入返回 null
 */
function readHMSBluetoothKitRaw(): HMSBluetoothKitNativeModule | null {
    try {
        const kit = (globalThis as Record<string, unknown>)[HMS_BT_KIT_KEY]
        return kit ? (kit as HMSBluetoothKitNativeModule) : null
    } catch {
        return null
    }
}


/**
 * 获取 PrintManager 原生插件实例
     *
     * 平台分支：
     *  - APP-PLUS && !HARMONYOS：通过 uni.requireNativePlugin('PrintManager') 获取
     *  - HARMONYOS：使用 HMS Core Bluetooth Kit（globalThis.HMSɨBluetoothKit）
     *  - 其他环境（H5/小程序）：返回 null
     *
     * 使用 IIFE 包裹条件编译，避免 vue-tsc 看到多个 return 语句造成问题（踩坑日志 [15]）
     *
     * @returns 原生插件实例，不可用时返回 null
     */
function getPrintManager(): PrintManagerNativeModule | null {
    return (() => {
        // #ifdef APP-PLUS && !HARMONYOS
        return uni.requireNativePlugin('PrintManager') as PrintManagerNativeModule | null
        // #endif
        // #ifdef HARMONYOS
        // HMS Bluetooth Kit 接口与 PrintManagerNativeModule 对齐，可直接转换
        return readHMSBluetoothKitRaw() as (HMSBluetoothKitNativeModule & PrintManagerNativeModule) | null
        // #endif
        // #ifndef APP-PLUS
        return null
        // #endif
    })()
}

// ====================== HarmonyOS HMS Bluetooth Kit 适配 ======================

/**
 * HarmonyOS HMS Bluetooth Kit 连接打印机适配
 *
 * 使用 HMS Core Bluetooth Kit 的 connectPrinter API 连接指定 MAC 的蓝牙打印机。
 * 复用现有的 cacheConnectedPrinter 缓存逻辑。
 *
 * 注意：
 *  - 仅在 HARMONYOS 平台下有效，其他平台调用会 reject
 *  - 实际 API 调用在 HBuilderX 打包鸿蒙包时由原生层处理
 *
 * @param mac 蓝牙 MAC 地址（XX:XX:XX:XX:XX:XX）
 * @returns 连接成功 resolve(true)，失败 reject PrintError
 */
export async function connectWithHMSBLE(mac: string): Promise<boolean> {
    const kit = readHMSBluetoothKitRaw()
    if (!kit) {
        uni.showToast({ title: 'HMS Bluetooth Kit 不可用', icon: 'none' })
        return Promise.reject(new PrintError('device_not_supported', 'HMS Bluetooth Kit 不可用'))
    }
    if (!mac || typeof mac !== 'string') {
        return Promise.reject(new PrintError('connect_failed', 'MAC 地址不能为空'))
    }

    return new Promise<boolean>((resolve, reject) => {
        try {
            kit.connectPrinter({ mac }, (res: NativeSimpleResult) => {
                if (res && res.success) {
                    cacheConnectedPrinter(mac, mac)
                    resolve(true)
                } else {
                    reject(toPrintError(res?.error || 'HMS BLE 连接打印机失败', 'connect_failed', undefined, res?.bluetoothEnabled))
                }
            })
        } catch (err) {
            reject(new PrintError('connect_failed', err instanceof Error ? err.message : 'HMS BLE 连接调用失败'))
        }
    })
}

/**
 * HarmonyOS HMS Bluetooth Kit 打印适配
 *
 * 使用 HMS Core Bluetooth Kit 的 printRawLines API 发送打印指令。
 * 复用现有的 buildSaleBillLines 模板和 persistPrintRecord 打印记录入库逻辑。
 *
 * 注意：
 *  - 仅在 HARMONYOS 平台下有效，其他平台调用会 reject
 *  - 实际 API 调用在 HBuilderX 打包鸿蒙包时由原生层处理
 *
 * @param lines PrintLine 数组（由 buildSaleBillLines 构造）
 * @returns 打印成功 resolve，失败 reject PrintError
 */
export async function printWithHMSBLE(lines: PrintLine[]): Promise<void> {
    const kit = readHMSBluetoothKitRaw()
    if (!kit) {
        uni.showToast({ title: 'HMS Bluetooth Kit 不可用', icon: 'none' })
        return Promise.reject(new PrintError('device_not_supported', 'HMS Bluetooth Kit 不可用'))
    }
    if (!Array.isArray(lines) || lines.length === 0) {
        return Promise.reject(new PrintError('print_failed', '打印内容不能为空'))
    }

    return new Promise<void>((resolve, reject) => {
        try {
            kit.printRawLines({ lines }, (res: NativePrintResult) => {
                if (res && res.success) {
                    resolve()
                } else {
                    reject(toPrintError(res?.error || 'HMS BLE 打印失败', 'print_failed', res?.outOfPaper))
                }
            })
        } catch (err) {
            reject(new PrintError('print_failed', err instanceof Error ? err.message : 'HMS BLE 打印调用失败'))
        }
    })
}

// ====================== 后端打印记录保存 ======================

/**
 * 保存打印记录到后端（对外接口，对齐任务"修复方向 #3"）
 *
 * 调用 POST /api/admin/print/records（R51-03 已实现，见 backend/src/routes/print.routes.ts）。
 * 打印成功/失败均应调用此接口保存记录，便于审计留痕。
 *
 * @param record 打印记录入参
 * @returns 保存成功 resolve，保存失败也 resolve（不抛错以保证不阻塞主流程，仅记录日志）
 */
export async function savePrintRecord(record: PrintRecordData): Promise<void> {
    try {
        await post<unknown>(PRINT_RECORD_API, record)
    } catch {
        // 打印记录保存失败不影响主流程，静默处理（仅审计留痕丢失）
    }
}


/**
 * 构造并保存打印记录（内部便捷方法）
     *
     * @param billType 单据类型
     * @param billNo 单据编号
     * @param printContent 打印内容摘要（PrintLine JSON 或文本）
     * @param status 打印状态
     * @param errorMsg 错误信息（失败时）
     * @returns 保存成功 resolve
     */
async function persistPrintRecord(
    billType: PrintBillType,
    billNo: string,
    printContent: string,
    status: PrintRecordStatus,
    errorMsg?: string,
): Promise<void> {
    const record: PrintRecordData = {
        billType,
        billNo,
        printerMac: getCachedPrinterMac() || null,
        printContent,
        copies: 1,
        status,
        errorMsg: errorMsg ? String(errorMsg).slice(0, 1000) : null,
        storeId: getCurrentStoreId(),
        operatorId: getCurrentOperatorId(),
    }
    await savePrintRecord(record)
}

// ====================== 核心打印 API（严格对齐 R51-02 任务接口定义） ======================

/**
 * 搜索蓝牙打印机
 *
 * 启动蓝牙扫描，约 10 秒后返回搜索到的设备列表。
 * Android 12+ 需要用户授予 BLUETOOTH_SCAN + BLUETOOTH_CONNECT 权限，
 * Android 11 及以下需要 ACCESS_FINE_LOCATION 权限。
 *
 * 错误处理：
 *  - 设备不支持（非 App 端）：reject PrintError(device_not_supported)
 *  - 蓝牙未开启：reject PrintError(bluetooth_disabled)
 *  - 搜索失败：reject PrintError(print_failed)
 *  - 未找到设备：resolve([])（不抛错，由调用方判断空数组）
 *
 * @returns 搜索到的打印机设备列表
 *
 * @example
 * ```ts
 * try {
 *   const devices = await search()
 *   if (devices.length === 0) {
 *     uni.showToast({ title: '未发现蓝牙打印机', icon: 'none' })
 *   }
 * } catch (err) {
 *   if (err instanceof PrintError && err.errorType === 'bluetooth_disabled') {
 *     uni.showToast({ title: '请先开启蓝牙', icon: 'none' })
 *   }
 * }
 * ```
 */
export function search(): Promise<PrinterDevice[]> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new PrintError('device_not_supported', '蓝牙打印功能仅在 App 端可用'))
    }

    return new Promise<PrinterDevice[]>((resolve, reject) => {
        try {
            manager.searchPrinters((res: NativeSearchResult) => {
                if (!res) {
                    reject(new PrintError('print_failed', '搜索打印机返回为空'))
                    return
                }
                if (res.success === false) {
                    // 蓝牙未开启或搜索失败
                    reject(toPrintError(res.error || '搜索打印机失败', 'print_failed', undefined, res.bluetoothEnabled))
                    return
                }
                const devices = (res.devices || []).map(normalizeDevice).filter((d) => d.mac)
                resolve(devices)
            })
        } catch (err) {
            reject(new PrintError('print_failed', err instanceof Error ? err.message : '搜索打印机调用失败'))
        }
    })
}

/**
 * 连接指定 MAC 的打印机
 *
 * @param mac 蓝牙 MAC 地址（XX:XX:XX:XX:XX:XX）
 * @returns 连接成功 resolve，失败 reject PrintError
 *
 * 错误处理：
 *  - 设备不支持：reject PrintError(device_not_supported)
 *  - 蓝牙未开启：reject PrintError(bluetooth_disabled)
 *  - 连接失败：reject PrintError(connect_failed)
 *
 * @example
 * ```ts
 * await connect('00:11:22:33:44:55')
 * uni.showToast({ title: '打印机已连接', icon: 'success' })
 * ```
 */
export function connect(mac: string): Promise<void> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new PrintError('device_not_supported', '蓝牙打印功能仅在 App 端可用'))
    }
    if (!mac || typeof mac !== 'string') {
        return Promise.reject(new PrintError('connect_failed', 'MAC 地址不能为空'))
    }

    return new Promise<void>((resolve, reject) => {
        try {
            manager.connectPrinter({ mac }, (res: NativeSimpleResult) => {
                if (res && res.success) {
                    cacheConnectedPrinter(mac, currentConnectedName || mac)
                    resolve()
                } else {
                    reject(toPrintError(res?.error || '连接打印机失败', 'connect_failed', undefined, res?.bluetoothEnabled))
                }
            })
        } catch (err) {
            reject(new PrintError('connect_failed', err instanceof Error ? err.message : '连接打印机调用失败'))
        }
    })
}

/**
 * 断开当前打印机连接
 *
 * 断开后会清除已连接打印机的本地缓存（模块级状态 + storage）。
 *
 * @returns 断开成功 resolve，失败也 resolve（即使原生断开失败也清除本地缓存，避免状态卡死）
 */
export function disconnect(): Promise<void> {
    const manager = getPrintManager()
    if (!manager) {
        // 非App端直接清除缓存并resolve
        clearConnectedPrinterCache()
        return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
        try {
            manager.disconnectPrinter((res: NativeSimpleResult) => {
                clearConnectedPrinterCache()
                // 即使原生断开失败也清除本地缓存，避免状态卡死
                if (res && res.success) {
                    resolve()
                } else {
                    resolve()
                }
            })
        } catch {
            clearConnectedPrinterCache()
            resolve()
        }
    })
}


/**
 * 检查当前打印机连接状态（同步，基于本地缓存）
     *
     * 返回模块级缓存的连接状态（connect 成功后为 true，disconnect 后为 false）。
     * 适用于打印流程中快速判断"是否曾连接打印机"。
     *
     * 注意：storage 中有 MAC 不代表物理连接仍然有效（打印机可能已关机）。
     * 如需确认物理连接是否仍然有效，请使用 checkConnected() 异步查询原生层。
     *
     * @returns 已连接返回 true，未连接返回 false
     *
     * @example
     * ```ts
     * if (isConnected()) {
     *   // 已连接，可以直接打印
     *   await printSaleBill(billData)
     * } else {
     *   // 引导用户连接打印机
     *   uni.showToast({ title: '请先连接打印机', icon: 'none' })
     * }
     * ```
     */
export function isConnected(): boolean {
    return currentConnectedMac !== null
}


/**
 * 异步查询打印机物理连接状态（真实查询原生层）
     *
     * 与 isConnected()（同步、基于缓存）不同，checkConnected() 会真实查询原生层连接状态，
     * 适用于长时间未操作后确认物理连接是否仍然有效。
     *
     * @returns 已连接返回 true，未连接返回 false（查询失败也返回 false）
     */
export function checkConnected(): Promise<boolean> {
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
     *  1. 调用 buildSaleBillLines(data) 构造 58mm 打印模板
     *  2. 调用原生 printSaleBill 发送打印指令（带 30s 超时）
     *  3. 无论成功/失败，调用后端 POST /api/admin/print/records 保存打印记录
     *  4. 返回 PrintResult（含 success/error/printTime）
     *
     * 错误处理：
     *  - 设备不支持：reject PrintError(device_not_supported)
     *  - 打印超时（30s）：reject PrintError(print_timeout)
     *  - 缺纸：reject PrintError(out_of_paper)
     *  - 其他打印失败：reject PrintError(print_failed)
     *
     * @param data 销售单打印数据
     * @returns 打印结果（成功含 printTime）
     *
     * @example
     * ```ts
     * try {
     *   const result = await printSaleBill(billData)
     *   if (result.success) {
     *     uni.showToast({ title: '打印成功', icon: 'success' })
     *   }
     * } catch (err) {
     *   if (err instanceof PrintError) {
     *     // 按 errorType 区分处理
     *   }
     * }
     * ```
     */
export async function printSaleBill(data: SaleBillPrintData): Promise<PrintResult> {
    const lines = buildSaleBillLines(data)
    return executePrint('printSaleBill', data.billNo, lines, async (manager, callback) => {
        manager.printSaleBill({ lines }, callback)
    })
}

/**
 * 打印销售单（点阵/针式三联）
 *
 * 针式打印机三联复写纸打印，模板与 58mm 热敏一致，由原生层处理三联走纸。
 *
 * @param data 销售单打印数据
 * @returns 打印结果（成功含 printTime）
 */
export async function printSaleBillDot(data: SaleBillPrintData): Promise<PrintResult> {
    const lines = buildSaleBillLines(data)
    return executePrint('printSaleBillDot', data.billNo, lines, async (manager, callback) => {
        manager.printSaleBillDot({ lines }, callback)
    })
}

/**
 * 原始数据打印（ESC/POS 指令透传）
 *
 * 接受 Uint8Array 原始字节数据，透传给原生打印层。
 * 适用于调用方自行构造 ESC/POS 指令的场景（如自定义模板、特殊指令）。
 * 不自动保存打印记录（保存由调用方决定）。
 *
 * @param data 原始字节数据（Uint8Array）
 * @returns 打印结果（成功含 printTime）
 *
 * @example
 * ```ts
 * // 构造 ESC/POS 初始化 + 打印文本 + 切刀指令
 * const data = new Uint8Array([0x1B, 0x40, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x0A, 0x1D, 0x56, 0x00])
 * const result = await printRaw(data)
 * ```
 */
export function printRaw(data: Uint8Array): Promise<PrintResult> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new PrintError('device_not_supported', '蓝牙打印功能仅在 App 端可用'))
    }
    if (!data || !(data instanceof Uint8Array) || data.length === 0) {
        return Promise.reject(new PrintError('print_failed', '打印数据不能为空，需为非空 Uint8Array'))
    }

    // Uint8Array 转 number 数组（uni-app 原生通信支持 Array<number>）
    const byteArray: Array<number> = Array.from(data)

    return executeRawPrint(byteArray, async (m, callback) => {
        m.printRawBytes({ data: byteArray }, callback)
    })
}

/**
 * 原始打印指令（PrintLine 数组版本，扩展能力）
 *
 * 调用方自行构造 PrintLine[] 数组，直接发送给原生打印层。
 * 与 printRaw(Uint8Array) 的区别：接受高层 PrintLine 指令，由原生层渲染。
 * 不自动保存打印记录（保存由调用方决定）。
 *
 * @param lines 打印行数组
 * @returns 打印结果（成功含 printTime）
 *
 * @example
 * ```ts
 * const result = await printRawLines([
 *   { type: 'text', content: '测试打印', align: 'center', bold: true },
 *   { type: 'divider' },
 *   { type: 'feed', lines: 3 },
 * ])
 * ```
 */
export function printRawLines(lines: PrintLine[]): Promise<PrintResult> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        return Promise.reject(new PrintError('device_not_supported', '蓝牙打印功能仅在 App 端可用'))
    }
    if (!Array.isArray(lines) || lines.length === 0) {
        return Promise.reject(new PrintError('print_failed', '打印内容不能为空'))
    }

    return executeRawPrint([], async (m, callback) => {
        m.printRawLines({ lines }, callback)
    })
}

/**
 * 执行打印并保存打印记录（内部统一流程，PrintLine 版本）
 *
 * @param _method 打印方法名（仅用于日志，不参与逻辑）
 * @param billNo 单据编号（保存打印记录用）
 * @param lines 打印内容（保存打印记录用）
 * @param invoke 调用原生打印方法的封装
 * @returns PrintResult（成功含 printTime）
 */
async function executePrint(
    _method: 'printSaleBill' | 'printSaleBillDot',
    billNo: string,
    lines: PrintLine[],
    invoke: (
        manager: PrintManagerNativeModule,
        callback: (result: NativePrintResult) => void
    ) => void
): Promise<PrintResult> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        // 即使非App端也尝试保存 FAILED 记录
        await persistPrintRecord('SALE_BILL', billNo, JSON.stringify(lines), 'FAILED', '蓝牙打印功能仅在 App 端可用')
        throw new PrintError('device_not_supported', '蓝牙打印功能仅在 App 端可用')
    }

    const startTime = Date.now()

    return new Promise<PrintResult>((resolve, reject) => {
        let settled = false

        // 打印超时定时器（30s）
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            const errMsg = `打印超时（${DEFAULT_PRINT_TIMEOUT}ms）`
            // 超时也保存 FAILED 记录
            void persistPrintRecord('SALE_BILL', billNo, JSON.stringify(lines), 'FAILED', errMsg)
            reject(new PrintError('print_timeout', errMsg))
        }, DEFAULT_PRINT_TIMEOUT)

        try {
            invoke(manager, async (res: NativePrintResult) => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                const printTime = Date.now() - startTime

                if (res && res.success) {
                    // 打印成功，保存 SUCCESS 记录
                    await persistPrintRecord('SALE_BILL', billNo, JSON.stringify(lines), 'SUCCESS')
                    resolve({ success: true, printTime })
                } else {
                    const errMsg = res?.error || '打印失败'
                    // 打印失败，保存 FAILED 记录
                    await persistPrintRecord('SALE_BILL', billNo, JSON.stringify(lines), 'FAILED', errMsg)
                    reject(toPrintError(errMsg, 'print_failed', res?.outOfPaper))
                }
            })
        } catch (err) {
            if (settled) return
            settled = true
            clearTimeout(timer)
            const errMsg = err instanceof Error ? err.message : '打印调用失败'
            // 调用异常，保存 FAILED 记录
            void persistPrintRecord('SALE_BILL', billNo, JSON.stringify(lines), 'FAILED', errMsg)
            reject(new PrintError('print_failed', errMsg))
        }
    })
}

/**
 * 执行原始打印（内部统一流程，不自动保存打印记录）
 *
 * @param _data 字节数组（仅用于占位，实际数据已在 invoke 闭包中传递）
 * @param invoke 调用原生打印方法的封装
 * @returns PrintResult（成功含 printTime）
 */
async function executeRawPrint(
    _data: Array<number>,
    invoke: (
        manager: PrintManagerNativeModule,
        callback: (result: NativePrintResult) => void
    ) => void
): Promise<PrintResult> {
    const manager = getPrintManager()
    if (!manager) {
        uni.showToast({ title: '蓝牙打印功能仅在 App 端可用', icon: 'none' })
        throw new PrintError('device_not_supported', '蓝牙打印功能仅在 App 端可用')
    }

    const startTime = Date.now()

    return new Promise<PrintResult>((resolve, reject) => {
        let settled = false

        // 打印超时定时器（30s）
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            reject(new PrintError('print_timeout', `打印超时（${DEFAULT_PRINT_TIMEOUT}ms）`))
        }, DEFAULT_PRINT_TIMEOUT)

        try {
            invoke(manager, (res: NativePrintResult) => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                const printTime = Date.now() - startTime

                if (res && res.success) {
                    resolve({ success: true, printTime })
                } else {
                    reject(toPrintError(res?.error || '打印失败', 'print_failed', res?.outOfPaper))
                }
            })
        } catch (err) {
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject(new PrintError('print_failed', err instanceof Error ? err.message : '原始打印调用失败'))
        }
    })
}

// ====================== 58mm 热敏打印模板（对齐任务"修复方向 #2"模板要求） ======================

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
 * 对齐任务"修复方向 #2"模板要求：
 * ```
 * =================================
 *      智享全链 - 销售单
 * =================================
 * 单号: XS202607190001
 * 时间: 2026-07-19 14:30
 * 收银员: 李四
 * --------------------------------
 * 商品          数量  单价  小计
 * --------------------------------
 * 茅台飞天 500ml
 *                1  1499.00  1499.00
 * 五粮液 52度
 *                2   899.00  1798.00
 * --------------------------------
 * 合计:                  3297.00
 * 优惠:                     0.00
 * 应付:                  3297.00
 * 支付方式: 微信支付
 * 实付:                  3297.00
 * --------------------------------
 * 积分: 320
 * [二维码]
 * 欢迎再光临！
 * [走纸 3 行 + 切刀]
 * ```
 *
 * @param data 销售单打印数据
 * @returns PrintLine 数组
 */
export function buildSaleBillLines(data: SaleBillPrintData): PrintLine[] {
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
        content: `时间: ${formatDateTime(data.createdAt)}`,
        align: 'left',
    })
    lines.push({
        type: 'text',
        content: `收银员: ${data.cashierName || '-'}`,
        align: 'left',
    })

    // 单据信息分隔线
    lines.push({ type: 'divider' })

    // ============ 商品明细表头 ============
    lines.push({
        type: 'table',
        columns: [
            { text: '商品', width: 14, align: 'left' },
            { text: '数量', width: 6, align: 'right' },
            { text: '单价', width: 6, align: 'right' },
            { text: '小计', width: 6, align: 'right' },
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
                { text: String(item.quantity), width: 6, align: 'right' },
                { text: formatMoney(item.unitPrice), width: 6, align: 'right' },
                { text: formatMoney(item.subtotal), width: 6, align: 'right' },
            ],
        })
    }

    // 合计区分隔线
    lines.push({ type: 'divider' })

    // ============ 合计区域 ============
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
            { text: formatMoney(data.payableAmount), width: 10, align: 'right' },
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

    // ============ 会员积分（可选） ============
    if (typeof data.memberPoints === 'number') {
        lines.push({ type: 'divider' })
        lines.push({
            type: 'text',
            content: `积分: ${data.memberPoints}`,
            align: 'left',
        })
    }

    // ============ 底部 ============
    lines.push({ type: 'divider', char: '=' })
    lines.push({
        type: 'text',
        content: '欢迎再光临！',
        align: 'center',
        bold: true,
    })

    // 二维码（可选，如店铺小程序码）
    if (data.qrcode) {
        lines.push({
            type: 'qrcode',
            content: data.qrcode,
            size: 6,
        })
    }

    // 走纸 3 行（配合切刀指令，便于撕纸）
    lines.push({ type: 'feed', lines: DEFAULT_FEED_LINES })

    return lines
}

// ====================== 便捷方法 ======================

/**
 * 一键打印销售单（自动连接缓存打印机）
 *
 * 流程：
 *  1. 检查当前打印机连接状态（异步真实查询原生层）
 *  2. 未连接时尝试连接缓存的 MAC
 *  3. 连接成功后打印
 *
 * @param data 销售单打印数据
 * @returns 打印结果（成功含 printTime）
 *
 * @example
 * ```ts
 * try {
 *   const result = await printSaleBillAuto(billData)
 *   if (result.success) {
 *     uni.showToast({ title: '打印成功', icon: 'success' })
 *   }
 * } catch (err) {
 *   if (err instanceof PrintError && err.errorType === 'device_not_found') {
 *     // 引导用户去打印机设置页
 *   }
 * }
 * ```
 */
export async function printSaleBillAuto(data: SaleBillPrintData): Promise<PrintResult> {
    const connected = await checkConnected()
    if (!connected) {
        const cachedMac = getCachedPrinterMac()
        if (!cachedMac) {
            uni.showToast({ title: '请先连接打印机', icon: 'none' })
            // 未配置打印机，保存 FAILED 记录
            const lines = buildSaleBillLines(data)
            await persistPrintRecord('SALE_BILL', data.billNo, JSON.stringify(lines), 'FAILED', '未连接打印机')
            throw new PrintError('device_not_found', '未连接打印机，请先搜索并连接打印机')
        }
        try {
            await connect(cachedMac)
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : '连接打印机失败'
            const lines = buildSaleBillLines(data)
            await persistPrintRecord('SALE_BILL', data.billNo, JSON.stringify(lines), 'FAILED', errMsg)
            throw err
        }
    }
    return printSaleBill(data)
}

/**
 * 获取当前已缓存的打印机 MAC
 * @returns MAC 地址，未缓存返回空字符串
 */
export function getCachedPrinter(): string {
    return getCachedPrinterMac()
}

// ====================== @deprecated 别名（向后兼容，对齐 R51-01 scan.ts 做法） ======================

/**
 * 搜索蓝牙打印机（@deprecated 别名，请使用 search()）
 * @deprecated 请使用 search()，本别名仅为向后兼容保留
 */
export function searchPrinters(): Promise<PrinterDevice[]> {
    return search()
}

/**
 * 连接打印机（@deprecated 别名，请使用 connect(mac)）
 * @deprecated 请使用 connect(mac)，本别名仅为向后兼容保留
 */
export function connectPrinter(mac: string): Promise<boolean> {
    return connect(mac).then(() => true)
}

/**
 * 断开打印机（@deprecated 别名，请使用 disconnect()）
 * @deprecated 请使用 disconnect()，本别名仅为向后兼容保留
 */
export function disconnectPrinter(): Promise<void> {
    return disconnect()
}

// ====================== 导出清单 ======================

export {
    // 类型已通过 export interface / export type 导出：
    // PrinterDevice, SaleBillPrintData, PrintResult, PrintRecordData,
    // PrintAlign, PrintFontSize, PrintLine, PrinterType,
    // PrintBillType, PrintRecordStatus, PrintErrorType
    // 错误类：PrintError
    // 主接口（严格对齐 R51-02 任务接口定义）：
    // search, connect, disconnect, isConnected, printSaleBill, printSaleBillDot, printRaw
    // 扩展接口：
    // checkConnected, printRawLines, buildSaleBillLines, printSaleBillAuto, getCachedPrinter,
    // savePrintRecord
    // HMS 适配：connectWithHMSBLE, printWithHMSBLE
    // @deprecated 别名：searchPrinters, connectPrinter, disconnectPrinter
    // 常量导出（便于外部模板构造时参考）
    PAPER_58MM_CHARS,
    DEFAULT_DIVIDER_CHAR,
    DEFAULT_FEED_LINES,
    DEFAULT_PRINT_TIMEOUT,
    HMS_BT_KIT_KEY,
}
