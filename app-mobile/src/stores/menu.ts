/**
 * 当前用户"可用页面 code"共享 store（S3-136-F1 阶段一 · S3-239 三态统一）
 *
 * 背景（审计卡 M2/M6）：
 *  - 改造前，可见性判定在 functions.vue / more-functions.vue 各拉一次 /admin/menus/user，
 *    各自算出**模块前缀集**后按前缀过滤（function-menu.ts:175 code.split(':')[0]）；
 *  - 接口失败时两个页面都会把集合置为 undefined ⇒ 静默回退全量（等于临时取消门禁）。
 *
 * 本 store 的三件事：
 *  1. 共用同一份：两个页面只调 ensureLoaded()，会话内只拉一次，不再各拉一次；
 *  2. 口径改为**兼容态**：页面 code 精确命中为主，code 未命中时回落改造前的模块前缀语义
 *     （判定实现见 config/function-menu.ts 的 isPageVisible；为何要回退见该函数注释）；
 *  3. **S3-239 起**：「未取到」的处置不再由本文件自判 null——一律上送
 *     `config/permission-view-state.ts` 的三态单一定义源裁决：
 *       ① 加载中（请求在途）⇒ 有缓存按缓存、无缓存按**最小可见集**（**不放全量、不判失败**）；
 *       ② 请求成功且码集为空 ⇒ 失败关闭（空集，需码菜单不显示）；
 *       ③ 请求失败/超时 ⇒ 有缓存按缓存 + 明示（stale）；无缓存 ⇒ 最小可见集 + 可关闭提示 + 重试。
 *     改造前"visibility=null ⇒ 放全量"的首屏口径到此**废止**（null 仅保留给"无登录态"，
 *     此时功能页本身不可达）；入口门与本页自此共用同一套三态口径（原"有意分叉"结束）。
 *
 * 取数口径与旧实现一致：GET /admin/menus/user（api/modules/menu.ts，silent 请求）。
 *
 * @author 阿澈（S3-239 三态接线：QODER）
 */
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getUserMenus, toAllowedCodes } from '@/api/modules/menu'
import { buildMenuVisibility, type MenuVisibility } from '@/config/function-menu'
import {
  MINIMUM_VISIBLE_MENU_CODES,
  resolvePermissionViewState,
  type PermissionViewStateResult,
} from '@/config/permission-view-state'
import { useUserStore } from '@/stores/user'

/** 权限信息加载状态：idle=未加载（① 态渲染中）/ ok=本次拉取成功 / stale=失败但有缓存 / firstfail=失败且无缓存（③ 态） */
export type MenuLoadStatus = 'idle' | 'ok' | 'stale' | 'firstfail'

/** 缓存 key 前缀（按用户维度隔离，避免换账号后读到上一个人的集合）；非敏感 key，走明文存储 */
const CACHE_KEY_PREFIX = 'merchant_menu_codes_cache_'

/** ③ 态「失败但有缓存」的明示文案（展示的是上次结果） */
const STALE_BANNER_TEXT = '权限信息加载失败，显示的是上次结果'

