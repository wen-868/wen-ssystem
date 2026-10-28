/**
 * Dashboard 字段适配器 —— **唯一真相源**（管理 Dashboard 与门店工作台必须共用）
 *
 * 背景（R101 工作台审查清单 WB-AUDIT-01 / 02 / 08）：
 *   前端长期手写扁平字段（`d.todaySalesAmount` / `d.monthOrderCount`），而后端 `getOverview`
 *   返回**嵌套**结构（`today.salesAmount` / `month.orderCount`）⇒ 指标恒为 0。
 *   待办侧前端读四个**并不存在**的分组字段（`inventoryAlerts` 等），真实端点 `/todos`
 *   返回**平铺数组** ⇒ 永远走空态"今日无待办事项"。
 *
 * 契约出处（逐条直读后端源码，不采信文档）：
 *   - `backend/src/services/admin/dashboard.service.ts:360-406` getOverview
 *       today: { salesAmount, orderCount, receivedAmount, purchaseAmount, purchaseOrderCount,
 *                compareYesterday:{salesAmountChange, orderCountChange} }
 *       month: { salesAmount, orderCount, receivedAmount, ... compareLastMonth }
 *       year / pending / stockAlerts / inventory / finance
 *     ⚠️ **overview 不含毛利字段**（全文无 grossProfit）。
 *   - `backend/src/services/admin/report/finance-report.service.ts:307-321` getProfit
 *       返回 { dateStart, dateEnd, income, cost, returns, grossProfit, grossProfitRate, ... }
 *       路由 `backend/src/routes/report.routes.ts:36` → `GET /api/admin/reports/profit`（prefix `/api/admin/reports`）
 *       ⇒ 毛利唯一真实来源是 reports/profit，按今日区间取。
 *   - `backend/src/services/admin/dashboard.service.ts:539-649` getTodos
 *       返回 **{ total: number, items: Array<{ type, priority, title, subtitle, count, link }> }**
 *       （L649 `return { total: items.length, items };`；运行态抓包实测确认，非平铺数组）
 *   - `backend/src/services/admin/dashboard.service.ts:513-535` getRecentAlerts
 *       返回**平铺数组**：Array<{ id, alertNo, ruleType, alertLevel, title, description,
 *                              bizType, bizId, status, createdAt }>
 *
 * 设计原则：
 *   ① **嵌套优先、扁平兼容**：真实契约是嵌套；扁平别名只为旧缓存/旧夹具兜底，
 *      且**绝不用扁平值冒充嵌套缺失**（缺失即 undefined，交由状态机判定）。
 *   ② **四态可区分**：`loading / empty / ready / error` 由调用方持有，
 *      本文件只提供纯函数与类型，不做全局单例，避免两页互相污染。
 *   ③ 失败**不得**降级成空数组（空 = 真的没有待办；失败 = 不知道）。
 *      因此 parse 函数返回 discriminated union，调用方必须分支处理。
 *
 * 负责人：墨（工作台前端 owner）｜WORKBENCH-07
 */

// ═══════════════════════════════════════════════════════════════════════════
// 一、原始响应形状（仅用于类型约束，字段名逐字对齐后端）
// ═══════════════════════════════════════════════════════════════════════════

/** 后端 overview 的 today/month 分组（嵌套） */
export interface OverviewPeriodRaw {
  salesAmount?: number | null;
  orderCount?: number | null;
  receivedAmount?: number | null;
  purchaseAmount?: number | null;
  purchaseOrderCount?: number | null;
  /** 🚫 后端 overview **不含** grossProfit —— 此字段仅为扁平兼容兜底，正常应为 undefined */
  grossProfit?: number | null;
}

/** 后端 `/admin/dashboard/overview` 响应体（嵌套契约） */
export interface DashboardOverviewRaw {
  today?: OverviewPeriodRaw;
  month?: OverviewPeriodRaw;
  year?: OverviewPeriodRaw;
  pending?: { orderCount?: number | null; changeFromYesterday?: number | null };
  stockAlerts?: { total?: number | null; urgent?: number | null };
  inventory?: { totalValue?: number | null; skuCount?: number | null };
  finance?: { receivable?: number | null; payable?: number | null };

