import { describe, expect, it, vi } from 'vitest'
import {
  buildResetConfirmText,
  describeResetError,
  extractInitialPassword,
  normalizeTenantUsers,
  performTenantUserReset,
  resolveUserListState,
  roleLabel,
  statusLabel,
  unwrapApiData,
} from './tenant-account-reset'

/**
 * S3-173 ③ 单测：平台侧「重置该账号口令」的纯逻辑 + 流程（真断言，不用快照）。
 * 覆盖三件必须为真的事：
 *   ① 列表归一化：兼容多种信封；缺 userId / username 的行必须丢弃（不得打错人）；
 *   ② 成功路径：只有真拿到一次性初始口令才算成功（可展示）；
 *   ③ 失败路径：4xx / 业务码失败 / 成功但无口令 ⇒ 一律 ok:false，且带后端中文原因，不假装成功。
 */

function httpError(status: number, body: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: body },
  })
}

describe('S3-173 ③ · 账号列表归一化', () => {
  it('unwrapApiData 兼容 { code, msg, data } 信封与裸数据', () => {
    expect(unwrapApiData({ code: '0', msg: '成功', data: { records: [] } })).toEqual({ records: [] })
    expect(unwrapApiData([1, 2])).toEqual([1, 2])
    expect(unwrapApiData(null)).toBeNull()
  })

  it('兼容 records / list / items / users 四种列表字段与裸数组', () => {
    const one = [{ userId: 7, username: 'boss', realName: '老板', role: 'SUPER_ADMIN', status: 'ACTIVE' }]
    for (const key of ['records', 'list', 'items', 'users']) {
      expect(normalizeTenantUsers({ [key]: one })).toHaveLength(1)
    }
    expect(normalizeTenantUsers({ data: { records: one } })).toHaveLength(1)
    expect(normalizeTenantUsers(one)).toHaveLength(1)
  })

  it('字段映射：real_name / role_code / 数字状态都要认得，角色码翻中文', () => {
    const rows = normalizeTenantUsers({
      records: [
        { id: 3, username: 'store_manager', real_name: '默认店长', role_code: 'STORE_MANAGER', status: 1 },
      ],
    })
    expect(rows).toEqual([
      { userId: 3, username: 'store_manager', realName: '默认店长', roleLabel: '店长', statusLabel: '正常' },
    ])
    expect(roleLabel('STORE_OPERATOR')).toBe('店员')
    expect(roleLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
    expect(roleLabel(undefined)).toBe('—')
    expect(statusLabel(0)).toBe('已停用')
    expect(statusLabel(undefined)).toBe('—')
  })

  it('缺 userId 或缺 username 的行必须丢弃（宁缺勿造，避免重置打错人）', () => {
    const rows = normalizeTenantUsers({
      records: [
        { userId: 1, username: 'a' },
        { username: 'no-id' },
        { userId: 2 },
        { userId: 3, username: '' },
        'not-an-object',
      ],
    })
    expect(rows.map((r) => r.username)).toEqual(['a'])
  })

  it('空集 / 异常负载 ⇒ []（空态而非假数据）', () => {
    expect(normalizeTenantUsers({ records: [] })).toEqual([])
    expect(normalizeTenantUsers(undefined)).toEqual([])
    expect(normalizeTenantUsers({ records: 'nope' })).toEqual([])
  })

  it('四态互斥：错误态优先于空态，加载态优先于两者', () => {
    expect(resolveUserListState({ loading: true, error: 'x', rows: [] })).toBe('loading')
    expect(resolveUserListState({ loading: false, error: '接口未就绪', rows: [] })).toBe('error')
    expect(resolveUserListState({ loading: false, error: '', rows: [] })).toBe('empty')
    expect(
      resolveUserListState({
        loading: false,
        error: '',
        rows: [{ userId: 1, username: 'a', realName: 'A', roleLabel: '—', statusLabel: '—' }],
      })
    ).toBe('ready')
  })

  it('二次确认文案写明「旧口令立即失效 + 只展示一次」', () => {
    const text = buildResetConfirmText({ realName: '默认店长', username: 'store_manager' })
    expect(text).toContain('默认店长（store_manager）')
    expect(text).toContain('旧口令立即失效')
    expect(text).toContain('展示一次')
  })
})

describe('S3-173 ③ · 重置口令流程（可注入 mock 后端）', () => {
  it('成功：返回一次性初始口令 ⇒ ok:true 且带口令（这就是页面要展示的那一个）', async () => {
    const reset = vi.fn().mockResolvedValue({
      code: '0',
      msg: '成功',
      data: { userId: 9, username: 'store_manager', initialPassword: 'Abc12345!' },
    })
    const outcome = await performTenantUserReset({ reset }, 'T001', 9)
    expect(outcome).toEqual({ ok: true, initialPassword: 'Abc12345!' })
    expect(reset).toHaveBeenCalledWith('T001', 9)
  })

  it('裸 data / 兼容字段名（initial_password / password）也能取到口令', async () => {
    expect(extractInitialPassword({ initialPassword: 'P@ssw0rd1' })).toBe('P@ssw0rd1')
    expect(extractInitialPassword({ data: { initial_password: 'P@ssw0rd2' } })).toBe('P@ssw0rd2')
    expect(extractInitialPassword({ data: { password: 'P@ssw0rd3' } })).toBe('P@ssw0rd3')
    expect(extractInitialPassword({ data: { userId: 1 } })).toBe('')
  })

  it('4xx（跨租户 / 找不到账号）⇒ ok:false 且原样带后端中文原因，不弹成功', async () => {
    const reset = vi.fn().mockRejectedValue(
      httpError(400, { code: '400', msg: '该租户下不存在该账号' })
    )
    const outcome = await performTenantUserReset({ reset }, 'T001', 999)
    expect(outcome.ok).toBe(false)
    expect(outcome.initialPassword).toBeUndefined()
    expect(outcome.errorText).toBe('该租户下不存在该账号')
  })

  it('403 / 404 / 无中文体 ⇒ 退回共享状态码文案（绝不上屏英文原文）', async () => {
    expect(describeResetError(httpError(403, { code: '403', msg: '' }))).toBe('当前账号没有该操作权限')
    expect(describeResetError(httpError(404, {}))).toBe('请求的数据不存在或已被删除')
    const reset = vi.fn().mockRejectedValue(
      Object.assign(new Error('Request failed with status code 400'), { response: { status: 400 } })
    )
    const outcome = await performTenantUserReset({ reset }, 'T001', 1)
    expect(outcome.ok).toBe(false)
    expect(outcome.errorText).toBe('请求参数有误，请检查后重试')
  })

  it('断网（无响应）⇒ ok:false，不假装成功', async () => {
    const reset = vi.fn().mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
    const outcome = await performTenantUserReset({ reset }, 'T001', 1)
    expect(outcome).toEqual({ ok: false, errorText: '网络连接失败，请检查网络设置' })
  })

  it('后端「成功」却没给口令 ⇒ 判失败并写明原因（不得展示空口令冒充成功）', async () => {
    const reset = vi.fn().mockResolvedValue({ code: '0', msg: '成功', data: { userId: 9 } })
    const outcome = await performTenantUserReset({ reset }, 'T001', 9)
    expect(outcome.ok).toBe(false)
    expect(outcome.initialPassword).toBeUndefined()
    expect(outcome.errorText).toContain('未返回初始口令')
  })
})
