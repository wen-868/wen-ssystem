/**
 * MFA-CHALLENGE-UI-01 · MFA 挑战域契约测试
 *
 * 被测：api/auth.ts 导出的 MFA 挑战纯函数族（mfaRequiredOf / mfaCodeIsValid /
 * mfaErrorText / mfaErrorTextIsSafe / mfaChallengeReduce / initialMfaChallengeState）。
 * 防线：
 *  T1-T3  mfaToken 绝不冒充登录态（严格判定）
 *  T4-T5  动态码格式与初始状态
 *  T6-T9  状态机（enter/submit/防重复提交）
 *  T10-T13  错误文案分类 + 不泄露敏感信息 + 上下文保留
 *
 * 环境：node。
 */
import { describe, expect, it } from 'vitest'
import {
  initialMfaChallengeState,
  mfaChallengeReduce,
  mfaCodeIsValid,
  mfaErrorText,
  mfaErrorTextIsSafe,
  mfaRequiredOf,
} from './auth'

describe('T1-T3 · mfaRequiredOf 严格判定（mfaToken 不冒充登录态）', () => {
  it('T1-1 mfaRequired===true 且 mfaToken 非空 ⇒ true', () => {
    expect(mfaRequiredOf({ mfaRequired: true, mfaToken: 'abc.def.ghi' })).toBe(true)
  })

  it('T1-2 mfaRequired===true 但 mfaToken 缺失/空串 ⇒ false（缺令牌的挑战不成立）', () => {
    expect(mfaRequiredOf({ mfaRequired: true })).toBe(false)
    expect(mfaRequiredOf({ mfaRequired: true, mfaToken: '' })).toBe(false)
    expect(mfaRequiredOf({ mfaRequired: true, mfaToken: 123 })).toBe(false)
  })

  it('T1-3 非 mfaRequired 响应（undefined/null/普通 token 登录）⇒ false', () => {
    expect(mfaRequiredOf(undefined)).toBe(false)
    expect(mfaRequiredOf(null)).toBe(false)
    expect(mfaRequiredOf({ token: 'real-token' })).toBe(false)
    expect(mfaRequiredOf({ mfaRequired: false })).toBe(false)
    // mfaToken 单独出现也不构成挑战（必须与 mfaRequired===true 同时成立）
    expect(mfaRequiredOf({ mfaToken: 'abc' })).toBe(false)
  })
})

describe('T4-T5 · 动态码格式与初始状态', () => {
  it('T4-1 恰 6 位数字合法；5/7 位、含字母、空串、前导零外的非法字符均拒绝', () => {
    expect(mfaCodeIsValid('123456')).toBe(true)
    expect(mfaCodeIsValid('000000')).toBe(true) // 前导零合法（TOTP 口径）
    expect(mfaCodeIsValid('12345')).toBe(false)
    expect(mfaCodeIsValid('1234567')).toBe(false)
    expect(mfaCodeIsValid('12345a')).toBe(false)
    expect(mfaCodeIsValid('')).toBe(false)
    expect(mfaCodeIsValid('12 456')).toBe(false)
  })

  it('T5-1 初始状态：凭据步、无令牌、未提交、无错误、0 次尝试', () => {
    const s = initialMfaChallengeState()
    expect(s).toEqual({ step: 'credentials', mfaToken: '', submitting: false, error: null, attempts: 0 })
  })
})

