/**
 * 推送通知原生插件封装（Android 极光推送 + HarmonyOS 华为 Push Kit）
 *
 * 功能：
 *  1. Android 分支：使用极光推送 JPush
 *     - registerPush(alias)      注册推送，alias=merchant_${userId}_${tenantId}
 *     - onPushReceived(cb)       监听推送接收
 *     - onPushClick(cb)          监听推送点击
 *     - unregisterPush()         注销推送
 *  2. HarmonyOS 分支：使用华为 Push Kit
 *     - registerHMSPush()        注册 Push Kit，获取 pushToken
 *     - onHMSPushReceived(cb)    监听推送接收
 *     - onHMSPushClick(cb)       监听推送点击
 *     - unregisterHMSPush()      注销 Push Kit
 *  3. 统一接口：通过条件编译对外暴露 registerPush/onPushReceived/onPushClick/unregisterPush
 *  4. 推送点击路由跳转：
 *     - order     → /pages-sub/order/order-center/order-center
 *     - inventory → /pages-sub/product/inventory/inventory
 *     - marketing → /pages-sub/marketing/marketing/coupons
 *     - system    → /pages/notifications/notifications
 *  5. 注册 Token 到后端：POST /api/admin/push/register
 *     body: { deviceId, pushToken, provider, appPlatform, appVersion }
 *
 * 注意：
 *  - 使用 IIFE 包裹 uni-app 条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *  - 非 APP-PLUS 环境（H5/小程序）下推送功能不可用，会 reject 错误
 *  - HMS Push Kit 实际 API 调用在 HBuilderX 打包鸿蒙包时由原生层处理
 *  - 后端推送服务由阿坚 R51-07 实现（backend/src/services/admin/push.service.ts）
 *
 * @author 阿澈
 */

import { post } from '@/api/request'
import { getUser, getTenant } from '@/api/storage'

// ====================== 类型定义 ======================

/** 推送消息类型 */
export type PushMessageType = 'system' | 'order' | 'inventory' | 'marketing'

/**
 * 推送消息载荷
 */
export interface PushPayload {
    /** 推送标题 */
    title: string
    /** 推送内容 */
    content: string
    /** 推送类型 */
    type?: PushMessageType
    /** 附加数据（如订单号、商品 ID 等） */
    extras?: Record<string, any>
}

/**
 * 推送点击结果
 */
export interface PushClickResult {
    /** 推送类型 */
    type: string
    /** 跳转路由（uni.navigateTo url，无则不跳转） */
    url?: string
    /** 附加数据 */
    extras?: Record<string, any>
}

/** 推送服务提供商 */
export type PushProvider = 'jpush' | 'hms'

/** App 平台 */
export type AppPlatform = 'android' | 'harmony'

/**
 * 推送注册 Token 到后端的入参
 * 对齐后端 POST /api/admin/push/register 接口契约
 */
export interface PushRegisterPayload {
    /** 设备唯一标识（uni.getDeviceInfo().deviceId） */
    deviceId: string
    /** 推送 Token（极光 registrationId 或华为 pushToken） */
    pushToken: string
    /** 推送服务提供商：jpush（极光）/ hms（华为 Push Kit） */
    provider: PushProvider
    /** App 平台：android / harmony */
    appPlatform: AppPlatform
    /** App 版本号（如 1.0.0） */
    appVersion: string
}

/** 推送注册响应 */
export interface PushRegisterResult {
    success: boolean
}

// ====================== 常量定义 ======================

/** HarmonyOS HMS Push Kit 全局对象键名（HBuilderX 打包鸿蒙包时由原生层注入） */
const HMS_PUSH_KIT_KEY = 'HMSɨPushKit'

/** 后端推送注册 API 路径（request.ts BASE_URL 已含 /api） */
const PUSH_REGISTER_API = '/admin/push/register'

/** 推送点击路由跳转映射表 */
const PUSH_ROUTE_MAP: Record<PushMessageType, string> = {
    order: '/pages-sub/order/order-center/order-center',
    inventory: '/pages-sub/product/inventory/inventory',
    marketing: '/pages-sub/marketing/marketing/coupons',
    system: '/pages/notifications/notifications',
}

/** App 版本号（与 manifest.json versionName 对齐） */
const APP_VERSION = '1.0.0'

/** 推送接收回调列表（支持多监听器） */
const pushReceivedCallbacks: Array<(payload: PushPayload) => void> = []

/** 推送点击回调列表（支持多监听器） */
const pushClickCallbacks: Array<(result: PushClickResult) => void> = []

