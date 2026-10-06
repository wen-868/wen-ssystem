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
 *
 * S3-58-F1 R2（2026-10-06）——**限流维度改造**（背景：业主已定「总台必须可从公网登录」）：
 *  原缺陷：账号维度键是纯 `acct:<username>`，攻击者只要制造 5 次失败，
 *  就能把**合法账号**锁死 15 分钟（换任何来源 IP 都登不上）——这是一条 DoS 式稳定性问题。
 *  改造后（凭据错误 401 通道）：
 *   - **主键 = 账号 + 归一化 IP**（`acct:<name>|ip:<ipKey>`）：单一来源失败只锁「该来源 + 该账号」，
 *     合法用户换一个来源仍能登录。阈值语义不变（5 次 / 5 分钟 → 最长锁 15 分钟）。
 *   - **保留账号维度高阈值兜底**（键仍是 `acct:<name>`，60 次 / 1 小时）：拦「分布式多 IP 打同一账号」。
 *     单一来源受 5min/15min 快锁限制，最多只能贡献 5 次 / 15 分钟，故 60 次 / 1 小时
 *     **至少需要 3 个不同来源**才可能触发 —— 单一来源依旧锁不死合法账号。
 *   - IP 维度（纯 IP，5 次 / 5 分钟 + 5 次 / 15 分钟）**保持不变**，继续拦「同来源轮换账号名」。
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

/**
 * 账号维度兜底阈值（S3-58-F1 R2 新增）：60 次 / 1 小时。
 *
 * 取值理由（不是拍脑袋，是按上层快锁的「贡献上限」倒推的）：
 *  - 账号维度的**主键**已改为 (账号 + 归一化 IP)，单一来源每 5 分钟最多
 *    贡献 5 次失败，且 15 分钟窗口同样 `max=5`（触发后本窗口内不再累计），
 *    于是**单一来源最多只能向兜底桶贡献 5 次 / 15 分钟 ≈ 20 次 / 小时**；
 *  - 兜底阈值取 60 次 / 1 小时 ⇒ **至少要 3 个不同来源**才可能触发，
 *    「攻击者用单一来源锁死合法账号」在数学上被排除；
 *  - 同时 60 次 / 小时对「分布式多 IP 爆破同一账号」仍是一道有效闸门（不会无上限）。
 */
export const ACCOUNT_BACKSTOP_MAX = 60;
/** 账号维度兜底窗口：1 小时 */
export const ACCOUNT_BACKSTOP_WINDOW_MS = 60 * 60_000;

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

/** 账号维度兜底的兜底文案（同上，动态生成） */
export const ACCOUNT_BACKSTOP_MESSAGE = {
  code: "429",
  msg: "该账号登录失败次数过多，已临时锁定，请稍后重试",
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
 * **仅用于「账号维度兜底」高阈值通道**（S3-58-F1 R2）——验证码错误按裁定只走 IP 维度，不进这个桶。
 */
function accountKey(req: Request): string {
  const raw = (req as { body?: { username?: unknown } }).body?.username;
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return name ? `acct:${name}` : `anon:${ipKey(req)}`;
}

/**
 * **账号 + 来源 IP 复合键**（S3-58-F1 R2 的凭据通道主键）：`acct:<name>|ip:<ipKey>`。
 *
 * 目的：把「快锁」的作用域从『账号』收窄到『账号 + 来源』——
 * 攻击者从单一来源连续失败，只会锁住「自己这个来源 + 该账号」，
 * **不会**把合法用户从其它来源一并锁死（这正是原实现的根因）。
 * 未提交账号时退回 IP 桶（与 accountKey 同口径）。
 */
function accountIpKey(req: Request): string {
  const raw = (req as { body?: { username?: unknown } }).body?.username;
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return name ? `acct:${name}|ip:${ipKey(req)}` : `anon:${ipKey(req)}`;
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
function buildMessage(kind: "credential" | "captcha" | "account") {
  return (req: Request): Record<string, unknown> => {
    const info = (req as unknown as { rateLimit?: { used?: number; resetTime?: Date } }).rateLimit;
    // express-rate-limit 在拦截时给出的 used 是**含本次被拦请求**的计数，
    // 但本次请求根本没进业务层、不算一次「失败」，直接展示会多报 1 次
    // （阈值 20 却显示「已达 21 次」）。故减 1 还原真实失败次数。
    const used = Math.max(0, Number(info?.used ?? 0) - 1);
    const tail = remainText(info?.resetTime);
    const base =
      kind === "credential"
        ? LOGIN_FAIL_MESSAGE
        : kind === "captcha"
          ? CAPTCHA_FAIL_MESSAGE
          : ACCOUNT_BACKSTOP_MESSAGE;
    const head =
      kind === "credential"
        ? `登录失败次数过多（已连续失败 ${used} 次），该账号与来源 IP 已临时锁定`
        : kind === "captcha"
          ? `图形验证码错误次数过多（已达 ${used} 次），请重新获取验证码`
          : `登录失败次数过多（该账号 1 小时内已累计失败 ${used} 次，来源分散），账号已临时锁定`;
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
  /** 快锁：短窗口（5min）+ 长窗口（15min），两把都 `max` 次 → 任一超限即拒绝 */
  const buildFast = (keyGenerator: KeyGen) => [
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
  // IP 维度：维持原样（拦「同来源轮换账号名」）
  const byIp = buildFast(ipKey);
  // 账号维度主键：账号 + 归一化 IP（S3-58-F1 R2）——单一来源锁不死合法账号
  const byAccount = buildFast(accountIpKey);
  // 账号维度兜底：纯账号键 + 显著抬高阈值（拦「分布式多 IP 打同一账号」）
  const backstop = makeLimiter({
    keyGenerator: accountKey,
    windowMs: ACCOUNT_BACKSTOP_WINDOW_MS,
    max: ACCOUNT_BACKSTOP_MAX,
    countStatus: CREDENTIAL_FAIL_STATUS,
    message: buildMessage("account"),
  });
  // 兜底放最后：只有通过前面快锁的请求才会计入兜底桶，
  // 被锁来源不会继续把兜底桶填满（否则单一来源也能靠时间堆到 60 次）。
  const all = [...byIp, ...byAccount, backstop];
  return {
    byIp: byIp.map((e) => e.middleware),
    byAccount: byAccount.map((e) => e.middleware),
    /** 账号维度兜底（高阈值，1 小时窗口） */
    byAccountBackstop: backstop.middleware,
    /** 三组串联：任一超限即拒绝 */
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
