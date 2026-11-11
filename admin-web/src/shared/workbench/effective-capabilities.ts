/**
 * 工作台唯一生产能力源（WORKBENCH-PROTOTYPE-12 · S2）
 *
 * 目标（派单卡 §一/§三）：rail、二级栏、快捷入口、AI 对等能力、任务中心
 * 消费**同一个**生产可见能力集合；任何消费者不得自建可见性口径。
 *
 * 生产集合 = 服务端菜单 ∩ 路由 manifest ∩ 角色 ∩ launched：
 *   1. 服务端菜单：`GET /api/admin/menus/user` 经 `SERVER_MENU_BRIDGE` 桥接
 *      （menu-access.ts 承接，交集不放开）；
 *   2. 路由 manifest：route-manifest.ts 白名单（routeName → 真实路由/组件）；
 *   3. 角色：auth.userRoles × 路由 meta.roles（与路由守卫同一语义；未知路由不可见）；
 *   4. launched：
 *      - 路由入口：已在 manifest 接线（原型 93 项目录中 manifest 未接线项不属于
 *        launched，只允许开发态/设计预览经 `planPrototypeSubnav` 呈现）；
 *      - AI 能力：台账状态 LIVE / PARTIAL（PLANNED / BLOCKED 属未上线）。
 *
 * fail-closed（不放开）：加载中 / 接口失败 / 空菜单 / 未知角色 ⇒ 空集合，不回退全量。
 *   角色识别基准 = resolveRoles 在 manifest 全量路由上的 meta.roles 并集
 *   ∪ 平台只读角色 SUPPORT（backend platform-rbac.ts：SUPPORT 无商户工作台授权，
 *   属已知平台角色但交集必为空 ⇒ 同样空集合，原因码区别于未知角色）。
 *
 * 消费者投影（全部由同一集合确定性派生，测试断言差集为 0）：
 *   - rail：一级模块行 = 有效分组 × 原型顺序（decorateRailGroups），按真实授权裁剪；
 *   - subnav：生产二级栏 = 已接线 ∧ 命中集合（planProductionSubnav），原型目录中的
 *     未接线项（待接入占位）不进生产；
 *   - quickEntry：信息流快速入口 = 集合全量（扁平化）；
 *   - quickCommands：生产快捷指令 = 挂靠能力已上线的指令（capability-registry）；
 *   - ai：AI 对等能力 = 已上线 ∧（AI 原生 ∨ 锚点路由命中集合）；
 *   - taskCenter：任务中心可见条目 = 集合全量（S3 WorkbenchTaskCenter 接线用）。
 *
 * 边界（不越权改写既有裁定）：
 *   - 收银台 9 项沿用 WORKBENCH-04F1 保底（不吃 /menus/user 交集），不在本集合内；
 *   - 本模块只产出集合与投影，不重写消费者页面；各消费者接线归 S3/S4 各自任务卡。
 */
import {
  resolveMenuAccess,
  SERVER_MENU_BRIDGE,
  type MenuLoadState,
  type ServerMenuRow,
} from "./menu-access";
import { AI_CAPABILITIES } from "./parity-ledger";
import {
  decorateRailGroups,
  findRailItem,
  planProductionSubnav,
  PROTOTYPE_RAIL_ITEMS,
  RAIL_FIXED_KEY_BY_GROUP,
} from "./prototype-nav";
import { ALL_MANIFEST_ITEMS, MANUAL_GROUPS } from "./route-manifest";
import { launchedQuickCommands } from "./capability-registry";
import type { CapabilityStatus } from "./capability-types";
import type { ManifestGroup, ManifestItem } from "./types";

/** 生产文案黑名单：生产投影的任何可见文案不得命中（含「待接入」占位，S2 §三.7） */
export const PRODUCTION_COPY_BLACKLIST: readonly string[] = [
  "待接入",
  "原型",
  "演示",
  "占位",
  "开发态",
  "工程状态",
];

/**
 * 平台只读角色码（非商户工作台角色，但属平台已知角色）。
 * 证据：backend/src/middleware/platform-rbac.ts（SUPPORT = t_platform_admin.role，
 * 角色码 'support'，仅平台只读矩阵）。列入「已知」只为把原因码与未知角色区分开：
 * 其交集必为空 ⇒ 同样 fail-closed 空集合。
 */
export const PLATFORM_READONLY_ROLE_CODES: readonly string[] = ["SUPPORT"];

/** 集合不可用（fail-closed）的原因码 */
export type EffectiveFailReason =
  | "loading"
  | "menu-error"
  | "empty-menu"
  | "unknown-role"
  | "no-effective-capability"
  | null;

