/**
 * 平台登录限流（R101-S2-01 批 2.1 建立，批 2.2 按裁定③ 改为「按失败类型分流」）
 *
 * 背景：平台登录接口 `/api/platform/auth/login` 原先**完全没有限流**
 * （`server.ts` 注释「应用户要求不限流」）。而图形验证码的字符以 SVG `<text>`
 * 明文下发，一旦被脚本解析，限流就是**唯一的爆破门闩**。
 *
 * 批 2.2 裁定（凌舟 2026-09-14）——**按失败类型分流，不搞一刀切**：
 *  - **凭据错误（401）**：IP + 账号**双维度**，5 次 / 5 分钟 → 锁定 15 分钟。
 *    这才是爆破特征，维持原有强度不变。
 *  - **验证码错误（400）**：**只计 IP 维度**，阈值放宽到 20 次 / 5 分钟，
 *    超限只拒绝并要求重新获取验证码（固定窗口语义下 ≤ 5 分钟），**绝不锁定账号**。
 *    理由是「验证码看错一位是正常交互噪声」，拿它触发「账号锁 15 分钟」会直接变成投诉；
 *    自动化尝试按 IP 抑制就够。
 *
 * 分流实现（关键技巧）：
 *  express-rate-limit 判定「成功」用的是 `requestWasSuccessful(req, res)`
 *  （默认 `res.statusCode < 400`）。把它**重写成「响应码不等于本 limiter 关心的那个状态码」**，
 *  即可做到「只有 401 计入凭据限流、只有 400 计入验证码限流」，
 *  其余响应（2xx、5xx、以及限流自身的 429）净效果为 0。
 *
 * 口径说明（如实标注）：
 *  - 底层是**固定窗口**，不是滑动窗口。短窗口保证「窗口内达到 max 次必触发」，
 *    长窗口保证触发后最长封锁到 15 分钟窗口结束；实际封锁时长 = 两个窗口结束时间的
 *    较晚者（≤ 15 分钟），**不是**「命中时刻起算精确 15 分钟」。
 *  - 存储用默认 MemoryStore（与 `platform-miniapp.routes.ts` 的限流范式一致），
 *    **进程内计数、不建表**；局限是多实例部署不共享（已报备）。
 */

import rateLimit, { ipKeyGenerator, MemoryStore } from "express-rate-limit";
import type { Request } from "express";

// ─── 常量 ─────────────────────────────────────────────────────

/** 凭据错误阈值：5 次 */
export const LOGIN_FAIL_MAX = 5;
/** 凭据错误判定窗口：5 分钟 */
export const LOGIN_FAIL_WINDOW_MS = 5 * 60_000;
/** 凭据错误锁定窗口：15 分钟 */
export const LOGIN_FAIL_LOCK_MS = 15 * 60_000;

/** 验证码错误阈值：20 次（裁定③ 放宽） */
export const CAPTCHA_FAIL_MAX = 20;
/** 验证码错误判定窗口：5 分钟（固定窗口 → 超限后最多短时拒绝 5 分钟） */
export const CAPTCHA_FAIL_WINDOW_MS = 5 * 60_000;

/** 计入凭据限流的响应码 */
export const CREDENTIAL_FAIL_STATUS = 401;
/** 计入验证码限流的响应码 */
export const CAPTCHA_FAIL_STATUS = 400;

/** 凭据错误的兜底文案（实际响应由 buildMessage 动态生成，含失败次数与剩余时间） */
export const LOGIN_FAIL_MESSAGE = {
  code: "429",
  msg: "登录失败次数过多，已临时锁定，请稍后重试",
  traceId: "",
};

/** 验证码错误的兜底文案（同上，动态生成） */
export const CAPTCHA_FAIL_MESSAGE = {
  code: "429",
  msg: "图形验证码错误次数过多，请重新获取验证码后重试",
  traceId: "",
};

// ─── 键 ───────────────────────────────────────────────────────

/**
 * IP 维度键。
 * 必须经 `ipKeyGenerator` 归一化：IPv6 按 /56 子网归并（防止攻击者轮换同段地址绕过），
 * `::ffff:127.0.0.1` 这类 IPv4-mapped 地址会被还原成 IPv4。
 * 直接拿 `req.ip` 当键会触发 express-rate-limit 的 ERR_ERL_KEY_GEN_IPV6 校验告警。
 */
function ipKey(req: Request): string {
  const ip = (req as { ip?: unknown }).ip;
  if (typeof ip !== "string" || ip.length === 0) return "unknown-ip";
  return ipKeyGenerator(ip);
}

/**
 * 账号维度键：账号名统一小写；未提交账号时退回 IP，避免所有匿名请求共用一个桶。
 * **仅凭据错误使用**——验证码错误按裁定只走 IP 维度，不进这个桶。
 */
function accountKey(req: Request): string {
  const raw = (req as { body?: { username?: unknown } }).body?.username;
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return name ? `acct:${name}` : `anon:${ipKey(req)}`;
}

type KeyGen = (req: Request) => string;

// ─── 动态文案 ─────────────────────────────────────────────────

