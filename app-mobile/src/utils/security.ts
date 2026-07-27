/**
 * 防调试 + Root/越狱检测 — R51-05 安全加固
 *
 * 核心功能：
 *  1. detectDebugger()       — 检测调试器是否附加（时间差法）
 *  2. startAntiDebug()       — 启动防调试监控（每 5 秒检测一次）
 *  3. stopAntiDebug()        — 停止防调试监控
 *  4. detectRoot()           — 检测 Root（Android）/越狱（iOS）
 *  5. securityCheck()        — App 启动时综合安全检查（Root + 越狱 + 调试器）
 *
 * 设计说明：
 *  - 防调试：基于时间差检测（debugger 语句前后时间差 > 100ms 视为调试器附加）
 *  - Root 检测：检测 su/Magisk/SuperSU 等特征文件（Android）
 *  - 越狱检测：检测 Cydia/Sileo 等特征文件（iOS）
 *  - 检测到风险仅记录日志（不上报服务端，避免泄露安全检测机制）
 *  - 条件编译：APP-PLUS 使用原生 API 检测；H5/小程序跳过检测（返回安全状态）
 *  - 使用 IIFE 包裹条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *
 * 安全策略：
 *  - 检测到调试器：可结合业务场景决定是否退出 App 或加扰关键逻辑
 *  - 检测到 Root/越狱：仅告警，不强制退出（兼容开发者调试设备）
 *  - 检测逻辑分散且不频繁，避免影响 App 性能
 *
 * @author 阿澈
 */

// ====================== 类型定义 ======================

/** 安全检查结果 */
export interface SecurityCheckResult {
    /** 是否 Root（Android） */
    isRooted: boolean
    /** 是否越狱（iOS） */
    isJailbroken: boolean
    /** 是否被调试 */
    isDebugging: boolean
    /** 风险列表（每条风险的简要描述） */
    risks: string[]
}

/** 安全状态枚举 */
export type SecurityLevel = 'safe' | 'warning' | 'danger'

// ====================== 常量定义 ======================

/** 调试器检测时间差阈值（毫秒），超过视为调试器附加 */
const DEBUG_TIME_THRESHOLD = 100

/** 防调试检测间隔（毫秒），每 5 秒检测一次 */
const ANTI_DEBUG_INTERVAL = 5000

/** Root 检测特征文件路径（Android） */
const ANDROID_ROOT_PATHS = [
    '/system/bin/su',
    '/system/xbin/su',
    '/sbin/su',
    '/system/sd/xbin/su',
    '/system/bin/failsafe/su',
    '/data/local/xbin/su',
    '/data/local/bin/su',
    '/data/local/su',
    '/su/bin/su',
    '/system/app/Superuser.apk',
    '/system/app/SuperSU',
    '/system/etc/init.d/99SuperSUDaemon',
    '/dev/com.koushikdutta.superuser.daemon/',
    '/system/xbin/daemonsu',
    '/data/data/com.noshufou.android.su',
    '/data/data/eu.chainfire.supersu',
    '/data/data/com.topjohnwu.magisk',
    '/sbin/.magisk',
    '/cache/.disable_magisk'
]

/** 越狱检测特征文件路径（iOS） */
const IOS_JAILBREAK_PATHS = [
    '/Applications/Cydia.app',
    '/Applications/Sileo.app',
    '/Applications/Installer.app',
    '/Applications/Zebra.app',
    '/Library/MobileSubstrate/MobileSubstrate.dylib',
    '/bin/bash',
    '/usr/sbin/sshd',
    '/etc/apt',
    '/private/var/lib/apt',
    '/usr/sbin/sshd',
    '/usr/bin/ssh',
    '/private/var/lib/cydia',
    '/private/var/cache/apt',
    '/private/var/lib/sileo',
    '/private/var/stash'
]

/** 越狱检测特征 URL Scheme（iOS） */
const IOS_JAILBREAK_SCHEMES = ['cydia://', 'sileo://', 'undecimus://']

// ====================== 全局状态 ======================

/** 防调试监控定时器 ID */
let antiDebugTimer: ReturnType<typeof setInterval> | null = null

/** 最近一次安全检查结果（缓存，避免重复检测） */
let lastCheckResult: SecurityCheckResult | null = null

// ====================== 防调试检测 ======================

/**
 * 检测调试器是否附加（时间差法）
 *
 * 原理：
 *  - 正常执行时，debugger 语句前后的时间差极小（< 10ms）
 *  - 调试器附加时，debugger 语句会暂停执行，时间差显著增大（> 100ms）
 *  - 此方法可检测到 Chrome DevTools / Safari Debugger / Android Studio 等调试器
 *
 * 注意：
 *  - 时间差法可能受设备性能影响（低端设备偶发误报）
 *  - 建议结合多次检测（startAntiDebug）综合判断
 *
 * @returns true=检测到调试器，false=未检测到
 */
