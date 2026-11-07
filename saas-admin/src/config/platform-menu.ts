/**
 * 平台总后台菜单配置
 * ─────────────────────────────────────────────────────────
 * 依据：设计稿 v1.6 侧边栏脚本定义（docs/智享全链_总后台UI设计稿_v1.6.html 第 2568 行 NAVS）
 *   var NAVS=[["概览",[["dashboard","运营大盘"]]],
 *             ["租户",[["tenant","租户管理"],["plan","套餐管理"],["bill","账单计费"]]],
 *             ["营销",[["market","渠道推广"],["agent","代理商管理"],["goods","商品库"],
 *                      ["coupon","优惠码"],["clue","招商线索"]]],
 *             ["平台",[["admin","管理员权限"],["config","系统配置"],["tpl","模板中心"]]],
 *             ["AI 中心",[["aim","模型接入"],["aib","计费管理"],["aiu","用量监控"]]],
 *             ["运维",[["ops","监控告警"],["log","日志中心"],["ntc","公告管理"],
 *                      ["tkt","工单系统"],["rel","版本发布"]]],
 *             ["开放平台",[["apikey","API 密钥"],["webhook","Webhook"]]]];
 *
 * 口径：7 组 22 项，分组名与条目名逐字对齐设计稿，不增删、不重命名。
 * 说明：设计稿侧边栏含「优惠码 / 招商线索」两项，但设计稿 17 个板块中无对应界面规范
 *      （06 营销板块仅含「渠道推广」），故标记 pending，待设计稿补充规范后再实现。
 *
 * 角色收敛（TOTAL-PLATFORM-MENU-ROLE-FILTER-01 · 关闭 G2）：
 *   · 每个菜单项声明所属**权限域**（module），域语义与后端 PERMISSION_CATALOG 的
 *     moduleCode 对齐（platform-role.service.ts：tenant/billing/sysconfig/monitor/ticket/
 *     marketing/ai/open/review/common）；
 *   · SUPER_ADMIN（PLATFORM_SUPER_ADMIN / SUPER_ADMIN）全通（与 backend platform-rbac.ts
 *     PLATFORM_SUPER_ROLES 同口径）；SUPPORT 只见运营支持域白名单；**未知角色 fail-closed**；
 *   · 菜单过滤与路由守卫（router/index.ts）共用同一份声明 —— 不以隐藏菜单代替权限拦截。
 */

import type { Component } from 'vue'
import {
  DataAnalysis,
  OfficeBuilding,
  Box,
  Money,
  Promotion,
  UserFilled,
  Goods,
  Discount,
  TrendCharts,
  Lock,
  Setting,
  Files,
  Cpu,
  Wallet,
  DataLine,
  Monitor,
  Document,
  ChatDotSquare,
  Tickets,
  UploadFilled,
  Key,
  Link,
} from '@element-plus/icons-vue'

/** 平台权限域（与后端 PERMISSION_CATALOG.moduleCode 对齐；common 仅用于数据范围档位，不出现在菜单） */
export type PlatformModule =
  | 'dashboard'
  | 'tenant'
  | 'billing'
  | 'marketing'
  | 'sysconfig'
  | 'monitor'
  | 'ticket'
  | 'ai'
  | 'open'
  | 'review'

export interface PlatformMenuItem {
  /** 菜单标题（与设计稿 NAVS 逐字一致） */
  title: string
  /** 路由路径（与 router/index.ts 保持一致） */
  path: string
  /** 图标组件 */
  icon: Component
  /** 设计稿有菜单项但无界面规范 / 页面尚未实现时为 true */
  pending?: boolean
  /** 所属权限域（角色收敛判定依据；菜单过滤与路由守卫共用） */
  module: PlatformModule
}

export interface PlatformMenuGroup {
  /** 分组名（与设计稿 NAVS 逐字一致） */
  group: string
  items: PlatformMenuItem[]
}

