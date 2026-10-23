/**
 * 动态菜单访问控制（WORKBENCH-04）
 *
 * 真相源：
 *   - 服务端 `GET /api/admin/menus/user` 返回当前用户可见 menuCode 集合（运行时真理）；
 *   - 静态 `route-manifest.ts` 是前端组件白名单（menuCode → routeName → component）；
 *   - `docs/evidence/WB-REFACTOR-P0/10-route-menu-matrix.md` 是两者之间的对齐证据。
 *
 * 硬规则（fail-closed）：
 *   1. 只有「服务端返回 ∧ 白名单路由存在 ∧ 路由 meta.roles 命中」三者同时满足才可见；
 *   2. 未知菜单码（白名单无桥接）只登记、不渲染；
 *   3. 服务失败 / 加载中 / 空菜单一律最小可见集（空集），不回退全量菜单；
 *   4. 本模块不读取也不改写静态台账（80/80、254/254 基线保持不变）。
 */
import type { ManifestGroup, ManifestItem } from "./types";

export type MenuLoadState = "idle" | "loading" | "ready" | "error";

/** 服务端菜单行（与 backend menu-permission.service.ts 的 MenuItem 字段对齐） */
export interface ServerMenuRow {
  menuCode: string;
  menuName: string;
  menuType: string;
  path: string | null;
  status: string;
}

/** 服务端 menuCode → 前端 routeName：仅收录 10-route-menu-matrix.md 判定「可对齐」的条目 */
export interface MenuBridgeEntry {
  serverCode: string;
  routeName: string;
  /** 证据行（矩阵文件 + 行号），禁止按名称相似临时新增 */
  evidence: string;
}

export const SERVER_MENU_BRIDGE: readonly MenuBridgeEntry[] = [
  { serverCode: "dashboard", routeName: "dashboard", evidence: "10-route-menu-matrix.md:497" },
  { serverCode: "marketing", routeName: "marketing", evidence: "10-route-menu-matrix.md:503" },
  { serverCode: "system", routeName: "system", evidence: "10-route-menu-matrix.md:507" },
  { serverCode: "marketing:coupon", routeName: "marketing-coupon", evidence: "10-route-menu-matrix.md:536" },
  { serverCode: "marketing:full-reduction", routeName: "marketing-full-reduction", evidence: "10-route-menu-matrix.md:537" },
  { serverCode: "marketing:flash-sale", routeName: "marketing-flash-sale", evidence: "10-route-menu-matrix.md:538" },
  { serverCode: "system:config", routeName: "system-config", evidence: "10-route-menu-matrix.md:558" },
  { serverCode: "finance:expenses", routeName: "finance-expenses", evidence: "10-route-menu-matrix.md:639" },
  { serverCode: "finance:reconciliation", routeName: "finance-reconciliation", evidence: "10-route-menu-matrix.md:640" },
  { serverCode: "system:print", routeName: "system-print", evidence: "10-route-menu-matrix.md:659" },
];

/** 载荷不合法（非数组 / 行缺 menuCode）：调用方按失败处理，不得猜数据 */
export class MenuPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuPayloadError";
  }
}

/** 服务端显式停用的菜单行 */
function isDisabledStatus(status: string): boolean {
  return status === "0" || status.toUpperCase() === "DISABLED" || status.toUpperCase() === "INACTIVE";
}

/**
 * 解析 `GET /api/admin/menus/user` 的响应（兼容 `{code,data:[...]}` 包装与裸数组）。
 * 空数组是合法结果（空菜单，fail-closed）；形状不对一律抛错（服务失败）。
 */
