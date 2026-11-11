/**
 * 今日晨报 view-model（WORKBENCH-PROTOTYPE-12-S1 · 父审计 D01-D04）
 *
 * 父审计结论（data-availability-matrix.json）：
 *   - D01 今日晨报 = DERIVABLE：由真实源组合生成，adapter 即本文件；
 *   - D02 库存安全线 = REAL；
 *   - D03 应收到期 = MISSING：无统一未来到期列表 ⇒ 中性"暂不可用"，
 *     不得把逾期列表改写成即将到期、不显示示例客户和金额；
 *   - D04 商品级负毛利 = MISSING：无商品级异常权威列表 ⇒ 中性"暂不可用"，
 *     不得用汇总毛利倒推商品异常。
 *
 * 真实数据源（后端源码直读，全部走 admin-web 主 api 实例——人工页面源，不经 AI 底座）：
 *   - GET /api/admin/dashboard/overview → ok({ today:{salesAmount,orderCount,…}, month:{…} })
 *     （backend/src/services/admin/dashboard.service.ts getOverview；嵌套结构。
 *       解析复用 src/utils/dashboard-contract.ts parseDashboardOverview——与 Dashboard 页同一解析器，同源）
 *   - GET /api/admin/dashboard/inventory-warning → ok([{ skuName, currentStock, warningThreshold, warningLevel, storeName }])
 *     （backend/src/services/admin/dashboard.service.ts getInventoryWarningList；warningLevel: URGENT/WARNING/…）
 *   - GET /api/admin/notifications → ok({ total, page, pageSize, records })
 *     （backend/src/routes/notification.routes.ts:14；解析复用 task-center.ts 同一解析器，同源）
 *
 * 生产规则（D01 production_rule）：只组合已成功读取的真实块；子块分别
 * loading/empty/error/timeout（各源独立状态对象），不允许用固定文字或演示金额冒充当日经营结论。
 * 本模块不依赖 AI 底座 ⇒ AI 接口失败天然不阻断晨报（硬验收 4）。
 *
 * ⚠️ 纯度约定：模块顶层只依赖纯解析器（task-center.ts / utils/dashboard-contract.ts，
 *     二者同样顶层零副作用）⇒ node 原生测试可直载本文件测解析函数（解析器单测，
 *     非 mock 冒充真实契约成功）；真实读数验证走 dev + 真实/transport 上游另行留证。
 */
import {
  parseNotificationsPayload,
  classifySourceFailure,
  makeSource,
  loadingOf,
  type ParsedNotification,
  type TaskSourceState,
  type TaskSourceStatus,
} from "./task-center";
import { parseDashboardOverview, type DashboardMetrics } from "../../utils/dashboard-contract";

export type BriefBlockStatus = TaskSourceStatus;

/** 晨报单块状态对象（每个数据块独立持有，不复用同一状态——D01 四态要求） */
export type BriefBlock<T> = TaskSourceState<T>;

/** 晨报块标识：3 个真实源 + 2 个 MISSING（中性不可用） */
export type MorningBriefBlockKey = "overview" | "inventoryWarnings" | "notifications" | "receivableDue" | "marginAnomaly";

export interface MorningBriefSnapshot {
  /** 经营概览（今日/本月销售与订单；真实源） */
  overview: BriefBlock<DashboardMetrics>;
  /** 库存安全线预警（真实源，D02） */
  inventoryWarnings: BriefBlock<ParsedInventoryWarning[]>;
  /** 通知（真实源） */
  notifications: BriefBlock<ParsedNotification[]>;
  /** 应收到期（D03 MISSING ⇒ 恒 unavailable） */
  receivableDue: BriefBlock<null>;
  /** 商品级负毛利（D04 MISSING ⇒ 恒 unavailable） */
  marginAnomaly: BriefBlock<null>;
}

// ==================== 库存安全线（D02 · /api/admin/dashboard/inventory-warning） ====================

/** 库存预警行（getInventoryWarningList 返回字段，逐字对齐） */
export interface ParsedInventoryWarning {
  skuName: string;
  storeName: string;
  currentStock: number;
  warningThreshold: number;
  /** URGENT/WARNING 之外的原值归 null（不猜；unknownLevels 计数披露） */
  warningLevel: "URGENT" | "WARNING" | null;
}

export interface ParsedInventoryWarnings {
  kind: "array" | "unknown";
  warnings: ParsedInventoryWarning[];
  urgentCount: number;
  warningCount: number;
  unknownLevels: number;
}

const KNOWN_WARNING_LEVELS = new Set(["URGENT", "WARNING"]);

