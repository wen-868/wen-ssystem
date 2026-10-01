/**
 * 当前用户"可用页面 code"共享 store（S3-136-F1 阶段一）
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
 *  3. 失败回退：上一次成功的集合（本地缓存）+ 界面明示；首次失败且无缓存 ⇒ 失败关闭（空集）+ 明示 + 重试。
 *
 * 取数口径与旧实现一致：GET /admin/menus/user（api/modules/menu.ts，silent 请求）。
 *
 * @author 阿澈
 */
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getUserMenus, toAllowedCodes } from '@/api/modules/menu'
import { buildMenuVisibility, type MenuVisibility } from '@/config/function-menu'
import { useUserStore } from '@/stores/user'

/** 权限信息加载状态：idle=未加载 / ok=本次拉取成功 / stale=失败但有缓存 / firstfail=失败且无缓存 */
export type MenuLoadStatus = 'idle' | 'ok' | 'stale' | 'firstfail'

/** 缓存 key 前缀（按用户维度隔离，避免换账号后读到上一个人的集合）；非敏感 key，走明文存储 */
const CACHE_KEY_PREFIX = 'merchant_menu_codes_cache_'

/**
 * "首次失败且无缓存"的兜底集合 = 空集（失败关闭）。
 * 为什么不给白名单：此时既没有本次结果也没有历史结果，任何"非空最小集"都是替用户猜权限（可能多放），
 * 与 S3-136-F1"不得静默放全量"同源；故取失败关闭——一页不显示 + 顶部明示 + 提供重试。
 * 若业务确要改成白名单（例如只留销售开单/销售记录），需凌舟裁定后再改这个常量。
 */
const FIRST_FAIL_FALLBACK_CODES: readonly string[] = []

export const useMenuStore = defineStore('menu', () => {
  const userStore = useUserStore()

  /**
   * 当前用户可见性判定输入（同时含 code 集与前缀集，见 config/function-menu.ts 的 MenuVisibility）；
   * null = 尚未取到任何结果（首屏加载中）⇒ 判定放全量，维持改造前首屏行为
   */
  const visibility = ref<MenuVisibility | null>(null)
  const status = ref<MenuLoadStatus>('idle')
  let inFlight: Promise<void> | null = null

  const cacheKey = computed(() => `${CACHE_KEY_PREFIX}${userStore.user?.id ?? 'anonymous'}`)

  /** 界面明示文案（空串 = 不展示） */
  const bannerText = computed(() => {
    if (status.value === 'stale') return '权限信息加载失败，显示的是上次结果'
    if (status.value === 'firstfail') return '权限信息加载失败，请点击重试'
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

  async function load(): Promise<void> {
    try {
      const menus = await getUserMenus()
      const codes = toAllowedCodes(menus)
      visibility.value = buildMenuVisibility(codes)
      status.value = 'ok'
      writeCache(codes)
    } catch {
      const cached = readCache()
      if (cached) {
        visibility.value = buildMenuVisibility(cached)
        status.value = 'stale'
      } else {
        // 空集 ⇒ 兼容态下"一页都不显示"（空集 ≠ null；null 才会放全量）
        visibility.value = buildMenuVisibility(new Set<string>(FIRST_FAIL_FALLBACK_CODES))
        status.value = 'firstfail'
      }
    }
  }

  /** 首次进入拉取；已取到结果（含缓存回退结果）就不再重复拉取 */
  async function ensureLoaded(): Promise<void> {
    if (!userStore.user) return
    if (status.value !== 'idle') return
    inFlight = inFlight ?? load().finally(() => { inFlight = null })
    await inFlight
  }

  /** 强制重拉（失败提示里的「重试」用） */
  async function refresh(): Promise<void> {
    inFlight = inFlight ?? load().finally(() => { inFlight = null })
    await inFlight
  }

  // 换账号 / 退出登录：丢弃上一用户的结果，避免串用
  watch(
    () => userStore.user?.id ?? null,
    () => {
      visibility.value = null
      status.value = 'idle'
    }
  )

  return { visibility, status, bannerText, showRetry, ensureLoaded, refresh }
})
