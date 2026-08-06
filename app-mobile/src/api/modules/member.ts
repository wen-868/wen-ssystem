import { get, post } from '../request'

export interface MemberRegisterParams {
  mobile: string
  password: string
  smsCode: string
  name?: string
}

export interface MemberRegisterResult {
  id: number
  mobile: string
  name: string
  token?: string
}

export interface SendSmsCodeParams {
  mobile: string
}

const memberApi = {
  sendSmsCode(params: SendSmsCodeParams): Promise<void> {
    return post('/store/members/sms-code', params)
  },

  register(params: MemberRegisterParams): Promise<MemberRegisterResult> {
    return post('/store/members/register', params)
  },

  async getMemberInfo(): Promise<MemberRegisterResult> {
    // R94-03：原 /store/members/info 不存在；当前登录用户信息真实接口为 /store/me（store-dashboard.routes.ts）
    const res: any = await get('/store/me')
    const r = res?.result ?? res ?? {}
    return {
      id: Number(r.userId ?? r.id ?? 0),
      mobile: r.username ?? r.mobile ?? '',
      name: r.realName ?? r.name ?? '',
    }
  }
}

export { memberApi }
