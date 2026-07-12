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

  getMemberInfo(): Promise<MemberRegisterResult> {
    return get('/store/members/info')
  }
}

export { memberApi }