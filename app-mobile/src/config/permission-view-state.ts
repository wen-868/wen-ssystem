// ============================================================================
// 「未取到权限码」三态的**单一定义源**（S3-239）
//
// 背景：S3-231 F3 把**入口门**改成失败关闭后，同端存在**两套 null 语义**——
//   · `stores/menu.ts`：null = 首屏加载中、放全量；
//   · `config/permission-gates.ts`：null/undefined = 未取到 ⇒ 隐藏（失败关闭）。
// 本文件把两套收成一套（凌舟口径见 `docs/tasks/inbox/ACTIVE-S3-239.md` §一）：
//
//   | 态           | 触发条件                          | 显示策略（policy）                | 提示 |
//   |:-------------|:----------------------------------|:----------------------------------|:-----|
//   | ① loading    | 有登录态、权限来源请求**在途**    | showAllMinimal（有缓存按缓存，    | 无   |
//   |              | 未返回                            | 无缓存 = 最小可见集）             |      |
//   | ② empty      | 请求**成功**返回、码数组为空      | hideNeedsCode（失败关闭）         | 无   |
//   | ③ unavailable| 请求失败 / 超时 / 401 已处理 /    | showAllMinimal + 可关闭提示       | 有   |
//   |              | 成功但缺字段（老版本缓存）        |                                   |      |
//   | ready        | 请求成功、持有非空码数组          | showGranted（按真实码判定）       | 无   |
//
// 消费方**只有两处**（本单的接线面，二者都必须调本文件，不许各自再判 null）：
//   · `stores/menu.ts`（页面 code 可见性）；
//   · `config/permission-gates.ts` 的 `isEntryVisible()`（入口门显隐），由
//     `composables/usePermissionGate.ts` 传入三元输入调用。
//
// 红线口径（凌舟 ACTIVE-S3-239 §四.2）：**不得把「最小可见集」实现成「全量放行」**。
//   policy 里保留了 'showAll'（改造前 null⇒放全量 的旧语义）**仅供反测注入**——
//   生产路径的任何分支都不返回它；把 loading/unavailable 分支打回 'showAll' 后，
//   `tests/permission-view-state.spec.ts` 的用例①/③必红（判据有分辨力，不是自证）。
//
// 代码层级：零依赖纯函数 + 常量（不引 vue / pinia / uni），可被 Node 直接加载做证据脚本。
// ============================================================================

/** 权限来源请求（登录响应 / `/admin/auth/me` / `/admin/menus/user`）的进行状态 */
export type PermissionRequestState = 'pending' | 'ok' | 'failed'

/** 三态 + ready 共四态（凌舟已定口径，勿自拟第五态） */
export type PermissionViewState = 'loading' | 'empty' | 'unavailable' | 'ready'

/**
 * 显示策略（返回值的一部分，消费方据此渲染）：
 *  · 'showAllMinimal' —— 最小可见集口径：**有缓存按缓存，无缓存按 MINIMUM_VISIBLE_*常量**；
 *  · 'hideNeedsCode'  —— 失败关闭：需码的菜单/入口一律不显示（② 态、无登录态）；
 *  · 'showGranted'    —— 已取到非空码数组，按真实码判定（正常态）；
 *  · 'showAll'        —— 改造前「null ⇒ 放全量」旧语义，**生产分支不返回**，仅供反测注入。
 */
export type PermissionViewPolicy = 'showAllMinimal' | 'hideNeedsCode' | 'showGranted' | 'showAll'

export interface PermissionViewStateInput {
  /** 是否有登录态（有缓存/取数的前提；无登录态一律失败关闭） */
  hasSession: boolean
  /** 权限来源请求的进行状态；调用方只描述事实，不做权限推断 */
  requestState: PermissionRequestState
  /** 已取到的权限码 / 菜单码数组；null/undefined = 尚未持有（缓存与本次结果都没有） */
  permissions: readonly string[] | null | undefined
}

