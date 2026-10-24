// ============================================================================
// 按钮级写动作权限预判（MOBILE-32 / MO-16）
//
// 问题：`request.ts` 的 403 分支只弹全局 toast 后 reject ⇒ 用户「填完表单、点提交」
// 才收到"权限不足"。本模块让**写按钮在点击前**就拿到明确状态。
//
// 与既有设施的关系（**不另造一套口径**）：
//  · 码匹配：复用 `config/permission-gates.ts` 的 `matchPermissionCode`（后端同源镜像）；
//  · 三态判定：复用 `config/permission-view-state.ts` 的 `resolvePermissionViewState`
//    （loading / empty / unavailable / ready 四态，菜单与入口门同源）；
//  · 本模块只补「**按钮**该按什么显示」这一层，不重判 null、不自拟第五态。
//
// 按钮四态 → 交互（卡 §二.2 / §三.2）：
//   | 场景                        | 按钮显示   | 可点 | 说明文案（对商户，非内部码） |
//   |:----------------------------|:-----------|:-----|:-----------------------------|
//   | ready 且持有               | 正常       | ✅   | 无                           |
//   | ready 且不持有             | 禁用       | ❌   | 「当前账号没有该操作权限」   |
//   | loading（权限在途）        | 加载中     | ❌   | 「权限校验中，请稍候」       |
//   | empty / unavailable        | 失败关闭   | ❌   | 「权限信息未取到，请下拉刷新或联系管理员」 |
//   | stale（用上次缓存）        | 正常+提示  | ✅   | 「权限信息来自上次加载」     |
//
// ⚠️ 红线（卡 §五）：
//  · 不得把多个写动作懒绑到同一宽泛码 —— 本 API 的入参就是**该按钮自己的**码数组；
//  · 不得禁用只读按钮 —— 只读动作调用方**不调**本模块；
//  · 后端无确定码 ⇒ 调用方传 null/[] 并用 `status='blocked'` 显式登记（见下），
//    不得自造码字符串。
//
// 代码层级：零依赖纯函数（不引 vue / pinia / uni），可被 Node 直接加载做单测与证据脚本。
// ============================================================================

import { matchPermissionCode } from './permission-gates'
import {
  resolvePermissionViewState,
  type PermissionRequestState,
  type PermissionViewState,
} from './permission-view-state'

/** 按钮显示状态（消费方据此渲染；不含「后端无码」以外的任何技术态） */
export type ButtonGateStatus =
  /** 持有该按钮全部所需码 ⇒ 正常可用 */
  | 'allowed'
  /** ready 但不是全部持有 ⇒ 禁用 + 说明 */
  | 'denied'
  /** 权限请求在途 ⇒ 暂缓（禁用 + "校验中"） */
  | 'loading'
  /** 确实无码 / 未取到 / 权限服务失败 ⇒ 失败关闭（禁用 + 引导刷新或联系管理员） */
  | 'unavailable'
  /** 用上次缓存判定且持有 ⇒ 可用但标注"基于上次结果" */
  | 'stale-allowed'
  /** 用上次缓存判定但不持有 ⇒ 禁用且标注 */
  | 'stale-denied'
  /** 后端无确定码（卡要求显式 BLOCKED；**不得自造码**）⇒ 禁用 + 联系管理员 */
  | 'blocked'

export interface ButtonGateInput {
  /** 该按钮承载的写端点所需码（**逐按钮各自**；空数组/undefined = 后端无确定码） */
  codes: readonly string[] | null | undefined
  /** 当前已持有的权限码；null/undefined = 未持有数组（交由三态源分流） */
  permissions: readonly string[] | null | undefined
  /** 是否有登录态 */
  hasSession: boolean
  /** 权限来源请求状态（pending / ok / failed） */
  requestState: PermissionRequestState
  /**
   * 是否允许把「上次成功取到的缓存」用于判定（stale 场景）。
   * true 且 permissions 非数组时，调用方可传 `cachedPermissions` 走 stale 分支。
   */
  cachedPermissions?: readonly string[] | null
}

export interface ButtonGateResult {
  status: ButtonGateStatus
  /** 是否可点击（唯一判据；模板里 v-if/disabled 都用它） */
  enabled: boolean
  /** 是否需要给出可见说明（denied / loading / unavailable / blocked / stale 均需） */
  showHint: boolean
  /** 面向商户的说明文案；enabled 且非 stale 时为空串 */
  hint: string
  /** 是否基于陈旧缓存（调用方可在按钮旁加标记） */
  stale: boolean
  /** 内部诊断用（**不得渲染给商户**）：判定依据 */
  reason: string
}

