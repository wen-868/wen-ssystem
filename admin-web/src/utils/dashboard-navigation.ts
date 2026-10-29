/**
 * WORKBENCH-08 · 工作台入口权限与动态链接语义（唯一导航适配器）
 *
 * 收口 R101 的 WB-AUDIT-06 / 07 / 09 / 10：
 *   - WB-AUDIT-06：快捷入口可见性**只由真实路由 meta.roles 派生**；
 *   - WB-AUDIT-09：动态信息流（收款动态/渠道订单等）在生成时校验目标 route 权限，
 *                  无权 ⇒ 明确置为不可点击（**绝不留"能点但会被守卫拦回"的链接**）；
 *   - WB-AUDIT-10：库存预警入口指向 /inventory-alerts（/inventory 是库存列表页）；
 *   - WB-AUDIT-07：线下 10 条与渠道订单合并后**最终最多 10 条**进 DOM。
 *
 * 设计红线（与派单卡 §七 一致）：
 *   ① 本文件**不含任何角色字面量表**：roles 一律来自真实路由表（router/index.ts）；
 *   ② 目标路由不存在 / 未声明 meta.roles ⇒ **fail-closed**（不可见、不可点击）；
 *   ③ 不用 mock 角色代替真实 router meta 解析。
 *
 * 真相源两条获取路径（**共用同一套判定逻辑**，见 isRouteOpenTo）：
 *   - 运行态（浏览器）：`collectRouteEntries(router)` 直接读 router.getRoutes() 的**真实实例记录**；
 *   - 契约态（Node 测试）：`parseRouteTable(<router/index.ts 源码>)` 静态解析同一份路由源码。
 *     二者产出的 RouteEntry 结构完全一致，由契约测试交叉验证。
 */

/** 一条真实路由（已归一化为完整路径） */
export interface RouteEntry {
  /** 完整路径，如 `/sales/create`（子路由 `sales/create` 会补上父级 `/`） */
  path: string;
  /** 路由 name */
  name: string;
  /** meta.title（页面标题，用于"名称 ↔ 目标页语义"校验） */
  title: string;
  /** meta.roles 原文；未声明即空数组（fail-closed 判定依据） */
  roles: string[];
}

/** 快捷入口定义：**只有目标路径，没有角色**——可见性一律由 meta.roles 派生 */
export interface QuickEntryDef {
  key: string;
  label: string;
  /** 目标完整路径 */
  target: string;
}

/** 派生后的快捷入口（含目标页标题，供语义校验） */
export interface QuickEntry extends QuickEntryDef {
  /** 目标路由的 meta.title */
  pageTitle: string;
  /** 目标路由的 meta.roles（仅用于回传矩阵留痕，不参与判定） */
  allowedRoles: string[];
}

/** 路由记录最小结构（兼容 vue-router 的 RouteRecordNormalized，避免引入运行时依赖） */
export interface RouteRecordLike {
  path: string;
  name?: unknown;
  meta?: unknown;
}

/** 路由表最小结构（兼容 vue-router Router） */
export interface RouteTableLike {
  getRoutes(): RouteRecordLike[];
}

/** 最新订单（线下 + 渠道）合并后的**最终渲染上限**（WB-AUDIT-07） */
export const RECENT_ORDER_LIMIT = 10;
/**
 * WORKBENCH-09：最新订单两个来源接口的首屏取数页大小（**最小安全值 = 最终上限**）。
 * 推导（详见 evidence/WORKBENCH-09/raw/10-sorting-proof.txt）：
 *   - 两接口均为 SQL 级 `ORDER BY created_at DESC LIMIT ? OFFSET ?`，第 1 页取 N 条即全局最新 N 条；
 *   - offline 上限 10（overview.recentBills 后端 limit=5，fallback slice(0,10)），
 *     offline 不足时由 channel 补足 ⇒ channel 至少要能独立供满 10 条 ⇒ pageSize ≥ 10；
 *   - 「凑满 10 条进行中」在任何 pageSize 下都无保证（进行中比例是数据属性），
 *     pageSize 只决定候选集边界：最新 10 条含进行中 ⇒ 出满 10 条，不含 ⇒ 100 条也不含。
 *   故 10 是"足以产生最终 10 条"的最小安全值，网络返回由 200 条/首屏降至 20 条（-90%）。
 */