/** 库存预警载荷解析（纯函数）：空数组 ⇒ 真实业务空态（不是失败） */
export function parseInventoryWarningsPayload(payload: unknown): ParsedInventoryWarnings {
  if (!Array.isArray(payload)) {
    return { kind: "unknown", warnings: [], urgentCount: 0, warningCount: 0, unknownLevels: 0 };
  }
  const warnings: ParsedInventoryWarning[] = [];
  let urgentCount = 0;
  let warningCount = 0;
  let unknownLevels = 0;
  for (const row of payload) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const rawLevel = typeof r.warningLevel === "string" ? r.warningLevel.trim().toUpperCase() : "";
    const level = KNOWN_WARNING_LEVELS.has(rawLevel) ? (rawLevel as "URGENT" | "WARNING") : null;
    if (level === "URGENT") urgentCount += 1;
    else if (level === "WARNING") warningCount += 1;
    else unknownLevels += 1;
    warnings.push({
      skuName: String(r.skuName ?? ""),
      storeName: String(r.storeName ?? ""),
      currentStock: Number(r.currentStock ?? 0),
      warningThreshold: Number(r.warningThreshold ?? 0),
      warningLevel: level,
    });
  }
  return { kind: "array", warnings, urgentCount, warningCount, unknownLevels };
}

// ==================== MISSING 块（D03/D04：业务级不可用，不填原型数据） ====================

/** D03：应收到期 MISSING —— 恒 unavailable，不发请求、不给示例客户/金额 */
export function makeReceivableDueBlock(): BriefBlock<null> {
  return {
    key: "receivableDue",
    label: "应收到期提醒",
    status: "unavailable",
    data: null,
    message: "应收到期提醒暂不可用：系统暂无统一的未来到期应收数据源（父审计 D03 MISSING），不展示示例数据",
    error: null,
    fetchedAt: null,
  };
}

/** D04：商品级负毛利 MISSING —— 恒 unavailable，不以汇总毛利倒推商品异常 */
export function makeMarginAnomalyBlock(): BriefBlock<null> {
  return {
    key: "marginAnomaly",
    label: "商品级负毛利提醒",
    status: "unavailable",
    data: null,
    message: "商品级负毛利提醒暂不可用：无商品级异常权威数据源（父审计 D04 MISSING），不以汇总毛利倒推商品异常",
    error: null,
    fetchedAt: null,
  };
}

// ==================== 聚合状态（各块独立对象） ====================

export const morningBrief: MorningBriefSnapshot = {
  overview: makeSource<DashboardMetrics>("overview", "经营概览"),
  inventoryWarnings: makeSource<ParsedInventoryWarning[]>("inventoryWarnings", "库存安全线"),
  notifications: makeSource<ParsedNotification[]>("notifications", "通知"),
  receivableDue: makeReceivableDueBlock(),
  marginAnomaly: makeMarginAnomalyBlock(),
};

function applyReady<T>(block: BriefBlock<T>, data: T, emptyMessage: string, isEmpty: boolean): void {
  if (isEmpty) {
    block.status = "empty";
    block.data = data;
    block.message = emptyMessage;
    block.error = null;
  } else {
    block.status = "ready";
    block.data = data;
    block.message = "";
    block.error = null;
  }
  block.fetchedAt = new Date().toISOString();
}

function applyFailure<T>(block: BriefBlock<T>, err: unknown): void {
  const { status, message } = classifySourceFailure(err);
  block.status = status;
  block.data = null;
  block.message = message;
  block.error = message;
}

// ==================== 装载器（dynamic import 主 api，保持顶层纯净） ====================

/** 主后端 ok() 包装取数：code!=="0" 视为业务失败；网络/超时错误向上抛由各块独立降级 */
async function adminGet(path: string): Promise<unknown> {
  const { api } = await import("../../api/request");
  const resp = await api.get(path);
  const body = resp.data as { code?: unknown; msg?: unknown; data?: unknown } | undefined;
  if (body && typeof body === "object" && typeof body.code === "string" && body.code !== "0") {
    throw new Error(typeof body.msg === "string" && body.msg ? body.msg : "接口返回失败");
  }
  return body?.data;
}

/** 经营概览（复用 Dashboard 页同一解析器 parseDashboardOverview ⇒ 同源） */
export async function loadOverviewBlock(): Promise<BriefBlock<DashboardMetrics>> {
  const block = morningBrief.overview;
  Object.assign(block, loadingOf(block));
  try {
    const raw = await adminGet("/admin/dashboard/overview");
    const parsed = parseDashboardOverview(raw);
    // ParseResult 判别联合：ok:false ⇒ 形状异常/缺契约主体，必须按失败处理（不得当空态）
    if (!parsed.ok) {
      throw new Error(parsed.reason || "经营概览返回形状异常");
    }
    // parseDashboardOverview 对主体存在但全缺省 ⇒ ready（真实 0 也显示），故无 empty 分支
    applyReady(block, parsed.data, "", false);
  } catch (err) {
    applyFailure(block, err);
  }
  return block;
}

