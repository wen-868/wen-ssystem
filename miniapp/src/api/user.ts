import { get, post, put, del } from './request'

// 用户信息
export interface UserProfile {
  id: number
  nickname: string
  avatar: string
  phone: string
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN'
  birthday: string
  points: number
  level: string
  levelId: number
  growthValue: number
  nextLevelGrowth: number
}

// 收货地址
export interface Address {
  id: number
  name: string
  mobile: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}

// 会员等级
export interface MemberLevel {
  id: number
  name: string
  level: number
  icon: string
  minGrowth: number
  maxGrowth: number
  discount: number
  benefits: string[]
}

// 成长值明细
export interface GrowthRecord {
  id: number
  type: 'EARN' | 'CONSUME'
  amount: number
  reason: string
  orderNo?: string
  createdAt: string
}

// 会员权益
export interface MemberBenefit {
  id: number
  name: string
  icon: string
  description: string
  levelRequired: number
}

export const userApi = {
  // 获取用户信息
  getProfile: (): Promise<UserProfile> => {
    return get('/miniapp/user/profile')
  },

  // 更新用户信息
  updateProfile: (data: {
    nickname?: string
    avatar?: string
    gender?: string
    birthday?: string
  }): Promise<{ message: string }> => {
    return put('/miniapp/user/profile', data)
  },

  // 修改密码
  changePassword: (data: {
    oldPassword: string
    newPassword: string
  }): Promise<{ message: string }> => {
    // 后端 miniapp 路由：POST /api/miniapp/user/change-password
    return post('/miniapp/user/change-password', data as unknown as Record<string, unknown>)
  },

  // 获取收货地址列表
  getAddresses: (): Promise<Address[]> => {
    return get('/miniapp/user/addresses')
  },

  // 新增收货地址
  createAddress: (data: Omit<Address, 'id'>): Promise<Address> => {
    return post('/miniapp/user/addresses', data as Record<string, unknown>)
  },

  // 更新收货地址
  updateAddress: (id: number, data: Omit<Address, 'id'>): Promise<{ message: string }> => {
    return put(`/miniapp/user/addresses/${id}`, data as Record<string, unknown>)
  },

  // 删除收货地址
  deleteAddress: (id: number): Promise<{ message: string }> => {
    return del(`/miniapp/user/addresses/${id}`)
  },

  // 设为默认地址
  setDefaultAddress: (id: number): Promise<{ message: string }> => {
    return post(`/miniapp/user/addresses/${id}/default`)
  },

  // 获取会员等级信息
  getMemberLevel: (): Promise<{
    currentLevel: MemberLevel
    nextLevel?: MemberLevel
    growthValue: number
    benefits: MemberBenefit[]
  }> => {
    // 后端 miniapp 路由：GET /api/miniapp/member/levels
    return get('/miniapp/member/levels')
  },

  // 获取成长值明细
  getGrowthRecords: (params?: {
    page?: number
    pageSize?: number
    type?: string
  }): Promise<{
    total: number
    page: number
    pageSize: number
    records: GrowthRecord[]
  }> => {
    // 后端 miniapp 路由：GET /api/miniapp/member/growth
    return get('/miniapp/member/growth', params as Record<string, unknown>)
  }
}