export const useMenuStore = defineStore('menu', () => {
  const userStore = useUserStore()

  /**
   * 当前用户可见性判定输入（同时含 code 集与前缀集，见 config/function-menu.ts 的 MenuVisibility）；
   * S3-239 起：登录态下**永不**为 null（①③ 态由三态源给出"缓存/最小可见集"）；
   * null 只剩"无登录态"一种来源，此时功能页不可达，不承载放全量语义。
   */
  const visibility = ref<MenuVisibility | null>(null)
  const status = ref<MenuLoadStatus>('idle')
  /** 提示是否被用户关闭（关闭只隐藏文案，不改渲染集合；重新拉取成功后复位） */
  const noticeDismissed = ref(false)
  /** ③ 态（无缓存分支）的提示文案：取三态源的 noticeText（单一定义源，文案不在此复读） */
  const firstFailNotice = ref('')
  let inFlight: Promise<void> | null = null

  const cacheKey = computed(() => `${CACHE_KEY_PREFIX}${userStore.user?.id ?? 'anonymous'}`)

  /** 界面明示文案（空串 = 不展示）；① 态不得出现失败提示 */
  const bannerText = computed(() => {
    if (noticeDismissed.value) return ''
    if (status.value === 'stale') return STALE_BANNER_TEXT
    if (status.value === 'firstfail') return firstFailNotice.value
    return ''
  })
  const showRetry = computed(() => status.value === 'stale' || status.value === 'firstfail')

  function readCache(): Set<string> | null {
    try {
      const raw = uni.getStorageSync(cacheKey.value)
      const parsed = typeof raw === 'string' && raw ? JSON.parse(raw) : raw
      if (Array.isArray(parsed)) {
        const codes = parsed.filter((c): c is string => typeof c === 'string' && c.length > 0)
        return codes.length > 0 ? new Set<string>(codes) : null
      }
    } catch {
      // 缓存损坏按"无缓存"处理
    }
    return null
  }

  function writeCache(codes: Set<string>): void {
    try {
      uni.setStorageSync(cacheKey.value, JSON.stringify([...codes]))
    } catch {
      // 写缓存失败不影响本次展示
    }
  }

  /**
   * 三态裁决结果 → 渲染输入（**本文件不自行判 null**，null/失败的处置全部由三态源给出）：
   *  · showGranted    ⇒ 用本次取到的码集；
   *  · hideNeedsCode  ⇒ 请求成功但集为空 ⇒ 空集失败关闭（需码菜单全部不显示）；
   *  · showAllMinimal ⇒ 有缓存按缓存，无缓存按最小可见集（**不是全量**）；
   *  · showAll        ⇒ 改造前旧语义（放全量）：生产路径不可达，仅为反测注入点保留——
   *                     把三态源分支打回它 ⇒ 用例①/③ 必红（tests/permission-view-state.spec.ts）。
   */
  function applyViewState(view: PermissionViewStateResult, granted: Set<string> | null): void {
    switch (view.policy) {
      case 'showGranted':
        visibility.value = buildMenuVisibility(granted ?? new Set<string>())
        break
      case 'hideNeedsCode':
        visibility.value = buildMenuVisibility(new Set<string>())
        break
      case 'showAllMinimal':
        visibility.value = buildMenuVisibility(readCache() ?? new Set<string>(MINIMUM_VISIBLE_MENU_CODES))
        break
      case 'showAll':
        visibility.value = null
        break
    }
  }

  /** ① 态首帧播种：请求在途时就按"缓存/最小可见集"渲染，不放全量、不判失败 */
  function seedLoadingFallback(): void {
    if (!userStore.user) return
    const view = resolvePermissionViewState({ hasSession: true, requestState: 'pending', permissions: null })
    if (view.policy === 'showAllMinimal') applyViewState(view, null)
  }

  async function load(): Promise<void> {
    try {
      const menus = await getUserMenus()
      const codes = toAllowedCodes(menus)
      const view = resolvePermissionViewState({ hasSession: true, requestState: 'ok', permissions: [...codes] })
      applyViewState(view, codes)
      status.value = 'ok'
      noticeDismissed.value = false
      writeCache(codes)
    } catch {
      const view = resolvePermissionViewState({ hasSession: true, requestState: 'failed', permissions: null })
      applyViewState(view, null)
      firstFailNotice.value = view.noticeText
      noticeDismissed.value = false
      status.value = readCache() ? 'stale' : 'firstfail'
    }
  }

  /** 首次进入拉取；已取到结果（含缓存回退结果）就不再重复拉取 */
  async function ensureLoaded(): Promise<void> {
    if (!userStore.user) return
    if (status.value !== 'idle') return
    seedLoadingFallback()
    inFlight = inFlight ?? load().finally(() => { inFlight = null })
    await inFlight
  }

  /** 强制重拉（失败提示里的「重试」用） */
  async function refresh(): Promise<void> {
    inFlight = inFlight ?? load().finally(() => { inFlight = null })
    await inFlight
  }

  /** 关闭顶部提示（可关闭口径；不动渲染集合，「重试」按钮仍由 showRetry 提供） */
  function dismissBanner(): void {
    if (status.value === 'stale' || status.value === 'firstfail') noticeDismissed.value = true
  }

  // 换账号 / 退出登录：丢弃上一用户的结果，避免串用；登录后新一帧立即按 ① 态播种（不放全量）
  watch(
    () => userStore.user?.id ?? null,
    () => {
      visibility.value = null
      status.value = 'idle'
      noticeDismissed.value = false
      firstFailNotice.value = ''
      seedLoadingFallback()
    }
  )

  return { visibility, status, bannerText, showRetry, ensureLoaded, refresh, dismissBanner }
})
