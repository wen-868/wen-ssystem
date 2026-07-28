/**
 * SSL 证书锁定（SSL Pinning）— R51-05 安全加固
 *
 * 核心功能：
 *  1. PINNED_CERTS                — 内置生产证书 SHA256 指纹配置（占位，后续替换实际值）
 *  2. validateCertificate(host, cert) — 校验证书指纹是否匹配锁定列表
 *  3. getPinnedCerts(host)        — 获取指定域名的锁定证书列表
 *  4. isPinningEnabled()          — 是否启用 Pinning（支持远程配置应急关闭）
 *  5. setPinningEnabled(enabled)  — 远程下发开关（应急时关闭）
 *
 * 设计说明：
 *  - 防止中间人攻击（MITM）：即使攻击者拥有可信 CA 签发的证书，也无法冒充服务端
 *  - 应急开关：服务端可下发 { pinning: false } 关闭 Pinning（用于证书轮换应急）
 *  - 开关状态加密存储在 enc_ssl_pinning_enabled（复用 crypto.ts 安全存储）
 *  - 条件编译：APP-PLUS 在 request 拦截器中校验证书；H5/小程序跳过（浏览器自带校验）
 *  - 使用 IIFE 包裹条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *
 * 注意：
 *  - 当前 PINNED_CERTS 中的指纹为占位值，正式发布前必须替换为生产证书实际 SHA256
 *  - 证书轮换时，新旧证书指纹应同时保留在列表中，确保切换期间 App 仍可连接
 *  - 应急开关关闭后，App 仍受 HTTPS 标准校验保护（仅失去 Pinning 额外防护）
 *
 * @author 阿澈
 */

import { setSecureStorage, getSecureStorage } from '@/utils/crypto'

// ====================== 类型定义 ======================

/** 证书信息（APP-PLUS 环境下 uni.request 返回的证书对象） */
export interface CertificateInfo {
    /** 证书指纹（SHA256，格式：sha256/base64=） */
    fingerprint?: string
    /** 证书主题（CN） */
    subject?: string
    /** 证书颁发者（Issuer） */
    issuer?: string
    /** 证书有效期起始时间（毫秒时间戳） */
    validFrom?: number
    /** 证书有效期截止时间（毫秒时间戳） */
    validTo?: number
    /** 原始证书数据（PEM 或 DER，可选） */
    raw?: string
}

/** Pinning 校验结果 */
export interface PinningResult {
    /** 是否通过校验 */
    valid: boolean
    /** 失败原因（valid=false 时有值） */
    reason?: string
    /** 匹配的证书指纹（valid=true 时有值） */
    matchedFingerprint?: string
}

// ====================== 证书指纹配置 ======================

/**
 * 锁定证书列表（生产环境替换实际 SHA256 指纹）
 *
 * 格式：sha256/<Base64(SubjectPublicKeyInfo 的 SHA256)>=
 *
 * 占位说明：
 *  - 当前为占位值（AAAA... / BBBB...），发布前必须替换
 *  - 建议保留 2 个指纹：当前证书 + 备用证书（用于轮换）
 *
 * 生成方式：
 *  - OpenSSL: openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
 *  - 在线工具: https://www.ssllabs.com/ssltest/
 */
const PINNED_CERTS: Record<string, string[]> = {
    'api.zhixiang-chain.com': [
        'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // 占位 — 主证书（发布前替换）
        'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=' // 占位 — 备用证书（用于轮换）
    ]
}

/** 应急开关存储键（加密存储，复用 crypto.ts） */
const PINNING_ENABLED_KEY = 'ssl_pinning_enabled'

/** 应急开关默认值（true=启用，false=关闭） */
const DEFAULT_PINNING_ENABLED = true

// ====================== 应急开关 ======================

/**
 * 是否启用 SSL Pinning
 * - 优先读取加密存储的远程配置开关
 * - 默认启用（true）
 * - 远程下发 { pinning: false } 时关闭
 *
 * @returns true=启用 Pinning 校验，false=跳过校验（应急关闭）
 */