/** 生产可见能力条目（routeName 唯一键） */
export interface EffectiveCapabilityEntry {
  routeName: string;
  /** 命中的服务端菜单码（SERVER_MENU_BRIDGE 反查；交集证据） */
  menuCode: string | null;
  /** manifest 标题（生产文案唯一来源） */
  title: string;
  path: string | null;
  groupCode: string;
  groupTitle: string;
}

/** rail 一级模块行（原型顺序 × 真实授权裁剪后的有效分组） */
export interface EffectiveRailRow {
  /** 原型 rail 稳定键（manifest 有而原型未声明的分组冠 `+` 前缀，沿用 decorateRailGroups） */
  protoKey: string;
  label: string;
  title: string;
  groupCode: string;
  entries: readonly EffectiveCapabilityEntry[];
}

/** 生产二级栏条目（只含已接线 ∧ 命中集合；原型未接线项不返回） */
export interface EffectiveSubnavEntry {
  moduleKey: string;
  label: string;
  routeName: string;
  path: string | null;
}

/** AI 对等能力（生产口径：已上线 ∧ 可达） */
export interface EffectiveAiCapability {
  id: string;
  title: string;
  status: CapabilityStatus;
  /** AI 原生能力（人工页面无对应动作，显式标记） */
  aiOnly: boolean;
  /** 锚点人工路由 ∩ 生产集合（已按真实授权裁剪，不得链接越权页） */
  anchoredRouteNames: readonly string[];
}

/** 任务中心可见条目（S3 WorkbenchTaskCenter 接线契约：与集合同源） */
export interface EffectiveTaskCenterEntry {
  routeName: string;
  title: string;
  groupCode: string;
  groupTitle: string;
}

/** 生产快捷指令（capability-registry.launchedQuickCommands 的行形状） */
export interface EffectiveQuickCommand {
  label: string;
  prompt: string;
  capabilityId: string;
}

export interface EffectiveCapabilitySnapshot {
  /** 集合非空且来源四要素全部就绪 */
  ok: boolean;
  /** fail-closed 原因码；ok=true 时为 null */
  failReason: EffectiveFailReason;
  /** UI 状态文案（失败/空/裁剪说明，来源仅限生产事实，不编造） */
  notice: string;
  /** 唯一生产可见集合（routeName 键）——一切消费者的唯一口径 */
  routeNames: ReadonlySet<string>;
  /** 集合条目（manifest 顺序） */
  entries: readonly EffectiveCapabilityEntry[];
  /** rail 投影 */
  rail: readonly EffectiveRailRow[];
  /** 生产二级栏投影（跨模块扁平，模块内保持原型目录顺序） */
  subnav: readonly EffectiveSubnavEntry[];
  /** 信息流快速入口投影（= 集合全量） */
  quickEntry: readonly EffectiveCapabilityEntry[];
  /** 生产快捷指令投影 */
  quickCommands: readonly EffectiveQuickCommand[];
  /** AI 对等能力投影 */
  ai: readonly EffectiveAiCapability[];
  /** 任务中心投影（= 集合全量的任务中心形状） */
  taskCenter: readonly EffectiveTaskCenterEntry[];
  /** 交集诊断（来自 menu-access，仅供诊断与文案，不驱动 UI） */
  diagnostics: {
    serverMenuCount: number;
    unmappedMenuCodes: readonly string[];
    unroutableRouteNames: readonly string[];
    trimmedRouteNames: readonly string[];
    restricted: true;
  };
}

export interface EffectiveCapabilityInput {
  menuState: MenuLoadState;
  /** `GET /api/admin/menus/user` 的行（失败/加载中传 null） */
  menuRows?: readonly ServerMenuRow[] | null;
  /** 当前用户角色（auth.userRoles）；未知角色 fail-closed */
  userRoles?: readonly string[] | null;
  /** 路由 meta.roles 解析器（与路由守卫同一语义）；未知路由返回 null */
  resolveRoles: (routeName: string) => readonly string[] | null;
}

function emptySnapshot(failReason: EffectiveFailReason, notice: string): EffectiveCapabilitySnapshot {
  return {
    ok: false,
    failReason,
    notice,
    routeNames: new Set<string>(),
    entries: [],
    rail: [],
    subnav: [],
    quickEntry: [],
    quickCommands: [],
    ai: [],
    taskCenter: [],
    diagnostics: {
      serverMenuCount: 0,
      unmappedMenuCodes: [],
      unroutableRouteNames: [],
      trimmedRouteNames: [...new Set(ALL_MANIFEST_ITEMS.map((item) => item.routeName).filter(Boolean))] as string[],
      restricted: true,
    },
  };
}

/**
 * 已知角色集合：manifest 全量路由的 meta.roles 并集 ∪ 平台只读角色。
 * resolveRoles 返回 null（未知路由）不贡献角色；返回 []（未声明角色）也不贡献。
 */
