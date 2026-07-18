import { get, post } from '../request'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: {
    id: number
    username: string
    realName: string
    avatar?: string
    roles: string[]
    storeId?: number
    tenantId: string
    permissions?: string[]
  }
}

export interface ProfileResult {
  id: number
  username: string
  realName: string
  avatar?: string
  email?: string
  phone?: string
  roles: string[]
  storeId?: number
  tenantId?: string
}

export interface TenantRegisterParams {
  companyName: string
  contactPerson: string
  contactMobile: string
  adminUsername: string
  adminPassword: string
  adminRealName: string
  contactEmail?: string
  address?: string
}

export interface SendSmsCodeParams {
  mobile: string
  tenantId?: string
}

const authApi = {
  /** 登录 */
  login(params: LoginParams): Promise<LoginResult> {
    return post('/admin/auth/login', params)
  },

  /** 获取当前用户信息 */
  getProfile(): Promise<ProfileResult> {
    return get('/admin/auth/me')
  },

  /** 修改密码 */
  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return post('/admin/auth/change-password', { oldPassword, newPassword })
  },

  /** 发送注册短信验证码 */
  sendSmsCode(params: SendSmsCodeParams): Promise<any> {
    return post('/store/members/sms-code', params)
  },

  /** 租户注册申请 */
  register(params: TenantRegisterParams): Promise<{ applicationId: number; message: string }> {
    return post('/tenant/register', params)
  }
}

export { authApi }