/** 当前注册的推送 Token（注册成功后缓存） */
let currentPushToken = ''

/** 当前推送服务提供商（注册成功后缓存） */
let currentProvider: PushProvider | null = null

// ====================== 原生插件接口 ======================

/** 极光推送 JPush 原生插件接口（callback 风格） */
interface JPushNativeModule {
    /** 初始化并注册极光推送，设置 alias */
    init(options: { alias: string }, callback: (result: { registrationId?: string; success?: boolean; error?: string }) => void): void
    /** 监听推送接收事件 */
    addPushListener(options: { event: 'messageReceive' }, callback: (payload: PushPayload) => void): void
    /** 监听推送点击事件 */
    addPushListener(options: { event: 'notificationOpen' }, callback: (result: PushClickResult) => void): void
    /** 注销推送 */
    stopPush(callback: (result: { success?: boolean; error?: string }) => void): void
    /** 移除推送监听 */
    removePushListener(options: { event: 'messageReceive' | 'notificationOpen' }): void
}

/**
 * HMS Core Push Kit 原生插件接口（HarmonyOS）
 *
 * 对应 @hms/core/push 模块，HarmonyOS 平台通过 HBuilderX 打包鸿蒙包时
 * 由原生层注入 globalThis.HMSɨPushKit 全局对象。
 */
interface HMSPushKitNativeModule {
    /** 注册华为 Push Kit，获取 pushToken */
    getToken(callback: (result: { pushToken?: string; success?: boolean; error?: string }) => void): void
    /** 监听推送接收事件 */
    onMessageReceived(callback: (payload: PushPayload) => void): void
    /** 监听推送点击事件 */
    onNotificationOpened(callback: (result: PushClickResult) => void): void
    /** 注销 Push Kit */
    unregister(callback: (result: { success?: boolean; error?: string }) => void): void
}

// ====================== 工具函数 ======================

/**
 * 获取当前设备 ID
 * 使用 uni.getDeviceInfo()（uni-app 3.x API）
 * @returns 设备 ID，获取失败返回空字符串
 */
function getDeviceId(): string {
    try {
        const info = (uni as any).getDeviceInfo?.()
        return String(info?.deviceId || '')
    } catch {
        return ''
    }
}

/**
 * 构造推送 alias
 * 格式：merchant_${userId}_${tenantId}
 * @returns alias 字符串，未登录返回空字符串
 */
function buildAlias(): string {
    const user = getUser()
    const tenant = getTenant()
    if (!user?.id || !tenant?.id) return ''
    return `merchant_${user.id}_${tenant.id}`
}

/**
 * 根据推送类型解析跳转路由
 * @param type 推送类型
 * @returns 跳转 url，未知类型返回 undefined
 */
function resolveRoute(type?: string): string | undefined {
    if (!type) return undefined
    return PUSH_ROUTE_MAP[type as PushMessageType]
}

/**
 * 从 globalThis 安全读取 HMS Push Kit 原生实例
 *
 * HarmonyOS 平台通过 HBuilderX 打包鸿蒙包时由原生层注入 globalThis.HMSɨPushKit。
 * 使用方括号访问避免特殊字符 `ɨ`（U+0268）在 TypeScript 标识符中引起解析问题。
 *
 * @returns HMS Push Kit 原生实例，未注入返回 null
 */
function readHMSPushKitRaw(): HMSPushKitNativeModule | null {
    try {
        const kit = (globalThis as Record<string, unknown>)[HMS_PUSH_KIT_KEY]
        return kit ? (kit as HMSPushKitNativeModule) : null
    } catch {
        return null
    }
}

/**
 * 获取 JPush 原生插件实例（仅 APP-PLUS && !HARMONYOS 平台）
 *
 * 使用 IIFE 包裹条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *
 * @returns JPush 原生插件实例，不可用时返回 null
 */
function getJPush(): JPushNativeModule | null {
    return (() => {
        // #ifdef APP-PLUS && !HARMONYOS
        return uni.requireNativePlugin('JPush') as JPushNativeModule | null
        // #endif
        // #ifndef APP-PLUS && !HARMONYOS
        return null
        // #endif
    })()
}

// ====================== 后端 Token 注册 ======================

/**
 * 注册推送 Token 到后端
 *
 * 调用 POST /api/admin/push/register，将 deviceId/pushToken/provider 等信息上报后端，
 * 后端根据 pushToken 向对应厂商推送服务下发推送消息。
 *
 * @param payload 注册入参
 * @returns 注册成功 resolve，失败 reject（错误信息不阻断主流程）
 */