export const platformMenus: PlatformMenuGroup[] = [
  {
    group: '概览',
    items: [{ title: '运营大盘', path: '/dashboard', icon: DataAnalysis, module: 'dashboard' }],
  },
  {
    group: '租户',
    items: [
      { title: '租户管理', path: '/tenants', icon: OfficeBuilding, module: 'tenant' },
      { title: '套餐管理', path: '/packages', icon: Box, module: 'billing' },
      { title: '账单计费', path: '/reconciliation', icon: Money, module: 'billing' },
    ],
  },
  {
    group: '营销',
    items: [
      { title: '渠道推广', path: '/marketing/channels', icon: Promotion, module: 'marketing' },
      { title: '代理商管理', path: '/marketing/agents', icon: UserFilled, module: 'marketing' },
      { title: '商品库', path: '/library/spus', icon: Goods, module: 'marketing' },
      { title: '优惠码', path: '/marketing/coupons', icon: Discount, pending: true, module: 'marketing' },
      { title: '招商线索', path: '/marketing/leads', icon: TrendCharts, pending: true, module: 'marketing' },
    ],
  },
  {
    group: '平台',
    items: [
      { title: '管理员权限', path: '/platform/admins', icon: Lock, module: 'sysconfig' },
      { title: '系统配置', path: '/settings', icon: Setting, module: 'sysconfig' },
      { title: '模板中心', path: '/platform/templates', icon: Files, module: 'sysconfig' },
    ],
  },
  {
    group: 'AI 中心',
    items: [
      { title: '模型接入', path: '/ai-config/platform', icon: Cpu, module: 'ai' },
      { title: '计费管理', path: '/ai-config/billing', icon: Wallet, module: 'ai' },
      { title: '用量监控', path: '/ai-config/usage', icon: DataLine, module: 'ai' },
    ],
  },
  {
    group: '运维',
    items: [
      { title: '监控告警', path: '/monitor', icon: Monitor, module: 'monitor' },
      { title: '日志中心', path: '/audit-logs', icon: Document, module: 'monitor' },
      { title: '公告管理', path: '/announcements', icon: ChatDotSquare, module: 'sysconfig' },
      { title: '工单系统', path: '/ops/tickets', icon: Tickets, module: 'ticket' },
      { title: '版本发布', path: '/app-versions', icon: UploadFilled, module: 'sysconfig' },
    ],
  },
  {
    group: '开放平台',
    items: [
      { title: 'API 密钥', path: '/open/api-keys', icon: Key, module: 'open' },
      { title: 'Webhook', path: '/open/webhooks', icon: Link, module: 'open' },
    ],
  },
]

/* ════════ 角色收敛声明（G2 唯一真源，菜单过滤与路由守卫共用） ════════ */

/** 平台超管口径：与 backend/src/middleware/platform-rbac.ts PLATFORM_SUPER_ROLES 逐字一致 */
export const PLATFORM_SUPER_ROLES: readonly string[] = ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN']

/**
 * SUPPORT（平台支持）可见的权限域白名单 —— 运营支持视角：
 * 概览 / 租户 / 套餐与计费 / 运维监控与日志 / 工单；
 * 平台自身管理域（营销、系统配置、AI 管控、开放平台、评价审核）不授予。
 * 差集与后端 PERMISSION_CATALOG 的功能域划分一致（非超管默认无权，白名单即全部授权）。
 */
export const PLATFORM_SUPPORT_MODULES: readonly PlatformModule[] = [
  'dashboard',
  'tenant',
  'billing',
  'monitor',
  'ticket',
]

/** 某角色是否可见指定权限域（fail-closed：未知角色一律 false，仅 dashboard 组兜底渲染） */
export function platformRoleAllows(role: string | null | undefined, module: PlatformModule): boolean {
  if (role && PLATFORM_SUPER_ROLES.includes(role)) return true
  if (role === 'SUPPORT') return PLATFORM_SUPPORT_MODULES.includes(module)
  return false
}

/**
 * 按角色过滤菜单：
 * - 超管 → 原样全量；
 * - SUPPORT → 仅保留白名单域所在组，组内条目全被滤掉时**整组移除**（不留空组）；
 * - role 缺失/未知 → 仅渲染概览组（fail-closed 但**不全空**：概览是所有角色的公共入口，
 *   避免「菜单过滤吞掉系统错误后整页空白」的假死状态）。
 */
export function filterPlatformMenusForRole(role: string | null | undefined): PlatformMenuGroup[] {
  if (role && PLATFORM_SUPER_ROLES.includes(role)) return platformMenus
  if (role === 'SUPPORT') {
    return platformMenus
      .map((g) => ({ ...g, items: g.items.filter((i) => PLATFORM_SUPPORT_MODULES.includes(i.module)) }))
      .filter((g) => g.items.length > 0)
  }
  return platformMenus.filter((g) => g.group === '概览')
}

/* ════════ 路由 → 权限域解析（守卫 fail-closed 用，覆盖全部受保护路由） ════════ */

/**
 * 受保护路由前缀 → 权限域。按**最长前缀优先**匹配；未命中的受保护路由返回 null
 * ⇒ 守卫按 fail-closed 处理（不因映射缺失而放行）。含全部真实路由（含非菜单的详情/子页）。
 */
