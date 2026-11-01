/**
 * MENU-ROLE-FILTER-01 · 平台菜单按角色收敛契约测试（G2）
 *
 * 防线：
 *  F1 超管全通（PLATFORM_SUPER_ADMIN / SUPER_ADMIN，与后端 platform-rbac 同口径）
 *  F2 SUPPORT 白名单收敛（差集稳定且非空）
 *  F3 fail-closed（未知角色/role 缺失不放行任何业务域；未知码不伪造文案）
 *  F4 路由域解析全量覆盖（守卫与菜单共用声明；未映射路由不放行）
 *  F5 声明完整性（每个菜单项都有合法 module）
 *
 * 环境：node。被测均为 config/platform-menu.ts 导出的纯函数（菜单过滤与路由守卫共用真源）。
 */
import { describe, expect, it } from 'vitest'
import {
  platformMenus,
  filterPlatformMenusForRole,
  platformRoleAllows,
  resolvePlatformModule,
  PLATFORM_SUPER_ROLES,
  PLATFORM_SUPPORT_MODULES,
  type PlatformModule,
} from './platform-menu'

const allItems = platformMenus.flatMap((g) => g.items)
const visibleTitles = (role: string | null | undefined) =>
  filterPlatformMenusForRole(role).flatMap((g) => g.items.map((i) => i.title))

describe('F1 · 超管全通', () => {
  it('F1-1 PLATFORM_SUPER_ADMIN / SUPER_ADMIN 看到全部 7 组 22 项（原样）', () => {
    for (const role of PLATFORM_SUPER_ROLES) {
      const filtered = filterPlatformMenusForRole(role)
      expect(filtered).toBe(platformMenus)
      expect(visibleTitles(role).length).toBe(allItems.length)
    }
  })

  it('F1-2 platformRoleAllows 超管对任意域放行（含非菜单域 review）', () => {
    for (const role of PLATFORM_SUPER_ROLES) {
      for (const m of ['dashboard', 'tenant', 'billing', 'marketing', 'sysconfig', 'monitor', 'ticket', 'ai', 'open', 'review'] as PlatformModule[]) {
        expect(platformRoleAllows(role, m)).toBe(true)
      }
    }
  })
})

describe('F2 · SUPPORT 白名单收敛（差集稳定且非空）', () => {
  it('F2-1 SUPPORT 可见域恰为白名单（dashboard/tenant/billing/monitor/ticket）', () => {
    const titles = visibleTitles('SUPPORT')
    expect(titles).toContain('运营大盘')
    expect(titles).toContain('租户管理')
    expect(titles).toContain('套餐管理')
    expect(titles).toContain('账单计费')
    expect(titles).toContain('监控告警')
    expect(titles).toContain('日志中心')
    expect(titles).toContain('工单系统')
  })

  it('F2-2 SUPPORT 不可见平台自身管理域（差集非空且可枚举）', () => {
    const titles = visibleTitles('SUPPORT')
    expect(titles).not.toContain('管理员权限')
    expect(titles).not.toContain('系统配置')
    expect(titles).not.toContain('模板中心')
    expect(titles).not.toContain('模型接入')
    expect(titles).not.toContain('API 密钥')
    expect(titles).not.toContain('渠道推广')
    expect(titles).not.toContain('商品库')
    expect(titles).not.toContain('公告管理')
    expect(titles).not.toContain('版本发布')
    // 差集非空：SUPPORT 可见数 < 全量
    expect(titles.length).toBeLessThan(allItems.length)
  })

  it('F2-3 组内条目全被滤掉时整组移除（AI 中心/开放平台组消失，不留空组）', () => {
    const groups = filterPlatformMenusForRole('SUPPORT').map((g) => g.group)
    expect(groups).not.toContain('AI 中心')
    expect(groups).not.toContain('开放平台')
    expect(groups).not.toContain('营销')
    expect(groups).not.toContain('平台')
    expect(groups).toContain('概览')
    expect(groups).toContain('租户')
    expect(groups).toContain('运维')
  })
})

describe('F3 · fail-closed（未知角色/缺失）', () => {
  it('F3-1 role 缺失 → 仅概览组（不全空、不吞错误、不放行业务域）', () => {
    const groups = filterPlatformMenusForRole(null)
    expect(groups.map((g) => g.group)).toEqual(['概览'])
    expect(filterPlatformMenusForRole(undefined).flatMap((g) => g.items.map((i) => i.title))).toEqual(['运营大盘'])
  })

  it('F3-2 未知角色码 → 同样 fail-closed（仅概览）', () => {
    expect(filterPlatformMenusForRole('UNKNOWN_ROLE').flatMap((g) => g.group)).toEqual(['概览'])
    expect(platformRoleAllows('UNKNOWN_ROLE', 'dashboard')).toBe(false)
    expect(platformRoleAllows('UNKNOWN_ROLE', 'tenant')).toBe(false)
  })

  it('F3-3 role 为空串 → fail-closed', () => {
    expect(platformRoleAllows('', 'tenant')).toBe(false)
  })
})