  // ── 扁平兼容别名（历史前端手写字段；**只读兜底，不作主路径**）──
  todaySalesAmount?: number | null;
  todayOrderCount?: number | null;
  todayGrossProfit?: number | null;
  monthSalesAmount?: number | null;
  monthOrderCount?: number | null;
}

/** `/admin/dashboard/todos` 单项（位于 data.items 内） */
export interface DashboardTodoRaw {
  type: string;
  priority: string;
  title: string;
  subtitle?: string;
  count: number;
  link?: string;
}

/** `/admin/dashboard/recent-alerts` 单项（平铺） */
export interface DashboardAlertRaw {
  id?: number | string;
  alertNo?: string;
  ruleType?: string;
  alertLevel?: string;
  title?: string;
  description?: string;
  bizType?: string;
  bizId?: number | string;
  status?: string;
  createdAt?: string;
}

/** `/admin/reports/profit` 响应体（毛利唯一真实来源） */
export interface ProfitReportRaw {
  dateStart?: string;
  dateEnd?: string;
  income?: number | null;
  cost?: number | null;
  returns?: number | null;
  grossProfit?: number | null;
  grossProfitRate?: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 二、归一化后的领域模型（两页共同消费）
// ═══════════════════════════════════════════════════════════════════════════

/** 四态：必须可区分（派单卡硬验收 §3） */
export type DataState = "loading" | "empty" | "ready" | "error";

/** 今日/本月 一组指标 */
export interface PeriodMetrics {
  salesAmount: number;
  orderCount: number;
  /** 毛利：overview 无此字段，来自 reports/profit；未取到时为 null（**不填 0**） */
  grossProfit: number | null;
}

/** 归一化后的看板指标（今日 + 本月） */
export interface DashboardMetrics {
  today: PeriodMetrics;
  month: PeriodMetrics;
}

/** 待办项（归一化） */
export interface TodoItem {
  type: string;
  priority: string;
  title: string;
  subtitle: string;
  count: number;
  link: string;
}

/** 预警项（归一化） */
export interface AlertItem {
  alertNo: string;
  ruleType: string;
  alertLevel: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

/**
 * parse 结果：discriminated union —— **失败与空必须可区分**。
 * `ok:false` ⇒ 调用方必须显示错误 + 重试；**不得**当作"没有数据"。
 */
export type ParseResult<T> =
  | { ok: true; data: T; state: "ready" | "empty" }
  | { ok: false; reason: string };

// ═══════════════════════════════════════════════════════════════════════════
// 三、工具
// ═══════════════════════════════════════════════════════════════════════════

/** 安全取数字：null/undefined/非有限数 ⇒ fallback；**不把 null 变 0 冒充真实读数** */
function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** 取值：嵌套优先；嵌套缺失时才看扁平别名（兼容旧夹具）；都缺 ⇒ undefined */
function pick(
  nested: unknown,
  flat: unknown,
): number | undefined {
  const n = typeof nested === "string" ? Number(nested) : nested;
  if (typeof n === "number" && Number.isFinite(n)) return n;
  const f = typeof flat === "string" ? Number(flat) : flat;
  if (typeof f === "number" && Number.isFinite(f)) return f;
  return undefined;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object";
}

// ═══════════════════════════════════════════════════════════════════════════
// 四、适配器：overview ⇒ DashboardMetrics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 折算 overview（嵌套契约）为领域指标。
 *
 * 判定顺序（**先排除失败再判空**，与 WORKBENCH-06F1 就绪探针同口径）：
 *   ① 载荷非对象 ⇒ error（形状异常，绝不当作空）
 *   ② 既无 today 也无 month ⇒ error（缺契约主体）
 *   ③ 有嵌套但全字段缺失 ⇒ ready（真实 0 也要显示，不能当空态）
 *
 * @param raw 后端 `/admin/dashboard/overview` 的 `data.data`
 * @param grossProfit 今日毛利（来自 reports/profit）；**未取到传 null**
 */
export function parseDashboardOverview(
  raw: unknown,
  grossProfit: number | null = null,
): ParseResult<DashboardMetrics> {
  if (!isObject(raw)) {
    return { ok: false, reason: "概览响应形状异常（非对象）" };
  }
  const o = raw as DashboardOverviewRaw;
  const hasToday = isObject(o.today);
  const hasMonth = isObject(o.month);
  if (!hasToday && !hasMonth && o.todaySalesAmount === undefined && o.monthSalesAmount === undefined) {
    return { ok: false, reason: "概览响应缺少 today/month 分组" };
  }

  const t = (o.today ?? {}) as OverviewPeriodRaw;
  const m = (o.month ?? {}) as OverviewPeriodRaw;

  const today: PeriodMetrics = {
    // ① 嵌套优先 ② 扁平兜底 ③ 都缺 ⇒ 0（overview 主体存在时的真实缺省值）
    salesAmount: pick(t.salesAmount, o.todaySalesAmount) ?? 0,
    orderCount: pick(t.orderCount, o.todayOrderCount) ?? 0,
    // 毛利只认 reports/profit；扁平兜底仅为兼容旧夹具，正常为 null
    grossProfit: grossProfit ?? pick(t.grossProfit, o.todayGrossProfit) ?? null,
  };
  const month: PeriodMetrics = {
    salesAmount: pick(m.salesAmount, o.monthSalesAmount) ?? 0,
    orderCount: pick(m.orderCount, o.monthOrderCount) ?? 0,
    grossProfit: null, // 本月毛利不在本卡范围（WB-AUDIT-01/08 只要求销售与订单）
  };

  return { ok: true, data: { today, month }, state: "ready" };
}

// ═══════════════════════════════════════════════════════════════════════════
// 五、适配器：todos ⇒ TodoItem[]
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 折算 `/admin/dashboard/todos`。
 *
 * ⚠️ **真实形状以运行态响应为准**（本次抓包实测，纠正了此前的源码误读）：
 *   实际返回 `data = { total: number, items: Array<{type,priority,title,subtitle,count,link}> }`
 *   出处：`backend/src/services/admin/dashboard.service.ts:649` `return { total: items.length, items };`
 *   （我最初只读 `items.push({...})` 就推断"平铺数组"，被运行态抓包证伪 —— 记此防复发。）
 *   同时兼容平铺数组形态，以容忍未来契约简化或旧缓存。
 *
 * 红线（派单卡 §六-2）：**接口失败/形状异常必须 error，绝不能当空数组**。
 * 空 = 真的今日无待办（empty）；形状异常 = 不知道（error）。
 */
export function parseDashboardTodos(raw: unknown): ParseResult<TodoItem[]> {
  // ① 形状判定：{total, items} 嵌套 或 平铺数组；其余一律 error
  let rows: unknown[];
  if (Array.isArray(raw)) {
    rows = raw;
  } else if (isObject(raw) && Array.isArray((raw as { items?: unknown }).items)) {
    rows = (raw as { items: unknown[] }).items;
  } else {
    return { ok: false, reason: "待办响应形状异常（既非 {total,items} 也非数组）" };
  }

  const items: TodoItem[] = [];
  for (const row of rows) {
    if (!isObject(row)) continue; // 单条脏数据跳过，但不影响整体 ready
    // 逐字段读取（不强转类型：TS 严格模式下 Record<string,unknown> → 具名接口属不安全转换）
    const r = row as Record<string, unknown>;
    items.push({
      type: String(r.type ?? ""),
      priority: String(r.priority ?? ""),
      title: String(r.title ?? ""),
      subtitle: String(r.subtitle ?? ""),
      count: num(r.count, 0),
      link: String(r.link ?? ""),
    });
  }
  return { ok: true, data: items, state: items.length > 0 ? "ready" : "empty" };
}

/**
 * 待办按类型分组（供 UI 分区渲染）。
 * 分组**不预设固定类目**：后端新增 type 也不丢，未知类型归入 `other`。
 */
export interface TodoGroups {
  /** type → 原始项（保序） */
  byType: Record<string, TodoItem[]>;
  /** 全部项（保序，供"不分组"渲染） */
  all: TodoItem[];
  /** 合计条目数（不是 count 求和：count 是每类的笔数，合计用项数更稳） */
  totalItems: number;
  /** 按 priority 排序后的视图（urgent → important → 其他） */
  ordered: TodoItem[];
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, important: 1, normal: 2 };

export function groupTodos(items: TodoItem[]): TodoGroups {
  const byType: Record<string, TodoItem[]> = {};
  for (const it of items) {
    const key = it.type || "other";
    (byType[key] ??= []).push(it);
  }
  const ordered = [...items].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  );
  return { byType, all: items, totalItems: items.length, ordered };
}

// ═══════════════════════════════════════════════════════════════════════════
// 六、适配器：recent-alerts ⇒ AlertItem[]
// ═══════════════════════════════════════════════════════════════════════════

/** 折算 `/admin/dashboard/recent-alerts`（平铺数组）。失败与空同样必须区分。 */
export function parseDashboardAlerts(raw: unknown): ParseResult<AlertItem[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "预警响应不是数组（形状异常）" };
  }
  const items: AlertItem[] = [];
  for (const row of raw) {
    if (!isObject(row)) continue;
    const a = row as DashboardAlertRaw;
    items.push({
      alertNo: String(a.alertNo ?? ""),
      ruleType: String(a.ruleType ?? ""),
      alertLevel: String(a.alertLevel ?? ""),
      title: String(a.title ?? ""),
      description: String(a.description ?? ""),
      status: String(a.status ?? ""),
      createdAt: String(a.createdAt ?? ""),
    });
  }
  return { ok: true, data: items, state: items.length > 0 ? "ready" : "empty" };
}

