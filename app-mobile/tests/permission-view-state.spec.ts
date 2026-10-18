/**
 * QODER-4（S3-239）· 「未取到权限码」三态统一 · 反测装置
 *
 * 判据（任务书 §三，逐条对应）：
 *   1) ① 加载中（请求挂起不返回）⇒ 菜单渲染**最小可见集**（不是全量、不是空）且**无失败提示**；
 *   2) ② 请求成功 + 码集为空 ⇒ 需码菜单/入口**全部不显示**（失败关闭，现状保持）；
 *   3) ③ 请求失败 ⇒ 最小可见集 + **提示出现**（可关闭：dismissBanner 后仅文案消失，集合不动）；
 *   4) 反测（另跑，非本文件）：把 `permission-view-state.ts` 的 loading/unavailable 分支打回
 *      'showAll'（改造前 null⇒放全量）⇒ 用例 1/3 **必红**——本文件的断言全部按
 *      "最小可见集 ≠ 全量 ≠ 空集" 三向卡死，注入后 visibility=null（放全量）必然撞红；
 *   5) **两端同源**：menu store / permission-gates / usePermissionGate 三个消费方源码必须
 *      引用单一定义源（静态断言，防止"某端偷偷自判 null"回潮）；
 *   6) 生产路径的 resolvePermissionViewState **永不返回 'showAll'**（注入点语义仅限反测）。
 *
 * ⚠️ 注释与本文件均不写带引号的真实门 id；入口一律从注册表枚举里程序化选取。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  MINIMUM_VISIBLE_ENTRY_IDS,
  MINIMUM_VISIBLE_MENU_CODES,
  PERMISSION_UNAVAILABLE_NOTICE,
  resolvePermissionViewState,
  type PermissionViewStateInput,
} from '@/config/permission-view-state'
import {
  ENTRY_GATE_BY_ID,
  GATED_ENTRY_IDS,
  REGISTERED_ENTRY_IDS,
  PENDING_CODE_ENTRY_IDS,
  isEntryVisible,
} from '@/config/permission-gates'
import { buildMenuVisibility, filterGroupsByCodes, isPageVisible } from '@/config/function-menu'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '..', 'src')

/** 程序化取样本 id（注册表为唯一真相源，测试不写死门 id 字面量） */
const gatedId = GATED_ENTRY_IDS[0]
const gatedCodes = ENTRY_GATE_BY_ID[gatedId].codes
const registeredId = REGISTERED_ENTRY_IDS[0]
const pendingId = PENDING_CODE_ENTRY_IDS[0]