/** 把 resetTime 转成中文的「还要等多久」 */
function remainText(resetTime?: Date): string {
  if (!(resetTime instanceof Date)) return "";
  const seconds = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
  if (seconds <= 0) return "";
  return seconds >= 60 ? `请约 ${Math.ceil(seconds / 60)} 分钟后重试` : `请在 ${seconds} 秒后重试`;
}

/**
 * 生成带「失败次数 + 剩余时间」的中文文案。
 * 裁定③ 明确要求：超限不能只丢一句「请求过于频繁」，要说清第几次、还要等多久。
 */
function buildMessage(kind: "credential" | "captcha") {
  return (req: Request): Record<string, unknown> => {
    const info = (req as unknown as { rateLimit?: { used?: number; resetTime?: Date } }).rateLimit;
    // express-rate-limit 在拦截时给出的 used 是**含本次被拦请求**的计数，
    // 但本次请求根本没进业务层、不算一次「失败」，直接展示会多报 1 次
    // （阈值 20 却显示「已达 21 次」）。故减 1 还原真实失败次数。
    const used = Math.max(0, Number(info?.used ?? 0) - 1);
    const tail = remainText(info?.resetTime);
    const base = kind === "credential" ? LOGIN_FAIL_MESSAGE : CAPTCHA_FAIL_MESSAGE;
    const head =
      kind === "credential"
        ? `登录失败次数过多（已连续失败 ${used} 次），该账号与来源 IP 已临时锁定`
        : `图形验证码错误次数过多（已达 ${used} 次），请重新获取验证码`;
    return { ...base, msg: tail ? `${head}，${tail}` : head };
  };
}

// ─── 工厂 ─────────────────────────────────────────────────────

/** 限流器 + 其计数字典。显式持有 store 是为了能重置（单测隔离 / 运维手动解锁）。 */
interface LimiterEntry {
  middleware: ReturnType<typeof rateLimit>;
  store: MemoryStore;
}

function makeLimiter(opts: {
  keyGenerator: KeyGen;
  windowMs: number;
  max: number;
  /** 只统计该状态码；其余响应一律不计数（裁定③ 的分流核心） */
  countStatus: number;
  message: (req: Request) => unknown;
}): LimiterEntry {
  const store = new MemoryStore();
  const middleware = rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    keyGenerator: opts.keyGenerator,
    store,
    // 「成功」= 不是我们要计数的那个状态码 → 只有 countStatus 会被计入
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== opts.countStatus,
    message: opts.message,
    standardHeaders: true,
    legacyHeaders: false,
    // 与 platform-miniapp.routes.ts 一致：反代场景下禁用 X-Forwarded-For 校验
    validate: { trustProxy: false, xForwardedForHeader: false },
  });
  return { middleware, store };
}

/**
 * 凭据错误（401）限流：IP + 账号双维度，5 次 / 5 分钟，最长锁 15 分钟。
 * 暴露工厂形式是为了单测能用独立实例（计数互不污染），生产用下方模块级实例。
 */
export function createLoginFailLimiters(max: number = LOGIN_FAIL_MAX) {
  const message = buildMessage("credential");
  const build = (keyGenerator: KeyGen) => [
    makeLimiter({
      keyGenerator,
      windowMs: LOGIN_FAIL_WINDOW_MS,
      max,
      countStatus: CREDENTIAL_FAIL_STATUS,
      message,
    }),
    makeLimiter({
      keyGenerator,
      windowMs: LOGIN_FAIL_LOCK_MS,
      max,
      countStatus: CREDENTIAL_FAIL_STATUS,
      message,
    }),
  ];
  const byIp = build(ipKey);
  const byAccount = build(accountKey);
  const all = [...byIp, ...byAccount];
  return {
    byIp: byIp.map((e) => e.middleware),
    byAccount: byAccount.map((e) => e.middleware),
    /** 双维度串联：任一超限即拒绝 */
    all: all.map((e) => e.middleware),
    /**
     * 清空全部计数。
     * 用途：① 单测在用例间隔离计数（同一测试文件内多次失败登录会真实触发限流）；
     * ② 运维在误锁真实用户时手动解锁。**生产常规链路不应调用。**
     */
    reset(): void {
      for (const e of all) void e.store.resetAll();
    },
  };
}

/**
 * 验证码错误（400）限流：**仅 IP 维度**，20 次 / 5 分钟。
 * 超限只拒绝并要求重新获取验证码，**不锁账号**（裁定③）。
 */
export function createCaptchaFailLimiters(max: number = CAPTCHA_FAIL_MAX) {
  const entry = makeLimiter({
    keyGenerator: ipKey,
    windowMs: CAPTCHA_FAIL_WINDOW_MS,
    max,
    countStatus: CAPTCHA_FAIL_STATUS,
    message: buildMessage("captcha"),
  });
  const all = [entry];
  return {
    all: all.map((e) => e.middleware),
    /** 同 createLoginFailLimiters.reset()：单测隔离 / 运维手动解锁 */
    reset(): void {
      for (const e of all) void e.store.resetAll();
    },
  };
}

/** 平台登录路由使用的凭据限流器（IP + 账号双维度） */
export const loginFailLimiters = createLoginFailLimiters();

/** 平台登录路由使用的验证码限流器（仅 IP 维度，弱阈值） */
export const captchaFailLimiters = createCaptchaFailLimiters();