export function isPinningEnabled(): boolean {
    const raw = getSecureStorage(PINNING_ENABLED_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    // 未设置时使用默认值
    return DEFAULT_PINNING_ENABLED
}

/**
 * 设置 SSL Pinning 开关（远程配置下发）
 * - 服务端可下发 { pinning: false } 应急关闭 Pinning（如证书轮换异常）
 * - 开关状态加密存储在 enc_ssl_pinning_enabled
 * - 关闭后 App 仍受 HTTPS 标准校验保护，仅失去 Pinning 额外防护
 *
 * @param enabled true=启用，false=关闭
 */
export function setPinningEnabled(enabled: boolean): void {
    setSecureStorage(PINNING_ENABLED_KEY, enabled ? 'true' : 'false')
}

// ====================== 证书锁定校验 ======================

/**
 * 获取指定域名的锁定证书列表
 *
 * @param hostname 域名（如 api.zhixiang-chain.com）
 * @returns 证书指纹数组；未配置的域名返回空数组
 */
export function getPinnedCerts(hostname: string): string[] {
    return PINNED_CERTS[hostname] || []
}

/**
 * 校验证书指纹是否匹配锁定列表
 *
 * @param hostname 域名
 * @param cert     证书信息（含 SHA256 指纹）
 * @returns PinningResult：valid=true 表示校验通过
 *
 * @example
 * ```ts
 * const result = validateCertificate('api.zhixiang-chain.com', {
 *   fingerprint: 'sha256/XXXX...'
 * })
 * if (!result.valid) {
 *   logger.warn('证书校验失败：', result.reason)
 * }
 * ```
 */
export function validateCertificate(hostname: string, cert: CertificateInfo): PinningResult {
    // 应急开关关闭时，直接放行（仍受 HTTPS 标准校验保护）
    if (!isPinningEnabled()) {
        return { valid: true, reason: 'Pinning 应急关闭，放行（仍受 HTTPS 校验）' }
    }

    // 该域名未配置锁定证书，放行（仍受 HTTPS 标准校验保护）
    const pinnedCerts = getPinnedCerts(hostname)
    if (pinnedCerts.length === 0) {
        return { valid: true, reason: '该域名未配置 Pinning，放行' }
    }

    // 证书无指纹信息，拒绝
    if (!cert.fingerprint) {
        return { valid: false, reason: '证书缺少 SHA256 指纹' }
    }

    // 指纹匹配校验
    const fingerprint = cert.fingerprint.trim()
    for (const pinned of pinnedCerts) {
        if (fingerprint === pinned) {
            return { valid: true, matchedFingerprint: fingerprint }
        }
    }

    // 指纹不匹配，拒绝（疑似 MITM 攻击）
    return {
        valid: false,
        reason: `证书指纹不匹配锁定列表（域名: ${hostname}，可能遭遇中间人攻击）`
    }
}

// ====================== 平台适配（IIFE 包裹条件编译，踩坑日志 [15]） ======================

/**
 * 在请求拦截器中安装 SSL Pinning 校验
 *
 * - APP-PLUS 环境：监听 uni.request 的 onCertificateValidate 事件（如可用），
 *   调用 validateCertificate 校验证书指纹
 * - H5/小程序环境：浏览器自带 HTTPS 校验，跳过 Pinning 安装（返回 false）
 *
 * @returns true=安装成功，false=当前平台不支持或安装失败
 *
 * @example
 * ```ts
 * import { installSslPinning } from '@/utils/pin-ssl'
 * // 在 App.vue onLaunch 中调用
 * installSslPinning()
 * ```
 */
export function installSslPinning(): boolean {
    return (() => {
        // #ifdef APP-PLUS
        // APP-PLUS 环境：尝试安装证书校验钩子
        try {
            const g: any = globalThis
            const plusObj: any = g?.plus
            // plus.networkEvent 或 plus.net 提供证书校验事件（具体 API 视 HBuilderX 版本）
            // 这里仅做接口预留，实际安装逻辑在原生层（NetworkClient）
            // 当 uni.request 在 APP-PLUS 发起请求时，原生层会回调证书校验
            const networkObj: any = plusObj?.networkEvent
            if (networkObj && typeof networkObj.addEventListener === 'function') {
                networkObj.addEventListener('certificateValidate', (e: any) => {
                    const hostname: string = e?.hostname || ''
                    const cert: CertificateInfo = {
                        fingerprint: e?.fingerprint,
                        subject: e?.subject,
                        issuer: e?.issuer,
                        validFrom: e?.validFrom,
                        validTo: e?.validTo,
                        raw: e?.raw
                    }
                    const result = validateCertificate(hostname, cert)
                    if (!result.valid) {
                        // 拒绝连接（设置 e.preventDefault 或返回 false）
                        if (typeof e.preventDefault === 'function') {
                            e.preventDefault()
                        }
                    }
                })
                return true
            }
        } catch {
            // plus 不可用，降级到无 Pinning 状态
        }
        return false
        // #endif
        // #ifndef APP-PLUS
        // H5/小程序环境：浏览器自带 HTTPS 证书校验，无需应用层 Pinning
        return false
        // #endif
    })()
}

// ====================== 工具函数 ======================

/**
 * 获取当前配置的所有锁定域名列表
 * 用于调试和配置验证
 */
export function listPinnedHostnames(): string[] {
    return Object.keys(PINNED_CERTS)
}

/**
 * 添加临时锁定证书（运行时动态添加，不持久化）
 * 用于测试环境或临时证书轮换场景
 *
 * @param hostname 域名
 * @param fingerprint SHA256 指纹（格式：sha256/base64=）
 */
export function addPinnedCert(hostname: string, fingerprint: string): void {
    if (!PINNED_CERTS[hostname]) {
        PINNED_CERTS[hostname] = []
    }
    if (!PINNED_CERTS[hostname].includes(fingerprint)) {
        PINNED_CERTS[hostname].push(fingerprint)
    }
}