// ── 一、单一定义源：三态契约（纯函数，全输入组合）──────────────────────────
describe('resolvePermissionViewState（三态单一定义源契约）', () => {
  it('① 加载中：有登录态 + 请求在途 + 无数组 ⇒ loading / showAllMinimal / 不提示', () => {
    const r = resolvePermissionViewState({ hasSession: true, requestState: 'pending', permissions: null })
    expect(r.viewState).toBe('loading')
    expect(r.policy).toBe('showAllMinimal')
    expect(r.showNotice).toBe(false)
    expect(r.noticeText).toBe('')
  })

  it('② 确实无码：请求成功 + 空数组 ⇒ empty / hideNeedsCode（失败关闭）', () => {
    const r = resolvePermissionViewState({ hasSession: true, requestState: 'ok', permissions: [] })
    expect(r.viewState).toBe('empty')
    expect(r.policy).toBe('hideNeedsCode')
    expect(r.showNotice).toBe(false)
  })

  it('③ 未取到：请求失败 ⇒ unavailable / showAllMinimal + 提示出现', () => {
    const r = resolvePermissionViewState({ hasSession: true, requestState: 'failed', permissions: null })
    expect(r.viewState).toBe('unavailable')
    expect(r.policy).toBe('showAllMinimal')
    expect(r.showNotice).toBe(true)
    expect(r.noticeText).toBe(PERMISSION_UNAVAILABLE_NOTICE)
  })

  it('③ 变体：请求成功却缺字段（老版本缓存缺 permissions）⇒ 同 ③，不当 ②', () => {
    const r = resolvePermissionViewState({ hasSession: true, requestState: 'ok', permissions: undefined })
    expect(r.viewState).toBe('unavailable')
    expect(r.policy).toBe('showAllMinimal')
    expect(r.showNotice).toBe(true)
  })

  it('ready：请求成功 + 非空数组 ⇒ showGranted（数组说了算，与 requestState 无关）', () => {
    for (const rs of ['pending', 'ok', 'failed'] as const) {
      const r = resolvePermissionViewState({ hasSession: true, requestState: rs, permissions: ['sale:create'] })
      expect(r.viewState).toBe('ready')
      expect(r.policy).toBe('showGranted')
    }
  })

  it('无登录态 ⇒ 失败关闭（empty），不渲染需码项也不提示', () => {
    const r = resolvePermissionViewState({ hasSession: false, requestState: 'pending', permissions: null })
    expect(r.viewState).toBe('empty')
    expect(r.policy).toBe('hideNeedsCode')
    expect(r.showNotice).toBe(false)
  })

  it('生产路径永不返回 showAll（该值仅为反测注入点存在）', () => {
    const combos: PermissionViewStateInput[] = []
    for (const hasSession of [true, false]) {
      for (const requestState of ['pending', 'ok', 'failed'] as const) {
        for (const permissions of [null, undefined, [], ['sale:create']]) {
          combos.push({ hasSession, requestState, permissions })
        }
      }
    }
    for (const input of combos) {
      expect(resolvePermissionViewState(input).policy).not.toBe('showAll')
    }
  })
})

// ── 二、最小可见集常量：不是全量、不是空、不外溢写域 ────────────────────────
describe('MINIMUM_VISIBLE_* 常量口径', () => {
  it('菜单最小可见集非空且远小于全量；只落报表只读域', () => {
    expect(MINIMUM_VISIBLE_MENU_CODES.length).toBeGreaterThan(0)
    expect(MINIMUM_VISIBLE_MENU_CODES.length).toBeLessThanOrEqual(10)
    for (const code of MINIMUM_VISIBLE_MENU_CODES) {
      expect(code.startsWith('report:')).toBe(true)
    }
  })

  it('兼容态下最小集只放报表域 6 页；开单页（sale 域写页）不可见 ⇒ 不是放全量', () => {
    const v = buildMenuVisibility(new Set<string>(MINIMUM_VISIBLE_MENU_CODES))
    const visible = filterGroupsByCodes(v, true).flatMap((g) => g.items.map((it) => it.code))
    expect(visible.length).toBe(MINIMUM_VISIBLE_MENU_CODES.length)
    expect(isPageVisible('sale:bill', v)).toBe(false)
    expect(isPageVisible('goods:stock-check', v)).toBe(false)
    // 全量口径（null ⇒ 放全量）下 sale:bill 必可见 ⇒ 注入 showAll 后本用例即红（反测分辨力所在）
    expect(isPageVisible('sale:bill', null)).toBe(true)
  })

  it('入口门最小可见集当前为空集（gated 写入口不得混入）', () => {
    expect(MINIMUM_VISIBLE_ENTRY_IDS.length).toBe(0)
    for (const id of GATED_ENTRY_IDS) expect(MINIMUM_VISIBLE_ENTRY_IDS).not.toContain(id)
  })
})

