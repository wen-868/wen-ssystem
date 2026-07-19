/**
 * 持久化存储适配层 — R51-05 安全加固
 *
 * 改造说明：
 *  - 4 个敏感 Key（merchant_token / merchant_user / merchant_tenant / merchant_tenant_id）
 *    改用 setSecureStorage / getSecureStorage 加密存储（AES-256-GCM）
 *  - 非敏感 Key（主题、语言偏好等）保持明文存储（直接用 uni.setStorageSync）
 *  - 保留现有 API 接口（getToken / setToken / removeToken 等），仅内部实现改为加密
 *  - 兼容性：首次启动自动检测旧明文数据，迁移到加密存储后删除明文
 *  - 兼容性：安装 uni.getStorageSync / uni.removeStorageSync 拦截器，
 *    将外部代码（request.ts / stores/user.ts / App.vue 等）对敏感 Key 的
 *    直接访问转发到加密存储，无需修改这些外部文件
 *
 * 敏感 Key 加密映射：
 *  | 原始 Key                | 加密后存储为              |
 *  |-------------------------|---------------------------|
 *  | merchant_token          | enc_merchant_token        |
 *  | merchant_user           | enc_merchant_user         |
 *  | merchant_tenant         | enc_merchant_tenant       |
 *  | merchant_tenant_id      | enc_merchant_tenant_id    |
 *
 * 拦截器循环依赖检查：
 *  - crypto.ts 的 setSecureStorage 内部调用 uni.setStorageSync('enc_' + key, ...)
 *    'enc_xxx' 不在 SENSITIVE_KEYS 中，不会触发拦截器
 *  - crypto.ts 的 getSecureStorage 内部调用 uni.getStorageSync('enc_' + key)
 *    同样不会触发拦截器
 *  - 无循环依赖
 *
 * @author 阿澈
 */

import { setSecureStorage, getSecureStorage, removeSecureStorage } from '@/utils/crypto'

// ====================== 类型定义 ======================

export interface UserInfo {
  id: number
  name: string
  account: string
  avatar?: string
  roles: string[]
  storeId?: number
  storeName?: string
}

export interface TenantInfo {
  id: number
  name: string
  code: string
}

// ====================== 敏感 Key 常量 ======================

/** 4 个敏感 Key（需加密存储） */
const SENSITIVE_KEYS = {
  TOKEN: 'merchant_token',
  USER: 'merchant_user',
  TENANT: 'merchant_tenant',
  TENANT_ID: 'merchant_tenant_id'
} as const

// ====================== 原始 uni API 引用（在拦截器安装前保存） ======================

/**
 * 保存原始 uni.getStorageSync / uni.removeStorageSync 引用
 *
 * 必须在拦截器安装前保存，否则拦截器会形成无限递归（自己调用自己）。
 * 用途：
 *  - migrateFromPlainStorage 读取旧明文（避免被拦截器拦截，因为拦截器读不到明文）
 *  - 拦截器内部的 fallback 调用（非敏感 Key 走原始 API）
 *  - removeToken / removeUser / removeTenant 中清理可能残留的旧明文
 */
const _originalGetStorageSync: (key: string) => any = uni.getStorageSync.bind(uni)
const _originalRemoveStorageSync: (key: string) => void = uni.removeStorageSync.bind(uni)

// ====================== 旧明文数据迁移 ======================

/**
 * 迁移旧明文数据到加密存储
 * - 首次启动 App 时调用（模块加载时自动执行）
 * - 检测 4 个敏感 Key 的旧明文数据，迁移到加密存储后删除明文
 * - 幂等：迁移完成后明文已删除，重复调用安全
 *
 * 注意：使用 _originalGetStorageSync 读取明文，避免被拦截器拦截
 *       （拦截器读不到明文，因为加密存储此时还没有数据）
 *
 * 迁移流程：
 *  1. 读取旧明文 merchant_token 等（用原始 API）
 *  2. 如有值，写入 enc_merchant_token（加密）
 *  3. 删除旧明文 merchant_token（用原始 API）
 *  4. 对 4 个 Key 依次执行
 */
