/**
 * S3-173 ③：平台侧「重置该账号口令」——与视图解耦的纯逻辑 + 流程函数（可单测）。
 *
 * 契约（与 docs/tasks/cards/R101-派单-20261007-S3-172.md §一③ 对齐，后端由 S3-172 提供）：
 *   列表：GET  /api/platform/tenants/:tenantId/users
 *   重置：POST /api/platform/tenants/:tenantId/users/:userId/reset-password ⇒ 一次性初始口令
 *
 * 三条硬口径（本单红线）：
 *   ① 成功必须**真的拿到**一次性初始口令才允许展示；后端说成功却没给口令 ⇒ 如实报错，不假装成功；
 *   ② 失败（4xx/5xx/断网）必须原样报出后端中文原因，绝不弹成功；
 *   ③ 列表行缺 userId / username ⇒ 丢弃该行（宁缺勿造）——重置要靠 userId 定位账号，造一个 id 等于打错人。
 */

import { resolveHttpErrorText } from '../../utils/http-error'

export interface TenantUserRow {
  userId: number | string
  username: string
  realName: string
  roleLabel: string
  statusLabel: string
}

export type TenantUserListState = 'loading' | 'error' | 'empty' | 'ready'

export interface ResetApiDeps {
  reset: (tenantId: number | string, userId: number | string) => Promise<unknown>
}

export interface ResetOutcome {
  ok: boolean
  initialPassword?: string
  errorText?: string
}

/** 角色码 → 中文（后端 t_sys_user.role / role_code 的真实取值见 backend/src/shared/seed-data.ts）；未登记的原样显示 */
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  STORE_MANAGER: '店长',
  STORE_OPERATOR: '店员',
}

const ACTIVE_STATUS = new Set(['1', 'ACTIVE', 'TRUE'])
const DISABLED_STATUS = new Set(['0', 'DISABLED', 'FALSE'])

function toText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const p = payload as Record<string, unknown>
  for (const key of ['records', 'list', 'items', 'users', 'rows']) {
    if (Array.isArray(p[key])) return p[key] as unknown[]
  }
  return []
}

/** 解开 { code, msg, data } 信封；裸数据原样返回（后端两套响应风格都兼容） */
export function unwrapApiData(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in (payload as Record<string, unknown>)) {
    return (payload as Record<string, unknown>).data
  }
  return payload
}

export function roleLabel(v: unknown): string {
  const raw = toText(v)
  if (!raw) return '—'
  return ROLE_LABELS[raw.toUpperCase()] || raw
}

export function statusLabel(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const raw = String(v).toUpperCase()
  if (ACTIVE_STATUS.has(raw)) return '正常'
  if (DISABLED_STATUS.has(raw)) return '已停用'
  return String(v)
}

/**
 * 归一化租户账号列表：兼容 { records } / { list } / { items } / { users } / 裸数组。
 * 缺 userId 或缺 username 的行一律丢弃（不得用下标充数）。
 */
export function normalizeTenantUsers(payload: unknown): TenantUserRow[] {
  const rows: TenantUserRow[] = []
  for (const raw of pickList(unwrapApiData(payload))) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const idRaw = r.userId ?? r.user_id ?? r.id
    const username = toText(r.username ?? r.account ?? r.loginName)
    if (idRaw === null || idRaw === undefined || toText(idRaw) === '' || !username) continue
    rows.push({
      userId: typeof idRaw === 'number' ? idRaw : String(idRaw),
      username,
      realName: toText(r.realName ?? r.real_name ?? r.name) || '—',
      roleLabel: roleLabel(r.roleLabel ?? r.roleName ?? r.role ?? r.roleCode ?? r.role_code),
      statusLabel: statusLabel(r.status),
    })
  }
  return rows
}

/** 四态互斥：错误态优先于空态（改错路径必须看得见），加载态优先于两者 */
export function resolveUserListState(input: { loading: boolean; error: string; rows: TenantUserRow[] }): TenantUserListState {
  if (input.loading) return 'loading'
  if (input.error) return 'error'
  return input.rows.length ? 'ready' : 'empty'
}

/** 二次确认文案：必须写明「旧口令立即失效 + 新口令只展示一次」 */
export function buildResetConfirmText(user: Pick<TenantUserRow, 'realName' | 'username'>): string {
  return `确认重置「${user.realName}（${user.username}）」的登录口令？重置后旧口令立即失效，新口令只在提交后展示一次，关闭后不可再查看。`
}

/** 从重置响应里取一次性初始口令（字段名未定死，按后端可能给出的几种命名兼容） */
export function extractInitialPassword(payload: unknown): string {
  const data = unwrapApiData(payload)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ''
  const d = data as Record<string, unknown>
  for (const key of ['initialPassword', 'initial_password', 'password', 'initPassword']) {
    const text = toText(d[key])
    if (text) return text
  }
  return ''
}

/** 纯 ASCII（不含中文）判据：与 utils/http-error.ts 同口径 —— 英文原文一律不上屏 */
const PURE_ASCII = /^[\x20-\x7E]+$/

/**
 * 失败原因（全站唯一来源 utils/http-error.ts）：
 *   · 有 HTTP 响应（4xx/5xx）⇒ 后端中文原因 → 状态码中文文案 → 兜底；
 *   · 无响应但是中文 message ⇒ 业务码失败（request 拦截器 reject 的就是后端中文文案）原样透出；
 *   · 其余（断网 / 超时 / 英文原文）⇒ 共享文案，绝不上屏 "Network Error" 这类英文。
 */
export function describeResetError(error: unknown): string {
  const e = error as { response?: unknown; message?: string } | undefined
  if (!e?.response) {
    const msg = String(e?.message || '').trim()
    if (msg && !PURE_ASCII.test(msg)) return msg
  }
  return resolveHttpErrorText(error, '重置失败，请稍后重试')
}

/**
 * 重置口令流程（组件唯一调用入口，可注入 mock 后端做单测）：
 *   · 成功且拿到一次性口令 ⇒ { ok: true, initialPassword }
 *   · 成功但响应里没有口令 ⇒ { ok: false }（这是后端缺陷，不得假装成功）
 *   · 抛错（4xx/5xx/断网）    ⇒ { ok: false, errorText: 后端中文原因 }
 */
export async function performTenantUserReset(
  deps: ResetApiDeps,
  tenantId: number | string,
  userId: number | string
): Promise<ResetOutcome> {
  try {
    const res = await deps.reset(tenantId, userId)
    const initialPassword = extractInitialPassword(res)
    if (!initialPassword) {
      return { ok: false, errorText: '重置接口未返回初始口令，本次未展示任何口令，请重试或联系后端排查' }
    }
    return { ok: true, initialPassword }
  } catch (e) {
    return { ok: false, errorText: describeResetError(e) }
  }
}
