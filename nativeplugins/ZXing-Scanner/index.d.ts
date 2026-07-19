/**
 * ZXing-Scanner 原生插件 TypeScript 类型声明
 *
 * 插件功能：条码扫码识别（基于 ZXing 库）
 * 支持格式：EAN-13 / EAN-8 / UPC-A / UPC-E / CODE_128 / CODE_39 / ITF / CODABAR / QR_CODE / DATA_MATRIX / AZTEC / PDF_417
 *
 * UniModule 调用方式：
 *   const scanner = uni.requireNativePlugin('ZXing-Scanner')
 *   scanner.scan({ continuous: false, title: '扫一扫' }, (res) => {
 *     if (res.code) {
 *       console.log('扫码内容:', res.code, '格式:', res.format)
 *     }
 *   })
 *
 * 注意：
 *   - 原生插件本身使用 callback 风格调用
 *   - 本声明文件提供 Promise 风格的类型定义，供 TypeScript 项目参考
 *   - 实际 Promise 封装在 app-mobile/src/native/scan.ts 中实现
 */

/** 扫码类型过滤选项 */
export type ScanTypeFilter = 'barcode' | 'qrcode' | 'all'

/** 扫码结果类型（自动识别） */
export type ScanCodeType = 'barcode' | 'qrcode' | 'trace_code'

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

/**
 * ZXing-Scanner 原生插件模块接口
 *
 * 注意：原生插件本身使用 callback 风格调用，
 * 此处声明为 Promise 风格仅作为 TypeScript 类型参考。
 * 实际使用时通过 app-mobile/src/native/scan.ts 中的 scanCode() 等 Promise 封装调用。
 */
export interface ZXingScannerModule {
  /**
   * 发起扫码
   * @param options 扫码选项
   * @returns 扫码结果 Promise
   */
  scan(options?: ScanOptions): Promise<ScanResult>

  /**
   * 停止连续扫码
   */
  stopScan(): void

  /**
   * 检查扫码功能是否可用（相机权限、插件加载状态）
   * @returns 是否可用
   */
  isAvailable(): Promise<boolean>
}

/**
 * 原生插件默认导出
 * uni.requireNativePlugin('ZXing-Scanner') 返回此模块实例
 */
declare const ZXingScanner: ZXingScannerModule
export default ZXingScanner
