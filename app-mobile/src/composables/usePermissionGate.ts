/**
 * 入口权限门 composable（S3-230 · S3-239 三态接线）
 *
 * 用途：页面/组件按**注册表里的入口 id** 决定"这个入口要不要显示"，
 * 模板里用 `v-if` 调 `canEntry`（入参 = 注册表里的入口 id），脚本里用 `can(['<权限码>'])` 判零散动作。
 * ⚠️ 本文件与页面注释里**不要写带引号的真实门 id**：证据脚本靠"字面出现次数"核对
 *    「注册表 ↔ 源码引用」一致性，注释里的范例会被算成一处引用（S3-230 实测踩过）。
 *
 * 口径（**S3-239 起：与 `stores/menu.ts` 同源，全部上送 `config/permission-view-state.ts` 三态单一定义源**）：
 *  · 本文件只做**参数装配**（从 user store 现算 hasSession / requestState / permissions 三元输入），
 *    显隐结果由 `permission-gates.ts` 的 `isEntryVisible()` 给出——曾与 menu.ts 的"两套 null 语义
 *    有意分叉"（menu null ⇒ 放全量 vs 入口门 null ⇒ 关闭）自本单起**废止**。
 *  · 三态表现：① 加载中 / ③ 未取到 ⇒ 无码入口（registered / 未登记）照常可见、gated 写入口隐藏、
 *    ③ 另有可关闭顶部提示（提示挂在 menu store 的 bannerText，跨端共用一处文案）；
 *    ② 确实无码（成功返回空数组）⇒ 失败关闭（现状保持）；ready ⇒ 按真实码判定。
 *  · `status=pending-code` 的入口（码未立）⇒ **任何态恒隐藏**（B3-1：按"未开通"处理，
 *    与 registered 的放行相反；即便用户持通配码也不显示），立码 + 后端接线后由注册表转 gated。
 *  · `can()` 仍保留 `codes===null ⇒ 放行`（那是"该动作**不设门**"，与"没取到权限码"是两回事）。
 *
 * requestState 推导口径（`stores/user.ts` 本单不可改，故在此现算）：
 *  · `permissions` 已是数组 ⇒ 'ok'（数组本身说了算：本次结果或登录响应缓存）；
 *  · 缺失且 `initialized=false` ⇒ 'pending'（`/admin/auth/me` 未回或尚未发起）；
 *  · 缺失且 `initialized=true` ⇒ 'failed'（登录态在、初始化走完了却没有码数组 ⇒ 老缓存缺字段/401 已处理）。
 *  ⚠️ 已知边界（如实报备）：fetchProfile **非过期失败**时 `initialized` 停在 false，
 *     此处会被当作 ① 态（最小可见集、无提示）而非 ③ 态——显示结果与 ① 相同（gated 隐藏），
 *     只差提示可见性；根因在 `stores/user.ts` 不记失败态，本单红线不动该文件，待凌舟裁定是否补状态。
 *
 * 为什么不用「角色名单」判定：不变量 I1 约束的是**权限码**（后端 `requirePermission(码)`），
 * 角色与码会各自漂移（`STORE_ADMIN`/`SALESMAN` 是旧词表角色；菜单授予 ≠ 持码）。
 * 判定实现集中在 `config/permission-gates.ts`，与后端 `matchPermission` 同源；
 * 三态显示策略集中在 `config/permission-view-state.ts`，与 `stores/menu.ts` 同源。
 */
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { hasPermissionCodes, isEntryVisible } from '@/config/permission-gates'
import { resolvePermissionViewState, type PermissionRequestState } from '@/config/permission-view-state'

export function usePermissionGate() {
  const userStore = useUserStore()

  /** 当前用户权限码（null/undefined = 未持有数组，交由三态源分流） */
  const permissions = computed<string[] | null | undefined>(() => userStore.permissions)

  /** 是否已取到权限码（用于"暂缓判定"类展示，一般页面不需要） */
  const permissionsLoaded = computed(() => Array.isArray(permissions.value))

  /** 登录态（无登录态时三态源一律失败关闭） */
  const hasSession = computed(() => !!userStore.user)

  /** 权限来源请求状态（推导口径见文件头；只描述事实，不做权限推断） */
  const requestState = computed<PermissionRequestState>(() => {
    if (Array.isArray(permissions.value)) return 'ok'
    return userStore.initialized ? 'failed' : 'pending'
  })

  /** 三态裁决结果（页面可用于"加载中"类展示；显隐判定不需要页面自己读它） */
  const viewState = computed(() =>
    resolvePermissionViewState({
      hasSession: hasSession.value,
      requestState: requestState.value,
      permissions: permissions.value,
    })
  )

  /** 直接按码判定（用于页面内零散动作；码数组 = 全部持有才通过） */
  function can(codes: readonly string[] | string | null | undefined): boolean {
    if (codes === null || codes === undefined) return true
    const list = typeof codes === 'string' ? [codes] : codes
    return hasPermissionCodes(permissions.value, list)
  }

  /**
   * 按注册表入口 id 判定（推荐：入口与码的对应关系只写在注册表里）。
   * pending-code ⇒ 恒 false；无码入口 ⇒ 恒 true；带码入口 ⇒ 三态源分流（见文件头与 permission-gates 注释）。
   */
  function canEntry(entryId: string): boolean {
    return isEntryVisible(entryId, {
      hasSession: hasSession.value,
      requestState: requestState.value,
      permissions: permissions.value,
    })
  }

  /**
   * 「任一入口可见」判定：用于**父级入口**的显隐 —— 一个父容器里含多个子入口时，
   * 父容器应在"至少有一个子入口对该账号可见"时显示（否则整块空白）。
   * 注意：父级用"任一"、子级仍各自用 `canEntry`（父级宽松不代表子级放开）。
   */
  function canAnyEntry(entryIds: readonly string[]): boolean {
    return entryIds.some((id) => canEntry(id))
  }

  return { permissions, permissionsLoaded, hasSession, requestState, viewState, can, canEntry, canAnyEntry }
}