export function detectDebugger(): boolean {
    // 使用 IIFE 包裹条件编译（踩坑日志 [15]）
    return (() => {
        // #ifdef APP-PLUS
        // APP-PLUS 环境：执行时间差检测
        const start = Date.now()
        // eslint-disable-next-line no-debugger
        debugger // 调试器附加时会在此暂停
        const elapsed = Date.now() - start
        return elapsed > DEBUG_TIME_THRESHOLD
        // #endif
        // #ifndef APP-PLUS
        // H5/小程序环境：跳过检测，返回 false（开发环境允许调试）
        return false
        // #endif
    })()
}

/**
 * 启动防调试监控（每 5 秒检测一次）
 * - 检测到调试器时记录日志（不上报服务端，避免泄露检测机制）
 * - 重复调用安全（已启动时先停止旧的监控再启动新的）
 *
 * @param onDetect 可选回调，检测到调试器时调用（如退出 App）
 *
 * @example
 * ```ts
 * import { startAntiDebug } from '@/utils/security'
 * startAntiDebug(() => {
 *   uni.showModal({ title: '安全警告', content: '检测到调试器，App 将退出' })
 *   plus.runtime.quit()
 * })
 * ```
 */
export function startAntiDebug(onDetect?: () => void): void {
    // 先停止已有的监控
    stopAntiDebug()

    const check = (): void => {
        const detected = detectDebugger()
        if (detected) {
            // 仅记录日志（不上报服务端，避免泄露）
            console.error('[security] 检测到调试器附加')
            if (typeof onDetect === 'function') {
                try {
                    onDetect()
                } catch (e) {
                    console.error('[security] 防调试回调执行失败', e)
                }
            }
        }
    }

    // 立即检测一次，再启动定时器
    check()
    antiDebugTimer = setInterval(check, ANTI_DEBUG_INTERVAL)
}

/**
 * 停止防调试监控
 * - 清除定时器，停止周期性检测
 * - App 退出或进入后台时可调用（节省电量）
 */
export function stopAntiDebug(): void {
    if (antiDebugTimer !== null) {
        clearInterval(antiDebugTimer)
        antiDebugTimer = null
    }
}

// ====================== Root/越狱检测 ======================

/**
 * 检测 Android 设备是否 Root
 * - 通过 plus.io.resolveLocalFileSystemURL 检测 su/Magisk/SuperSU 等特征文件
 * - 同步检测（基于已知路径列表，不依赖文件系统遍历）
 *
 * @returns true=已 Root，false=未 Root 或非 Android 平台
 */
function detectAndroidRoot(): boolean {
    return (() => {
        // #ifdef APP-PLUS
        // APP-PLUS 环境：检测 Android Root 特征文件
        try {
            const g: any = globalThis
            const plusObj: any = g?.plus
            const runtime: any = plusObj?.runtime
            const systemInfo = uni.getSystemInfoSync()
            // 仅在 Android 平台检测
            if (systemInfo.platform !== 'android') return false

            // 通过 plus.io 同步检测特征文件（如可用）
            const ioObj: any = plusObj?.io
            if (ioObj && typeof ioObj.resolveLocalFileSystemURL === 'function') {
                // 同步遍历特征路径，任一存在即视为 Root
                // 注意：resolveLocalFileSystemURL 是异步的，这里用同步降级方案
                // 实际生产建议使用 plus.android.invoke 同步检测
                const javaIoFile: any = plusObj?.android?.import ? plusObj.android.import('java.io.File') : null
                if (javaIoFile) {
                    for (const path of ANDROID_ROOT_PATHS) {
                        try {
                            const f: any = plusObj.android?.newObject ? plusObj.android.newObject(javaIoFile, path) : null
                            if (f && typeof f.exists === 'function') {
                                // java.io.File.exists() 返回 boolean
                                const exists: boolean = plusObj.android.invoke(f, 'exists')
                                if (exists) return true
                            }
                        } catch {
                            // 单个路径检测失败，继续检测下一个
                        }
                    }
                }
            }
        } catch {
            // plus 不可用，无法检测
        }
        return false
        // #endif
        // #ifndef APP-PLUS
        return false
        // #endif
    })()
}

/**
 * 检测 iOS 设备是否越狱
 * - 通过检测 Cydia/Sileo 等特征文件
 * - 通过检测 cydia:// URL Scheme 是否可打开
 *
 * @returns true=已越狱，false=未越狱或非 iOS 平台
 */