export function migrateFromPlainStorage(): void {
  // 遍历 4 个敏感 Key，检测旧明文数据并迁移
  for (const key of Object.values(SENSITIVE_KEYS)) {
    try {
      const plainValue = _originalGetStorageSync(key)
      if (plainValue === '' || plainValue === null || plainValue === undefined) {
        continue // 无旧明文数据，跳过
      }
      // 迁移到加密存储
      // 注意：旧明文可能是字符串（token/tenant_id）或 JSON 字符串（user/tenant）
      // setSecureStorage 内部会 JSON.stringify，对于字符串会再次包裹引号
      // 为了保持数据一致性，先尝试 JSON.parse，如果是对象则直接传，否则按字符串传
      let valueToEncrypt: unknown = plainValue
      if (typeof plainValue === 'string') {
        try {
          // 尝试解析为 JSON（适用于 user/tenant 等对象）
          valueToEncrypt = JSON.parse(plainValue)
        } catch {
          // 不是 JSON 字符串（适用于 token/tenant_id），保持字符串
          valueToEncrypt = plainValue
        }
      }
      setSecureStorage(key, valueToEncrypt)
      // 删除旧明文（用原始 API，避免触发拦截器的 removeSecureStorage）
      _originalRemoveStorageSync(key)
    } catch (e) {
      // 单个 Key 迁移失败不影响其他 Key
      console.warn(`[storage] 迁移 ${key} 失败:`, e)
    }
  }
}

// ====================== uni API 拦截器（兼容外部直接读取） ======================

/**
 * 安装 uni.getStorageSync / uni.removeStorageSync 拦截器
 *
 * 背景：
 *  - request.ts 第 35/39 行：uni.getStorageSync('merchant_token' / 'merchant_tenant_id')
 *  - stores/user.ts 第 7 行：uni.getStorageSync('merchant_token')
 *  - App.vue 第 7 行：uni.getStorageSync('merchant_token')
 *  - request.ts 第 73-75 行：uni.removeStorageSync('merchant_token' / 'merchant_user' / 'merchant_tenant_id')
 *  这些外部代码绕过 storage.ts 直接调用 uni API，但任务约束不允许修改它们。
 *  通过 monkey-patch uni API，将外部对敏感 Key 的访问转发到加密存储。
 *
 * 拦截规则：
 *  - uni.getStorageSync(SENSITIVE_KEY) → 自动走 getSecureStorage 解密返回原值
 *  - uni.removeStorageSync(SENSITIVE_KEY) → 自动走 removeSecureStorage + 清理残留明文
 *  - uni.setStorageSync 不拦截（外部代码不应直接写敏感 Key，应通过 storage.ts API）
 *  - 其他 key（含 enc_xxx 前缀）→ 不拦截，走原始 uni API
 *
 * 循环依赖检查：
 *  - crypto.ts 的 setSecureStorage 内部调用 uni.setStorageSync('enc_' + key, ...)
 *    'enc_xxx' 不在 SENSITIVE_KEYS 中，不会触发拦截器
 *  - crypto.ts 的 getSecureStorage 内部调用 uni.getStorageSync('enc_' + key)
 *    同样不会触发拦截器
 *  - 无循环依赖
 */
function installUniInterceptor(): void {
  const sensitiveKeySet = new Set<string>(Object.values(SENSITIVE_KEYS))

    // 重写 uni.getStorageSync：敏感 Key 走加密存储
    // 注意：用 (uni as any) 绕过 TypeScript 对 uni API 的只读检查
    ; (uni as any).getStorageSync = function (key: string): any {
      if (sensitiveKeySet.has(key)) {
        // 敏感 Key 走加密存储（解密后返回原值）
        const jsonStr = getSecureStorage(key)
        if (!jsonStr) return ''
        // setSecureStorage 内部 JSON.stringify(value) 后加密
        // getSecureStorage 解密后返回的是 JSON 字符串
        // 这里 JSON.parse 还原为原值（字符串或对象）
        try {
          return JSON.parse(jsonStr)
        } catch {
          return jsonStr
        }
      }
      // 非敏感 Key 走原始 API
      return _originalGetStorageSync(key)
    }

    // 重写 uni.removeStorageSync：敏感 Key 走加密存储删除 + 清理残留明文
    ; (uni as any).removeStorageSync = function (key: string): void {
      if (sensitiveKeySet.has(key)) {
        removeSecureStorage(key)
        _originalRemoveStorageSync(key)
        return
      }
      _originalRemoveStorageSync(key)
    }
}

