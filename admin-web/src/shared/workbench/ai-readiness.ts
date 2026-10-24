/**
 * AI 底座可用性状态机（WORKBENCH-06F1 · B1 返工）
 *
 * 背景（凌舟验收 B1）：旧实现把 `sessionState === 'idle'` 直接渲染成绿色「AI 在线待命」。
 * idle 只表示**没有进行中的流式请求**，不等于服务可达 —— 运行态里 AI 请求真实
 * `net::ERR_FAILED` 时页面仍显示在线（假绿）。
 *
 * 本模块把「AI 是否真的可用」做成显式状态机，**只有真实探针成功才允许进入 ready（绿色）**：
 *
 *   unchecked → 尚未探测（首屏瞬时；不显示绿色）
 *   checking  → 探测中（灰/蓝，不显示绿色）
 *   ready     → 真实探针返回 status=ready ⇒ 绿色「AI 就绪」
 *   degraded  → 探针可达但 status=degraded（表结构/依赖缺失）⇒ 非绿「AI 降级」
 *   error     → 探针失败（网络/CORS/超时/401/403/非 2xx）⇒ 非绿「AI 不通」
 *
 * 硬规则（对应派单卡 §二.1 / §四）：
 *   1. `idle` / 组件已挂载 / 页面已打开 ⇒ **一律不得**映射为 ready；
 *   2. 失败、超时、CORS、401/403 **一律非绿**；
 *   3. 不自动反复重试形成请求风暴 —— 只在挂载时探测一次；用户可点「重试」单次手动触发
 *      （另加 60s 冷却，避免连点成风暴）。
 *
 * 探针选择（派单卡推荐）：`GET /api/health/ready`
 *   契约见 ZXQL-AI `src/app.controller.ts:47-64`：
 *   - **恒返 HTTP 200**（degraded 也不返 5xx，避免编排误判进程故障）；
 *   - 语义在 body 的 `status` 字段与 `X-AI-Readiness` 响应头里，**不能只看 HTTP 状态码**；
 *   - `status ∈ { ready, degraded }`。
 *   ⇒ 本模块同时读 body.status 与响应头，任一为 degraded 即判 degraded。
 */
import { ref } from "vue";

export type AiReadinessState = "unchecked" | "checking" | "ready" | "degraded" | "error";

/** 探针结果（可机器断言；测试直接喂这个结构） */
export interface AiReadinessResult {
  state: AiReadinessState;
  /** 底座自报状态（ready/degraded），未取到时 null */
  reportedStatus: string | null;
  /** 失败原因（网络/CORS/超时/非 2xx/形状异常），ready/degraded 时为 null */
  error: string | null;
  /** 最近一次探测完成时间（毫秒时间戳），未探测为 null */
  checkedAt: number | null;
}

/** 单次手动重试的最小间隔（防连点造成请求风暴） */
export const RETRY_COOLDOWN_MS = 60_000;

/**
 * 把一次探针的**原始观测**折算为状态 —— 本函数是状态机的唯一判据（纯函数，可单测）。
 *
 * @param input.httpOk      fetch 是否拿到 2xx 响应
 * @param input.bodyStatus  body 里的 `status`（缺失/非字符串按未知处理）
 * @param input.headerStatus `X-AI-Readiness` 响应头
 * @param input.networkError 网络层错误文案（fetch 抛错 / 超时 / CORS 都落这里）
 *
 * 判定顺序（**先排除失败，再判就绪**）：
 *   1. 有网络错误 或 HTTP 非 2xx ⇒ error（非绿）
 *   2. body/header 均未给出可识别的 status ⇒ error（形状异常，不得乐观判绿）
 *   3. 任一为 degraded ⇒ degraded（非绿）
 *   4. body 或 header 明确为 ready ⇒ ready（**唯一进入绿色的路径**）
 *   5. 其余未知值 ⇒ error（不认识的枚举不放行）
 */
export function resolveReadiness(input: {
  httpOk: boolean;
  bodyStatus?: unknown;
  headerStatus?: unknown;
  networkError?: string | null;
}): AiReadinessState {
  if (input.networkError) return "error";
  if (!input.httpOk) return "error";

  const norm = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const lowered = value.trim().toLowerCase();
    return lowered.length > 0 ? lowered : null;
  };
  const fromBody = norm(input.bodyStatus);
  const fromHeader = norm(input.headerStatus);
  const signals = [fromBody, fromHeader].filter((v): v is string => v !== null);

  // 形状异常：既无 body.status 也无响应头 ⇒ 不能判绿（例如被代理返回 HTML 登录页）
  if (signals.length === 0) return "error";
  if (signals.includes("degraded")) return "degraded";
  if (signals.includes("ready")) return "ready";
  return "error";
}

