/**
 * 持久化存储适配层
 * 封装 uni.getStorageSync / setStorageSync，统一管理 Token、用户信息、租户信息
 */

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

// ──────────────────────────── Token ────────────────────────────

export function getToken(): string {
  return uni.getStorageSync('merchant_token') || ''
}

export function setToken(token: string): void {
  uni.setStorageSync('merchant_token', token)
}

export function removeToken(): void {
  uni.removeStorageSync('merchant_token')
}

// ──────────────────────────── User ────────────────────────────

export function getUser(): UserInfo | null {
  const raw = uni.getStorageSync('merchant_user')
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

export function setUser(user: UserInfo): void {
  uni.setStorageSync('merchant_user', JSON.stringify(user))
}

export function removeUser(): void {
  uni.removeStorageSync('merchant_user')
}

// ──────────────────────────── Tenant ────────────────────────────

export function getTenant(): TenantInfo | null {
  const raw = uni.getStorageSync('merchant_tenant')
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

export function setTenant(tenant: TenantInfo): void {
  uni.setStorageSync('merchant_tenant', JSON.stringify(tenant))
  uni.setStorageSync('merchant_tenant_id', String(tenant.id))
}

export function removeTenant(): void {
  uni.removeStorageSync('merchant_tenant')
  uni.removeStorageSync('merchant_tenant_id')
}

// ──────────────────────────── Clear All ────────────────────────────

export function logout(): void {
  removeToken()
  removeUser()
  removeTenant()
  uni.reLaunch({ url: '/pages/login/login' })
}