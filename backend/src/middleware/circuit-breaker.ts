import type { Request, Response, NextFunction } from "express";
import logger from "../shared/logger";

/**
 * 熔断器中间件（顶级商业软件验收-降级与熔断检查项）
 *
 * 状态机：
 *   CLOSED  正常放行，统计窗口内失败率
 *   OPEN    失败率超阈值，快速失败（fallback 或 503），openMs 后进入 HALF_OPEN
 *   HALF_OPEN 放行试探请求：成功 → CLOSED；失败 → OPEN
 *
 * 用法：
 *   router.get("/api", circuitBreaker({ key: "order-list" }), handler)
 */

type State = "CLOSED" | "OPEN" | "HALF_OPEN";

interface BreakerState {
  state: State;
  failures: number;
  total: number;
  openedAt: number;
  windowStart: number;
}

interface CircuitBreakerOptions {
  /** 熔断器标识（按接口隔离） */
  key: string;
  /** 失败率阈值（0~1），默认 0.5 */
  failureThreshold?: number;
  /** 统计窗口（毫秒），默认 60s */
  windowMs?: number;
  /** 熔断打开持续时间（毫秒），默认 30s */
  openMs?: number;
  /** 触发熔断的最少请求数（防冷启动误判），默认 10 */
  minRequests?: number;
  /** 触发熔断的最少失败数（覆盖低流量场景：窗口内请求数不足 minRequests 时按失败数触发），默认 5 */
  minFailures?: number;
  /** 熔断降级回调：可返回缓存数据；未提供时返回 503 */
  fallback?: (req: Request, res: Response) => void | Promise<void>;
}

const breakers = new Map<string, BreakerState>();

function getState(key: string, options: Required<Pick<CircuitBreakerOptions, "openMs">>): BreakerState {
  let state = breakers.get(key);
  if (!state) {
    state = { state: "CLOSED", failures: 0, total: 0, openedAt: 0, windowStart: Date.now() };
    breakers.set(key, state);
  }
  // OPEN 超过 openMs 后自动转 HALF_OPEN（试探）
  if (state.state === "OPEN" && Date.now() - state.openedAt >= options.openMs) {
    state.state = "HALF_OPEN";
    state.failures = 0;
    state.total = 0;
  }
  return state;
}

export function circuitBreaker(options: CircuitBreakerOptions) {
  const {
    key,
    failureThreshold = 0.5,
    windowMs = 60_000,
    openMs = 30_000,
    minRequests = 10,
    minFailures = 5,
    fallback,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const state = getState(key, { openMs });

    // 熔断打开：快速失败或走降级
    if (state.state === "OPEN") {
      if (fallback) {
        await fallback(req, res);
        return;
      }
      res.status(503).json({ code: "503", msg: "服务暂不可用，请稍后重试" });
      return;
    }

    // 统计窗口过期则重置（独立窗口起始时间，避免首次请求即重置）
    if (Date.now() - state.windowStart > windowMs) {
      state.failures = 0;
      state.total = 0;
      state.windowStart = Date.now();
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      state.total++;
      const failed = typeof body === "object" && body !== null
        && (body as { code?: string }).code && (body as { code?: string }).code !== "0";
      if (failed) state.failures++;

      // HALF_OPEN：试探请求失败则回到 OPEN
      if (state.state === "HALF_OPEN") {
        if (failed) {
          state.state = "OPEN";
          state.openedAt = Date.now();
        } else {
          state.state = "CLOSED";
          state.failures = 0;
          state.total = 0;
        }
      } else if ((state.total >= minRequests
        && state.failures / state.total >= failureThreshold)
        || state.failures >= minFailures) {
        state.state = "OPEN";
        state.openedAt = Date.now();
        if (state.failures >= minFailures) {
          logger.warn(`[circuit-breaker] ${key} 熔断打开（失败数 ${state.failures} ≥ ${minFailures}）`);
        } else {
          logger.warn(`[circuit-breaker] ${key} 熔断打开（失败率 ${(state.failures / state.total * 100).toFixed(1)}%）`);
        }
      }
      return originalJson(body);
    }) as Response["json"];

    res.on("finish", () => {
      // 5xx 计入失败（非业务错误码时）
      if (res.statusCode >= 500) {
        state.total++;
        state.failures++;
        if (state.state === "HALF_OPEN") {
          state.state = "OPEN";
          state.openedAt = Date.now();
        } else if ((state.total >= minRequests
          && state.failures / state.total >= failureThreshold)
          || state.failures >= minFailures) {
          state.state = "OPEN";
          state.openedAt = Date.now();
          logger.warn(`[circuit-breaker] ${key} 熔断打开（HTTP ${res.statusCode}，失败数 ${state.failures}）`);
        }
      }
    });

    next();
  };
}

/** 测试辅助：重置指定熔断器状态 */
export function resetBreaker(key: string) {
  breakers.delete(key);
}
