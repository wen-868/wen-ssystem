/**
 * 平台 RBAC 前端闭环契约测试（TOTAL-PLATFORM-SERVER-SIDE-RBAC-01-UI-01）
 *
 * 真源：
 *  - src/config/platform-menu.ts  → canWritePlatformTenant / tenantRowActions（角色判定纯函数）
 *  - src/api/feedback.ts          → classifyFeedbackError / 文案（既有反馈契约，本卡不弱化）
 *  - src/utils/http-error.ts      → resolveHttpErrorText（旧客户端中文文案）
 *  - src/api.ts                   → 主实例 timeout（源码契约）
 *  - TenantList.vue / TenantDetail.vue → 所有写入口二次守卫（源码契约）
 *
 * ⚠️ 前端隐藏绝不替代服务端 403；本文件只证明交互收敛与分类契约成立。
 * mutation 反测（timeout 删除 / timeout 误分类 / SUPPORT 写动作恢复 / 未知角色 fail-open）
 * 由仓外 RBAC-UI-01-verify/mutate.cjs 注入并点名本文件判红。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PLATFORM_SUPER_ROLES,
  canWritePlatformTenant,
  allTenantRowActions,
  tenantRowActions,
} from '../../config/platform-menu'
import {
  classifyFeedbackError,
  feedbackErrorText,
  FEEDBACK_ERROR_TEXT,
} from '../../api/feedback'
import { resolveHttpErrorText, HTTP_STATUS_TEXT } from '../../utils/http-error'

const source = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')
const apiTs = () => source('../../api.ts')
const feedbackTs = () => source('../../api/feedback.ts')
const listVue = () => source('./TenantList.vue')
const detailVue = () => source('./TenantDetail.vue')

const WRITE_KEYS = ['freeze', 'unfreeze', 'renew', 'proxy', 'export', 'reset']

describe('R1 · canWritePlatformTenant：真实 role，fail-closed', () => {
  it('R1-1 两个超管角色码放行（与服务端 PLATFORM_SUPER_ROLES 同口径）', () => {
    expect(canWritePlatformTenant('PLATFORM_SUPER_ADMIN')).toBe(true)
    expect(canWritePlatformTenant('SUPER_ADMIN')).toBe(true)
    expect([...PLATFORM_SUPER_ROLES].sort()).toEqual(
      ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].sort(),
    )
  })

  it('R1-2 SUPPORT 一律拒绝', () => {
    expect(canWritePlatformTenant('SUPPORT')).toBe(false)
    expect(canWritePlatformTenant('PLATFORM_SUPPORT')).toBe(false)
  })

  it('R1-3 其他 / 未知 / null / undefined / 空串一律拒绝（fail-closed）', () => {
    for (const role of ['PLATFORM_ADMIN', 'GUEST', '', null, undefined]) {
      expect(canWritePlatformTenant(role)).toBe(false)
    }
  })

  it('R1-4 小写超管码不得被误放（前端不自行归一化，取 /me 真实值）', () => {
    expect(canWritePlatformTenant('platform_super_admin')).toBe(false)
    expect(canWritePlatformTenant('super_admin')).toBe(false)
  })
})

describe('R2 · tenantRowActions：非超管不渲染任何写动作，读动作不误伤', () => {
  it('R2-1 SUPER + ACTIVE 保留全部写动作与两个读动作', () => {
    const keys = tenantRowActions('PLATFORM_SUPER_ADMIN', 'ACTIVE').map((a) => a.key)
    expect(keys).toContain('freeze')
    expect(keys).toContain('renew')
    expect(keys).toContain('detail')
    expect(keys).toContain('overview')
    expect(keys.length).toBe(7)
  })

  it('R2-2 SUPER + DISABLED 保留启用（unfreeze）', () => {
    expect(tenantRowActions('SUPER_ADMIN', 'DISABLED').map((a) => a.key)).toContain('unfreeze')
  })

  it('R2-3 SUPPORT + ACTIVE 零写动作，仅保留详情 / 概况', () => {
    const actions = tenantRowActions('SUPPORT', 'ACTIVE')
    expect(actions.filter((a) => a.write)).toHaveLength(0)
    expect(actions.map((a) => a.key)).toEqual(['detail', 'overview'])
  })

  it('R2-4 SUPPORT + DISABLED 同样不得出现启用按钮', () => {
    expect(tenantRowActions('SUPPORT', 'DISABLED').map((a) => a.key)).not.toContain('unfreeze')
  })

  it('R2-5 未知 / null / 空角色 ACTIVE 均 fail-closed', () => {
    for (const role of ['SOMETHING_NEW', null, undefined, '']) {
      expect(tenantRowActions(role, 'ACTIVE').filter((a) => a.write)).toHaveLength(0)
    }
  })

  it('R2-6 六个写 key 在 SUPPORT 下全部不出现', () => {
    const keys = tenantRowActions('SUPPORT', 'ACTIVE').map((a) => a.key)
    for (const k of WRITE_KEYS) expect(keys).not.toContain(k)
  })

  it('R2-7 未知状态（EXPIRED）任意角色只给读动作，不自造状态分支', () => {
    expect(allTenantRowActions('EXPIRED').map((a) => a.key)).toEqual(['detail', 'overview'])
    expect(tenantRowActions('SUPPORT', 'EXPIRED').map((a) => a.key)).toEqual([
      'detail',
      'overview',
    ])
  })

  it('R2-8 收敛返回新数组，不污染全量动作真源', () => {
    const before = allTenantRowActions('ACTIVE').map((a) => a.key)
    const filtered = tenantRowActions('SUPPORT', 'ACTIVE')
    filtered.push({ key: 'injected', label: '注入', cls: '', write: true })
    expect(allTenantRowActions('ACTIVE').map((a) => a.key)).toEqual(before)
  })
})

describe('R3 · 主实例 timeout 与错误分类（网络 ≠ 超时，403 独立）', () => {
  it('R3-1 api.ts 声明 15000ms 常量并接入 axios.create', () => {
    const text = apiTs()
    expect(text).toMatch(/export const API_TIMEOUT_MS = 15000/)
    expect(text).toMatch(/timeout:\s*API_TIMEOUT_MS/)
    expect(text).toMatch(/axios\.create\(\{[\s\S]{0,200}timeout:\s*API_TIMEOUT_MS/)
  })

  it('R3-2 ECONNABORTED 经既有反馈契约归为 timeout', () => {
    expect(classifyFeedbackError({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' })).toBe(
      'timeout',
    )
    expect(feedbackErrorText({ code: 'ECONNABORTED' })).toBe(FEEDBACK_ERROR_TEXT.timeout)
  })

  it('R3-3 ETIMEDOUT 同样归为 timeout', () => {
    expect(classifyFeedbackError({ code: 'ETIMEDOUT' })).toBe('timeout')
  })

  it('R3-4 断网归 offline，且与 timeout 文案可区分', () => {
    expect(classifyFeedbackError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe('offline')
    expect(FEEDBACK_ERROR_TEXT.timeout).not.toBe(FEEDBACK_ERROR_TEXT.offline)
    expect(feedbackErrorText({ code: 'ERR_NETWORK' })).not.toBe(
      feedbackErrorText({ code: 'ECONNABORTED' }),
    )
  })

  it('R3-5 旧客户端中文文案同样区分超时与断网，且绝不上屏英文原文', () => {
    const timeout = resolveHttpErrorText({ code: 'ECONNABORTED' })
    const offline = resolveHttpErrorText({})
    expect(timeout).not.toBe(offline)
    expect(timeout).not.toMatch(/timeout of|ECONNABORTED/)
    expect(offline).not.toMatch(/Network Error/)
  })

  it('R3-6 403 保持 forbidden 语义，不吞成空态或业务失败', () => {
    expect(classifyFeedbackError({ response: { status: 403 } })).toBe('forbidden')
    expect(FEEDBACK_ERROR_TEXT.forbidden).not.toBe(FEEDBACK_ERROR_TEXT.server)
    expect(HTTP_STATUS_TEXT[403]).toContain('权限')
  })

  it('R3-7 feedback.ts 仍保留 ECONNABORTED / ETIMEDOUT 双判据（防误分类 mutation）', () => {
    const text = feedbackTs()
    expect(text).toContain("e.code === 'ECONNABORTED'")
    expect(text).toContain("e.code === 'ETIMEDOUT'")
    expect(text).toMatch(/\/timeout\/i\.test/)
  })
})

describe('R4 · Vue 写入口二次守卫源码契约（防 SUPPORT 写动作恢复）', () => {
  it('R4-1 TenantList 接线角色真源并使用 tenantRowActions', () => {
    const text = listVue()
    expect(text).toContain('canWritePlatformTenant(viewerRole.value)')
    expect(text).toContain('tenantRowActions(viewerRole.value, row.status)')
    expect(text).toContain('guardWrite()')
  })

  it('R4-2 TenantList 写按钮全部 v-if="canWrite" 收敛', () => {
    const text = listVue()
    expect((text.match(/v-if="canWrite"/g) || []).length).toBeGreaterThanOrEqual(6)
    expect(text).toContain('<span v-else-if="canWrite" class="btn-t" @click="onEdit">编辑</span>')
  })

  it('R4-3 TenantList 所有写函数入口都有二次守卫', () => {
    const text = listVue()
    // 8 个写函数各一处 + onRowAction 的读动作豁免守卫（形态不同，单独断言）
    expect((text.match(/if \(guardWrite\(\)\) return/g) || []).length).toBeGreaterThanOrEqual(8)
    expect(text).toContain("key !== 'detail' && key !== 'overview' && guardWrite()")
  })

  it('R4-4 TenantDetail 页头写按钮收敛并改走带守卫的弹窗入口', () => {
    const text = detailVue()
    expect(text).toContain('@click="openProxyDialog"')
    expect(text).toContain('@click="openResetDialog"')
    expect(text).toContain('@click="openExportDialog"')
    expect((text.match(/v-if="canWrite"/g) || []).length).toBeGreaterThanOrEqual(9)
  })

  it('R4-5 TenantDetail 所有写函数入口都有二次守卫', () => {
    const text = detailVue()
    expect((text.match(/if \(guardWrite\(\)\) return/g) || []).length).toBeGreaterThanOrEqual(11)
    for (const fn of [
      'onSubmitProxy',
      'onConfirmReset',
      'onCreateExport',
      'onRenew',
      'onFreeze',
      'onResetUserPassword',
      'onSubmitExpand',
      'onExpandQuota',
    ]) {
      expect(text).toMatch(new RegExp(`${fn}\\([^)]*\\)\\s*\\{\\s*\\r?\\n\\s*if \\(guardWrite\\(\\)\\) return`))
    }
  })

  it('R4-6 两页读入口未加守卫（五域白名单读取不误伤）', () => {
    expect(listVue()).toContain('function fetchList()')
    expect(detailVue()).toContain('async function fetchDetail()')
    expect(listVue()).not.toContain('fetchList() {\n  if (guardWrite()) return')
  })
})
