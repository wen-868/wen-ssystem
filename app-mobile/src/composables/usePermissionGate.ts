/**
 * 入口权限门 composable（S3-230）
 *
 * 用途：页面/组件按**注册表里的入口 id** 决定"这个入口要不要显示"，
 * 模板里用 `v-if` 调 `canEntry`（入参 = 注册表里的入口 id），脚本里用 `can(['<权限码>'])` 判零散动作。
 * ⚠️ 本文件与页面注释里**不要写带引号的真实门 id**：证据脚本靠"字面出现次数"核对
 *    「注册表 ↔ 源码引用」一致性，注释里的范例会被算成一处引用（S3-230 实测踩过）。
 *
 * 口径（**与 stores/menu.ts 的 null / 空集口径一致**，别在这里分叉）：
 *  · `permissions` 为 null/undefined ⇒ 尚未取到权限码（老版本本地缓存）⇒ **放行**（维持改造前可见性）；
 *  · `permissions` 为空数组          ⇒ 确实无任何码 ⇒ **不显示**（失败关闭）；
 *  · 码数组为空（注册表里 `status=registered` 的入口）⇒ **放行**，由后端收编单/立码单决定后续。
 *
 * 为什么不用「角色名单」判定：不变量 I1 约束的是**权限码**（后端 `requirePermission(码)`），
 * 角色与码会各自漂移（`STORE_ADMIN`/`SALESMAN` 是旧词表角色；菜单授予 ≠ 持码）。
 * 判定实现集中在 `config/permission-gates.ts`，与后端 `matchPermission` 同源。
 */
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { codesOfEntry, hasPermissionCodes } from '@/config/permission-gates'

export function usePermissionGate() {
  const userStore = useUserStore()

  /** 当前用户权限码（null/undefined = 未取到） */
  const permissions = computed<string[] | null | undefined>(() => userStore.permissions)

  /** 是否已取到权限码（用于"暂缓判定"类展示，一般页面不需要） */
  const permissionsLoaded = computed(() => Array.isArray(permissions.value))

  /** 直接按码判定（用于页面内零散动作；码数组 = 全部持有才通过） */
  function can(codes: readonly string[] | string | null | undefined): boolean {
    if (codes === null || codes === undefined) return true
    const list = typeof codes === 'string' ? [codes] : codes
    return hasPermissionCodes(permissions.value, list)
  }

  /** 按注册表入口 id 判定（推荐：入口与码的对应关系只写在注册表里） */
  function canEntry(entryId: string): boolean {
    return can(codesOfEntry(entryId))
  }

  /**
   * 「任一入口可见」判定：用于**父级入口**的显隐 —— 一个父容器里含多个子入口时，
   * 父容器应在"至少有一个子入口对该账号可见"时显示（否则整块空白）。
   * 注意：父级用"任一"、子级仍各自用 `canEntry`（父级宽松不代表子级放开）。
   */
  function canAnyEntry(entryIds: readonly string[]): boolean {
    return entryIds.some((id) => canEntry(id))
  }

  return { permissions, permissionsLoaded, can, canEntry, canAnyEntry }
}