// ── 三、入口门三态表现（isEntryVisible，纯数据侧）───────────────────────────
describe('isEntryVisible（入口门 ↔ 三态源）', () => {
  it('① 加载中：gated 隐藏、无码入口可见、pending-code 恒隐藏', () => {
    const q = { hasSession: true, requestState: 'pending' as const, permissions: null }
    expect(isEntryVisible(gatedId, q)).toBe(false)
    expect(isEntryVisible(registeredId, q)).toBe(true)
    expect(isEntryVisible(pendingId, q)).toBe(false)
  })

  it('③ 未取到：与 ① 同显隐、但状态可观测（三态源给提示）', () => {
    const q = { hasSession: true, requestState: 'failed' as const, permissions: undefined }
    expect(isEntryVisible(gatedId, q)).toBe(false)
    expect(isEntryVisible(registeredId, q)).toBe(true)
    expect(resolvePermissionViewState(q).showNotice).toBe(true)
  })

  it('② 确实无码：gated / pending-code 全隐藏，无码入口仍可见（整端不空白）', () => {
    const q = { hasSession: true, requestState: 'ok' as const, permissions: [] }
    expect(isEntryVisible(gatedId, q)).toBe(false)
    expect(isEntryVisible(pendingId, q)).toBe(false)
    expect(isEntryVisible(registeredId, q)).toBe(true)
  })

  it('ready：持码显示 / 不持码隐藏 / 通配码显示；pending-code 任何码都隐藏', () => {
    expect(isEntryVisible(gatedId, { hasSession: true, requestState: 'ok', permissions: gatedCodes })).toBe(true)
    expect(isEntryVisible(gatedId, { hasSession: true, requestState: 'ok', permissions: ['nothing:match'] })).toBe(
      false
    )
    expect(isEntryVisible(gatedId, { hasSession: true, requestState: 'ok', permissions: ['*'] })).toBe(true)
    expect(isEntryVisible(pendingId, { hasSession: true, requestState: 'ok', permissions: ['*'] })).toBe(false)
  })

  it('未知 id ⇒ 无码口径：三态下恒可见（不抛错、不误隐藏）', () => {
    const q = { hasSession: true, requestState: 'pending' as const, permissions: null }
    expect(isEntryVisible('no-such-entry-id-at-all', q)).toBe(true)
  })
})

// ── 四、菜单 store 三态接线（①/②/③ + 提示可关闭）───────────────────────────
let mockUserState: { user: { id: string } | null; permissions: string[] | null; initialized: boolean }
let apiBehaviour: () => Promise<string[]>
let cacheStore: Record<string, string>

vi.mock('@/stores/user', () => ({
  useUserStore: () => mockUserState
}))
vi.mock('@/api/modules/menu', () => ({
  getUserMenus: () => apiBehaviour(),
  toAllowedCodes: (codes: string[]) => new Set(codes)
}))

const menuModule = import('@/stores/menu')