describe('F4 · 路由域解析（守卫 fail-closed 的映射真源）', () => {
  it('F4-1 精确路径命中', () => {
    expect(resolvePlatformModule('/tenants')).toBe('tenant')
    expect(resolvePlatformModule('/dashboard')).toBe('dashboard')
    expect(resolvePlatformModule('/ops/tickets')).toBe('ticket')
  })

  it('F4-2 子路径前缀命中（详情/编辑页随所属域）', () => {
    expect(resolvePlatformModule('/tenants/abc-123')).toBe('tenant')
    expect(resolvePlatformModule('/tenants/create')).toBe('tenant')
    expect(resolvePlatformModule('/packages/p1/edit')).toBe('billing')
    expect(resolvePlatformModule('/ai-config/usage')).toBe('ai')
    expect(resolvePlatformModule('/open/api-keys')).toBe('open')
  })

  it('F4-3 非菜单路由同样有归属（守卫全覆盖）', () => {
    expect(resolvePlatformModule('/subscriptions')).toBe('billing')
    expect(resolvePlatformModule('/subscription-applies')).toBe('billing')
    expect(resolvePlatformModule('/applications')).toBe('tenant')
    expect(resolvePlatformModule('/tenant-usage')).toBe('tenant')
    expect(resolvePlatformModule('/mobile-preview')).toBe('tenant')
    expect(resolvePlatformModule('/error-logs')).toBe('monitor')
    expect(resolvePlatformModule('/message-config')).toBe('sysconfig')
    expect(resolvePlatformModule('/reviews')).toBe('review')
  })

  it('F4-4 未映射路由返回 null（守卫按 fail-closed 拒绝，不放行）', () => {
    expect(resolvePlatformModule('/no-such-page')).toBeNull()
  })

  it('F4-5 前缀不误命中：/monitorX 不归 monitor 域', () => {
    expect(resolvePlatformModule('/monitorX')).toBeNull()
  })
})

describe('F5 · 声明完整性（守卫与菜单共用真源的结构防线）', () => {
  it('F5-1 每个菜单项都声明了合法 module', () => {
    const legal: PlatformModule[] = ['dashboard', 'tenant', 'billing', 'marketing', 'sysconfig', 'monitor', 'ticket', 'ai', 'open', 'review']
    for (const item of allItems) {
      expect(legal).toContain(item.module)
      expect(item.module).toBeTruthy()
    }
  })

  it('F5-2 白名单域均在合法域集合内且不含超管特有语义', () => {
    const legal: PlatformModule[] = ['dashboard', 'tenant', 'billing', 'marketing', 'sysconfig', 'monitor', 'ticket', 'ai', 'open', 'review']
    for (const m of PLATFORM_SUPPORT_MODULES) expect(legal).toContain(m)
  })
})

describe('F6 · MFA 同口径与菜单-守卫一致性（MENU-ROLE-FILTER-01-F1）', () => {
  it('F6-1 role 是唯一输入：同一 role 字符串（无论来自 MFA verify 还是普通登录）过滤结果恒等', () => {
    // 超管分支返回**真源原样**（引用相等锁死）
    for (const role of PLATFORM_SUPER_ROLES) {
      expect(filterPlatformMenusForRole(role)).toBe(platformMenus)
    }
    // SUPPORT 分支同参同构（每次新数组但结构内容恒等 —— MFA verify 与普通登录同口径）
    expect(filterPlatformMenusForRole('SUPPORT')).toStrictEqual(filterPlatformMenusForRole('SUPPORT'))
    // role 缺失（MFA 偏差残留/旧行）与显式 null 同口径
    expect(filterPlatformMenusForRole(null)).toEqual(filterPlatformMenusForRole(undefined))
  })

  it('F6-2 菜单与守卫判定一致：SUPPORT 可见项的 module 全在白名单内，不可见项全不在', () => {
    const visible = filterPlatformMenusForRole('SUPPORT').flatMap((g) => g.items)
    for (const item of visible) {
      expect(PLATFORM_SUPPORT_MODULES).toContain(item.module)
      expect(platformRoleAllows('SUPPORT', item.module)).toBe(true)
    }
    for (const item of allItems) {
      if (!PLATFORM_SUPPORT_MODULES.includes(item.module)) {
        expect(platformRoleAllows('SUPPORT', item.module)).toBe(false)
      }
    }
  })

  it('F6-3 /forbidden 与 /login 不在路由域映射表（守卫依赖 requiresAuth:false 放行，不得误拦成死循环）', () => {
    expect(resolvePlatformModule('/forbidden')).toBeNull()
    expect(resolvePlatformModule('/login')).toBeNull()
  })

  it('F6-4 未知角色码批量 fail-closed（含大小写变形与空白，防大小写绕过；白名单外的超管变体同样不放行）', () => {
    // 注：'SUPER_ADMIN' 是合法超管角色（与后端 PLATFORM_SUPER_ROLES 逐字一致），不在未知列表
    for (const bad of ['', ' ', 'support', 'Support', 'PLATFORM_SUPER', 'SUPER_ADMIN ', 'ROLE_UNKNOWN_X', 'PLATFORM_SUPPORT_ADMIN']) {
      expect(filterPlatformMenusForRole(bad).map((g) => g.group)).toEqual(['概览'])
      expect(platformRoleAllows(bad, 'dashboard')).toBe(false)
      expect(platformRoleAllows(bad, 'tenant')).toBe(false)
    }
  })
})
