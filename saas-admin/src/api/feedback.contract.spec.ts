/**
 * 页面反馈域契约测试（TOTAL-PLATFORM-UI-FEEDBACK-POLISH-01）
 * 真源：src/api/feedback.ts（纯函数，node 环境直接可测）
 * 覆盖：错误分类 / 文案区分度与安全 / 状态机（防重复、保留旧数据、恢复清残留）/ ARIA 语义
 */
import { describe, it, expect } from 'vitest'
import {
  classifyFeedbackError,
  feedbackErrorText,
  feedbackTextIsSafe,
  initialLoadFeedbackState,
  loadFeedbackReduce,
  canRetryFeedback,
  feedbackBusyOf,
  feedbackLiveRoleOf,
  FEEDBACK_ERROR_TEXT,
} from './feedback'

describe('F1 错误分类 classifyFeedbackError', () => {
  it('F1-1 axios 超时（ECONNABORTED）归为 timeout', () => {
    expect(classifyFeedbackError({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' })).toBe('timeout')
  })
  it('F1-2 底层 ETIMEDOUT 同样归为 timeout', () => {
    expect(classifyFeedbackError({ code: 'ETIMEDOUT' })).toBe('timeout')
  })
  it('F1-3 网络层失败（带 code 无 response）归为 offline', () => {
    expect(classifyFeedbackError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe('offline')
  })
  it('F1-4 HTTP 403 必须独立归为 forbidden（不得吞成通用失败）', () => {
    expect(classifyFeedbackError({ response: { status: 403 } })).toBe('forbidden')
  })
  it('F1-5 5xx 族（500/502/503）归为 server，与空态语义无关', () => {
    expect(classifyFeedbackError({ response: { status: 500 } })).toBe('server')
    expect(classifyFeedbackError({ response: { status: 502 } })).toBe('server')
    expect(classifyFeedbackError({ response: { status: 503 } })).toBe('server')
  })
  it('F1-6 其他 4xx（404 等）归为 http', () => {
    expect(classifyFeedbackError({ response: { status: 404 } })).toBe('http')
  })
  it('F1-7 业务失败（拦截器 reject 的纯 Error，无 code 无 response）归为 biz', () => {
    expect(classifyFeedbackError(new Error('租户不存在'))).toBe('biz')
  })
})

describe('F2 错误文案 feedbackErrorText：区分度与安全', () => {
  it('F2-1 六类文案两两互不相同（操作者可区分超时/断网/故障/无权限）', () => {
    const texts = Object.values(FEEDBACK_ERROR_TEXT)
    expect(new Set(texts).size).toBe(texts.length)
    for (const t of texts) expect(t.length).toBeGreaterThan(0)
  })
  it('F2-2 500 的文案必须是服务故障语义，绝不是「无数据/暂无」', () => {
    const text = feedbackErrorText({ response: { status: 500 } })
    expect(text).toBe(FEEDBACK_ERROR_TEXT.server)
    expect(text).not.toMatch(/暂无|无数据|没有数据/)
  })
  it('F2-3 forbidden 文案安全：不含内部权限码/表名/令牌片段', () => {
    const text = feedbackErrorText({ response: { status: 403 } })
    expect(text).toBe(FEEDBACK_ERROR_TEXT.forbidden)
    expect(feedbackTextIsSafe(text)).toBe(true)
  })
  it('F2-4 biz 类取后端中文原因（截断 120 字符）', () => {
    const msg = '欠费租户暂不可执行该操作'.repeat(10)
    const text = feedbackErrorText(new Error(msg))
    expect(text.length).toBeLessThanOrEqual(120)
    expect(text.startsWith('欠费租户')).toBe(true)
  })
  it('F2-5 biz 类空 message 时用兜底文案，绝不上屏空串或英文原文', () => {
    expect(feedbackErrorText(new Error(''))).not.toBe('')
    expect(feedbackErrorText(new Error('Request failed'))).not.toMatch(/Request failed/)
  })
  it('F2-6 任何文案都过安全防线：含表名/权限码的输入被替换为兜底', () => {
    expect(feedbackTextIsSafe('SELECT * FROM t_platform_admin')).toBe(false)
    expect(feedbackTextIsSafe('role=PLATFORM_SUPER_ADMIN')).toBe(false)
    expect(feedbackErrorText(new Error('SELECT * FROM t_platform_admin'))).not.toMatch(/t_platform/i)
  })
})

describe('F3 状态机 loadFeedbackReduce', () => {
  const serverErr = { response: { status: 500 } }

  it('F3-1 begin 进入 loading 且保留 stale（刷新中旧数据仍在）', () => {
    const s = loadFeedbackReduce({ ...initialLoadFeedbackState(), phase: 'ready', stale: true }, { type: 'begin' })
    expect(s.phase).toBe('loading')
    expect(s.stale).toBe(true)
    expect(s.kind).toBeNull()
  })
  it('F3-2 success(hasData) 回 ready 并清残留（recovered：kind/message/stale 全归零）', () => {
    const failed = loadFeedbackReduce(initialLoadFeedbackState(), { type: 'fail', err: serverErr, hasStaleData: false })
    const ok = loadFeedbackReduce(failed, { type: 'success', hasData: true })
    expect(ok).toEqual({ phase: 'ready', kind: null, message: null, stale: false })
  })
  it('F3-3 success(!hasData) 进 empty——空态与错误态不同形', () => {
    const ok = loadFeedbackReduce(initialLoadFeedbackState(), { type: 'success', hasData: false })
    expect(ok.phase).toBe('empty')
    expect(ok.phase).not.toBe('error')
  })
  it('F3-4 无旧数据时 fail 进 error：带分类与文案（不与空态混同）', () => {
    const s = loadFeedbackReduce(initialLoadFeedbackState(), { type: 'fail', err: serverErr, hasStaleData: false })
    expect(s.phase).toBe('error')
    expect(s.kind).toBe('server')
    expect(s.message).toBe(FEEDBACK_ERROR_TEXT.server)
  })
  it('F3-5 有旧数据时刷新失败：保留旧数据语义（ready + stale + 刷新失败文案）', () => {
    const s = loadFeedbackReduce({ ...initialLoadFeedbackState(), phase: 'ready' }, { type: 'fail', err: { code: 'ECONNABORTED' }, hasStaleData: true })
    expect(s.phase).toBe('ready')
    expect(s.stale).toBe(true)
    expect(s.kind).toBe('timeout')
    expect(s.message).toContain('请求超时')
  })
  it('F3-6 loading 期间 retry 是 no-op（防重复点击，引用不变）', () => {
    const loading = loadFeedbackReduce(initialLoadFeedbackState(), { type: 'begin' })
    expect(loadFeedbackReduce(loading, { type: 'retry' })).toBe(loading)
  })
  it('F3-7 error 态 retry 回 loading（页面内重试入口生效）', () => {
    const err = loadFeedbackReduce(initialLoadFeedbackState(), { type: 'fail', err: serverErr, hasStaleData: false })
    const s = loadFeedbackReduce(err, { type: 'retry' })
    expect(s.phase).toBe('loading')
    expect(s.kind).toBeNull()
  })
  it('F3-8 刷新失败（ready+stale）态 retry 同样回 loading', () => {
    const stale = loadFeedbackReduce({ ...initialLoadFeedbackState(), phase: 'ready' }, { type: 'fail', err: serverErr, hasStaleData: true })
    expect(loadFeedbackReduce(stale, { type: 'retry' }).phase).toBe('loading')
  })
  it('F3-9 恢复后清残留：失败→成功后 stale 必须归零（recovered）', () => {
    const stale = loadFeedbackReduce({ ...initialLoadFeedbackState(), phase: 'ready' }, { type: 'fail', err: serverErr, hasStaleData: true })
    expect(stale.stale).toBe(true)
    const ok = loadFeedbackReduce(stale, { type: 'success', hasData: true })
    expect(ok.stale).toBe(false)
    expect(ok.message).toBeNull()
  })
  it('F3-10 ready 且无 stale 时 retry 是 no-op（正常数据不误触发重载）', () => {
    const ready = loadFeedbackReduce(initialLoadFeedbackState(), { type: 'success', hasData: true })
    expect(loadFeedbackReduce(ready, { type: 'retry' })).toBe(ready)
  })
})

describe('F4 ARIA / 键盘可操作语义', () => {
  it('F4-1 aria-busy 仅在 loading 为 true', () => {
    expect(feedbackBusyOf(initialLoadFeedbackState())).toBe(true)
    expect(feedbackBusyOf({ phase: 'ready', kind: null, message: null, stale: false })).toBe(false)
  })
  it('F4-2 错误与数据过期用 assertive（打断播报），刷新中用 polite（aria-live 合法值）', () => {
    expect(feedbackLiveRoleOf({ phase: 'error', kind: 'server', message: null, stale: false })).toBe('assertive')
    expect(feedbackLiveRoleOf({ phase: 'ready', kind: null, message: null, stale: true })).toBe('assertive')
    expect(feedbackLiveRoleOf({ phase: 'loading', kind: null, message: null, stale: true })).toBe('polite')
  })
  it('F4-3 canRetryFeedback 只认 error / stale（重试中不再可触发）', () => {
    expect(canRetryFeedback({ phase: 'error', kind: null, message: null, stale: false })).toBe(true)
    expect(canRetryFeedback({ phase: 'ready', kind: null, message: null, stale: true })).toBe(true)
    expect(canRetryFeedback({ phase: 'loading', kind: null, message: null, stale: false })).toBe(false)
    expect(canRetryFeedback({ phase: 'ready', kind: null, message: null, stale: false })).toBe(false)
  })
})
