/**
 * 审批区数据适配（WORKBENCH-10-F1 · 区域 B · 块 2）
 *
 * 原型锚点：`.wb-sec`「待办审批」+ 副标「AI 已预审 · 确认后执行 · 全程留痕」（L1764），
 * `#wbApps` 内 `.wb-ap` 卡（L1764-1768）：`.hd`（图标 + `.tt` 标题 + `<small>` 单号 + AI 预审完成）
 * \+ `.amt` + `.ai`（AI 预审意见 + `.a-acts` 通过 / 驳回）；已执行变体 `.wb-ap.done` 带
 * `.done-tag`「AI 已执行 · 已回流」。原型 `WB_AP`（L1680-1683）只作**结构**参照，
 * 其中的人名 / 金额 / 单号是演示数据，一律不进入实现。
 *
 * 真实数据源（已核对，非猜测）：`admin-web/src/api/ai.ts` 的待确认列表读取
 * （`GET {AI_BASE}/api/chat/confirmations`，与 tests/prototype-parity.spec.mjs L177 断言同源）。
 * 确认执行与转人工走同一确认链，**由视图层直接调用 api/ai**（壳层/manifest 层受
 * WORKBENCH-02 约束不得出现 AI 写动作符号名，本文件只提供折算与装载）。
 *
 * 状态口径：
 *   - 未注入读取器 ⇒ unavailable「待接入」；404 ⇒ unavailable；其它失败 ⇒ error + 重试；
 *   - 真实空列表 ⇒ empty（真的没有待确认，不伪装成有审批）；
 *   - AI 预审意见取底座返回的 `summary`，缺失时如实标注缺失，不生成建议文案。
 */
import { classifyFeedError, formatFeedAmount, type FeedBlock, isFeedObject } from "./wb-feed-types";

export type ApprovalCardState = "pending" | "done";

export interface WbApprovalCard {
  /** 底座确认 ID（执行链入参） */
  id: string;
  /** 操作名（原型 `.tt` 标题位）；缺失 ⇒ 「AI 写操作」 */
  title: string;
  /** `<small>` 位展示的留痕标识（确认 ID 尾段或操作名） */
  refLabel: string;
  /** 金额；底座未给金额 ⇒ null（UI 不画假 `.amt`） */
  amount: string | null;
  /** AI 预审意见正文（`.ai` 块）；缺失 ⇒ null */
  opinion: string | null;
  /** 确认链状态：pending = 待你确认；done = 已执行（`.wb-ap.done` 变体） */
  status: ApprovalCardState;
}

export interface WbApprovalsDeps {
  /** 注入真实读取器（视图接 api/ai 的确认列表）；未注入 ⇒ unavailable */
  fetchConfirmations?: () => Promise<unknown>;
}

/** 纯折算：确认列表载荷 ⇒ 审批卡（可单测，不发请求） */
export function parseWbApprovalsPayload(raw: unknown): FeedBlock<WbApprovalCard[]> {
  const rows = Array.isArray(raw)
    ? raw
    : isFeedObject(raw) && Array.isArray((raw as { confirmations?: unknown }).confirmations)
      ? ((raw as { confirmations: unknown[] }).confirmations)
      : null;
  if (rows === null) {
    return { state: "error", data: [], message: "待确认列表响应形状异常（既非数组也无 confirmations）" };
  }

  const cards: WbApprovalCard[] = [];
  for (const row of rows) {
    if (!isFeedObject(row)) continue; // 单条脏数据跳过，不污染整体状态
    const id = String(row.confirmationId ?? row.id ?? "").trim();
    if (!id) continue; // 无 ID 无法进入确认链 ⇒ 不渲染（避免不可操作的假卡）
    const title = String(row.operation ?? "").trim() || "AI 写操作";
    const opinion = String(row.summary ?? "").trim() || null;
    const details = isFeedObject(row.details) ? (row.details as Record<string, unknown>) : {};
    const amount = formatFeedAmount(details.amount ?? details.totalAmount ?? row.amount);
    const rawStatus = String(row.status ?? "").toLowerCase();
    const executed = rawStatus === "confirmed" || rawStatus === "executed" || row.executed === true;
    cards.push({
      id,
      title,
      refLabel: id.length > 12 ? `确认单 …${id.slice(-6)}` : `确认单 ${id}`,
      amount,
      opinion,
      status: executed ? "done" : "pending",
    });
  }

  if (cards.length === 0) {
    return { state: "empty", data: [], message: "当前没有等待确认的 AI 写操作（真实空列表）" };
  }
  return { state: "ready", data: cards, message: "" };
}

/**
 * 装载审批区。判定「真实 vs 待接入」的关键行是 `if (!deps.fetchConfirmations)`：
 * 视图注入确认列表读取器才走真数据；否则 unavailable，UI 显示待接入 + 重试。
 */
export async function loadWbApprovals(deps: WbApprovalsDeps = {}): Promise<FeedBlock<WbApprovalCard[]>> {
  if (!deps.fetchConfirmations) {
    return {
      state: "unavailable",
      data: [],
      message: "审批区暂不可用：审批数据读取器未就绪（/api/chat/confirmations）",
    };
  }
  try {
    const raw = await deps.fetchConfirmations();
    return parseWbApprovalsPayload(raw);
  } catch (err) {
    return classifyFeedError(err, "审批区", []);
  }
}