export const PLATFORM_ROUTE_MODULES: ReadonlyArray<readonly [string, PlatformModule]> = [
  ['/dashboard', 'dashboard'],
  ['/tenants', 'tenant'],
  ['/tenant-usage', 'tenant'],
  ['/applications', 'tenant'],
  ['/mobile-preview', 'tenant'],
  ['/packages', 'billing'],
  ['/subscriptions', 'billing'],
  ['/subscription-applies', 'billing'],
  ['/reconciliation', 'billing'],
  ['/marketing', 'marketing'],
  ['/library', 'marketing'],
  ['/reviews', 'review'],
  ['/platform', 'sysconfig'],
  ['/settings', 'sysconfig'],
  ['/message-config', 'sysconfig'],
  ['/announcements', 'sysconfig'],
  ['/app-versions', 'sysconfig'],
  ['/monitor', 'monitor'],
  ['/audit-logs', 'monitor'],
  ['/error-logs', 'monitor'],
  ['/ops/tickets', 'ticket'],
  ['/ai-config', 'ai'],
  ['/open', 'open'],
]

/** 解析路由路径所属权限域；未命中返回 null（守卫 fail-closed） */
export function resolvePlatformModule(path: string): PlatformModule | null {
  let best: { prefix: string; module: PlatformModule } | null = null
  for (const [prefix, module] of PLATFORM_ROUTE_MODULES) {
    if ((path === prefix || path.startsWith(prefix + '/')) && (!best || prefix.length > best.prefix.length)) {
      best = { prefix, module }
    }
  }
  return best?.module ?? null
}

/** 全部条目标题 → 路径的扁平映射，供面包屑等处复用（永远基于**全量**菜单，不随角色过滤） */
export function findMenuTitleByPath(path: string): { group: string; title: string } | null {
  for (const g of platformMenus) {
    const hit = g.items.find((i) => i.path === path)
    if (hit) return { group: g.group, title: hit.title }
  }
  return null
}

/* ════════ 租户域写动作角色真源（TOTAL-PLATFORM-SERVER-SIDE-RBAC-01-UI-01） ════════ */

/**
 * 平台租户域写操作是否可渲染 / 可提交。
 * 与服务端 backend/src/middleware/platform-rbac.ts:isPlatformSuperRole 同口径：
 * 仅 PLATFORM_SUPER_ADMIN / SUPER_ADMIN 全通；SUPPORT、其他角色、未知 / null 一律 fail-closed。
 * ⚠️ 前端收敛只是交互层防线，绝不替代服务端 403；服务端必须独立拒绝并留审计。
 */
export function canWritePlatformTenant(role: string | null | undefined): boolean {
  return !!role && PLATFORM_SUPER_ROLES.includes(role)
}

export interface TenantRowAction {
  key: string
  label: string
  cls: string
  /** true = 写动作（含跳写页 / 提交写 API 的入口）；非超管一律不渲染 */
  write: boolean
}

/** 只读动作（详情 / 概况），任何角色都不得被误伤 */
function readActions(): TenantRowAction[] {
  return [
    { key: 'detail', label: '详情', cls: '', write: false },
    { key: 'overview', label: '概况', cls: '', write: false },
  ]
}

/**
 * 全量行内动作（仅按后端真实枚举 ACTIVE / DISABLED 分支，不自造状态）。
 * 从 TenantList.vue 行 373 的 rowActions 上提为纯函数，便于契约测试直接断言。
 */
export function allTenantRowActions(status: string | null | undefined): TenantRowAction[] {
  const s = String(status ?? '').toUpperCase()
  const [detail, overview] = readActions()
  if (s === 'DISABLED') {
    return [detail, { key: 'unfreeze', label: '启用', cls: 'warn', write: true }, overview]
  }
  if (s === 'ACTIVE') {
    return [
      detail,
      { key: 'freeze', label: '停用', cls: 'warn', write: true },
      overview,
      { key: 'renew', label: '续费', cls: '', write: true },
      { key: 'proxy', label: '代登录', cls: '', write: true },
      { key: 'export', label: '数据导出', cls: '', write: true },
      { key: 'reset', label: '重置数据', cls: 'dgr', write: true },
    ]
  }
  return [detail, overview]
}

/** 按真实 role 收敛行内写动作：非超管只保留详情 / 概况两个读动作（fail-closed） */
export function tenantRowActions(
  role: string | null | undefined,
  status: string | null | undefined,
): TenantRowAction[] {
  const all = allTenantRowActions(status)
  return canWritePlatformTenant(role) ? all : all.filter((a) => !a.write)
}
