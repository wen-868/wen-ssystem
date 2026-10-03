import { get, post, request } from '../request'

/**
 * 演示凭据（**唯一出处**）
 *
 * 口径同工作台单 C6-9：一键「演示登录」会把这两个值明文填入表单并自动提交，
 * 用户零输入、零二次点击。值来自构建期环境变量 VITE_DEMO_ACCOUNT / VITE_DEMO_PASSWORD
 * （见 app-mobile/.env.example，注明"演示账号，可替换"）；未配置时回退到默认值。
 *
 * ⚠️ 禁止在页面/组件里再写字面量——凭据只能从这里出。
 */
export const DEMO_ACCOUNT: string =
  (import.meta.env?.VITE_DEMO_ACCOUNT as string | undefined) || 'demo'
export const DEMO_PASSWORD: string =
  (import.meta.env?.VITE_DEMO_PASSWORD as string | undefined) || 'Demo@2026'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  /** CSRF 防护令牌（后端 R52-01 登录接口下发，写操作需注入 x-csrf-token header） */
  csrfToken: string
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
  /** 双因素认证：账号启用 MFA 时，第一步登录仅返回挑战令牌 */
  mfaRequired?: boolean
  mfaToken?: string
}

export interface ProfileResult {
  id: number
  username?: string
  realName?: string
  avatar?: string
  email?: string
  phone?: string
  roles: string[]
  storeId?: number
  storeName?: string
  name?: string
  tenantId?: string
  /** CSRF 防护令牌（getMe 接口同步返回，供前端刷新页面后恢复） */
  csrfToken?: string
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
  /** 登录（商户端store端点） */
  login(params: LoginParams): Promise<LoginResult> {
    return post('/store/auth/login', params)
  },

  /**
   * 演示登录用的密码登录（silent：出错不弹后端 toast）
   *
   * 与 login() 同一后端 controller（server.ts 中 /api/store/auth/login 与 /api/admin/auth/login
   * 均指向 authController.login）。演示场景要自行判断"锁定"并降级免密通道，
   * 若沿用非 silent 通道，用户会先收到一条"账号已锁定"toast、再收到"演示通道已接管"，
   * 两条提示互相打架，故这里静默，由页面统一提示。
   */
  loginSilent(params: LoginParams): Promise<LoginResult> {
    return request<LoginResult>({ url: '/store/auth/login', method: 'POST', data: params, silent: true })
  },

  /** 免密演示通道（降级兜底）：自动建号、幂等绑超管、被锁定/禁用自动恢复 */
  demoLogin(): Promise<LoginResult> {
    return post('/admin/auth/demo-login')
  },

  /** 获取当前用户信息（统一 JWT，复用 /admin/auth/me；原 /store/me 后端无此路由，登录态拉取会 404 踢回登录页） */
  getProfile(): Promise<ProfileResult> {
    return get('/admin/auth/me')
  },

  /** 修改密码（暂用admin端点，若后端补齐store端点后替换） */
  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return post('/admin/auth/change-password', { oldPassword, newPassword })
  },

  /** 发送注册短信验证码 */
  sendSmsCode(params: SendSmsCodeParams): Promise<any> {
    return post('/store/members/sms-code', params)
  },

  /** 双因素认证：登录二次验证（MFA 挑战令牌 + 动态码 → 完整登录结果） */
  verifyMfa(mfaToken: string, code: string): Promise<LoginResult> {
    return post('/admin/auth/mfa/verify', { mfaToken, code })
  },

  /** 获取当前用户 MFA 状态 */
  getMfaStatus(): Promise<{ enabled: boolean; hasSecret: boolean }> {
    return get('/admin/auth/mfa/status')
  },

  /** 发起 MFA 绑定（返回 secret 与 otpauth 地址） */
  setupMfa(): Promise<{ secret: string; otpauthUrl: string; enabled: boolean }> {
    return post('/admin/auth/mfa/setup', {})
  },

  /** 确认 MFA 绑定 */
  confirmMfa(code: string): Promise<{ enabled: boolean }> {
    return post('/admin/auth/mfa/confirm', { code })
  },

  /** 关闭 MFA */
  disableMfa(code: string): Promise<{ enabled: boolean }> {
    return post('/admin/auth/mfa/disable', { code })
  },

  /** 租户注册申请 */
  register(params: TenantRegisterParams): Promise<{ applicationId: number; message: string }> {
    return post('/tenant/register', params)
  }
}

export { authApi }
