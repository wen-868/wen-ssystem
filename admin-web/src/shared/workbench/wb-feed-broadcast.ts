/**
 * AI 播报数据适配（WORKBENCH-10-F1 · 区域 B · 块 3 · 经营异动播报）
 *
 * 原型锚点：经营异动播报（L5620 / L5709）——
 * 「GMV 环比 / 退款率 / 毛利异动自动播报并给出排查建议（AI 建议 · 人工核实后处置）」。
 *
 * **现状核对（2026-11-01，不是猜测）**：
 *   - 管理后端仅有消息流 `GET /admin/wb-notifications`（`backend/src/routes/workbench.routes.ts`），
 *     返回的是系统/订单/支付等**通知记录**，没有 GMV 环比 / 退款率 / 毛利异动的播报结构，
 *     也没有「AI 建议」字段；把它改名当播报用属于冒用语义（agent-directory.ts 同口径禁止）。
 *   - AI 底座（`src/api/ai.ts`）只有对话、模型/工具枚举、确认链与服务端推送，
 *     **没有**播报 / 晨报 / 异动分析端点；异动建议若由前端本地文案拼出来即为伪造 AI 结论。
 * ⇒ 结论：**播报数据源不存在**，本适配按 agent-directory.ts 的强制形态返回
 *   `{ state: "unavailable", data: [], message: "<缺什么、为什么>" }`，UI 显示「待接入」+ 重试。
 *
 * 端点补齐后只需注入 `fetchBroadcasts`（或改本文件默认实现），UI 与测试无需改动：
 *   - `parseWbBroadcastRows` 已定义好 ready/empty/error 折算（形状：数组，
 *     单项 `{ metric, value, advice }`，advice=AI 建议、必须来自服务端）。
 */
import { classifyFeedError, type FeedBlock, isFeedObject } from "./wb-feed-types";

export interface WbBroadcastItem {
  /** 异动指标名（如 GMV 环比 / 退款率 / 毛利 —— 由服务端数据给出，不本地命名） */
  metric: string;
  /** 指标读数（服务端格式化或原始值字符串） */
  value: string;
  /** AI 建议（服务端产物；缺失 ⇒ null，UI 标注缺失而不生成文案） */
  advice: string | null;
  /** 人工核实要求（原型口径「AI 建议 · 人工核实后处置」） */
  needHumanCheck: boolean;
}

export interface WbBroadcastDeps {
  /** 播报端点读取器；当前**没有**可注入的真实端点，视图不注入 ⇒ unavailable */
  fetchBroadcasts?: () => Promise<unknown>;
}

/** 纯折算：播报行 ⇒ 展示项（端点接入后生效；现在由测试以受控输入验证三态） */
export function parseWbBroadcastRows(raw: unknown): FeedBlock<WbBroadcastItem[]> {
  if (!Array.isArray(raw)) {
    return { state: "error", data: [], message: "播报响应形状异常（非数组）" };
  }
  const items: WbBroadcastItem[] = [];
  for (const row of raw) {
    if (!isFeedObject(row)) continue;
    const metric = String(row.metric ?? row.title ?? "").trim();
    const value = String(row.value ?? "").trim();
    if (!metric || !value) continue; // 无指标名或无读数 = 不知道，不拼半截条目
    items.push({
      metric,
      value,
      advice: String(row.advice ?? row.suggestion ?? "").trim() || null,
      needHumanCheck: row.needHumanCheck !== false,
    });
  }
  if (items.length === 0) {
    return { state: "empty", data: [], message: "暂无经营异动播报（真实空列表）" };
  }
  return { state: "ready", data: items, message: "" };
}

/**
 * 装载播报。判定「真实 vs 待接入」的关键行是 `if (!deps.fetchBroadcasts)`：
 * 底座播报端点不存在 ⇒ 视图无读取器可注入 ⇒ 恒为 unavailable（待接入 + 重试）。
 */
export async function loadWbBroadcasts(deps: WbBroadcastDeps = {}): Promise<FeedBlock<WbBroadcastItem[]>> {
  if (!deps.fetchBroadcasts) {
    return {
      state: "unavailable",
      data: [],
      message: "经营异动播报尚未接入：GMV 环比 / 退款率 / 毛利异动与 AI 建议需要底座播报端点（现无此端点，不本地伪造）",
    };
  }
  try {
    const raw = await deps.fetchBroadcasts();
    return parseWbBroadcastRows(raw);
  } catch (err) {
    return classifyFeedError(err, "经营异动播报", []);
  }
}