function detectIosJailbreak(): boolean {
    return (() => {
        // #ifdef APP-PLUS
        // APP-PLUS 环境：检测 iOS 越狱特征
        try {
            const g: any = globalThis
            const plusObj: any = g?.plus
            const runtime: any = plusObj?.runtime
            const systemInfo = uni.getSystemInfoSync()
            // 仅在 iOS 平台检测
            if (systemInfo.platform !== 'ios') return false

            // 1. 检测特征文件（通过 plus.io 检测文件是否存在）
            const ioObj: any = plusObj?.io
            if (ioObj && typeof ioObj.resolveLocalFileSystemURL === 'function') {
                // 注意：resolveLocalFileSystemURL 异步，这里仅作接口预留
                // 实际生产建议用 plus.ios.invoke 同步检测 NSFileManager
                const nsFileManager: any = plusObj?.ios?.import ? plusObj.ios.import('NSFileManager') : null
                if (nsFileManager) {
                    const defaultManager: any = plusObj.ios?.invoke ? plusObj.ios.invoke(nsFileManager, 'defaultManager') : null
                    if (defaultManager && typeof defaultManager.fileExistsAtPath === 'function') {
                        for (const path of IOS_JAILBREAK_PATHS) {
                            try {
                                // NSFileManager.fileExistsAtPath: 返回 BOOL
                                const exists: boolean = plusObj.ios.invoke(defaultManager, 'fileExistsAtPath:', path)
                                if (exists) return true
                            } catch {
                                // 单个路径检测失败，继续
                            }
                        }
                    }
                }
            }

            // 2. 检测 URL Scheme（cydia://）
            const runtimeObj: any = runtime
            if (runtimeObj && typeof runtimeObj.openURL === 'function') {
                for (const scheme of IOS_JAILBREAK_SCHEMES) {
                    try {
                        // canOpenURL 在越狱设备上对 cydia:// 返回 true
                        const canOpen: boolean = plusObj.ios.invoke(runtimeObj, 'canOpenURL:', scheme)
                        if (canOpen) return true
                    } catch {
                        // 单个 scheme 检测失败，继续
                    }
                }
            }
        } catch {
            // plus 不可用，无法检测
        }
        return false
        // #endif
        // #ifndef APP-PLUS
        return false
        // #endif
    })()
}

/**
 * 综合检测 Root/越狱状态
 * - 自动判断平台（Android/iOS）调用对应的检测函数
 * - 非 APP-PLUS 平台（H5/小程序）返回 false（无法检测）
 *
 * @returns SecurityCheckResult（仅含 Root/越狱状态，调试器状态需单独检测）
 */
export function detectRoot(): SecurityCheckResult {
    const isRooted = detectAndroidRoot()
    const isJailbroken = detectIosJailbreak()
    const risks: string[] = []
    if (isRooted) risks.push('Android 设备已 Root')
    if (isJailbroken) risks.push('iOS 设备已越狱')

    return {
        isRooted,
        isJailbroken,
        isDebugging: false, // 由 detectDebugger 单独检测
        risks
    }
}

// ====================== 综合安全检查 ======================

/**
 * App 启动时综合安全检查
 * - 检测 Root/越狱/调试器
 * - 检测到风险时记录日志（不上报服务端，避免泄露检测机制）
 * - 结果缓存在内存，避免重复检测
 *
 * 调用时机：
 *  - App.vue 的 onLaunch 中调用
 *  - 用户登录前调用
 *
 * @param options 选项
 *   - force: 是否强制重新检测（默认 false，使用缓存）
 *   - startMonitor: 是否启动防调试监控（默认 false）
 *
 * @returns SecurityCheckResult：含 Root/越狱/调试器状态及风险列表
 *
 * @example
 * ```ts
 * import { securityCheck } from '@/utils/security'
 * const result = securityCheck({ startMonitor: true })
 * if (result.risks.length > 0) {
 *   uni.showModal({ title: '安全提示', content: result.risks.join('\n') })
 * }
 * ```
 */
export function securityCheck(options: { force?: boolean; startMonitor?: boolean } = {}): SecurityCheckResult {
    const { force = false, startMonitor = false } = options

    // 使用缓存（除非强制重新检测）
    if (!force && lastCheckResult) {
        return lastCheckResult
    }

    // 1. Root/越狱检测
    const rootResult = detectRoot()

    // 2. 调试器检测（单次，不启动监控）
    const isDebugging = detectDebugger()

    // 3. 汇总风险
    const risks: string[] = [...rootResult.risks]
    if (isDebugging) risks.push('检测到调试器附加')

    const result: SecurityCheckResult = {
        isRooted: rootResult.isRooted,
        isJailbroken: rootResult.isJailbroken,
        isDebugging,
        risks
    }

    // 4. 记录日志（不上报服务端，避免泄露检测机制）
    if (risks.length > 0) {
        console.error('[security] 安全检查发现风险:', risks.join('; '))
    }

    // 5. 启动防调试监控（可选）
    if (startMonitor) {
        startAntiDebug()
    }

    // 6. 缓存结果
    lastCheckResult = result

    return result
}

// ====================== 安全等级评估 ======================

/**
 * 根据安全检查结果评估安全等级
 *
 * @param result 安全检查结果
 * @returns 'safe'（无风险） | 'warning'（Root/越狱） | 'danger'（调试器附加）
 */
export function getSecurityLevel(result: SecurityCheckResult): SecurityLevel {
    if (result.isDebugging) return 'danger'
    if (result.isRooted || result.isJailbroken) return 'warning'
    return 'safe'
}

// ====================== 工具函数 ======================

/**
 * 清除安全检查缓存
 * - 下次调用 securityCheck() 会重新检测
 */
export function clearSecurityCache(): void {
    lastCheckResult = null
}

/**
 * 获取最近一次安全检查结果（不触发新检测）
 * @returns 最近一次检查结果；未检查过返回 null
 */
export function getLastSecurityCheck(): SecurityCheckResult | null {
    return lastCheckResult
}
