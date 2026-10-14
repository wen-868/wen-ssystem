/**
 * S3-203 门禁·**双向越权必须被拒**（处置卡 §6.4.3 硬红线）
 *
 * ── 防的是什么 ────────────────────────────────────────────────────────
 *   业主原话：「**需要全部一致，租户帐号不能进入总台**」。
 *   本项目同时存在两套身份域：
 *     · 租户域：`t_sys_user` + `t_sys_role`，JWT issuer=`zhixiang-system`；
 *     · 平台域：`t_platform_admin`，JWT issuer=`zhixiang-platform`（`type=platform_admin`）。
 *   「统一账号口令」只统一**账号/口令/演示入口/文案**，**不**统一权限体系
 *   （见处置卡 §6.2：这是必须向业主讲清的一点）。
 *
 * ── 判据（任一侧放行即判红）────────────────────────────────────────────
 *   ① 租户 JWT（含**伪造 type=platform_admin 的租户 JWT**）打总台端点 ⇒ 401/403；
 *   ② 平台 JWT 打工作台端点 ⇒ 401；
 *   ③ 平台 JWT 的 type 不是 platform_admin（如 `user`）打总台端点 ⇒ 403；
 *   ④ 对照（证明装置本身不是恒红）：各自合法令牌打各自端点 ⇒ 200。
 *
 * 反测锚点：把任一 `issuer`/`audience` 校验去掉、或把 ① 的 `type` 判定放宽，
 * 本文件对应断言会直接翻红（见回执 §反测）。
 */
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  requireAuth,
  requirePlatformAuth,
  signToken,
  signPlatformToken,
  MERCHANT_JWT_ISSUER,
  MERCHANT_JWT_AUDIENCE,
  PLATFORM_JWT_ISSUER,
  PLATFORM_JWT_AUDIENCE,
} from "../../middleware/auth";
import { env } from "../../shared/env";

/** 最小装置：一个租户域端点 + 一个平台域端点，分别挂各自唯一的认证中间件 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.get("/api/admin/workspace-only", requireAuth, (_req, res) => {
    res.json({ code: "0", msg: "workspace-ok" });
  });
  app.get("/api/platform/platform-only", requirePlatformAuth, (_req, res) => {
    res.json({ code: "0", msg: "platform-ok" });
  });
  return app;
}

const TENANT_USER = {
  id: 1,
  username: "admin",
  realName: "超级管理员",
  roles: ["SUPER_ADMIN"],
  storeId: null,
  tenantId: "default",
};

describe("S3-203 双向越权门禁：租户域 ⇄ 平台域互不通行", () => {
  let app: express.Express;
  let tenantToken: string;
  let platformToken: string;

  beforeAll(() => {
    app = makeApp();
    tenantToken = signToken(TENANT_USER);
    platformToken = signPlatformToken({ type: "platform_admin", id: 1, username: "admin" });
  });

  it("① 租户 JWT 打总台端点 ⇒ 401（issuer/audience 不同，平台侧一律不认）", async () => {
    const res = await request(app)
      .get("/api/platform/platform-only")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
  });

  it("① 伪造 type=platform_admin 的**租户签发** JWT 打总台端点 ⇒ 仍 401（不许只看 type）", async () => {
    const forged = jwt.sign(
      { ...TENANT_USER, type: "platform_admin" },
      env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: MERCHANT_JWT_ISSUER,
        audience: MERCHANT_JWT_AUDIENCE,
      }
    );
    const res = await request(app)
      .get("/api/platform/platform-only")
      .set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("② 平台 JWT 打工作台端点 ⇒ 401（租户侧不认平台签发）", async () => {
    const res = await request(app)
      .get("/api/admin/workspace-only")
      .set("Authorization", `Bearer ${platformToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
  });

  it("③ 平台签发但 type≠platform_admin 的 JWT 打总台端点 ⇒ 403（认证通过、授权不过）", async () => {
    const wrongType = jwt.sign({ id: 1, type: "user" }, env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h",
      issuer: PLATFORM_JWT_ISSUER,
      audience: PLATFORM_JWT_AUDIENCE,
    });
    const res = await request(app)
      .get("/api/platform/platform-only")
      .set("Authorization", `Bearer ${wrongType}`);
    expect(res.status).toBe(403);
  });

  it("④ 对照：各自合法令牌打各自端点 ⇒ 200（证明装置不是恒红）", async () => {
    const okWorkspace = await request(app)
      .get("/api/admin/workspace-only")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(okWorkspace.status).toBe(200);
    expect(okWorkspace.body.msg).toBe("workspace-ok");

    const okPlatform = await request(app)
      .get("/api/platform/platform-only")
      .set("Authorization", `Bearer ${platformToken}`);
    expect(okPlatform.status).toBe(200);
    expect(okPlatform.body.msg).toBe("platform-ok");
  });

  it("⑤ 无令牌两侧均 401（不受 JWT_SECRET 缺省值影响）", async () => {
    expect((await request(app).get("/api/admin/workspace-only")).status).toBe(401);
    expect((await request(app).get("/api/platform/platform-only")).status).toBe(401);
  });
});