// 模块加载时自动执行：1. 迁移旧明文 → 2. 安装拦截器
// 顺序很重要：必须先迁移（用原始 API 读明文），再安装拦截器（之后所有 uni API 调用都走加密存储）
; (() => {
  try {
    migrateFromPlainStorage()
  } catch (e) {
    console.warn('[storage] 旧明文数据迁移失败:', e)
  }
  try {
    installUniInterceptor()
  } catch (e) {
    console.warn('[storage] uni API 拦截器安装失败:', e)
  }
})()

// ──────────────────────────── Token ────────────────────────────

/**
 * 获取 Token
 * - 从加密存储 enc_merchant_token 读取并解密
 * - 解密失败（数据被篡改或密钥不匹配）返回空字符串
 */
export function getToken(): string {
  const value = getSecureStorage(SENSITIVE_KEYS.TOKEN)
  if (!value) return ''
  // value 是 JSON 字符串（setSecureStorage 内部 JSON.stringify）
  // 对于字符串类型，JSON.stringify("abc") = '"abc"'，需要 JSON.parse 还原
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : String(parsed)
  } catch {
    // 不是 JSON 字符串，直接返回
    return value
  }
}

/**
 * 设置 Token（加密存储）
 * @param token JWT Token 字符串
 */
export function setToken(token: string): void {
  setSecureStorage(SENSITIVE_KEYS.TOKEN, token)
}

/** 删除 Token（含加密存储） */
export function removeToken(): void {
  removeSecureStorage(SENSITIVE_KEYS.TOKEN)
  // 兼容性：同时清理可能残留的旧明文
  uni.removeStorageSync(SENSITIVE_KEYS.TOKEN)
}

// ──────────────────────────── User ────────────────────────────

/**
 * 获取用户信息
 * - 从加密存储 enc_merchant_user 读取并解密
 * - 解密失败或数据不存在返回 null
 */
export function getUser(): UserInfo | null {
  const value = getSecureStorage(SENSITIVE_KEYS.USER)
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') {
      return parsed as UserInfo
    }
    return null
  } catch {
    return null
  }
}

/**
 * 设置用户信息（加密存储）
 * @param user 用户信息对象
 */
export function setUser(user: UserInfo): void {
  setSecureStorage(SENSITIVE_KEYS.USER, user)
}

/** 删除用户信息（含加密存储） */
export function removeUser(): void {
  removeSecureStorage(SENSITIVE_KEYS.USER)
  // 兼容性：同时清理可能残留的旧明文
  uni.removeStorageSync(SENSITIVE_KEYS.USER)
}

// ──────────────────────────── Tenant ────────────────────────────

/**
 * 获取租户信息
 * - 从加密存储 enc_merchant_tenant 读取并解密
 * - 解密失败或数据不存在返回 null
 */
export function getTenant(): TenantInfo | null {
  const value = getSecureStorage(SENSITIVE_KEYS.TENANT)
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') {
      return parsed as TenantInfo
    }
    return null
  } catch {
    return null
  }
}

/**
 * 设置租户信息（加密存储）
 * - 同时加密存储 merchant_tenant_id（字符串形式）
 * @param tenant 租户信息对象
 */
export function setTenant(tenant: TenantInfo): void {
  setSecureStorage(SENSITIVE_KEYS.TENANT, tenant)
  setSecureStorage(SENSITIVE_KEYS.TENANT_ID, String(tenant.id))
}

/** 删除租户信息（含加密存储和 tenant_id） */
export function removeTenant(): void {
  removeSecureStorage(SENSITIVE_KEYS.TENANT)
  removeSecureStorage(SENSITIVE_KEYS.TENANT_ID)
  // 兼容性：同时清理可能残留的旧明文
  uni.removeStorageSync(SENSITIVE_KEYS.TENANT)
  uni.removeStorageSync(SENSITIVE_KEYS.TENANT_ID)
}

// ──────────────────────────── Clear All ────────────────────────────

/**
 * 退出登录：清除所有敏感信息并跳转登录页
 * - 清除 Token / User / Tenant（含加密存储）
 * - 跳转到登录页（reLaunch）
 */
export function logout(): void {
  removeToken()
  removeUser()
  removeTenant()
  uni.reLaunch({ url: '/pages/login/login' })
}
