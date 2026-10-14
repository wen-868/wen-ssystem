/**
 * S3-196 · 消费者身份适配层（收口总清单第 52 项）
 *
 * 防的是什么：消费者端（/api/miniapp/**）此前一律要**商家端 JWT**，而老 miniapp 手上只有
 * 微信登录令牌 ⇒ 消费者端恒 401（"看起来能用、实际打不通"）。本单新增
 * `requireConsumerAuthWithTenant`：接受微信令牌并按 `openid + 租户` 解析**绑定的会员身份**。
 *
 * 判据（与派单卡 §二/§三/§五 同口径）：
 *  ① 微信令牌 + 租户 + CSRF ⇒ 通过，且注入的身份是**会员 id**、roles 恒空；
 *  ② 租户来源（令牌 → X-Tenant-Id）**都缺** ⇒ 401，且业务链一次都没被调用（不落库）；
 *  ③ 解析不到绑定会员 ⇒ 401，且业务链一次都没被调用（不伪造身份）；
 *  ④ 无 CSRF 头/令牌不对 ⇒ 403（CSRF 门禁对消费者身份同样生效）；
 *  ⑤ 商家端 JWT 仍原样透传（roles 保留）—— 既有调用方零回归。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { signToken } from "../../middleware/auth";
import { csrfMiddleware, generateCsrfToken } from "../../middleware/csrf";
import { requireConsumerAuthWithTenant } from "../../middleware/consumer-auth";
import { env } from "../../shared/env";

const db = vi.hoisted(() => ({ queryOne: vi.fn(), query: vi.fn() }));
vi.mock("../../shared/db", () => ({
  queryOne: db.queryOne,
  query: db.query,
}));

const WX_USER_ID = 9001;
const MEMBER_ID = 4242;
const TENANT = "t-s196";
const OPENID = "openid-s196";

/** 微信令牌（与 middleware/wechat-auth.ts 的 signWxToken 同形：payload 只有 wxUserId/openid[/tenantId]） */
function wxToken(extra: Record<string, unknown> = {}) {
  return jwt.sign({ wxUserId: WX_USER_ID, openid: OPENID, ...extra }, env.JWT_SECRET, { expiresIn: "7d" });
}

