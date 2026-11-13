/**
 * 默认工作台五块共用数据契约（WORKBENCH-10-F1 · 区域 B · 默认工作台主面）
 *
 * 五态可区分口径（派单卡 §B）：`loading / empty / unavailable / error / retry`
 *   - loading     ：读取中（首屏与每次重试都会进入）；
 *   - empty       ：端点真实返回了「没有数据」——空是结果，不是故障；
 *   - unavailable ：数据源缺失（端点未接入 / HTTP 404），沿用 `agent-directory.ts`
 *                  的统一形态：诚实说明缺什么，UI 显示「未接线」，**绝不编造条目**；
 *   - error       ：端点存在但请求失败或响应形状异常（失败 ≠ 空）；
 *   - retry       ：error / unavailable 两态在 UI 上必须给出可点的重试入口
 *                  （各块 `data-testid="wb-*-retry"`，重试即重跑对应 loader）。
 *
 * 本目录（shared/workbench）受 WORKBENCH-02 约束扫描管辖（tests/workbench-shell.spec.mjs）：
 * 文件内不得出现 AI 写动作符号名（确认/取消/撤销/对话发送）与动态菜单端点字符串；
 * 因此所有 loader 都以**注入 fetcher** 的方式取数，真实链路接线在视图层完成。
 */

export type FeedBlockState = "loading" | "ready" | "empty" | "unavailable" | "error";

/** 五态清单（供 UI/测试核对「每个状态都有实现」） */
export const FEED_BLOCK_STATES: readonly FeedBlockState[] = [
  "loading",
  "ready",
  "empty",
  "unavailable",
  "error",
];

export interface FeedBlock<T> {
  state: FeedBlockState;
  /** ready 时的数据；其余状态为空数组/空对象等诚实缺省，**不填占位数字** */
  data: T;
  /** 可直接展示的说明文案（loading/error/unavailable/empty 均必须有） */
  message: string;
}

/** 读取中缺省（每次装载/重试的起点） */
export function feedLoading<T>(emptyData: T, label: string): FeedBlock<T> {
  return { state: "loading", data: emptyData, message: `正在读取${label}…` };
}

/** 未接入缺省：说明缺的是什么、为什么（agent-directory 同形态） */
export function feedUnavailable<T>(emptyData: T, message: string): FeedBlock<T> {
  return { state: "unavailable", data: emptyData, message };
}

/** 空态：真实返回了「没有条目」 */
export function feedEmpty<T>(emptyData: T, message: string): FeedBlock<T> {
  return { state: "empty", data: emptyData, message };
}

/** 形状异常 ⇒ error（失败绝不降级成空数组） */
export function feedError<T>(emptyData: T, message: string): FeedBlock<T> {
  return { state: "error", data: emptyData, message };
}

/**
 * 失败分类（各 loader 与视图共用）：
 *   - 明确 404 / not found ⇒ unavailable —— 端点没挂（数据源缺失），文案给「未接线」依据；
 *   - 其余（网络/超时/5xx/形状异常）⇒ error —— 真实故障，可重试。
 */
export function classifyFeedError<T>(err: unknown, label: string, emptyData: T): FeedBlock<T> {
  const message = err instanceof Error ? err.message : String(err);
  if (/HTTP 404|not found/i.test(message)) {
    return {
      state: "unavailable",
      data: emptyData,
      message: `${label}暂不可用：服务返回 404（${message}）`,
    };
  }
  return { state: "error", data: emptyData, message: `${label}读取失败：${message || "未知错误"}` };
}

/** 金额展示：仅对**真实取到的有限数**格式化；取不到就返回 null（UI 隐藏，不画 0） */
export function formatFeedAmount(value: unknown): string | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return `¥${n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function isFeedObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}
