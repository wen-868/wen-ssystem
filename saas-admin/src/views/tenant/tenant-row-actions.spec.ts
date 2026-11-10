/**
 * TOTAL-PLATFORM-RBAC-UI-COUPLING-01 · 租户行动作角色收敛契约测试
 *
 * 被测：views/tenant/tenant-row-actions.ts 导出的纯函数族
 *   （isTenantWriteAllowed / tenantRowActions / guardTenantWrite / TENANT_WRITE_KEYS）。
 *
 * 防线：
 *  R1-R6   写权限判定唯一真源：仅 SUPER 系为 true；SUPPORT/未知/null fail-closed
 *  A1-A6   行动作按角色收敛：SUPER 保留写动作；SUPPORT/未知/null 只读不回退
 *  G1-G4   handler 二次防线：写动作在非超管时被拦（写 API 零调用的判定依据）
 *
 * 环境：node（纯函数，无 DOM 依赖）。
 */
import { describe, expect, it } from 'vitest'
import {
  isTenantWriteAllowed,
  tenantRowActions,
  guardTenantWrite,
  TENANT_WRITE_KEYS,
} from './tenant-row-actions'

const ACTIVE_ROW = { status: 'ACTIVE' }
const DISABLED_ROW = { status: 'DISABLED' }
const WEIRD_ROW = { status: 1 } // 历史表 TINYINT 存量数据

/** 行内写动作键（启停/续费/代登录/导出/重置）——SUPPORT 下一个都不允许出现 */
const ROW_WRITE_KEYS = ['freeze', 'unfreeze', 'renew', 'proxy', 'export', 'reset']

describe('R1 写权限判定 isTenantWriteAllowed（唯一真源）', () => {
  it('R1-1 PLATFORM_SUPER_ADMIN 拥有写权限', () => {
    expect(isTenantWriteAllowed('PLATFORM_SUPER_ADMIN')).toBe(true)
  })
  it('R1-2 SUPER_ADMIN 拥有写权限（与 backend PLATFORM_SUPER_ROLES 逐字同口径）', () => {
    expect(isTenantWriteAllowed('SUPER_ADMIN')).toBe(true)
  })
  it('R1-3 SUPPORT 无写权限（tenant 域只读白名单不等于可写）', () => {
    expect(isTenantWriteAllowed('SUPPORT')).toBe(false)
  })
  it('R1-4 PLATFORM_SUPPORT（历史别名码）同样 fail-closed', () => {
    expect(isTenantWriteAllowed('PLATFORM_SUPPORT')).toBe(false)
  })
  it('R1-5 PLATFORM_ADMIN（普通平台管理员）无写权限', () => {
    expect(isTenantWriteAllowed('PLATFORM_ADMIN')).toBe(false)
  })
  it('R1-6 未知角色码 / null / undefined / 空串一律 fail-closed', () => {
    expect(isTenantWriteAllowed('SOMETHING_ELSE')).toBe(false)
    expect(isTenantWriteAllowed(null)).toBe(false)
    expect(isTenantWriteAllowed(undefined)).toBe(false)
    expect(isTenantWriteAllowed('')).toBe(false)
  })
})

describe('R2 行动作收敛 tenantRowActions', () => {
  it('R2-1 SUPER + ACTIVE：启停/续费/代登录/导出/重置写动作全部保留', () => {
    const keys = tenantRowActions('PLATFORM_SUPER_ADMIN', ACTIVE_ROW).map((a) => a.key)
    for (const k of ['freeze', 'renew', 'proxy', 'export', 'reset']) expect(keys).toContain(k)
    expect(keys).not.toContain('unfreeze') // ACTIVE 行只有「停用」分支，无「启用」
  })
  it('R2-2 SUPER + DISABLED：只有「启用」（unfreeze），不出「停用」（freeze）', () => {
    const keys = tenantRowActions('SUPER_ADMIN', DISABLED_ROW).map((a) => a.key)
    expect(keys).toContain('unfreeze')
    expect(keys).not.toContain('freeze')
  })
  it('R2-3 SUPPORT + ACTIVE：写动作全部不渲染（写 API 零调用的 UI 前提）', () => {
    const keys = tenantRowActions('SUPPORT', ACTIVE_ROW).map((a) => a.key)
    for (const k of ROW_WRITE_KEYS) expect(keys).not.toContain(k)
  })
  it('R2-4 SUPPORT + DISABLED：不渲染「启用」（unfreeze）', () => {
    const keys = tenantRowActions('SUPPORT', DISABLED_ROW).map((a) => a.key)
    expect(keys).not.toContain('unfreeze')
  })
  it('R2-5 未知角色 / null role fail-closed：ACTIVE 行也只出只读动作', () => {
    for (const role of ['MYSTERY_ROLE', null, undefined]) {
      const keys = tenantRowActions(role, ACTIVE_ROW).map((a) => a.key)
      for (const k of ROW_WRITE_KEYS) expect(keys).not.toContain(k)
    }
  })
  it('R2-6 只读能力不回退：任何角色（含 null）都保留 详情+概况 入口', () => {
    for (const role of ['PLATFORM_SUPER_ADMIN', 'SUPPORT', 'MYSTERY_ROLE', null]) {
      const keys = tenantRowActions(role, ACTIVE_ROW).map((a) => a.key)
      expect(keys).toContain('detail')
      expect(keys).toContain('overview')
    }
  })
  it('R2-7 历史数值状态（TINYINT 1）按存量口径正常渲染，不抛异常', () => {
    const keys = tenantRowActions('SUPER_ADMIN', WEIRD_ROW).map((a) => a.key)
    expect(keys).toContain('detail')
    expect(keys).not.toContain('freeze') // 非 ACTIVE/DISABLED 字符串枚举 → 只读分支
  })
})

describe('R3 handler 二次防线 guardTenantWrite（写 API 零调用的最终判定）', () => {
  it('R3-1 SUPPORT 调写动作（freeze）被拦：返回 false ⇒ handler 绝不发写 API', () => {
    expect(guardTenantWrite('SUPPORT', 'freeze')).toBe(false)
  })
  it('R3-2 SUPPORT 调 unfreeze / proxyLogin / expand / resetUserPassword 同样被拦', () => {
    for (const k of ['unfreeze', 'proxyLogin', 'expand', 'resetUserPassword', 'editTenant', 'create']) {
      expect(guardTenantWrite('SUPPORT', k)).toBe(false)
    }
  })
  it('R3-3 null role 调任何写动作都被拦（覆盖按钮残留/事件绑定绕过）', () => {
    for (const k of TENANT_WRITE_KEYS) {
      expect(guardTenantWrite(null, k)).toBe(false)
    }
  })
  it('R3-4 只读动作（detail/overview）不受防线影响，任何角色都放行', () => {
    expect(guardTenantWrite('SUPPORT', 'detail')).toBe(true)
    expect(guardTenantWrite(null, 'overview')).toBe(true)
  })
  it('R3-5 SUPER 系对全部写动作放行（正常路径不被误伤）', () => {
    for (const k of TENANT_WRITE_KEYS) {
      expect(guardTenantWrite('PLATFORM_SUPER_ADMIN', k)).toBe(true)
      expect(guardTenantWrite('SUPER_ADMIN', k)).toBe(true)
    }
  })
})
