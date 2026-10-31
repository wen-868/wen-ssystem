/**
 * KPI 区数据适配（WORKBENCH-10-F1 · 区域 B · 块 1）
 *
 * 原型锚点：`WB_KPI` 4 指标（L1642-1647）渲染为 `.wb-kpis > .wb-kpi`（.l/.v/.d，L1763）。
 * 原型里的数字是演示值，**不进入实现**；本适配只折算真实端点数据：
 *   - `GET /admin/dashboard/overview`（`src/api/report.ts:fetchDashboardOverview`，
 *     契约与 `utils/dashboard-contract.ts` 一致：嵌套 `today.{salesAmount,orderCount,
 *     compareYesterday}` / `stockAlerts.{total,urgent}` / `finance.receivable`）。
 * 诚实口径：
 *   - 原型第 4 项「应收逾期」在 overview 契约中**没有对应字段** ⇒ 如实改为「应收余额」
 *     （`finance.receivable`），不虚构逾期数；
 *   - 字段缺省 ⇒ 该指标整条不渲染（不填 0）；一条都取不到 ⇒ empty；
 *   - 未注入读取器（数据源未接线）⇒ unavailable「待接入」；
 *   - 形状异常 / 请求失败 ⇒ error + 重试。
 */
import { classifyFeedError, type FeedBlock, isFeedObject } from "./wb-feed-types";

export interface WbKpiMetric {
  key: "sales" | "orders" | "stockAlert" | "receivable";
  /** .l 标签 */
  label: string;
  /** .v 数值（已格式化字符串；缺字段的指标整条不存在） */
  value: string;
  /** .d 环比/说明；取不到 ⇒ 空串（UI 显示「—」） */
  delta: string;
  /** .d 修饰类：up|warn（与原型 L221-222 一致） */
  deltaClass: "up" | "warn" | "";
}

export interface WbKpiDeps {
  /** 注入真实读取器（视图接 api/report）；未注入 ⇒ 数据源未接线 ⇒ unavailable */
  fetchOverview?: () => Promise<unknown>;
}

/** 纯折算：overview 载荷 ⇒ KPI 列表（可单测，不发请求） */
export function parseWbKpiPayload(raw: unknown): FeedBlock<WbKpiMetric[]> {
  if (!isFeedObject(raw)) {
    return { state: "error", data: [], message: "经营指标响应形状异常（非对象），无法判定真实数据" };
  }
  const hasToday = isFeedObject(raw.today);
  const hasMonth = isFeedObject(raw.month);
  const hasStock = isFeedObject(raw.stockAlerts);
  const hasFinance = isFeedObject(raw.finance);
  if (!hasToday && !hasMonth && !hasStock && !hasFinance) {
    return {
      state: "unavailable",
      data: [],
      message: "概览未返回任何指标分组（today/month/stockAlerts/finance 全缺省）——指标数据源未就绪",
    };
  }

  const metrics: WbKpiMetric[] = [];
  const today = hasToday ? (raw.today as Record<string, unknown>) : {};
  const compare = isFeedObject(today.compareYesterday) ? today.compareYesterday : {};
  const stock = hasStock ? (raw.stockAlerts as Record<string, unknown>) : {};
  const finance = hasFinance ? (raw.finance as Record<string, unknown>) : {};

  const num = (v: unknown): number | null => {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };
  const money = (n: number): string => `¥${n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  const trend = (change: number | null, unit: string): { delta: string; deltaClass: "up" | "warn" | "" } => {
    if (change === null) return { delta: "", deltaClass: "" };
    const arrow = change >= 0 ? "↑" : "↓";
    const text = unit === "%" ? `${Math.abs(change)}%` : `${change >= 0 ? "+" : ""}${change}`;
    return { delta: `${arrow} ${text}`, deltaClass: change >= 0 ? "up" : "warn" };
  };

  const sales = num(today.salesAmount);
  if (sales !== null) {
    const t = trend(num(compare.salesAmountChange), "%");
    metrics.push({ key: "sales", label: "今日销售额", value: money(sales), delta: t.delta, deltaClass: t.deltaClass });
  }
  const orders = num(today.orderCount);
  if (orders !== null) {
    const t = trend(num(compare.orderCountChange), "");
    metrics.push({ key: "orders", label: "今日单据", value: `${orders} 单`, delta: t.delta, deltaClass: t.deltaClass });
  }
  const stockAlerts = num(stock.total);
  if (stockAlerts !== null) {
    const urgent = num(stock.urgent);
    metrics.push({
      key: "stockAlert",
      label: "库存预警",
      value: `${stockAlerts} 项`,
      delta: urgent !== null && urgent > 0 ? `${urgent} 项紧急` : "暂无紧急项",
      deltaClass: stockAlerts > 0 ? "warn" : "up",
    });
  }
  // 概览契约只有应收余额、没有「逾期」字段 ⇒ 标签如实写作「应收余额」（不虚构逾期）
  const receivable = num(finance.receivable);
  if (receivable !== null) {
    metrics.push({ key: "receivable", label: "应收余额", value: money(receivable), delta: "", deltaClass: "" });
  }

  if (metrics.length === 0) {
    return { state: "empty", data: [], message: "概览已连通，但今日暂无可读指标（字段缺省不填 0）" };
  }
  return { state: "ready", data: metrics, message: "" };
}

/**
 * 装载 KPI。判定「真实 vs 待接入」的关键行是下面的 `if (!deps.fetchOverview)`：
 * 视图注入了 report 层真实读取器才走真数据；未注入即 unavailable，不显示任何占位数字。
 */
export async function loadWbKpi(deps: WbKpiDeps = {}): Promise<FeedBlock<WbKpiMetric[]>> {
  if (!deps.fetchOverview) {
    return {
      state: "unavailable",
      data: [],
      message: "经营指标待接入：未注入 /admin/dashboard/overview 读取器（数据源未接线）",
    };
  }
  try {
    const raw = await deps.fetchOverview();
    return parseWbKpiPayload(raw);
  } catch (err) {
    return classifyFeedError(err, "经营指标", []);
  }
}