// ═══════════════════════════════════════════════════════════════════════════
// 七、适配器：reports/profit ⇒ 今日毛利
// ═══════════════════════════════════════════════════════════════════════════

/** 从 profit 报告取毛利；失败/缺字段 ⇒ null（**不填 0**，交给 UI 显示"—"） */
export function parseProfitGross(raw: unknown): number | null {
  if (!isObject(raw)) return null;
  const p = raw as ProfitReportRaw;
  const v = typeof p.grossProfit === "string" ? Number(p.grossProfit) : p.grossProfit;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 八、日期区间（今日 / 本月首日到今天）
// ═══════════════════════════════════════════════════════════════════════════

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 今日区间（reports/profit 的 dateStart/dateEnd 均为同一个今天） */
export function todayRange(now: Date = new Date()): { dateStart: string; dateEnd: string } {
  const ymd = toYmd(now);
  return { dateStart: ymd, dateEnd: ymd };
}

/** 本月区间（首日 → 今天） */
export function monthRange(now: Date = new Date()): { dateStart: string; dateEnd: string } {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateStart: toYmd(first), dateEnd: toYmd(now) };
}

// ═══════════════════════════════════════════════════════════════════════════
// 九、客户会员入口（WB-AUDIT-04：/customer/members 不存在 ⇒ 统一 /customers）
// ═══════════════════════════════════════════════════════════════════════════

/** 客户会员现存路由（唯一真相源；两页入口都必须引用它） */
export const CUSTOMER_MEMBERS_ROUTE = "/customers";
/** 已废弃的死链（保留常量以便测试断言"不再出现"） */
export const LEGACY_CUSTOMER_MEMBERS_ROUTE = "/customer/members";

// ═══════════════════════════════════════════════════════════════════════════
// 十、四态辅助：由调用方持有 loading/error，本文件提供统一判定
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 合并出最终展示态。
 * @param loading 是否正在请求
 * @param error   请求错误信息（null=无错）
 * @param count   成功解析后的条数
 */
export function resolveDataState(
  loading: boolean,
  error: string | null,
  count: number | null,
): DataState {
  if (loading) return "loading";
  if (error) return "error";
  if (count === null) return "loading"; // 尚未落下结果
  return count > 0 ? "ready" : "empty";
}