describe('menu store（三态接线的渲染结果）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cacheStore = {}
    mockUserState = { user: { id: 'u-test' }, permissions: null, initialized: false }
    vi.stubGlobal('uni', {
      getStorageSync: (k: string) => cacheStore[k] ?? '',
      setStorageSync: (k: string, v: string) => {
        cacheStore[k] = v
      },
    })
  })

  it('用例①：请求挂起不返回 ⇒ 首帧就是最小可见集（不是全量、不是空），无失败提示', async () => {
    apiBehaviour = () => new Promise<string[]>(() => {})
    const { useMenuStore } = await menuModule
    const store = useMenuStore()
    void store.ensureLoaded()
    expect(store.visibility).not.toBeNull() // null = 放全量（改造前旧语义，注入 showAll 即复活 ⇒ 本断言撞红）
    const visible = filterGroupsByCodes(store.visibility!, true).flatMap((g) => g.items.map((it) => it.code))
    expect(visible.sort()).toEqual([...MINIMUM_VISIBLE_MENU_CODES].sort())
    expect(store.bannerText).toBe('')
    expect(store.showRetry).toBe(false)
    expect(store.status).toBe('idle')
  })

  it('用例②：成功返回空集 ⇒ 需码菜单全部不显示（失败关闭），无提示', async () => {
    apiBehaviour = async () => []
    const { useMenuStore } = await menuModule
    const store = useMenuStore()
    await store.ensureLoaded()
    expect(store.visibility).not.toBeNull()
    expect(filterGroupsByCodes(store.visibility!, true).length).toBe(0)
    expect(store.bannerText).toBe('')
    expect(store.status).toBe('ok')
  })

  it('用例③：请求失败且无缓存 ⇒ 最小可见集 + 提示出现；可关闭且关闭后集合不变', async () => {
    apiBehaviour = async () => {
      throw new Error('network down')
    }
    const { useMenuStore } = await menuModule
    const store = useMenuStore()
    await store.ensureLoaded()
    expect(store.visibility).not.toBeNull() // 注入 showAll ⇒ null（放全量）⇒ 本断言撞红
    const visible = filterGroupsByCodes(store.visibility!, true).flatMap((g) => g.items.map((it) => it.code))
    expect(visible.sort()).toEqual([...MINIMUM_VISIBLE_MENU_CODES].sort())
    expect(store.bannerText).toBe(PERMISSION_UNAVAILABLE_NOTICE)
    expect(store.showRetry).toBe(true)
    store.dismissBanner()
    expect(store.bannerText).toBe('')
    expect(filterGroupsByCodes(store.visibility!, true).flatMap((g) => g.items).length).toBe(visible.length)
  })

  it('用例③-缓存优先：请求失败但有上次成功缓存 ⇒ 按缓存渲染 + stale 明示（① 不判失败关闭）', async () => {
    apiBehaviour = async () => {
      throw new Error('network down')
    }
    const { useMenuStore } = await menuModule
    const store = useMenuStore()
    cacheStore[`merchant_menu_codes_cache_${mockUserState.user!.id}`] = JSON.stringify(['sale:bill'])
    await store.ensureLoaded()
    expect(store.visibility!.codes.has('sale:bill')).toBe(true)
    expect(store.visibility!.codes.has('report:dashboard')).toBe(false) // 有缓存时不掺最小集
    expect(store.bannerText).toBe('权限信息加载失败，显示的是上次结果')
    expect(store.status).toBe('stale')
  })

  it('无登录态 ⇒ 不播种不取数（visibility 保持 null，功能页本身不可达）', async () => {
    apiBehaviour = async () => {
      throw new Error('must not be called')
    }
    const { useMenuStore } = await menuModule
    mockUserState = { user: null, permissions: null, initialized: false }
    const store = useMenuStore()
    await store.ensureLoaded()
    expect(store.visibility).toBeNull()
    expect(store.status).toBe('idle')
  })

  it('成功取数后写缓存（③ 的缓存优先来源）且提示复位', async () => {
    apiBehaviour = async () => ['sale:record']
    const { useMenuStore } = await menuModule
    const store = useMenuStore()
    await store.ensureLoaded()
    expect(store.visibility!.codes.has('sale:record')).toBe(true)
    expect(cacheStore[`merchant_menu_codes_cache_${mockUserState.user!.id}`]).toContain('sale:record')
    expect(store.bannerText).toBe('')
  })
})

// ── 五、两端同源（静态断言：谁都不许再自判 null）────────────────────────────
describe('两端同源接线（防回潮）', () => {
  const consumers = ['stores/menu.ts', 'config/permission-gates.ts', 'composables/usePermissionGate.ts']
  for (const rel of consumers) {
    it(`${rel} 必须经单一定义源判定`, () => {
      const src = readFileSync(join(SRC, rel), 'utf8')
      expect(src).toContain('permission-view-state')
      expect(src).toContain('resolvePermissionViewState')
    })
  }

  it('menu.ts 不再存在「首次失败空集」旧兜底常量', () => {
    const src = readFileSync(join(SRC, 'stores/menu.ts'), 'utf8')
    expect(src).not.toContain('FIRST_FAIL_FALLBACK_CODES')
  })

  it('入口判定短路顺序：pending-code 先于三态、无码先于三态（isEntryVisible 源码形态）', () => {
    const src = readFileSync(join(SRC, 'config/permission-gates.ts'), 'utf8')
    const fn = src.slice(src.indexOf('export function isEntryVisible'))
    expect(fn.indexOf('isPendingCodeEntry')).toBeLessThan(fn.indexOf('resolvePermissionViewState'))
    expect(fn.indexOf('codes.length === 0')).toBeLessThan(fn.indexOf('resolvePermissionViewState'))
  })
})