export const RECENT_FETCH_PAGE_SIZE = 10;
/** 经营动态信息流上限（WB-OK-03 既有口径，本卡不改动） */
export const FEED_LIMIT = 50;

/**
 * 快捷入口配置（WB-AUDIT-06 / WB-AUDIT-10）。
 * 只登记"有哪些入口、各自跳哪"，**不登记谁能看**——谁看得见由 meta.roles 决定。
 * WB-AUDIT-04 已把客户入口目标订正为 /customers；WB-AUDIT-10 把库存预警订正为 /inventory-alerts。
 * WORKBENCH-09：客户入口文案统一为「客户管理」，与目标页 meta.title 逐字一致。
 */
export const QUICK_ENTRY_DEFS: readonly QuickEntryDef[] = [
  { key: "cashier", label: "开单收银", target: "/sales/create" },
  { key: "sale-bills", label: "销售单据", target: "/sale-bills" },
  { key: "messages", label: "消息中心", target: "/messages" },
  { key: "inventory-alerts", label: "库存预警", target: "/inventory-alerts" },
  { key: "sales-reports", label: "销售报表", target: "/sales/reports" },
  { key: "customers", label: "客户管理", target: "/customers" },
];

/** 动态信息流里**目标页仅 SUPER_ADMIN 可见**的动作（用于证据留痕与反测命名） */
export const RESTRICTED_FEED_TARGETS: readonly string[] = ["/finance/receipts", "/order-center"];

// ═══════════════════════════════════════════════════════════════════════════
// 一、真实路由表获取
// ═══════════════════════════════════════════════════════════════════════════

/** 剥注释（路径字面量可能合法出现在注释里，判定前先剥掉） */
export function stripSourceComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
}

/** 从 `[` 出发找配对的 `]`（跳过字符串字面量） */
function matchBracket(text: string, openIdx: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "[" || ch === "{") depth += 1;
    else if (ch === "]" || ch === "}") {
      depth -= 1;
      if (depth <= 0) return i;
    }
  }
  return -1;
}

/** `path: "x"` 取值（支持单双引号） */
function readQuoted(meta: string, key: string): string {
  const m = meta.match(new RegExp(`${key}:\\s*(["'])([^"']*)\\1`));
  return m ? m[2] : "";
}