/** 状态机是否处于「可显示绿色在线」的唯一状态 */
export function isAiOnline(state: AiReadinessState): boolean {
  return state === "ready";
}

/** 各状态的 UI 文案（**只有 ready 文案允许含"在线/就绪"**） */
export function readinessLabel(state: AiReadinessState): string {
  switch (state) {
    case "ready":
      return "AI 就绪";
    case "degraded":
      return "AI 降级";
    case "error":
      return "AI 不通";
    case "checking":
      return "AI 检测中";
    default:
      return "AI 未检测";
  }
}

/** 全局单例态（壳层与顶栏共用同一份，避免两处各探一次） */
export const aiReadiness = ref<AiReadinessResult>({
  state: "unchecked",
  reportedStatus: null,
  error: null,
  checkedAt: null,
});

let inFlight: Promise<void> | null = null;
let lastFinishedAt = 0;

/**
 * 执行一次就绪探测（**并发去重**：同一时刻只允许一个请求在飞）。
 *
 * @param force 手动重试时传 true 以绕过冷却（但仍不允许并发）
 * @param fetchImpl 注入用（测试传桩；默认真实 fetch）
 * @param url 探针地址（测试注入；默认走 AI_BASE_URL）
 */
export async function probeAiReadiness(options?: {
  force?: boolean;
  fetchImpl?: typeof fetch;
  url?: string;
  timeoutMs?: number;
}): Promise<void> {
  const now = Date.now();
  if (inFlight) return inFlight; // 并发去重
  if (!options?.force && lastFinishedAt > 0 && now - lastFinishedAt < RETRY_COOLDOWN_MS) {
    return; // 冷却期内不重复探测（防风暴）
  }

  const doFetch = options?.fetchImpl ?? fetch;
  const url = options?.url ?? `${resolveAiBaseForProbe()}/api/health/ready`;
  const timeoutMs = options?.timeoutMs ?? 8_000;

  aiReadiness.value = { ...aiReadiness.value, state: "checking" };

  inFlight = (async () => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const resp = await doFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller?.signal,
        // 探针不携带业务 JWT：health/ready 是**服务级**探针（契约见 app.controller.ts，
        // 无 guard），带上也无意义；不带可避免 token 过期把就绪误判为失败。
        credentials: "omit",
      });
      let bodyStatus: unknown;
      try {
        const json = (await resp.json()) as { status?: unknown };
        bodyStatus = json?.status;
      } catch {
        bodyStatus = undefined; // 非 JSON（如代理 HTML）⇒ 形状异常，由 resolveReadiness 判 error
      }
      const state = resolveReadiness({
        httpOk: resp.ok,
        bodyStatus,
        headerStatus: resp.headers?.get?.("X-AI-Readiness") ?? undefined,
        networkError: null,
      });
      aiReadiness.value = {
        state,
        reportedStatus: typeof bodyStatus === "string" ? bodyStatus : null,
        error: state === "error" ? `探针形状异常（HTTP ${resp.status}）` : null,
        checkedAt: Date.now(),
      };
    } catch (error) {
      // fetch 抛错 = 网络不可达 / CORS / 超时 abort
      const message = error instanceof Error ? error.message : String(error);
      aiReadiness.value = {
        state: "error",
        reportedStatus: null,
        error: message || "AI 底座不可达",
        checkedAt: Date.now(),
      };
    } finally {
      if (timer) clearTimeout(timer);
      lastFinishedAt = Date.now();
      inFlight = null;
    }
  })();

  return inFlight;
}

/** 探针基址：与 api/ai.ts 的 AI_BASE_URL 同源规则（测试可注入 url 绕过本函数） */
function resolveAiBaseForProbe(): string {
  const electronAiBase = (window as { electronAPI?: { aiBase?: string } } | undefined)?.electronAPI?.aiBase;
  if (typeof window !== "undefined" && electronAiBase) {
    return String(electronAiBase).replace(/\/+$/, "");
  }
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const configured = env?.VITE_AI_BASE_URL;
  if (typeof configured === "string" && configured) return configured.replace(/\/+$/, "");
  if (env?.PROD) return "https://admin.onepan.cn/ai-api";
  return ["http:", "", "//", "localhost", ":3016"].join("");
}

/** 仅供测试重置内部节流状态（不参与生产逻辑） */
export function __resetProbeThrottleForTest(): void {
  inFlight = null;
  lastFinishedAt = 0;
  aiReadiness.value = { state: "unchecked", reportedStatus: null, error: null, checkedAt: null };
}