export function parseUserMenusPayload(payload: unknown): ServerMenuRow[] {
  const candidate =
    payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;
  if (!Array.isArray(candidate)) {
    throw new MenuPayloadError("菜单响应不是数组（无 data 字段）");
  }
  return candidate.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new MenuPayloadError(`第 ${index + 1} 行不是对象`);
    }
    const row = raw as Record<string, unknown>;
    const menuCode = typeof row.menuCode === "string" ? row.menuCode.trim() : "";
    if (!menuCode) {
      throw new MenuPayloadError(`第 ${index + 1} 行缺少 menuCode`);
    }
    return {
      menuCode,
      menuName: typeof row.menuName === "string" ? row.menuName : "",
      menuType: typeof row.menuType === "string" ? row.menuType : "",
      path: typeof row.path === "string" && row.path ? row.path : null,
      status: row.status === undefined || row.status === null ? "" : String(row.status),
    };
  });
}

export interface MenuAccessInput {
  state: MenuLoadState;
  rows?: readonly ServerMenuRow[] | null;
  /** 静态白名单中真实存在的 routeName（由 route-manifest 派生） */
  manifestRouteNames: readonly string[];
  bridge?: readonly MenuBridgeEntry[];
  /**
   * 当前用户角色（来自 auth.userRoles）。
   * 未提供时 fail-closed：角色层不放行任何路由（业务集合仍单独保留供诊断）。
   */
  userRoles?: readonly string[] | null;
  /** 路由 meta.roles 解析器（与路由守卫同一语义）；未知路由返回 null */
  resolveRoles?: (routeName: string) => readonly string[] | null;
}

export interface MenuAccessSnapshot {
  state: MenuLoadState;
  /** 最终可见 routeName（业务集合 ∩ 当前角色；人工导航与 AI 能力视图共用同一集合） */
  visibleRouteNames: ReadonlySet<string>;
  /** 业务集合（服务端 menuCode ∩ 静态白名单），仅供诊断与文案，不直接驱动 UI */
  businessVisibleRouteNames: ReadonlySet<string>;
  /** 服务端返回的菜单码总数（去重后） */
  serverMenuCount: number;
  /** 命中桥接的菜单码 */
  mappedMenuCodes: readonly string[];
  /** 服务端有、桥接无（未知码，已隐藏） */
  unmappedMenuCodes: readonly string[];
  /** 桥接有、白名单无（未知路由，已隐藏） */
  unroutableRouteNames: readonly string[];
  /** 白名单有、服务端未返回（运行时裁剪，静态台账不变） */
  trimmedRouteNames: readonly string[];
  /** 服务端成功但可见集合为空 */
  empty: boolean;
  /** UI 状态文案（失败/空/裁剪计数） */
  notice: string;
  canRetry: boolean;
  /** 是否按服务端集合裁剪（本单恒为 true；保留字段供测试断言“未回退全量”） */
  restricted: boolean;
}

function emptySnapshot(
  state: MenuLoadState,
  manifestRouteNames: readonly string[],
  notice: string,
  canRetry: boolean,
): MenuAccessSnapshot {
  return {
    state,
    visibleRouteNames: new Set<string>(),
    businessVisibleRouteNames: new Set<string>(),
    serverMenuCount: 0,
    mappedMenuCodes: [],
    unmappedMenuCodes: [],
    unroutableRouteNames: [],
    trimmedRouteNames: [...manifestRouteNames],
    empty: manifestRouteNames.length > 0,
    notice,
    canRetry,
    restricted: true,
  };
}