export interface PermissionViewStateResult {
  viewState: PermissionViewState
  policy: PermissionViewPolicy
  /** 是否需要向用户明示（③ 态）；① 态**不得**判失败、不得提示 */
  showNotice: boolean
  /** 提示文案（showNotice=false 时为空串） */
  noticeText: string
}

/** ③ 态顶部提示文案（可关闭；不得用阻塞式弹窗） */
export const PERMISSION_UNAVAILABLE_NOTICE = '权限信息未取到，已按最小可见集显示，请下拉刷新重试'

/**
 * 菜单最小可见集（①③ 态、无缓存时渲染的页面 code 集）。
 * 依据（凌舟 ACTIVE-S3-239 §一）：首页/工作台为**无码入口**（不走菜单 code 闸，恒可见，
 * 即「不隐藏整端」的保底）；注册表内取**只读项** = 报表域 6 页。
 * ⚠️ 兼容态的前缀回落（`function-menu.ts` 判定②）会把**整个同前缀域**放大可见，
 * 故只收录「前缀域内全部页面均为只读」的域：
 *  · 报表域：report 前缀下 6 页全部是只读报表 ⇒ 可收；
 *  · 溯源（goods 前缀 ⇒ 带出库存/盘点/报损等写页）、销售记录（sale 前缀 ⇒ 带出开单）、
 *    操作日志/系统设置（system 前缀 ⇒ 带出配置写页）**均被前缀放大排除**，
 *    待 S3-143 严格 code 口径落地后再评估回补。
 * 本清单为逐项裁决结果，回传卡 §五 有对照；**不许扩成全量**（红线）。
 */
export const MINIMUM_VISIBLE_MENU_CODES: readonly string[] = [
  'report:dashboard',
  'report:sales',
  'report:inventory',
  'report:purchase',
  'report:customer',
  'report:finance-report',
]

/**
 * 入口门最小可见集（①③ 态额外放行的**带码**入口 id）。
 * 当前为**空集**（凌舟口径「首页/工作台为无码入口」——它们不走入口门，天然可见；
 * 注册表里 `status=registered` / 未登记的入口 codes 为空数组，同样天然放行；
 * 而全部 `gated` 入口都是**写**入口，未取到码时显示出去必 403 ⇒ 不放入最小集）。
 * 若将来要往这里加 id，须凌舟裁定；**不许**把整域 gated 入口批量放进来。
 */
export const MINIMUM_VISIBLE_ENTRY_IDS: readonly string[] = []

function toResult(
  viewState: PermissionViewState,
  policy: PermissionViewPolicy,
  showNotice: boolean
): PermissionViewStateResult {
  return {
    viewState,
    policy,
    showNotice,
    noticeText: showNotice ? PERMISSION_UNAVAILABLE_NOTICE : '',
  }
}

/**
 * 三态判定（唯一口径；菜单与入口门都调它，判定顺序即文档顺序）：
 *  1. `permissions` 是数组 ⇒ 已持有数据（本次结果或历史缓存），数组本身说了算：
 *     空数组 ⇒ ② empty / hideNeedsCode；非空 ⇒ ready / showGranted。
 *  2. 无登录态 ⇒ 失败关闭（② 同策略、不提示）：未登录时不渲染任何需码项。
 *  3. 有登录态但没取到数组：请求在途 ⇒ ① loading（**不判失败、不提示**）；
 *     请求失败 ⇒ ③ unavailable；请求成功却缺字段（老版本本地缓存）⇒ 同 ③。
 */
export function resolvePermissionViewState(input: PermissionViewStateInput): PermissionViewStateResult {
  const { hasSession, requestState, permissions } = input

  if (Array.isArray(permissions)) {
    return permissions.length === 0
      ? toResult('empty', 'hideNeedsCode', false)
      : toResult('ready', 'showGranted', false)
  }

  if (!hasSession) return toResult('empty', 'hideNeedsCode', false)

  if (requestState === 'pending') return toResult('loading', 'showAllMinimal', false)
  if (requestState === 'failed') return toResult('unavailable', 'showAllMinimal', true)
  return toResult('unavailable', 'showAllMinimal', true)
}