async function registerTokenToBackend(payload: PushRegisterPayload): Promise<void> {
    try {
        await post<PushRegisterResult>(PUSH_REGISTER_API, payload)
    } catch (err) {
        // 后端注册失败不阻断主流程，仅警告
        const msg = err instanceof Error ? err.message : '推送 Token 后端注册失败'
        console.error('[push] 后端注册失败:', msg)
    }
}

// ====================== Android 极光推送 JPush 实现 ======================

/**
 * Android 极光推送注册
 *
 * @param alias 推送 alias（格式 merchant_${userId}_${tenantId}）
 * @returns registrationId（极光推送唯一标识）
 */
async function registerJPush(alias: string): Promise<string> {
    const jpush = getJPush()
    if (!jpush) {
        return Promise.reject(new Error('JPush 插件不可用'))
    }
    if (!alias) {
        return Promise.reject(new Error('alias 不能为空（用户未登录）'))
    }

    return new Promise<string>((resolve, reject) => {
        try {
            jpush.init({ alias }, (res) => {
                if (res?.success === false || !res?.registrationId) {
                    reject(new Error(res?.error || 'JPush 注册失败'))
                    return
                }
                resolve(res.registrationId)
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('JPush 注册调用失败'))
        }
    })
}

/**
 * Android JPush 监听推送接收
 * @param callback 推送接收回调
 */
function onJPushReceived(callback: (payload: PushPayload) => void): void {
    const jpush = getJPush()
    if (!jpush) return
    try {
        jpush.addPushListener({ event: 'messageReceive' }, callback)
    } catch (err) {
        console.error('[push] JPush 监听接收失败:', err)
    }
}

/**
 * Android JPush 监听推送点击
 * @param callback 推送点击回调
 */
function onJPushClick(callback: (result: PushClickResult) => void): void {
    const jpush = getJPush()
    if (!jpush) return
    try {
        jpush.addPushListener({ event: 'notificationOpen' }, callback)
    } catch (err) {
        console.error('[push] JPush 监听点击失败:', err)
    }
}

/**
 * Android JPush 注销推送
 */
async function unregisterJPush(): Promise<void> {
    const jpush = getJPush()
    if (!jpush) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
        try {
            jpush.stopPush((res) => {
                if (res?.success === false) {
                    reject(new Error(res?.error || 'JPush 注销失败'))
                    return
                }
                resolve()
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('JPush 注销调用失败'))
        }
    })
}

// ====================== HarmonyOS 华为 Push Kit 实现 ======================

/**
 * HarmonyOS 华为 Push Kit 注册
 *
 * 调用 HMS Push Kit 的 getToken API 获取 pushToken。
 * 注意：HarmonyOS 不支持 alias 机制，使用 pushToken 作为唯一标识。
 *
 * @returns pushToken（华为 Push Kit 唯一标识）
 */
async function registerHMSPush(): Promise<string> {
    const kit = readHMSPushKitRaw()
    if (!kit) {
        return Promise.reject(new Error('HMS Push Kit 不可用'))
    }

    return new Promise<string>((resolve, reject) => {
        try {
            kit.getToken((res) => {
                if (res?.success === false || !res?.pushToken) {
                    reject(new Error(res?.error || 'HMS Push Kit 注册失败'))
                    return
                }
                resolve(res.pushToken)
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('HMS Push Kit 注册调用失败'))
        }
    })
}

/**
 * HarmonyOS HMS Push Kit 监听推送接收
 * @param callback 推送接收回调
 */
function onHMSPushReceived(callback: (payload: PushPayload) => void): void {
    const kit = readHMSPushKitRaw()
    if (!kit) return
    try {
        kit.onMessageReceived(callback)
    } catch (err) {
        console.error('[push] HMS Push Kit 监听接收失败:', err)
    }
}

/**
 * HarmonyOS HMS Push Kit 监听推送点击
 * @param callback 推送点击回调
 */
function onHMSPushClick(callback: (result: PushClickResult) => void): void {
    const kit = readHMSPushKitRaw()
    if (!kit) return
    try {
        kit.onNotificationOpened(callback)
    } catch (err) {
        console.error('[push] HMS Push Kit 监听点击失败:', err)
    }
}

/**
 * HarmonyOS HMS Push Kit 注销推送
 */
async function unregisterHMSPush(): Promise<void> {
    const kit = readHMSPushKitRaw()
    if (!kit) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
        try {
            kit.unregister((res) => {
                if (res?.success === false) {
                    reject(new Error(res?.error || 'HMS Push Kit 注销失败'))
                    return
                }
                resolve()
            })
        } catch (err) {
            reject(err instanceof Error ? err : new Error('HMS Push Kit 注销调用失败'))
        }
    })
}

