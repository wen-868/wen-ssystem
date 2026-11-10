/**
 * 租户行操作角色收敛适配器（TOTAL-PLATFORM-RBAC-UI-COUPLING-01 · F-2/P2-2）
 *
 * 背景：服务端 RBAC（TOTAL-PLATFORM-SERVER-SIDE-RBAC-01）落地前，总台前端先行收敛：
 *   平台写操作（启停/续费/代登录/导出/重置/扩容/重置口令等）只对超管可见可用；
 *   SUPPORT / 未知角色 / role 缺失一律 fail-closed —— 不显示、且 handler 层二次防线
 *   （guardTenantWrite）保证即便被绕过也不会发出写 API。
 *
 * 硬边界（回传必须复述）：**前端隐藏不替代服务端 403**。服务端 role 门缺失（P0-1）
 * 期间，直连 API 仍可能成功——本文件只是 UI 耦合收敛，不宣称 P0-1 已关闭。
 *
 * 口径来源（与既有实现同源，不另造标准）：
 *   - PLATFORM_SUPER_ROLES：复用 config/platform-menu.ts（与 backend platform-rbac.ts 逐字一致）；
 *   - 未知角色 fail-closed：与 platformRoleAllows 同策略；
 *   - 动作键与 TenantList.vue / TenantDetail.vue 现有 handler 一一对应，不改任何端点。
 *
 * 纯函数实现，node 环境可测（与 feedback / mfa-challenge 契约同风格）。
 */

import { PLATFORM_SUPER_ROLES } from '../../config/platform-menu'

/** 单个行动作（key 与页面 handler 对应；cls 沿用既有按钮样式类） */
export interface TenantAction {
  key: string
  label: string
  cls: string
}

/**
 * 需要平台写权限的动作键全集。
 * - freeze/unfreeze：POST /platform/tenants/:id/toggle（启停）
 * - renew：续费（跳订阅办理；仍属平台动作，SUPPORT 不展示）
 * - proxy：代登录（行内入口跳详情页；详情页内 proxyLogin 提交写 API）
 * - export/reset：数据导出/重置（行内当前为「后端未就绪」提示，但语义是写动作，一并收敛）
 * - proxyLogin/reset/exportTask：TenantDetail 页头弹窗动作
 * - expand：临时扩容（POST /tenants/:id/quota-expand）
 * - resetUserPassword：重置租户账号口令
 * - create：新建租户（POST /platform/tenants）
 * - editTenant：基础信息内联编辑保存（PUT /tenants/:id）
 */
export const TENANT_WRITE_KEYS: readonly string[] = [
  'freeze',
  'unfreeze',
  'renew',
  'proxy',
  'proxyLogin',
  'export',
  'exportTask',
  'reset',
  'expand',
  'resetUserPassword',
  'create',
  'editTenant',
]

/**
 * 某角色是否拥有平台写权限（唯一判定真源）：
 * 仅 PLATFORM_SUPER_ROLES 为 true；SUPPORT、未知角色码、null/undefined 一律 false（fail-closed）。
 * 注意：SUPPORT 在菜单域有 tenant 只读白名单，但**写操作全限超管**——只读能力不回退。
 */
export function isTenantWriteAllowed(role: string | null | undefined): boolean {
  return !!role && PLATFORM_SUPER_ROLES.includes(role)
}

/**
 * handler 层二次防线：写动作发出前的最后一道闸。
 * 返回 true = 允许发写请求；false = 拦下（页面据此提示且**绝不调用写 API**）。
 * 行内按钮隐藏是第一道；此防线覆盖「按钮残留/事件绑定绕过/状态回归」等意外路径。
 */
export function guardTenantWrite(role: string | null | undefined, actionKey: string): boolean {
  if (!TENANT_WRITE_KEYS.includes(actionKey)) return true // 只读动作不受限
  return isTenantWriteAllowed(role)
}

/** 拦下时的用户提示（不泄漏内部权限码/角色枚举） */
export const TENANT_WRITE_DENIED_TEXT = '当前账号仅具备只读权限，该操作未执行'

/**
 * 租户行动作按角色收敛（唯一真源，TenantList.vue 直接消费）。
 * 规则：
 *   - 基础只读动作（详情/概况）对**所有角色**保留——SUPPORT 的租户只读能力不回退；
 *   - 写动作（启停/续费/代登录/导出/重置）仅超管可见；
 *   - 状态分支沿用后端真实枚举 ACTIVE / DISABLED，不为不存在的状态造分支。
 */
export function tenantRowActions(
  role: string | null | undefined,
  row: { status?: string | number | null },
): TenantAction[] {
  const s = String(row?.status ?? '').toUpperCase()
  const base: TenantAction[] = [{ key: 'detail', label: '详情', cls: '' }]
  const overview = { key: 'overview', label: '概况', cls: '' }
  const canWrite = isTenantWriteAllowed(role)

  if (s === 'DISABLED') {
    return canWrite
      ? [...base, { key: 'unfreeze', label: '启用', cls: 'warn' }, overview]
      : [...base, overview]
  }
  if (s === 'ACTIVE') {
    if (!canWrite) return [...base, overview]
    return [
      ...base,
      { key: 'freeze', label: '停用', cls: 'warn' },
      overview,
      { key: 'renew', label: '续费', cls: '' },
      { key: 'proxy', label: '代登录', cls: '' },
      { key: 'export', label: '数据导出', cls: '' },
      { key: 'reset', label: '重置数据', cls: 'dgr' },
    ]
  }
  return [...base, overview]
}
