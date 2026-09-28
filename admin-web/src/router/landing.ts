/**
 * S3-132 登录落地 / 无权跳转的落点解析（纯函数，路由守卫与登录页共用同一份实现）
 *
 * 背景：此前"登录成功"与"无权拒绝"都硬编码跳 `/dashboard`，而 `/dashboard` 自身带
 * `meta.roles = ["SUPER_ADMIN","STORE_MANAGER"]` ⇒ 不属于该集合的角色被拒后又被送回同一处，
 * vue-router 判定 "possibly infinite redirection" 并中止导航（死循环）。
 *
 * 落地优先级（派单卡 S3-132 裁定 R1）：
 *   ① `default_homepage` 已配置 且 该路由存在 且 当前角色可访问 ⇒ 用它；
 *   ② `/dashboard` 当前角色可访问 ⇒ 用它（保持既有拒绝落点不变）；
 *   ③ POS 类角色（STORE_MANAGER / STORE_OPERATOR）⇒ `/pos/dashboard`；
 *   ④ 其余「无可用页」的角色 ⇒ `/login`（调用方须同时清会话，见裁定 R2）。
 *
 * 说明（内部一致性取舍，已在回传卡"风险与自我报备"中报备）：裁定 R1 的字面顺序把 POS 映射排在
 * `/dashboard` 兜底之前，但 `STORE_MANAGER` 本就可访问 `/dashboard`，按字面顺序会改变现存账号的
 * 既有落点，与验收标准④「既有守卫用例 3 passed」冲突。本实现按验收标准④ 取 ②→③ 顺序：
 * 可访问 `/dashboard` 的角色落点保持 `/dashboard`，POS 映射对「无法访问 `/dashboard` 的 POS 角色」
 * （如 STORE_OPERATOR）生效。
 */

/** 只用到路径与 meta.roles 的最小路由记录形状（兼容 vue-router 的 RouteRecordNormalized） */
export interface LandingRoute {
  path: string;
  meta?: Record<string, unknown> | null;
  children?: readonly LandingRoute[];
  /** 纯重定向路由（无 component）不可作为落地页：落地到它等于再跳一次，可能又跳回被拒目标 */
  redirect?: unknown;
  component?: unknown;
}

export const LOGIN_PATH = "/login";
export const DASHBOARD_PATH = "/dashboard";
export const POS_DASHBOARD_PATH = "/pos/dashboard";

/** POS 类角色（无 `/dashboard` 权限时的映射落点） */
const POS_ROLES = ["STORE_MANAGER", "STORE_OPERATOR"];

/**
 * 归一化路径：去 query/hash、去尾部斜杠、补前导斜杠。
 * 路由表里的子路由是相对路径（如 "dashboard"），vue-router 的 getRoutes() 给的是绝对路径，
 * 两者都要能对上，故统一归一化后再比较。
 */
export function normalizePath(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const withoutQuery = raw.trim().split(/[?#]/)[0].trim();
  if (!withoutQuery) return "";
  const prefixed = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return prefixed.length > 1 ? prefixed.replace(/\/+$/, "") : prefixed;
}

/** 角色命中判定：与守卫 `meta.roles` 同一语义（路由未声明 roles ⇒ 不限角色） */
export function matchRoles(
  userRoles: readonly string[] | null | undefined,
  allowedRoles: readonly string[] | null | undefined,
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return Boolean(userRoles && userRoles.some((role) => allowedRoles.includes(role)));
}

/** 取路由声明的允许角色（非字符串项一律忽略，防御脏数据） */
function allowedRolesOf(route: LandingRoute): string[] {
  const roles = route.meta?.roles;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
}

/** 拼接父子路径（子路由是相对路径，如 "dashboard"） */
function joinPath(parentPath: string, childPath: string): string {
  if (childPath.startsWith("/")) return childPath;
  if (!parentPath || parentPath === "/") return `/${childPath}`;
  return `${parentPath.replace(/\/+$/, "")}/${childPath}`;
}

function searchRoutes(routes: readonly LandingRoute[], parentPath: string, target: string): LandingRoute | null {
  for (const route of routes) {
    const fullPath = joinPath(parentPath, route.path);
    if (normalizePath(fullPath) === target) return route;
    if (route.children && route.children.length > 0) {
      const hit = searchRoutes(route.children, fullPath, target);
      if (hit) return hit;
    }
  }
  return null;
}

/** 在路由表中查找路径对应记录（未知路径返回 null；子路由与父子路径拼接后匹配） */
export function findLandingRoute(routes: readonly LandingRoute[], path: string): LandingRoute | null {
  const target = normalizePath(path);
  if (!target) return null;
  return searchRoutes(routes, "", target);
}

/** 当前角色能否访问给定路径：路由存在 且 不是纯重定向路由 且 角色命中 */
export function canAccessPath(
  routes: readonly LandingRoute[],
  path: string,
  userRoles: readonly string[] | null | undefined,
): boolean {
  const route = findLandingRoute(routes, path);
  if (!route) return false;
  if (route.redirect !== undefined && route.component === undefined) return false;
  return matchRoles(userRoles, allowedRolesOf(route));
}

/**
 * 解析落地页：返回值**必定是当前角色可访问的路径**（无可用页时返回 `/login`）。
 * 纯函数——只读入参，不做 IO、不依赖 store / 浏览器。
 *
 * @param userRoles 当前用户角色码数组（后端 `roles: string[]`）
 * @param defaultHomepage 用户在 `t_sys_user.default_homepage` 配置的首页（未配置传空）
 * @param routes 路由表（守卫传本地 routes，登录页传 `router.getRoutes()`）
 */
export function resolveLandingPath(
  userRoles: readonly string[] | null | undefined,
  defaultHomepage: unknown,
  routes: readonly LandingRoute[],
): string {
  const roles = Array.isArray(userRoles)
    ? userRoles.filter((role): role is string => typeof role === "string" && role.length > 0)
    : [];

  const candidates: string[] = [];
  const configured = normalizePath(defaultHomepage);
  if (configured) candidates.push(configured);
  candidates.push(DASHBOARD_PATH);
  if (roles.some((role) => POS_ROLES.includes(role))) candidates.push(POS_DASHBOARD_PATH);

  return candidates.find((candidate) => canAccessPath(routes, candidate, roles)) || LOGIN_PATH;
}