/** 面向商户的固定文案（中文、可执行、不泄漏权限码/后端内部信息 —— 卡 §二.4） */
export const BUTTON_HINTS = {
  denied: '当前账号没有该操作权限',
  loading: '权限校验中，请稍候',
  unavailable: '权限信息未取到，请下拉刷新页面后重试；仍不行请联系管理员',
  blocked: '该功能尚未开通，请联系管理员',
  stale: '权限信息来自上次加载',
} as const

function deny(status: ButtonGateStatus, hint: string, reason: string, stale = false): ButtonGateResult {
  return { status, enabled: false, showHint: true, hint, stale, reason }
}

/**
 * 按钮级判定（唯一入口；页面不得自行判 null 或自行拼文案）。
 *
 * 判定顺序（与三态源顺序一致，先「有没有数据」再「持不持有」）：
 *  1. codes 为空 ⇒ blocked（后端无确定码 / 未立码；**禁用以防误 403**，不作放行）。
 *  2. permissions 是数组 ⇒ ready：
 *      - 全部持有 ⇒ allowed；
 *      - 否则 ⇒ denied。
 *  3. permissions 非数组时看三态源：
 *      - loading ⇒ loading（暂缓，不算失败、不提示为权限不足）；
 *      - empty ⇒ unavailable（失败关闭）；
 *      - unavailable ⇒ 若给了 cachedPermissions 且持有 ⇒ stale-allowed（可用但标注）；
 *                     否则 ⇒ unavailable。
 *      - ready 但数组为空已在 2 覆盖（空数组 ⇒ 不持有 ⇒ denied）。
 */
export function resolveButtonGate(input: ButtonGateInput): ButtonGateResult {
  const { codes, permissions, hasSession, requestState, cachedPermissions } = input

  // 1. 后端无确定码 ⇒ 显式 blocked（不得自造码，也不得当作"不设门"放行）
  if (!codes || codes.length === 0) {
    return deny('blocked', BUTTON_HINTS.blocked, 'codes-empty ⇒ 后端无确定权限码，禁用并引导联系管理员')
  }

  const held = (perms: readonly string[] | null | undefined): boolean =>
    Array.isArray(perms) && codes.every((c) => matchPermissionCode(perms, c))

  // 2. 已持有数组 ⇒ 直接按真实码判定（三态源同为 ready）
  if (Array.isArray(permissions)) {
    return held(permissions)
      ? { status: 'allowed', enabled: true, showHint: false, hint: '', stale: false, reason: 'ready + 全部持有' }
      : deny('denied', BUTTON_HINTS.denied, 'ready + 未全部持有')
  }

  // 3. 未持有数组 ⇒ 交三态源分流，避免与菜单/入口门出现第二套 null 语义
  const view = resolvePermissionViewState({ hasSession, requestState, permissions })

  if (view.viewState === 'loading') {
    return deny('loading', BUTTON_HINTS.loading, '三态=loading（请求在途）')
  }

  // empty / unavailable 均失败关闭；unavailable 若存在上次缓存则允许 stale 判定
  if (view.viewState === 'unavailable' && Array.isArray(cachedPermissions)) {
    const ok = held(cachedPermissions)
    return ok
      ? {
          status: 'stale-allowed',
          enabled: true,
          showHint: true,
          hint: BUTTON_HINTS.stale,
          stale: true,
          reason: '三态=unavailable + 上次缓存持有 ⇒ 可用但标注',
        }
      : deny('stale-denied', BUTTON_HINTS.denied, '三态=unavailable + 上次缓存不持有', true)
  }

  return deny(
    'unavailable',
    BUTTON_HINTS.unavailable,
    `三态=${view.viewState}（${view.policy}）⇒ 失败关闭`
  )
}

/** 供测试/证据脚本读取的三态名（避免各处硬编码字符串） */
export const BUTTON_GATE_STATES: readonly ButtonGateStatus[] = [
  'allowed',
  'denied',
  'loading',
  'unavailable',
  'stale-allowed',
  'stale-denied',
  'blocked',
]

/** 该状态是否允许触发写请求（供「写请求零调用」断言直接引用） */
export function buttonGateAllowsWrite(result: ButtonGateResult): boolean {
  return result.enabled === true && (result.status === 'allowed' || result.status === 'stale-allowed')
}

export type { PermissionViewState, PermissionRequestState }
