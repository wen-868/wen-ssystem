import { get, post } from '../request'

export interface LoginParams {
  account: string
  password: string
}

export interface LoginResult {
  token: string
  user: {
    id: number
    name: string
    account: string
    avatar?: string
    roles: string[]
    storeId?: number
    storeName?: string
  }
  tenant: {
    id: number
    name: string
    code: string
  }
}

export interface SendSmsCodeParams {
  mobile: string
}

export interface SendSmsCodeResult {
  success: boolean
  message: string
}

export interface RegisterParams {
  mobile: string
  smsCode: string
  password: string
  name?: string
}

export interface RegisterResult {
  token: string
  user: {
    id: number
    name: string
    account: string
    avatar?: string
    roles: string[]
  }
}

export interface ProfileResult {
  id: number
  name: string
  account: string
  avatar?: string
  email?: string
  phone?: string
  roles: string[]
  storeId?: number
  storeName?: string
}

const authApi = {
  login(params: LoginParams): Promise<LoginResult> {
    return post('/admin/auth/login', params)
  },

  getProfile(): Promise<ProfileResult> {
    return get('/admin/auth/profile')
  },

  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return post('/admin/auth/change-password', { oldPassword, newPassword })
  },

  updateProfile(data: Partial<ProfileResult>): Promise<ProfileResult> {
    return post('/admin/auth/profile', data)
  },

  sendSmsCode(params: SendSmsCodeParams): Promise<SendSmsCodeResult> {
    return post('/admin/auth/send-sms-code', params)
  },

  register(params: RegisterParams): Promise<RegisterResult> {
    return post('/admin/auth/register', params)
  }
}

export { authApi }