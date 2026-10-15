/**
 * 路由级限流参数（S3-208 / R101 收口总清单第 57 项）
 *
 * 为什么是"导出参数对象、由注册点内联 `rateLimit(...)`"，而不是导出限流中间件：
 *   见 `server.ts` 的 S3-112 结论——CodeQL 的 `js/missing-rate-limiting` 只把
 *   "注册点上**直接出现**的限流中间件调用"识别为限流证据；若把 `rateLimit(...)`
 *   包进 helper 再返回中间件，CodeQL 识别不到，于是"做了鉴权的路由"每新增一条就被
 *   报一条 high（第 57 项实测：PR #297 的 11 条 high 全部是这条规则）。守此形状的
 *   断言见 `src/__tests__/config/rate-limit-options.test.ts`（同族口径）。
 *   ⇒ 本模块**只提供参数**，调用方必须在注册点写 `rateLimit(AUTHED_ROUTE_LIMIT)`。
 *
 * 参数口径与仓内既有**路由级**限流一字不差（`routes/platform-auth.routes.ts` 的
 * MFA 管理限流）：窗口 5 分钟、阈值 60 次/IP，正常使用远低于阈值，只兜
 * "拿到令牌后狂打某条接口"的场景；`validate.trustProxy/xForwardedForHeader = false`
 * 与该文件同形，避免 express-rate-limit v8 在 Nginx 反代下刷 `ERR_ERL_*` 校验告警
 * （踩坑 [54]：这类告警的实质是"IPv6 下限流可被绕过"，不是噪音）。
 * 真实客户端 IP 由 `server.ts` 的 `app.set("trust proxy", 1)` 统一处理，本模块不重复设置。
 *
 * ⚠️ 只提供参数、不返回中间件：这是 CodeQL 可见性的硬要求，不是风格偏好。
 */
import rateLimit from "express-rate-limit";

/** `rateLimit()` 的 options 类型（与 server.ts 的写法保持一致：从函数签名上取，不手写副本） */
type RateLimitOptions = NonNullable<Parameters<typeof rateLimit>[0]>;

/** 已鉴权路由的兜底限流参数（5 分钟 / 60 次 / IP） */
export const AUTHED_ROUTE_LIMIT: RateLimitOptions = {
  windowMs: 5 * 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: () => ({ code: "429", msg: "操作过于频繁，请稍后再试", traceId: "" }),
};