// ====================== 统一推送 API（条件编译对外统一） ======================

/**
 * Android JPush 注册流程（独立 async 函数，避免条件编译内的 const 重复声明）
 *
 * @param alias 推送 alias
 * @param deviceId 设备 ID
 * @returns registrationId
 */
async function doRegisterJPush(alias: string, deviceId: string): Promise<string> {
    const token = await registerJPush(alias)
    currentPushToken = token
    currentProvider = 'jpush'
    // 上报后端
    await registerTokenToBackend({
        deviceId,
        pushToken: token,
        provider: 'jpush',
        appPlatform: 'android',
        appVersion: APP_VERSION,
    })
    // 注册成功后自动绑定监听器（将原生事件转发到回调列表）
    onJPushReceived((payload) => {
        for (const cb of pushReceivedCallbacks) {
            try { cb(payload) } catch (e) { console.error('[push] 接收回调异常:', e) }
        }
    })
    onJPushClick((result) => {
        // 自动路由跳转
        const url = result.url || resolveRoute(result.type)
        if (url) {
            try {
                uni.navigateTo({ url })
            } catch (e) {
                console.error('[push] 路由跳转失败:', e)
            }
        }
        for (const cb of pushClickCallbacks) {
            try { cb(result) } catch (e) { console.error('[push] 点击回调异常:', e) }
        }
    })
    return token
}

/**
 * HarmonyOS HMS Push Kit 注册流程（独立 async 函数）
 *
 * @param deviceId 设备 ID
 * @returns pushToken
 */
async function doRegisterHMSPush(deviceId: string): Promise<string> {
    const token = await registerHMSPush()
    currentPushToken = token
    currentProvider = 'hms'
    // 上报后端
    await registerTokenToBackend({
        deviceId,
        pushToken: token,
        provider: 'hms',
        appPlatform: 'harmony',
        appVersion: APP_VERSION,
    })
    // 注册成功后自动绑定监听器
    onHMSPushReceived((payload) => {
        for (const cb of pushReceivedCallbacks) {
            try { cb(payload) } catch (e) { console.error('[push] 接收回调异常:', e) }
        }
    })
    onHMSPushClick((result) => {
        const url = result.url || resolveRoute(result.type)
        if (url) {
            try {
                uni.navigateTo({ url })
            } catch (e) {
                console.error('[push] 路由跳转失败:', e)
            }
        }
        for (const cb of pushClickCallbacks) {
            try { cb(result) } catch (e) { console.error('[push] 点击回调异常:', e) }
        }
    })
    return token
}

/**
 * 注册推送服务
 *
 * 平台分支：
 *  - APP-PLUS && !HARMONYOS：调用 JPush 注册（alias = merchant_${userId}_${tenantId}）
 *  - HARMONYOS：调用 HMS Push Kit 注册（获取 pushToken）
 *  - 其他平台：reject
 *
 * 注册成功后自动将 pushToken 上报后端 POST /api/admin/push/register。
 *
 * 使用 IIFE 包裹条件编译分发，避免 vue-tsc 看到多个 return 语句造成问题（踩坑日志 [15]）
 *
 * @param alias 推送 alias（仅 Android JPush 使用，HarmonyOS 忽略）
 * @returns pushToken（极光 registrationId 或华为 pushToken）
 *
 * @example
 * ```ts
 * import { registerPush } from '@/native/push'
 * const token = await registerPush(`merchant_${user.id}_${tenant.id}`)
 * logger.info('推送注册成功，token:', token)
 * ```
 */
export function registerPush(alias: string): Promise<string> {
    const deviceId = getDeviceId()
    return (() => {
        // #ifdef APP-PLUS && !HARMONYOS
        return doRegisterJPush(alias, deviceId)
        // #endif
        // #ifdef HARMONYOS
        return doRegisterHMSPush(deviceId)
        // #endif
        // #ifndef APP-PLUS
        return Promise.reject(new Error('推送功能仅在 App 端可用'))
        // #endif
    })()
}

