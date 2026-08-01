/**
 * SSE（Server-Sent Events）解析工具
 *
 * AI 底座通过 POST /api/chat 返回 SSE 流，事件格式约定为：
 *   data: {"type":"text","content":"增量文本"}\n\n
 * 每个事件以空行（\n\n）结束，事件内容在 data: 字段中（JSON 字符串）。
 *
 * 本模块提供纯函数解析逻辑（无 DOM / 网络依赖），类型完整，便于复用与单元测试。
 */

/** SSE 事件：type 为事件类型，其余字段由各事件约定 */
export interface SseEvent {
  type: string;
  [key: string]: unknown;
}

/** 解析单个 SSE 数据块（一个块内可有多个 data: 行，多行以换行连接后整体 JSON 解析） */
function parseSseBlock(block: string): SseEvent | null {
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith("data:")) {
      dataLines.push(trimmed.slice(5).trimStart());
    }
    // SSE 规范还可能有 event:/id:/retry: 等字段，AI 底座当前仅使用 data:，其余忽略
  }
  if (dataLines.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(dataLines.join("\n"));
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return parsed as SseEvent;
    }
  } catch {
    // 非法 JSON 直接丢弃该块，避免打断整个流式解析
  }
  return null;
}

export interface ParseSseResult {
  /** 已解析出的完整事件列表 */
  events: SseEvent[];
  /** 尚未凑齐结尾空行的残留文本，需与后续流内容拼接后再解析 */
  rest: string;
}

/**
 * 从 SSE 文本缓冲中解析出所有完整事件。
 *
 * @param buffer 当前已累积的流文本
 * @param flush  为 true 时强制解析尾部残留（流结束时使用，忽略是否缺少结尾空行）
 */
export function parseSseChunk(buffer: string, flush = false): ParseSseResult {
  const events: SseEvent[] = [];
  let rest = buffer;
  let idx = rest.indexOf("\n\n");
  while (idx !== -1) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    const event = parseSseBlock(block);
    if (event) events.push(event);
    idx = rest.indexOf("\n\n");
  }
  if (flush && rest.trim().length > 0) {
    const event = parseSseBlock(rest);
    if (event) events.push(event);
    rest = "";
  }
  return { events, rest };
}
