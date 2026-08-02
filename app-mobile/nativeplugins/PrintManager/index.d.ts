/**
 * PrintManager 原生插件 TypeScript 类型声明
 *
 * 插件功能：蓝牙热敏/针式打印
 *  - 支持 58mm / 80mm 热敏打印纸
 *  - 支持针式打印机三联复写纸
 *  - 支持的打印行类型：text / divider / table / barcode / qrcode / feed
 *  - 蓝牙打印机搜索、连接、断开、状态查询
 *
 * UniModule 调用方式：
 *   const printer = uni.requireNativePlugin('PrintManager')
 *   printer.searchPrinters((res) => {
 *     if (res.success && res.devices) {
 *       // res.devices: Array<{ mac, name, rssi, bonded }>
 *     }
 *   })
 *   printer.connectPrinter({ mac: '00:11:22:33:44:55' }, (res) => {
 *     if (res.success) { /* 连接成功 *\/ }
 *   })
 *   printer.printSaleBill({ lines: [...] }, (res) => {
 *     if (res.success) { /* 打印成功 *\/ }
 *   })
 *
 * 注意：
 *   - 原生插件本身使用 callback 风格调用
 *   - 本声明文件提供 Promise 风格的类型定义，供 TypeScript 项目参考
 *   - 实际 Promise 封装在 app-mobile/src/native/print.ts 中实现
 *   - 后端打印记录 API：POST /api/admin/print/records（成功/失败均保存）
 *
 * 关联任务：R51-02 蓝牙热敏打印插件封装
 *
 * @author 阿澈
 */

// ====================== 通用类型 ======================

/** 文本对齐方式 */
export type PrintAlign = 'left' | 'center' | 'right'

/** 文本字号 */
export type PrintFontSize = 'normal' | 'double'

/** 打印机类型 */
export type PrinterType = 'thermal' | 'dot'

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

// ====================== 设备/单据类型 ======================

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
    /** 打印机类型（热敏/针式） */
    type?: PrinterType
    /** 纸宽 mm（58/80） */
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
 * 对齐 R51 方案 2.2.3 节 58mm 热敏打印模板字段
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
    /** 支付方式 */
    paymentMethod: string
    /** 实付金额（元） */
    paidAmount: number
    /** 找零金额（元） */
    changeAmount: number
    /** 单据生成时间（ISO 字符串或 yyyy-MM-dd HH:mm:ss） */
    createdAt: string
    /** 备注（可选） */
    remark?: string
    /** 底部二维码内容（可选） */
    qrcodeContent?: string
}

// ====================== 原生结果类型 ======================

/** 原生搜索打印机结果 */
export interface NativeSearchResult {
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
export interface NativeSimpleResult {
    success?: boolean
    error?: string
    connected?: boolean
}

/** 原生打印结果 */
export interface NativePrintResult {
    success?: boolean
    error?: string
}

// ====================== 原生模块接口 ======================

/**
 * PrintManager 原生插件模块接口
 *
 * 注意：原生插件本身使用 callback 风格调用，
 * 此处声明为 Promise 风格仅作为 TypeScript 类型参考。
 * 实际使用时通过 app-mobile/src/native/print.ts 中的
 * searchPrinters() / connectPrinter() / printSaleBill() 等 Promise 封装调用。
 */
export interface PrintManagerModule {
    /**
     * 搜索蓝牙打印机
     * 启动蓝牙扫描，约 10 秒后返回搜索到的设备列表
     *
     * @returns 搜索到的打印机设备列表 Promise
     */
    searchPrinters(callback: (result: NativeSearchResult) => void): void

    /**
     * 连接指定 MAC 的打印机
     * @param options 包含 mac 字段
     * @returns 连接成功 resolve，失败 reject
     */
    connectPrinter(
        options: { mac: string },
        callback: (result: NativeSimpleResult) => void
    ): void

    /**
     * 断开当前打印机连接
     * @returns 断开成功 resolve，失败 reject
     */
    disconnectPrinter(callback: (result: NativeSimpleResult) => void): void

    /**
     * 查询当前打印机连接状态
     * @returns 已连接返回 true，未连接返回 false
     */
    isConnected(callback: (result: NativeSimpleResult) => void): void

    /**
     * 打印销售单（58mm 热敏）
     * @param options 包含 lines 字段（PrintLine 数组）
     * @returns 打印成功 resolve，失败 reject
     */
    printSaleBill(
        options: { lines: PrintLine[] },
        callback: (result: NativePrintResult) => void
    ): void

    /**
     * 打印销售单（针式三联）
     * 针式打印机三联复写纸打印，模板与 58mm 热敏一致
     * @param options 包含 lines 字段（PrintLine 数组）
     * @returns 打印成功 resolve，失败 reject
     */
    printSaleBillDot(
        options: { lines: PrintLine[] },
        callback: (result: NativePrintResult) => void
    ): void

    /**
     * 原始打印指令（自定义模板）
     * @param options 包含 lines 字段（PrintLine 数组）
     * @returns 打印成功 resolve，失败 reject
     */
    printRaw(
        options: { lines: PrintLine[] },
        callback: (result: NativePrintResult) => void
    ): void
}

/**
 * 原生插件默认导出
 * uni.requireNativePlugin('PrintManager') 返回此模块实例
 */
declare const PrintManager: PrintManagerModule
export default PrintManager