/**
 * 监听推送接收
 *
 * 注册回调，当 App 收到推送消息时触发。支持多监听器。
 * 注意：需在调用 registerPush 之前注册监听器，否则可能漏收首条消息。
 *
 * @param callback 推送接收回调
 *
 * @example
 * ```ts
 * onPushReceived((payload) => {
 *   logger.info('收到推送:', payload.title, payload.content)
 *   if (payload.type === 'order') {
 *     // 处理订单推送
 *   }
 * })
 * ```
 */
export function onPushReceived(callback: (payload: PushPayload) => void): void {
    if (typeof callback === 'function') {
        pushReceivedCallbacks.push(callback)
    }
}

/**
 * 监听推送点击
 *
 * 注册回调，当用户点击推送通知时触发。支持多监听器。
 * 注意：registerPush 内部已自动处理路由跳转，回调中通常只需做数据统计/刷新等额外逻辑。
 *
 * @param callback 推送点击回调
 *
 * @example
 * ```ts
 * onPushClick((result) => {
 *   logger.info('推送被点击:', result.type, result.url)
 *   // 刷新对应页面数据
 * })
 * ```
 */
export function onPushClick(callback: (result: PushClickResult) => void): void {
    if (typeof callback === 'function') {
        pushClickCallbacks.push(callback)
    }
}

/**
 * Android JPush 注销流程（独立 async 函数）
 */
async function doUnregisterJPush(): Promise<void> {
    try {
        await unregisterJPush()
    } finally {
        currentPushToken = ''
        currentProvider = null
        pushReceivedCallbacks.length = 0
        pushClickCallbacks.length = 0
    }
}

/**
 * HarmonyOS HMS Push Kit 注销流程（独立 async 函数）
 */
async function doUnregisterHMSPush(): Promise<void> {
    try {
        await unregisterHMSPush()
    } finally {
        currentPushToken = ''
        currentProvider = null
        pushReceivedCallbacks.length = 0
        pushClickCallbacks.length = 0
    }
}

/**
 * 注销推送服务
 *
 * 平台分支：
 *  - APP-PLUS && !HARMONYOS：调用 JPush stopPush
 *  - HARMONYOS：调用 HMS Push Kit unregister
 *  - 其他平台：resolve（无操作）
 *
 * 注销后会清空本地缓存的 pushToken 和回调列表。
 *
 * 使用 IIFE 包裹条件编译分发，避免 vue-tsc 看到多个 return 语句造成问题（踩坑日志 [15]）
 */
export function unregisterPush(): Promise<void> {
    return (() => {
        // #ifdef APP-PLUS && !HARMONYOS
        return doUnregisterJPush()
        // #endif
        // #ifdef HARMONYOS
        return doUnregisterHMSPush()
        // #endif
        // #ifndef APP-PLUS
        return Promise.resolve()
        // #endif
    })()
}

// ====================== 便捷方法 ======================

/**
 * 获取当前已注册的推送 Token
 * @returns pushToken，未注册返回空字符串
 */
export function getCurrentPushToken(): string {
    return currentPushToken
}

/**
 * 获取当前推送服务提供商
 * @returns 'jpush' / 'hms' / null（未注册）
 */
export function getCurrentProvider(): PushProvider | null {
    return currentProvider
}

/**
 * 自动构造 alias 并注册推送（便捷方法）
 *
 * 内部自动从加密存储读取 userId/tenantId，构造 alias = merchant_${userId}_${tenantId}，
 * 然后调用 registerPush。
 *
 * @returns pushToken
 * @throws 未登录时抛错（alias 为空）
 *
 * @example
 * ```ts
 * // 用户登录后调用
 * import { autoRegisterPush } from '@/native/push'
 * await autoRegisterPush()
 * ```
 */
export async function autoRegisterPush(): Promise<string> {
    const alias = buildAlias()
    if (!alias) {
        return Promise.reject(new Error('用户未登录，无法构造推送 alias'))
    }
    return registerPush(alias)
}

// ====================== 导出清单 ======================

export {
    // 类型已通过 export interface / export type 导出：
    // PushPayload, PushClickResult, PushProvider, AppPlatform,
    // PushRegisterPayload, PushRegisterResult, PushMessageType,
    // JPushNativeModule, HMSPushKitNativeModule
    // 函数已通过 export function / export async function 导出：
    // registerPush, onPushReceived, onPushClick, unregisterPush,
    // getCurrentPushToken, getCurrentProvider, autoRegisterPush
    // 常量导出
    HMS_PUSH_KIT_KEY,
    PUSH_REGISTER_API,
    PUSH_ROUTE_MAP,
    APP_VERSION,
}
