/**
 * S3-208（R101 收口总清单第 57 项）：CodeQL `js/missing-rate-limiting` 报的
 * 「route handler performs authorization, but is not rate-limited」路由，接线后的
 * **运行期**证据（不是静态子串匹配）。
 *
 * 为什么需要运行期证据：CodeQL 该规则的判据是"注册点上出现了限流中间件"。静态读源码只能证明
 * "写了 `rateLimit(...)`"，证明不了"这个限流器真的挂在请求链上、真的会 429"。本文件用真实
 * router + 真实中间件链，按 `AUTHED_ROUTE_LIMIT.limit` 打满阈值再打第 N+1 次，断言：
 *   ① 前 N 次不是 429（无令牌 ⇒ 401/403，说明限流器在鉴权之前，且没把正常请求打死）；
 *   ② 首次响应带 `ratelimit-limit` 头（证明请求确实过了 express-rate-limit）；
 *   ③ 第 N+1 次是 429（限流真的生效）。
 * 反测（`docs/evidence/S3-208/README.md` §F1）：摘掉任一条路由上的 `rateLimit(...)` ⇒ 该条
 * 用例红（第 N+1 次拿到 401/403 而不是 429）。
 *
 * 覆盖范围：PR #297 check-run 115404340298 注解的 11 条 high（wechat 5 条路由 / marketing 4 条
 * 路由 / commerce-fix 1 条路由；同一行 2 条注解按 1 条路由计），加上同文件同族在 main 上另有
 * 5 条（marketing 3 条 + commerce-fix 1 条 + wechat 的 `/auth/login` 除外 —— 登录路由
 * 按业主口径**不限流**，见回执 §五）。共 11 条路由，全部逐条打满阈值验证。
 */
import express from "express";
import type { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AUTHED_ROUTE_LIMIT } from "../../config/rate-limit";
import { wechatRouter } from "../../routes/wechat.routes";
import { miniappMarketingRouter } from "../../routes/marketing-miniapp.routes";
import { adminCommerceFixRouter, storeCommerceFixRouter } from "../../routes/commerce-fix.routes";

const LIMIT = AUTHED_ROUTE_LIMIT.limit as number;

interface Case {
  /** 断言用例名（含 CodeQL 注解行，便于与台账对齐） */
  name: string;
  mount: string;
  router: Router;
  method: "get" | "post" | "put";
  path: string;
}