export function knownWorkbenchRoles(
  resolveRoles: (routeName: string) => readonly string[] | null,
): ReadonlySet<string> {
  const known = new Set<string>(PLATFORM_READONLY_ROLE_CODES);
  for (const routeName of ALL_MANIFEST_ITEMS.map((item) => item.routeName).filter(Boolean) as string[]) {
    const roles = resolveRoles(routeName);
    if (!roles) continue;
    for (const role of roles) {
      if (typeof role === "string" && role) known.add(role);
    }
  }
  return known;
}

function toEntry(item: ManifestItem, group: ManifestGroup, menuCodeByRoute: ReadonlyMap<string, string>): EffectiveCapabilityEntry {
  return {
    routeName: item.routeName as string,
    menuCode: menuCodeByRoute.get(item.routeName as string) ?? null,
    title: item.title,
    path: item.path,
    groupCode: group.groupCode,
    groupTitle: group.title,
  };
}

/**
 * 解析唯一生产可见能力集合。除本函数外，任何模块不得自行计算
 * 「服务端菜单 ∩ manifest ∩ 角色」口径（单一真相源）。
 */
export function resolveEffectiveCapabilities(input: EffectiveCapabilityInput): EffectiveCapabilitySnapshot {
  const { resolveRoles } = input;

  // ── fail-closed 第一层：菜单链路状态 ─────────────────────────────────────
  if (input.menuState === "loading" || input.menuState === "idle") {
    return emptySnapshot("loading", "正在加载权限菜单…");
  }
  if (input.menuState === "error") {
    return emptySnapshot(
      "menu-error",
      "菜单服务不可用：已按最小可见集处理（不回退全量菜单），请重试或联系管理员",
    );
  }

  // ── fail-closed 第二层：角色识别（未知角色 ⇒ 空集合）─────────────────────
  const userRoles = (input.userRoles ?? []).filter(
    (role): role is string => typeof role === "string" && role.length > 0,
  );
  if (userRoles.length === 0) {
    return emptySnapshot("unknown-role", "当前账号未携带有效角色：已按最小可见集处理（fail-closed）");
  }
  const known = knownWorkbenchRoles(resolveRoles);
  const recognized = userRoles.some((role) => known.has(role));
  if (!recognized) {
    return emptySnapshot(
      "unknown-role",
      `未知角色（${userRoles.join(" / ")}）：已按最小可见集处理（fail-closed），请联系管理员`,
    );
  }

  // ── 交集：服务端菜单 ∩ manifest ∩ 角色（menu-access 承接，不放开）──────────
  const access = resolveMenuAccess({
    state: "ready",
    rows: input.menuRows ?? [],
    manifestRouteNames: [...new Set(ALL_MANIFEST_ITEMS.map((item) => item.routeName).filter(Boolean) as string[])],
    userRoles,
    resolveRoles,
  });
  if (access.serverMenuCount === 0) {
    return emptySnapshot("empty-menu", access.notice);
  }
  const routeNames = access.visibleRouteNames;
  if (routeNames.size === 0) {
    return emptySnapshot("no-effective-capability", access.notice);
  }

  // 服务端菜单码反查表（交集证据：条目 → menuCode）
  const routeByCode = new Map(SERVER_MENU_BRIDGE.map((entry) => [entry.serverCode, entry.routeName]));
  const menuCodeByRoute = new Map<string, string>();
  for (const [code, routeName] of routeByCode) {
    if (routeNames.has(routeName) && !menuCodeByRoute.has(routeName)) menuCodeByRoute.set(routeName, code);
  }

  // ── 集合条目（manifest 顺序，routeName 去重）──────────────────────────────
  const entries: EffectiveCapabilityEntry[] = [];
  const seenRoutes = new Set<string>();
  for (const group of MANUAL_GROUPS) {
    for (const item of group.items) {
      if (!item.routeName || !routeNames.has(item.routeName)) continue;
      if (seenRoutes.has(item.routeName)) continue;
      seenRoutes.add(item.routeName);
      entries.push(toEntry(item, group, menuCodeByRoute));
    }
  }

  // ── rail 投影：有效分组 × 原型顺序（真实授权裁剪：空组整块不渲染）──────────
  const effectiveGroups: ManifestGroup[] = MANUAL_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => Boolean(item.routeName) && routeNames.has(item.routeName as string)),
  })).filter((group) => group.items.length > 0);
  const rail: EffectiveRailRow[] = decorateRailGroups(effectiveGroups).map((row) => ({
    protoKey: row.protoKey,
    label: row.protoLabel,
    title: row.protoTitle,
    groupCode: row.groupCode,
    entries: row.items
      .filter((item): item is ManifestItem & { routeName: string } => Boolean(item.routeName))
      .map((item) => toEntry(item, row, menuCodeByRoute)),
  }));
  // 固定 rail 项（desk→wb.dashboard）：decorateRailGroups 会跳过被固定项占用的分组，
  // 其可见条目由固定行承接，避免「工作台」集合内路由从 rail 投影消失（差集必须为 0）。
  const fixedRows: EffectiveRailRow[] = [];
  for (const group of effectiveGroups) {
    const fixedKey = RAIL_FIXED_KEY_BY_GROUP[group.groupCode];
    if (!fixedKey) continue;
    const proto = findRailItem(fixedKey);
    fixedRows.push({
      protoKey: fixedKey,
      label: proto?.label ?? group.title,
      title: proto?.title ?? group.title,
      groupCode: group.groupCode,
      entries: group.items
        .filter((item): item is ManifestItem & { routeName: string } => Boolean(item.routeName))
        .map((item) => toEntry(item, group, menuCodeByRoute)),
    });
  }
  // 按原型 rail 顺序装配：固定项（desk）与业务模块各归其位；「设置」无分组承载，
  // 属壳层固定项（不随授权裁剪），由消费者自行渲染，不进本投影。
  const railOrder = new Map(PROTOTYPE_RAIL_ITEMS.map((item, index) => [item.key, index]));
  rail.push(...fixedRows);
  rail.sort(
    (a, b) =>
      (railOrder.get(a.protoKey) ?? Number.MAX_SAFE_INTEGER) -
      (railOrder.get(b.protoKey) ?? Number.MAX_SAFE_INTEGER),
  );

  // ── 生产二级栏投影：已接线 ∧ 命中集合（原型未接线项不进生产）───────────────
  const subnav: EffectiveSubnavEntry[] = [];
  for (const row of rail) {
    const group = effectiveGroups.find((candidate) => candidate.groupCode === row.groupCode);
    if (!group) continue;
    for (const entry of planProductionSubnav(row.protoKey, group.items, routeNames)) {
      subnav.push({
        moduleKey: row.protoKey,
        label: entry.label,
        routeName: entry.item.routeName as string,
        path: entry.item.path,
      });
    }
  }

  // ── AI 对等能力投影：已上线 ∧（AI 原生 ∨ 锚点路由命中集合）────────────────
  const ai: EffectiveAiCapability[] = [];
  for (const capability of AI_CAPABILITIES) {
    if (capability.status !== "LIVE" && capability.status !== "PARTIAL") continue;
    const anchored = (capability.manualRouteNames ?? []).filter((routeName) => routeNames.has(routeName));
    if (capability.aiOnly || anchored.length > 0) {
      ai.push({
        id: capability.id,
        title: capability.title,
        status: capability.status,
        aiOnly: Boolean(capability.aiOnly),
        anchoredRouteNames: anchored,
      });
    }
  }

  // ── 快捷入口 / 快捷指令 / 任务中心投影（同一集合，形状各异）────────────────
  const quickEntry = entries;
  const quickCommands: readonly EffectiveQuickCommand[] = launchedQuickCommands();
  const taskCenter: EffectiveTaskCenterEntry[] = entries.map((entry) => ({
    routeName: entry.routeName,
    title: entry.title,
    groupCode: entry.groupCode,
    groupTitle: entry.groupTitle,
  }));

  return {
    ok: true,
    failReason: null,
    notice: access.notice,
    routeNames,
    entries,
    rail,
    subnav,
    quickEntry,
    quickCommands,
    ai,
    taskCenter,
    diagnostics: {
      serverMenuCount: access.serverMenuCount,
      unmappedMenuCodes: access.unmappedMenuCodes,
      unroutableRouteNames: access.unroutableRouteNames,
      trimmedRouteNames: access.trimmedRouteNames,
      restricted: true,
    },
  };
}

/** 深链准入：仅生产集合内、且 manifest 有真实路由的路径允许进入（fail-closed） */
export function canDeepLinkPath(path: string, snapshot: EffectiveCapabilitySnapshot): boolean {
  if (!snapshot.ok) return false;
  const hit = ALL_MANIFEST_ITEMS.find((item) => item.path === path);
  return Boolean(hit?.routeName && snapshot.routeNames.has(hit.routeName));
}

/** 路由可见性（AI 代办按钮、搜索准入共用）：集合外一律不可见 */
export function isEffectiveRoute(routeName: string | null | undefined, snapshot: EffectiveCapabilitySnapshot): boolean {
  return Boolean(routeName) && snapshot.ok && snapshot.routeNames.has(routeName as string);
}

/** 生产文案黑名单检查：返回命中黑名单的文案（应恒为空） */
export function findProductionCopyViolations(labels: readonly string[]): readonly string[] {
  return labels.filter((label) =>
    PRODUCTION_COPY_BLACKLIST.some((banned) => label.includes(banned)),
  );
}
