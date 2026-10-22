/**
 * 工作台静态 route manifest（WORKBENCH-02）
 *
 * 最低映射：menuCode → routeName → component。
 * - 本表是前端白名单，不是后端菜单真相源；动态菜单 `/api/admin/menus/user` 本阶段不接入。
 * - 可见性不写死在表内，统一由路由 `meta.roles` 派生（AI 模式与人工模式共用同一份声明）。
 * - 范围：人工侧 12 组 71 项 + 收银台 9 项（8 条路由 + 1 个本地打印设置动作）。
 * - 本表不新增业务动作，也不改变现有页面组件。
 */
import type { ManifestGroup, ManifestItem, RouteRolesResolver } from "./types";
import { MANUAL_GROUPS_A } from "./manifest-manual-a";
import { MANUAL_GROUPS_B } from "./manifest-manual-b";
import { CASHIER_ITEMS } from "./manifest-pos";

export type { ManifestGroup, ManifestItem, ManifestComponentLoader, RouteRolesResolver } from "./types";
export { CASHIER_ITEMS } from "./manifest-pos";

/** 人工操作台 12 组 71 项（顺序与 MainLayout 现有导航一致） */
export const MANUAL_GROUPS: ManifestGroup[] = [...MANUAL_GROUPS_A, ...MANUAL_GROUPS_B];

/** 与路由守卫同一语义：未声明 roles ⇒ 不限角色；声明了则需命中任一 */
export function matchManifestRoles(
  userRoles: readonly string[] | null | undefined,
  allowedRoles: readonly string[] | null | undefined,
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return Boolean(userRoles && userRoles.some((role) => allowedRoles.includes(role)));
}

function itemRoles(entry: ManifestItem, resolveRoles: RouteRolesResolver): string[] | null {
  const source = entry.routeName ?? entry.visibilityFrom ?? null;
  if (!source) return null;
  return resolveRoles(source);
}

/** 单项可见性：角色一律从路由 meta.roles 派生，未知路由不可见 */
export function isManifestItemVisible(
  entry: ManifestItem,
  userRoles: readonly string[] | null | undefined,
  resolveRoles: RouteRolesResolver,
): boolean {
  const roles = itemRoles(entry, resolveRoles);
  if (roles === null) return false;
  return matchManifestRoles(userRoles, roles);
}

/** 过滤分组：组内一项都不可见时整组隐藏 */
export function filterVisibleGroups(
  groups: readonly ManifestGroup[],
  userRoles: readonly string[] | null | undefined,
  resolveRoles: RouteRolesResolver,
): ManifestGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((entry) => isManifestItemVisible(entry, userRoles, resolveRoles)),
    }))
    .filter((group) => group.items.length > 0);
}

/** 过滤收银台项 */
export function filterVisibleItems(
  items: readonly ManifestItem[],
  userRoles: readonly string[] | null | undefined,
  resolveRoles: RouteRolesResolver,
): ManifestItem[] {
  return items.filter((entry) => isManifestItemVisible(entry, userRoles, resolveRoles));
}

/** 人工侧项总数（默认取 12 组 71 项），供测试与证据核对 */
export function countManualItems(groups: readonly ManifestGroup[] = MANUAL_GROUPS): number {
  return groups.reduce((sum, group) => sum + group.items.length, 0);
}