describe('T6-T9 · 状态机（enter/submit/防重复）', () => {
  it('T6-1 enter：进入挑战步并仅内存持有令牌，错误/尝试归零', () => {
    const s = mfaChallengeReduce(initialMfaChallengeState(), { type: 'enter', mfaToken: 't-1' })
    expect(s.step).toBe('challenge')
    expect(s.mfaToken).toBe('t-1')
    expect(s.error).toBeNull()
    expect(s.attempts).toBe(0)
    expect(s.submitting).toBe(false)
  })

  it('T7-1 submit 有效码：进入 submitting 且清错误（此后才允许发起 verify）', () => {
    let s = mfaChallengeReduce(initialMfaChallengeState(), { type: 'enter', mfaToken: 't-1' })
    s = mfaChallengeReduce(s, { type: 'submit', code: '123456' })
    expect(s.submitting).toBe(true)
    expect(s.error).toBeNull()
  })

  it('T8-1 submit 无效码：不进入 submitting，给出格式文案（不发请求）', () => {
    let s = mfaChallengeReduce(initialMfaChallengeState(), { type: 'enter', mfaToken: 't-1' })
    s = mfaChallengeReduce(s, { type: 'submit', code: '12a456' })
    expect(s.submitting).toBe(false)
    expect(s.error).toBe('请输入 6 位数字动态码')
    expect(s.mfaToken).toBe('t-1') // 上下文不丢
  })

  it('T9-1 submitting 期间再 submit 为 no-op（连点/并发不重复消费验证码；期间即使传入无效码也不得改状态）', () => {
    let s = mfaChallengeReduce(initialMfaChallengeState(), { type: 'enter', mfaToken: 't-1' })
    s = mfaChallengeReduce(s, { type: 'submit', code: '123456' })
    expect(s.submitting).toBe(true)
    // 提交进行中：即便传入（另一个）无效码，也必须完全忽略 —— 否则存在重复 verify 窗口
    const during = mfaChallengeReduce(s, { type: 'submit', code: '12a456' })
    expect(during).toEqual(s)
    expect(during.error).toBeNull()
  })

  it('T9-2 凭据步 submit 为 no-op（挑战未建立时不允许发起 verify）', () => {
    const s = mfaChallengeReduce(initialMfaChallengeState(), { type: 'submit', code: '123456' })
    expect(s.step).toBe('credentials')
    expect(s.submitting).toBe(false)
  })
})

describe('T10-T13 · 失败处理与错误文案（分类 + 不泄露）', () => {
  const entered = () => mfaChallengeReduce(initialMfaChallengeState(), { type: 'enter', mfaToken: 't-secret' })

  it('T10-1 fail：结束 submitting、attempts+1、保留 mfaToken（400 可原地重试）', () => {
    let s = mfaChallengeReduce(entered(), { type: 'submit', code: '123456' })
    s = mfaChallengeReduce(s, { type: 'fail', err: { response: { status: 400 } } })
    expect(s.submitting).toBe(false)
    expect(s.attempts).toBe(1)
    expect(s.mfaToken).toBe('t-secret')
    expect(s.error).toBe('动态码错误或已过期，请核对后重试')
  })

  it('T11-1 401（挑战过期）与超时/网络分别给出可操作文案', () => {
    expect(mfaErrorText({ response: { status: 401 } })).toBe('验证会话已过期，请返回重新登录')
    const timeout = Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' })
    expect(mfaErrorText(timeout)).toBe('请求超时，请检查网络后重试')
    expect(mfaErrorText(new Error('Network Error'))).toBe('网络异常，请稍后重试')
    expect(mfaErrorText('weird')).toBe('验证失败，请稍后重试')
  })

  it('T12-1 任何错误的文案都不泄露敏感片段（令牌/secret/堆栈/密码）', () => {
    const leaky = new Error('JWT mfaToken=abc.def.ghi invalid; stack: at verify (auth.ts:1); secret=ABC234')
    const cases = [
      { response: { status: 400, data: { msg: 'mfaToken=abc Bearer invalid' } } },
      { response: { status: 500 }, message: 'password hash mismatch' },
      leaky,
      'plain string err',
      null,
    ]
    for (const err of cases) {
      const text = mfaErrorText(err)
      expect(mfaErrorTextIsSafe(text)).toBe(true)
    }
  })

  it('T13-1 back 回凭据步并丢弃挑战；success 整体复位（正式 token 落盘由 store 负责）', () => {
    let s = mfaChallengeReduce(entered(), { type: 'submit', code: '123456' })
    s = mfaChallengeReduce(s, { type: 'fail', err: { response: { status: 400 } } })
    s = mfaChallengeReduce(s, { type: 'back' })
    expect(s.step).toBe('credentials')
    expect(s.mfaToken).toBe('')
    expect(s.error).toBeNull()
    expect(s.attempts).toBe(0)
    const done = mfaChallengeReduce(entered(), { type: 'success' })
    expect(done).toEqual(initialMfaChallengeState())
  })
})