/** 库存安全线（D02：没有预警时显示紧凑业务空态，不用原型商品名/数量） */
export async function loadInventoryWarningsBlock(): Promise<BriefBlock<ParsedInventoryWarning[]>> {
  const block = morningBrief.inventoryWarnings;
  Object.assign(block, loadingOf(block));
  try {
    const raw = await adminGet("/admin/dashboard/inventory-warning");
    const parsed = parseInventoryWarningsPayload(raw);
    if (parsed.kind === "unknown") throw new Error("库存预警端点返回形状异常（非数组）");
    applyReady(block, parsed.warnings, "当前没有库存预警（真实空态）", parsed.warnings.length === 0);
  } catch (err) {
    applyFailure(block, err);
  }
  return block;
}

/** 通知（复用 task-center 同一解析器 ⇒ 同源；AI 故障不影响本块） */
export async function loadNotificationsBlock(): Promise<BriefBlock<ParsedNotification[]>> {
  const block = morningBrief.notifications;
  Object.assign(block, loadingOf(block));
  try {
    const raw = await adminGet("/admin/notifications?page=1&pageSize=20");
    const parsed = parseNotificationsPayload(raw);
    if (parsed.kind === "unknown") throw new Error("通知端点返回形状异常（缺 records）");
    applyReady(block, parsed.notifications, "当前没有通知（真实空态）", parsed.notifications.length === 0);
  } catch (err) {
    applyFailure(block, err);
  }
  return block;
}

/**
 * 聚合装载晨报：三个真实源并行、彼此独立（Promise.allSettled），互不阻断；
 * 两个 MISSING 块恒 unavailable（不发请求）。全函数不抛——任一源失败只落在该源状态上。
 */
export async function loadMorningBrief(): Promise<MorningBriefSnapshot> {
  morningBrief.receivableDue = makeReceivableDueBlock();
  morningBrief.marginAnomaly = makeMarginAnomalyBlock();
  await Promise.allSettled([loadOverviewBlock(), loadInventoryWarningsBlock(), loadNotificationsBlock()]);
  return morningBrief;
}

// ==================== 头条摘要（与列表同源派生，硬验收 3） ====================

export interface MorningBriefHeadline {
  /** 今日销售额/订单数（来自 overview 同一解析数据；overview 非 ready/empty ⇒ null） */
  todaySalesAmount: number | null;
  todayOrderCount: number | null;
  /** 库存预警条数（来自 inventoryWarnings 同一数据集） */
  inventoryWarningCount: number | null;
  urgentInventoryCount: number | null;
  /** 通知条数（来自 notifications 同一数据集） */
  notificationCount: number | null;
}

/**
 * 头条数字：**只读各块已解析的 data**（同一数据集派生，不另发请求、不另立口径）。
 * ready/empty 给真实数字（empty 的 0 是真空）；error/timeout/unavailable ⇒ null 不展示。
 */
export function deriveMorningBriefHeadline(s: MorningBriefSnapshot = morningBrief): MorningBriefHeadline {
  const overviewUsable = s.overview.status === "ready" || s.overview.status === "empty";
  const inventoryUsable = s.inventoryWarnings.status === "ready" || s.inventoryWarnings.status === "empty";
  const notificationsUsable = s.notifications.status === "ready" || s.notifications.status === "empty";
  const warnings = inventoryUsable && Array.isArray(s.inventoryWarnings.data) ? s.inventoryWarnings.data : null;
  const notifications =
    notificationsUsable && Array.isArray(s.notifications.data) ? s.notifications.data : null;
  return {
    todaySalesAmount: overviewUsable && s.overview.data ? s.overview.data.today.salesAmount : null,
    todayOrderCount: overviewUsable && s.overview.data ? s.overview.data.today.orderCount : null,
    inventoryWarningCount: warnings ? warnings.length : null,
    urgentInventoryCount: warnings ? warnings.filter((w) => w.warningLevel === "URGENT").length : null,
    notificationCount: notifications ? notifications.length : null,
  };
}

/** 仅供测试重置（不参与生产逻辑） */
export function __resetMorningBriefForTest(): void {
  morningBrief.overview = makeSource<DashboardMetrics>("overview", "经营概览");
  morningBrief.inventoryWarnings = makeSource<ParsedInventoryWarning[]>("inventoryWarnings", "库存安全线");
  morningBrief.notifications = makeSource<ParsedNotification[]>("notifications", "通知");
  morningBrief.receivableDue = makeReceivableDueBlock();
  morningBrief.marginAnomaly = makeMarginAnomalyBlock();
}