const wxHeaders = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${wxToken()}`,
  "X-Tenant-Id": TENANT,
  ...extra,
});

/** 直接观察中间件注入的 req.user / csrfSubjectIds */
function echoApp() {
  const app = express();
  app.use(express.json());
  app.get("/probe", requireConsumerAuthWithTenant, (req, res) => {
    res.json({
      user: req.user,
      tenantId: req.tenantId,
      csrfSubjectIds: req.csrfSubjectIds,
      consumerWxUserId: req.consumerWxUserId,
    });
  });
  // CSRF 只对写方法校验，故另加一条带 csrfMiddleware 的 POST 探针（与生产挂法同序：认证在前）
  app.post("/probe", ...requireConsumerAuthWithTenant, csrfMiddleware, (req, res) => {
    res.json({ user: req.user, csrfSubjectIds: req.csrfSubjectIds });
  });
  return app;
}

const boundMember = { id: MEMBER_ID, name: "张三", tenant_id: TENANT };

beforeEach(() => {
  vi.clearAllMocks();
  db.queryOne.mockResolvedValue(boundMember);
  db.query.mockResolvedValue([boundMember]);
});

describe("S3-196 · requireConsumerAuth 身份解析", () => {
  it("微信令牌 + X-Tenant-Id ⇒ 注入会员身份（id=会员 id、roles 空、租户来自请求头）", async () => {
    const res = await request(echoApp()).get("/probe").set(wxHeaders());
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(MEMBER_ID);
    expect(res.body.user.roles).toEqual([]);
    expect(res.body.user.tenantId).toBe(TENANT);
    expect(res.body.tenantId).toBe(TENANT);
    expect(res.body.consumerWxUserId).toBe(WX_USER_ID);
    // 同一登录态的两个等价 CSRF 主体：业务身份（会员 id）+ 会话身份（微信用户 id）
    expect(res.body.csrfSubjectIds).toEqual([MEMBER_ID, WX_USER_ID]);
    // 只按 openid + 租户查会员，不做任何跨租户/兜底查询
    expect(db.queryOne).toHaveBeenCalledTimes(1);
    expect(db.queryOne.mock.calls[0][1]).toEqual([OPENID, TENANT]);
  });

  it("租户写在令牌里（无请求头）⇒ 走「令牌 → 请求头」的第一来源", async () => {
    const res = await request(echoApp())
      .get("/probe")
      .set({ Authorization: `Bearer ${wxToken({ tenantId: TENANT })}` });
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe(TENANT);
  });

  it("两个租户来源都缺 + 该微信唯一绑定一个租户会员 ⇒ 用绑定行的租户（老端没有租户来源的兜底口径）", async () => {
    const res = await request(echoApp()).get("/probe").set({ Authorization: `Bearer ${wxToken()}` });
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe(TENANT);
    expect(res.body.user.id).toBe(MEMBER_ID);
  });

  it("两个租户来源都缺 + 跨租户多命中 ⇒ 401（歧义显式失败，不取第一条）", async () => {
    db.query.mockResolvedValue([
      { id: MEMBER_ID, name: "张三", tenant_id: "t-a" },
      { id: MEMBER_ID + 1, name: "李四", tenant_id: "t-b" },
    ]);
    const res = await request(echoApp()).get("/probe").set({ Authorization: `Bearer ${wxToken()}` });
    expect(res.status).toBe(401);
    expect(res.body.msg).toContain("缺少租户信息");
  });

  it("两个租户来源都缺 + 未绑定 ⇒ 401（不伪造租户、不落库）", async () => {
    db.query.mockResolvedValue([]);
    const res = await request(echoApp()).get("/probe").set({ Authorization: `Bearer ${wxToken()}` });
    expect(res.status).toBe(401);
    expect(res.body.msg).toContain("缺少租户信息");
  });

  it("解析不到绑定会员 ⇒ 401 且不生成任何身份（不伪造）", async () => {
    db.queryOne.mockResolvedValue(null);
    const res = await request(echoApp()).get("/probe").set(wxHeaders());
    expect(res.status).toBe(401);
    expect(res.body.msg).toContain("消费者身份未建立");
  });

  it("无凭证 ⇒ 401", async () => {
    const res = await request(echoApp()).get("/probe");
    expect(res.status).toBe(401);
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it("商家端 JWT ⇒ 原样透传（roles 保留、不查会员表）", async () => {
    const merchant = { id: 7, username: "boss", roles: ["SUPER_ADMIN"], storeId: null, tenantId: "t-m" };
    const res = await request(echoApp())
      .get("/probe")
      .set({ Authorization: `Bearer ${signToken(merchant as never)}` });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 7, roles: ["SUPER_ADMIN"], tenantId: "t-m" });
    expect(res.body.csrfSubjectIds).toBeUndefined();
    expect(db.queryOne).not.toHaveBeenCalled();
  });
});

describe("S3-196 · CSRF 主体（登录下发的令牌对消费者端点同样有效）", () => {
  it("x-csrf-token = HMAC(微信用户 id) ⇒ 放行（登录响应下发的就是它）", async () => {
    const res = await request(echoApp())
      .post("/probe")
      .set(wxHeaders({ "x-csrf-token": generateCsrfToken(WX_USER_ID) }));
    expect(res.status).toBe(200);
  });

  it("x-csrf-token = HMAC(会员 id) ⇒ 放行（业务身份主体）", async () => {
    const res = await request(echoApp())
      .post("/probe")
      .set(wxHeaders({ "x-csrf-token": generateCsrfToken(MEMBER_ID) }));
    expect(res.status).toBe(200);
  });

  it("x-csrf-token 不是本登录态任一主体 ⇒ 403", async () => {
    const res = await request(echoApp())
      .post("/probe")
      .set(wxHeaders({ "x-csrf-token": generateCsrfToken(123456) }));
    expect(res.status).toBe(403);
  });

  it("写方法缺 x-csrf-token ⇒ 403", async () => {
    const res = await request(echoApp()).post("/probe").set(wxHeaders());
    expect(res.status).toBe(403);
  });
});