/** `roles: ["A", "B"]` 取值 */
function readRoles(meta: string): string[] {
  const m = meta.match(/roles:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/(["'])([^"']*)\1/g)].map((x) => x[2]);
}

/** 子路由路径归一化：父级 `/` + 子级 `dashboard` ⇒ `/dashboard` */
function normalizeRoutePath(raw: string, parent: string): string {
  const p = String(raw || "").trim();
  if (!p) return "";
  if (p.startsWith("/")) return p.replace(/\/{2,}/g, "/");
  const base = parent && parent !== "/" ? parent : "";
  return `${base}/${p}`.replace(/\/{2,}/g, "/");
}

/** 单个路由对象：path + name + meta（meta 内无嵌套花括号，可安全用 [^}]* 截段） */
const ROUTE_OBJECT_RE =
  /\{\s*path:\s*(["'])([^"']*)\1\s*,\s*name:\s*(["'])([^"']*)\3\s*,\s*component:\s*[\s\S]*?meta:\s*\{([^}]*)\}/g;

/**
 * 静态解析 `admin-web/src/router/index.ts` 源码，得到真实路由表。
 * 契约态（Node）唯一入口：读的是**与运行态同一份文件**，不做任何角色硬编码。
 */
export function parseRouteTable(source: string): RouteEntry[] {
  const src = stripSourceComments(source);
  const decl = src.search(/const\s+routes\s*=\s*\[/);
  if (decl < 0) return [];
  const open = src.indexOf("[", decl);
  const close = matchBracket(src, open);
  if (close < 0) return [];

  // children 区间 → 父路径（本路由表只有一层嵌套，但按栈实现，便于日后加深）
  const spans: { from: number; to: number; parent: string }[] = [];
  for (const m of src.matchAll(/children:\s*\[/g)) {
    const from = m.index + m[0].length - 1;
    const to = matchBracket(src, from);
    if (to < 0) continue;
    const before = src.slice(0, m.index);
    const parents = [...before.matchAll(/path:\s*(["'])([^"']*)\1/g)];
    spans.push({ from, to, parent: parents.length ? parents[parents.length - 1][2] : "" });
  }

  const out: RouteEntry[] = [];
  for (const m of src.matchAll(ROUTE_OBJECT_RE)) {
    const at = m.index;
    if (at < open || at > close) continue;
    // 命中的**最深** children 区间决定父路径
    let parent = "";
    let depth = -1;
    for (const s of spans) {
      if (at > s.from && at < s.to && s.from > depth) {
        depth = s.from;
        parent = s.parent;
      }
    }
    const path = normalizeRoutePath(m[2], parent);
    const meta = m[5] || "";
    out.push({
      path,
      name: m[4] || "",
      title: readQuoted(meta, "title"),
      roles: readRoles(meta),
    });
  }
  return out;
}

/**
 * 运行态收集：直接读 router.getRoutes() 的**真实实例记录**。
 * 与 parseRouteTable 产出同一种 RouteEntry，判定逻辑完全共用。
 */
export function collectRouteEntries(router: RouteTableLike): RouteEntry[] {
  const out: RouteEntry[] = [];
  for (const record of router.getRoutes()) {
    const path = normalizeRoutePath(String(record.path || ""), "");
    if (!path) continue;
    const meta = (record.meta ?? {}) as Record<string, unknown>;
    const rolesRaw = Array.isArray(meta.roles) ? meta.roles : [];
    out.push({
      path,
      name: typeof record.name === "string" ? record.name : "",
      title: typeof meta.title === "string" ? meta.title : "",
      roles: rolesRaw.filter((r): r is string => typeof r === "string"),
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 二、权限判定（fail-closed）
// ═══════════════════════════════════════════════════════════════════════════

/** 去掉 query / hash，只留路径部分 */
function pathOnly(target: string): string {
  const s = String(target || "").trim();
  const cut = s.search(/[?#]/);
  return (cut >= 0 ? s.slice(0, cut) : s).replace(/\/{2,}/g, "/");
}

/** 兜底路由 `/:pathMatch(.*)*` 能匹配一切，**绝不能**当作"目标存在" */
function isCatchAll(path: string): boolean {
  return path.includes("pathMatch");
}

/**
 * 把 `/sale-bills/:billNo` 这类参数路由编译成匹配器（无参数路由直接字面相等）。
 * 步骤：先转义正则元字符（**故意留着 `()`**，供下一步识别参数里的正则段）→
 * 把 `:name` / `:name(regex)` 整段换成 `[^/]+` → 再把残留的字面括号转义。
 */
function compileMatcher(path: string): RegExp {
  if (!path.includes(":")) return new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  const body = path
    .replace(/[.*+?^$[\]\\]/g, "\\$&")
    .replace(/:\w+(?:\([^)]*\))?/g, "[^/]+")
    .replace(/[()]/g, "\\$&");
  return new RegExp(`^${body}$`);
}

/**
 * 定位目标路由：① 精确命中 ⇒ ② 参数路由命中（取**路径段更具体**的一条）。
 * 找不到 ⇒ null（上层按 fail-closed 处理）。
 */
export function matchRouteEntry(routes: RouteEntry[], target: string): RouteEntry | null {
  const want = pathOnly(target);
  if (!want) return null;
  const exact = routes.find((r) => r.path === want);
  if (exact) return exact;
  let best: RouteEntry | null = null;
  let bestScore = -1;
  for (const r of routes) {
    if (isCatchAll(r.path) || !r.path.includes(":")) continue;
    if (!compileMatcher(r.path).test(want)) continue;
    const score = r.path.split("/").filter((s) => s && !s.startsWith(":")).length;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

/**
 * 当前角色能否打开该路由（**fail-closed**）。
 * 三种拒绝：目标路由不存在 / 目标未声明 meta.roles / 当前角色一个都不在 roles 里。
 */
export function isRouteOpenTo(entry: RouteEntry | null, roles: readonly string[]): boolean {
  if (!entry) return false;
  if (!entry.roles || entry.roles.length === 0) return false;
  return roles.some((r) => entry.roles.includes(r));
}

// ═══════════════════════════════════════════════════════════════════════════
// 三、快捷入口（WB-AUDIT-06 / 10）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 按当前角色派生可见快捷入口。
 * **只由真实路由 meta.roles 决定**，角色入参来自登录态，不在本文件内硬编码。
 */
export function visibleQuickEntries(
  routes: readonly RouteEntry[],
  roles: readonly string[],
  defs: readonly QuickEntryDef[] = QUICK_ENTRY_DEFS,
): QuickEntry[] {
  const out: QuickEntry[] = [];
  for (const def of defs) {
    const entry = matchRouteEntry(routes as RouteEntry[], def.target);
    if (!isRouteOpenTo(entry, roles)) continue;
    out.push({
      ...def,
      pageTitle: entry ? entry.title : "",
      allowedRoles: entry ? entry.roles : [],
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 四、动态链接（WB-AUDIT-09）
// ═══════════════════════════════════════════════════════════════════════════

export interface NavTarget {
  /** 有权 ⇒ 原路径；无权 ⇒ **null**（绝不返回"可点但会被拦"的链接） */
  route: string | null;
  canOpen: boolean;
}

/**
 * 给动态条目（收款动态、渠道订单…）挂目标链接：
 * 无权 ⇒ `route: null`，由模板据此渲染为不可点击。
 */
export function decorateNavTarget(
  routes: readonly RouteEntry[],
  roles: readonly string[],
  target: string,
): NavTarget {
  const entry = matchRouteEntry(routes as RouteEntry[], target);
  if (!isRouteOpenTo(entry, roles)) return { route: null, canOpen: false };
  return { route: target, canOpen: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// 五、最新订单合并与最终截断（WB-AUDIT-07）
// ═══════════════════════════════════════════════════════════════════════════

export interface MergeRecentOrdersResult<T> {
  /** 最终进 DOM 的条目（≤ limit） */
  items: T[];
  /** 输入的线下 / 渠道条数 */
  offlineIn: number;
  channelIn: number;
  /** 输出的线下 / 渠道条数（守恒：in = out + dropped） */
  offlineOut: number;
  channelOut: number;
  /** 被最终截断丢弃的条数 */
  dropped: number;
  total: number;
  truncated: boolean;
}

/**
 * 线下单与渠道订单合并 → 按时间倒序 → **最终截断到 limit**。
 * 无论接口返回多少条渠道订单，出去的永远 ≤ limit，且丢弃量如实记账（守恒）。
 */
export function mergeRecentOrders<T>(opts: {
  offline: readonly T[];
  channel: readonly T[];
  limit?: number;
  getTime?: (item: T) => number | null;
}): MergeRecentOrdersResult<T> {
  const limit = opts.limit ?? RECENT_ORDER_LIMIT;
  const getTime = opts.getTime;
  const offline = opts.offline ?? [];
  const channel = opts.channel ?? [];

  const tagged = [
    ...offline.map((item, seq) => ({ item, source: "offline" as const, seq, time: getTime ? getTime(item) : null })),
    ...channel.map((item, seq) => ({ item, source: "channel" as const, seq, time: getTime ? getTime(item) : null })),
  ];
  // 时间倒序；时间缺失排最后；同级保持"线下优先 + 入参次序"，保证结果稳定可复现
  tagged.sort((a, b) => {
    const ta = a.time ?? Number.NEGATIVE_INFINITY;
    const tb = b.time ?? Number.NEGATIVE_INFINITY;
    if (tb !== ta) return tb > ta ? 1 : -1;
    if (a.source !== b.source) return a.source === "offline" ? -1 : 1;
    return a.seq - b.seq;
  });
  const kept = tagged.slice(0, limit);

  return {
    items: kept.map((k) => k.item),
    offlineIn: offline.length,
    channelIn: channel.length,
    offlineOut: kept.filter((k) => k.source === "offline").length,
    channelOut: kept.filter((k) => k.source === "channel").length,
    dropped: Math.max(0, tagged.length - limit),
    total: tagged.length,
    truncated: tagged.length > limit,
  };
}
