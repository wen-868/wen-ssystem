import Taro from '@tarojs/taro'
import { get, post } from './request'

/** 本地身份存储键：提交申请后保存 { openid, mobile }，供「我的申请」查询 */
export const IDENTITY_STORAGE_KEY = 'platform_miniapp_identity'

/** 本地设备标识存储键：MVP 阶段作为 openid 兜底（R98-02 换真实微信 openid） */
export const DEVICE_ID_STORAGE_KEY = 'platform_miniapp_device_id'

/**
 * 获取本地设备标识：
 * MVP 无 code2session 能力，先用本地持久化设备 ID 充当 openid 关联本人申请，
 * R98-02 接入真实微信登录后替换。
 */
export function getDeviceOpenid(): string {
  try {
    let deviceId = Taro.getStorageSync(DEVICE_ID_STORAGE_KEY)
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      Taro.setStorageSync(DEVICE_ID_STORAGE_KEY, deviceId)
    }
    return String(deviceId)
  } catch {
    return ''
  }
}

/** 读取本地身份（提交申请时保存） */
export function getLocalIdentity(): { openid?: string; mobile?: string } | null {
  try {
    const saved = Taro.getStorageSync(IDENTITY_STORAGE_KEY)
    if (saved && (saved.openid || saved.mobile)) {
      return saved as { openid?: string; mobile?: string }
    }
  } catch {
    // 忽略存储异常
  }
  return null
}

/** 保存本地身份 */
export function saveLocalIdentity(identity: { openid?: string; mobile?: string }) {
  try {
    Taro.setStorageSync(IDENTITY_STORAGE_KEY, identity)
  } catch {
    // 忽略存储异常
  }
}

/** 公开套餐（后端已脱敏：id/name/price/cycle/description/features） */
export interface PlatformPlan {
  id: number
  name: string
  price: number
  cycle: string
  description: string
  features: unknown
}

/** 订阅申请记录 */
export interface SubscriptionApply {
  id: number
  planId: number
  planName: string
  company: string
  contact: string
  mobile: string
  remark: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  auditRemark: string
  auditedAt: string | null
  createdAt: string
}

/** 获取公开套餐列表 */
export function fetchPlans(): Promise<PlatformPlan[]> {
  return get<PlatformPlan[]>('/platform-miniapp/plans')
}

/** 提交订阅申请 */
export function submitSubscription(data: {
  openid?: string
  planId: number
  company: string
  contact: string
  mobile: string
  remark?: string
}): Promise<SubscriptionApply> {
  return post<SubscriptionApply>('/platform-miniapp/subscriptions', data)
}

/** 查询本人申请（openid 优先，mobile 兜底） */
export function fetchMyApplications(params: {
  openid?: string
  mobile?: string
}): Promise<SubscriptionApply[]> {
  return get<SubscriptionApply[]>('/platform-miniapp/subscriptions/me', params)
}