export function resolveMenuAccess(input: MenuAccessInput): MenuAccessSnapshot {
  const bridge = input.bridge ?? SERVER_MENU_BRIDGE;
  const manifest = new Set(input.manifestRouteNames);

  if (input.state !== "ready") {
    if (input.state === "error") {
      return emptySnapshot(
        "error",
        input.manifestRouteNames,
        "菜单服务不可用：已按最小可见集处理（不回退全量菜单），请重试或联系管理员",
        true,
      );
    }
    return emptySnapshot(input.state, input.manifestRouteNames, "正在加载权限菜单…", false);
  }

  const rows = (input.rows ?? []).filter((row) => !isDisabledStatus(row.status));
  const serverCodes = [...new Set(rows.map((row) => row.menuCode))];
  const bridgeByCode = new Map(bridge.map((entry) => [entry.serverCode, entry.routeName]));

  const mapped: string[] = [];
  const unmapped: string[] = [];
  const unroutable: string[] = [];
  // 第一层：业务集合 = 服务端 menuCode ∩ 静态白名单（不代表当前角色可访问）
  const business = new Set<string>();

  for (const code of serverCodes) {
    const routeName = bridgeByCode.get(code);
    if (!routeName) {
      unmapped.push(code);
      continue;
    }
    if (!manifest.has(routeName)) {
      unroutable.push(routeName);
      continue;
    }
    mapped.push(code);
    business.add(routeName);
  }

  // 第二层：角色最终裁剪（auth.userRoles + 路由 meta.roles），AI 与人工共用
  const userRoles = input.userRoles ?? null;
  const resolveRoles = input.resolveRoles ?? null;
  const visible = new Set<string>();
  if (userRoles && resolveRoles) {
    for (const routeName of business) {
      const roles = resolveRoles(routeName);
      if (roles === null) continue; // 未知路由不可见
      const allowed = roles.length === 0 || userRoles.some((role) => roles.includes(role));
      if (allowed) visible.add(routeName);
    }
  }

  const trimmed = input.manifestRouteNames.filter((name) => !visible.has(name));
  const notice =
    serverCodes.length === 0
      ? "服务端未返回任何可见菜单：当前账号无可见入口，请联系管理员"
      : business.size === 0
        ? `服务端返回 ${serverCodes.length} 个菜单码，但均未映射到前端白名单路由（已全部隐藏，不回退全量）`
        : visible.size === 0
          ? `服务端返回 ${serverCodes.length} 个菜单码，业务层命中 ${business.size} 项，但当前角色无权访问（已全部隐藏，不回退全量）`
          : `服务端返回 ${serverCodes.length} 个菜单码：已映射 ${visible.size} 项，未映射 ${unmapped.length} 个（已隐藏）${
              unroutable.length > 0 ? `，白名单缺失 ${unroutable.length} 项` : ""
            }`;

  return {
    state: "ready",
    visibleRouteNames: visible,
    businessVisibleRouteNames: business,
    serverMenuCount: serverCodes.length,
    mappedMenuCodes: mapped,
    unmappedMenuCodes: unmapped,
    unroutableRouteNames: [...new Set(unroutable)],
    trimmedRouteNames: trimmed,
    empty: visible.size === 0,
    notice,
    canRetry: true,
    restricted: true,
  };
}

/** 入口可见性：路由项看 routeName；本地动作项（routeName=null）看 visibilityFrom */
function isEntryVisible(
  entry: Pick<ManifestItem, "routeName" | "visibilityFrom">,
  visibleRouteNames: ReadonlySet<string>,
): boolean {
  const source = entry.routeName ?? entry.visibilityFrom ?? null;
  return Boolean(source) && visibleRouteNames.has(source as string);
}

/** 按服务端集合裁剪人工分组（AI rail 与人工侧栏共用同一结果，来源相同） */
export function restrictManifestGroups(
  groups: readonly ManifestGroup[],
  visibleRouteNames: ReadonlySet<string>,
): ManifestGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((entry) => isEntryVisible(entry, visibleRouteNames)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * 收银台保底（WORKBENCH-04F1）：
 * `CASHIER_ITEMS` 不参与 `/menus/user` 交集，只由路由 `meta.roles` 判定；
 * 菜单 loading/error 时收银导航也不得被清空。保留入参以兼容既有调用点。
 */
export function restrictManifestItems(
  items: readonly ManifestItem[],
  _visibleRouteNames: ReadonlySet<string>,
): ManifestItem[] {
  return [...items];
}

/** 当前页是否对当前用户可见（AI 代办按钮的显示条件） */
export function isRouteVisible(
  routeName: string | null | undefined,
  visibleRouteNames: ReadonlySet<string>,
): boolean {
  return Boolean(routeName) && visibleRouteNames.has(routeName as string);
}