/** 11 条被 CodeQL 指名的路由（左列＝本文件在 main 2fe8f109 上的行号） */
const cases: Case[] = [
  // wechat.routes.ts（PR #297 注解 26/26/27/28/29/30 行）
  { name: "wechat.routes.ts:26 POST /auth/decrypt-phone", mount: "/api/miniapp/wechat", router: wechatRouter, method: "post", path: "/auth/decrypt-phone" },
  { name: "wechat.routes.ts:27 PUT /auth/profile", mount: "/api/miniapp/wechat", router: wechatRouter, method: "put", path: "/auth/profile" },
  { name: "wechat.routes.ts:28 GET /auth/profile", mount: "/api/miniapp/wechat", router: wechatRouter, method: "get", path: "/auth/profile" },
  { name: "wechat.routes.ts:29 POST /auth/bind", mount: "/api/miniapp/wechat", router: wechatRouter, method: "post", path: "/auth/bind" },
  { name: "wechat.routes.ts:30 POST /auth/unbind", mount: "/api/miniapp/wechat", router: wechatRouter, method: "post", path: "/auth/unbind" },
  // marketing-miniapp.routes.ts（PR #297 注解 55/67/72/80 行；+:62/74/90 为同文件同族存量）
  { name: "marketing-miniapp.routes.ts POST /coupons/:templateId/claim", mount: "/api/miniapp/marketing", router: miniappMarketingRouter, method: "post", path: "/coupons/1/claim" },
  { name: "marketing-miniapp.routes.ts GET /coupons/my", mount: "/api/miniapp/marketing", router: miniappMarketingRouter, method: "get", path: "/coupons/my" },
  { name: "marketing-miniapp.routes.ts GET /points/my", mount: "/api/miniapp/marketing", router: miniappMarketingRouter, method: "get", path: "/points/my" },
  { name: "marketing-miniapp.routes.ts GET /points/my-records", mount: "/api/miniapp/marketing", router: miniappMarketingRouter, method: "get", path: "/points/my-records" },
  { name: "marketing-miniapp.routes.ts POST /flash-sale/:id/buy", mount: "/api/miniapp/marketing", router: miniappMarketingRouter, method: "post", path: "/flash-sale/1/buy" },
  { name: "marketing-miniapp.routes.ts POST /group-buy/:teamId/join", mount: "/api/miniapp/marketing", router: miniappMarketingRouter, method: "post", path: "/group-buy/1/join" },
  { name: "marketing-miniapp.routes.ts POST /calculate", mount: "/api/miniapp/marketing", router: miniappMarketingRouter, method: "post", path: "/calculate" },
  // commerce-fix.routes.ts（PR #297 注解第 30 行＝当时的 POST /bills；+:20 为同文件同族存量）
  { name: "commerce-fix.routes.ts:30 GET /verify-records（门店端，auth 由 routeConfigs 前缀级前置）", mount: "/api/store/coupons", router: storeCommerceFixRouter, method: "get", path: "/verify-records" },
  { name: "commerce-fix.routes.ts POST /bills", mount: "/api/admin", router: adminCommerceFixRouter, method: "post", path: "/bills" },
  { name: "commerce-fix.routes.ts POST /bills/:id/verify", mount: "/api/admin", router: adminCommerceFixRouter, method: "post", path: "/bills/1/verify" },
];

function buildApp(c: Case): express.Express {
  const app = express();
  app.use(express.json());
  app.use(c.mount, c.router);
  return app;
}

/** 按 method 真实发一次请求（不用 `any` 绕类型） */
function fire(app: express.Express, c: Case) {
  const agent = request(app);
  const url = `${c.mount}${c.path}`;
  const pending = c.method === "get" ? agent.get(url) : c.method === "put" ? agent.put(url) : agent.post(url);
  return pending.set("content-type", "application/json").send({});
}

describe("S3-208 · 已鉴权路由的运行期限流（CodeQL js/missing-rate-limiting 接线证据）", () => {
  it("用例数 ≥ 11（防遍历/过滤条件写错导致空转 —— 同 S3-49 假门禁教训）", () => {
    expect(cases.length).toBeGreaterThanOrEqual(11);
    expect(Number.isInteger(LIMIT)).toBe(true);
    expect(LIMIT).toBeGreaterThan(0);
    expect(LIMIT).toBeLessThanOrEqual(100); // 阈值上限：保住"打满阈值"用例的耗时
  });

  it.each(cases)("$name：打满阈值后第 N+1 次 429", async (c) => {
    const app = buildApp(c);
    const responses = [];
    for (let i = 0; i < LIMIT + 1; i += 1) {
      responses.push(await fire(app, c));
    }

    const first = responses[0];
    // ① 阈值内没有 429（无令牌 ⇒ 鉴权/CSRF 拦成 401/403；限流器在鉴权之前所以也会计数）
    expect(responses.slice(0, LIMIT).filter((r) => r.status === 429)).toHaveLength(0);
    // ② 首次响应带 RateLimit 头 ⇒ 请求确实过了 express-rate-limit（而不是"没挂上也没人发现"）
    expect(first.headers["ratelimit-limit"]).toBe(String(LIMIT));
    // ③ 第 N+1 次被限流
    expect(responses[LIMIT].status).toBe(429);
    expect(responses[LIMIT].headers["ratelimit-limit"]).toBe(String(LIMIT));
    // ④ 每路由独立桶：本条打满不影响别的路由（独立 store）——由 it.each 各条互不干扰间接证明
  });
});
