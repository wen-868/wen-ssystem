/**
 * 平台登录失败限流（R101-S2-01 批 2.1 · 凌舟 2026-09-14 授权）
 *
 * 背景：平台登录接口 `/api/platform/auth/login` 原先**完全没有限流**
 * （`server.ts:172` 注释「应用户要求不限流」）。而图形验证码的字符以 SVG `<text>`
 * 明文下发，一旦被脚本解析，限流就是**唯一的爆破门闩**——裁定据此授权本批。
 *
 * 口径（裁定原文）：**IP + 账号双维度**；阈值 **5 次 / 5 分钟**；超限锁定 15 分钟；
 * 命中返回**中文**；复用现有 rate limiter 基础设施，**不建表**。
 *
 * 实现说明：
 *  - 每个维度串两个固定窗口（5 分钟 max=5 + 15 分钟 max=5）：
 *    短窗口保证「5 分钟内 5 次必触发」，长窗口保证「触发后最坏锁到 15 分钟窗口结束」。
 *    这是 express-rate-limit 固定窗口语义下的近似，并非精确「命中时刻起算 15 分钟」，
 *    实际封锁时长 = 到两个窗口各自结束的较晚者（≤ 15 分钟）。如实标注，不宣称精确。
 *  - `skipSuccessfulRequests: true`：只统计失败（HTTP 4xx/5xx），登录成功不计数，
 *    正常用户不受影响。验证码校验失败同样返回 400，也计入尝试次数（同属登录尝试）。
 *  - 存储用默认 MemoryStore（与 `routes/platform-miniapp.routes.ts:10` 的限流范式一致），
 *    零新增卡外改动；**局限**：单进程内存计数，多实例部署下不共享（已报备，见回传）。
 */

import rateLimit, { ipKeyGenerator, MemoryStore } from "express-rate-limit";
import type { Request } from "express";

/** 阈值：5 次登录失败 */
export const LOGIN_FAIL_MAX = 5;
/** 判定窗口：5 分钟 */
export const LOGIN_FAIL_WINDOW_MS = 5 * 60_000;
/** 锁定窗口：15 分钟 */
export const LOGIN_FAIL_LOCK_MS = 15 * 60_000;

/** 命中限流时的中文响应体（统一信封，字段为 msg 而非 message） */
export const LOGIN_FAIL_MESSAGE = {
  code: "429",
  msg: "登录失败次数过多，已临时锁定，请稍后重试",
  traceId: "",
};

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

/** 账号维度键：账号名统一小写；未提交账号时退回 IP，避免所有匿名请求共用一个桶 */
function accountKey(req: Request): string {
  const raw = (req as { body?: { username?: unknown } }).body?.username;
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return name ? `acct:${name}` : `anon:${ipKey(req)}`;
}

type KeyGen = (req: Request) => string;

/** 限流器 + 其计数字典。显式持有 store 是为了能按 key 重置（单测隔离 / 运维手动解锁）。 */
interface LimiterEntry {
  middleware: ReturnType<typeof rateLimit>;
  store: MemoryStore;
}

function makeLimiter(keyGenerator: KeyGen, windowMs: number, max: number): LimiterEntry {
  const store = new MemoryStore();
  const middleware = rateLimit({
    windowMs,
    max,
    keyGenerator,
    store,
    // 只统计失败请求：登录成功（2xx）不计数
    skipSuccessfulRequests: true,
    message: LOGIN_FAIL_MESSAGE,
    standardHeaders: true,
    legacyHeaders: false,
    // 与 platform-miniapp.routes.ts 一致：Nginx 反代下禁用 X-Forwarded-For 校验
    validate: { trustProxy: false, xForwardedForHeader: false },
  });
  return { middleware, store };
}

/**
 * 创建登录失败限流器。
 * 暴露工厂形式是为了单测可以用独立实例（计数互不污染），生产用下方模块级实例。
 */
export function createLoginFailLimiters(max: number = LOGIN_FAIL_MAX) {
  const byIp = [
    makeLimiter(ipKey, LOGIN_FAIL_WINDOW_MS, max),
    makeLimiter(ipKey, LOGIN_FAIL_LOCK_MS, max),
  ];
  const byAccount = [
    makeLimiter(accountKey, LOGIN_FAIL_WINDOW_MS, max),
    makeLimiter(accountKey, LOGIN_FAIL_LOCK_MS, max),
  ];
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

/** 平台登录路由使用的限流器（IP + 账号双维度） */
export const loginFailLimiters = createLoginFailLimiters();
