/**
 * S3-193 · 试点域（短信/邮件配置 = sysconfig 域）端点级反测
 *
 * 范式与 R101-C6-1A 路由测试一致：**真实** `requirePlatformAuth` + 真实 router/controller/service，
 * 只把 `shared/db` 换成内存桩 ⇒ 断言的是端点真实行为，不是 mock 自证。
 *
 * 两侧齐（派单卡 §二.7）：
 *   · 缺权限码 ⇒ 403（原始响应 code="403"，且写 t_platform_audit_log 留痕）；
 *   · 有权限码 / 超管 ⇒ 200（到达 handler，非 401/403）；
 *   · 无令牌 ⇒ 401（既有鉴权未被放宽）；
 *   · 有令牌无 CSRF ⇒ 403 CSRF（证明权限判定挂在校验之后，不抢先报权限错）。
 * 摘中间件变红：见 `docs/evidence/S3-193/` 的 06-反测日志（同一用例在摘除
 * `requirePlatformPermission` 后由 403 变 200）。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn()
}));

vi.mock("../../shared/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    query: hoisted.query,
    queryOne: hoisted.queryOne,
    queryWithTenant: hoisted.queryWithTenant
  };
});

import { env } from "../../config/env";
import {
  PLATFORM_JWT_AUDIENCE,
  PLATFORM_JWT_ISSUER,
  requirePlatformAuth
} from "../../middleware/auth";
import { csrfMiddleware, generateCsrfToken } from "../../middleware/csrf";
import { platformMsgConfigRouter } from "../../routes/platform-msg-config.routes";

const ADMIN_ID = 42;

/** 真实平台令牌（与 platform-auth 登录签发 claims 同形） */
function platformToken(adminId = ADMIN_ID) {
  return jwt.sign(
    { type: "platform_admin", id: adminId, username: "ops_admin", realName: "运营管理员" },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: PLATFORM_JWT_ISSUER,
      audience: PLATFORM_JWT_AUDIENCE,
      expiresIn: "1h"
    }
  );
}

const CSRF = generateCsrfToken(ADMIN_ID);

/** 与 auto-routes 的 `requirePlatformAuth` 分支一致：认证 + CSRF，再进 router */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
  app.use("/api/platform", requirePlatformAuth, csrfMiddleware, platformMsgConfigRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err instanceof ZodError) {
      res.status(400).json({ code: "400", msg: err.errors[0]?.message || "参数校验失败" });
      return;
    }
    res.status(err?.statusCode || 500).json({
      code: String(err?.statusCode || 500),
      msg: err?.message || "服务器内部错误"
    });
  });
  return app;
}

const app = buildApp();

/** 按 SQL 内容分派：管理员角色 / 平台角色行 / 权限矩阵行；INSERT 审计日志记进 auditLogs */
function mockDb(rows: {
  adminRole?: string | null;
  roleRow?: { id: number; code: string } | null;
  matrix?: { canMenu: number; canPageBtn: number } | null;
}) {
  hoisted.queryOne.mockImplementation((sql: string) => {
    if (sql.includes("FROM t_platform_admin")) {
      return Promise.resolve(rows.adminRole === undefined ? null : { role: rows.adminRole });
    }
    if (sql.includes("FROM t_platform_role WHERE code")) {
      return Promise.resolve(rows.roleRow ?? null);
    }
    if (sql.includes("FROM t_platform_role_permission")) {
      return Promise.resolve(rows.matrix ?? null);
    }
    return Promise.resolve(null);
  });
  hoisted.query.mockImplementation((sql: string) => {
    if (sql.includes("INSERT INTO t_platform_audit_log")) {
      auditLogs.push(sql.replace(/\s+/g, " ").trim());
      return Promise.resolve({ insertId: auditLogs.length });
    }
    return Promise.resolve([]);
  });
}

let auditLogs: string[] = [];

describe("S3-193 · 试点域 sysconfig 写端点权限中间件（两侧齐 + 反测）", () => {
  beforeEach(() => {
    hoisted.query.mockReset();
    hoisted.queryOne.mockReset();
    auditLogs = [];
  });

  it("① 无令牌 ⇒ 401（既有鉴权未被放宽）", async () => {
    mockDb({ adminRole: "PLATFORM_SUPER_ADMIN" });
    const res = await request(app).put("/api/platform/msg-config").send([]);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
  });

  it("② 超管令牌 + CSRF ⇒ 200（到达 handler）", async () => {
    mockDb({ adminRole: "PLATFORM_SUPER_ADMIN" });
    const res = await request(app)
      .put("/api/platform/msg-config")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send([]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code: "0", data: { updated: 0 } });
    expect(auditLogs).toHaveLength(0);
  });

  it("③ 缺权限码（已绑定角色但 can_page_btn=0）⇒ 403 + 审计留痕", async () => {
    mockDb({
      adminRole: "PLATFORM_ADMIN",
      roleRow: { id: 7, code: "platform_admin" },
      matrix: { canMenu: 1, canPageBtn: 0 }
    });
    const res = await request(app)
      .put("/api/platform/msg-config")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send([]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toContain("sysconfig:manage");
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toContain("INSERT INTO t_platform_audit_log");
  });

  it("④ 有权限码（can_page_btn=1）⇒ 200（两侧齐的「通过」侧）", async () => {
    mockDb({
      adminRole: "PLATFORM_ADMIN",
      roleRow: { id: 7, code: "platform_admin" },
      matrix: { canMenu: 1, canPageBtn: 1 }
    });
    const res = await request(app)
      .put("/api/platform/msg-config")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send([]);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 0 });
  });

  it("⑤ 未绑定角色（role 为空）⇒ 403（过渡期收紧口径）", async () => {
    mockDb({ adminRole: null });
    const res = await request(app)
      .put("/api/platform/msg-config")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send([]);
    expect(res.status).toBe(403);
    expect(res.body.msg).toContain("未分配平台角色");
  });

  it("⑥ 角色行存在但矩阵未配该域 ⇒ 403（可区分原因）", async () => {
    mockDb({ adminRole: "SUPPORT", roleRow: { id: 3, code: "support" }, matrix: null });
    const res = await request(app)
      .put("/api/platform/msg-config")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send([]);
    expect(res.status).toBe(403);
    expect(res.body.msg).toContain("未配置「sysconfig」域权限");
  });

  it("⑦ DB 异常 ⇒ 403（fail-closed），不回 500/200", async () => {
    hoisted.queryOne.mockRejectedValue(new Error("ER_NO_SUCH_TABLE"));
    const res = await request(app)
      .put("/api/platform/msg-config")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send([]);
    expect(res.status).toBe(403);
  });

  it("⑧ 有令牌但缺 CSRF ⇒ 403 CSRF（权限判定不先于既有校验）", async () => {
    mockDb({
      adminRole: "PLATFORM_ADMIN",
      roleRow: { id: 7, code: "platform_admin" },
      matrix: { canMenu: 1, canPageBtn: 1 }
    });
    const res = await request(app)
      .put("/api/platform/msg-config")
      .set("Authorization", `Bearer ${platformToken()}`)
      .send([]);
    expect(res.status).toBe(403);
    expect(res.body.msg).toContain("CSRF");
  });

  it("⑨ 试点域其余 3 个写端点同样受控（DELETE 无权限 ⇒ 403）", async () => {
    mockDb({
      adminRole: "PLATFORM_ADMIN",
      roleRow: { id: 7, code: "platform_admin" },
      matrix: { canMenu: 1, canPageBtn: 0 }
    });
    const del = await request(app)
      .delete("/api/platform/sms-templates/5")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF);
    expect(del.status).toBe(403);
    expect(del.body.code).toBe("403");

    const post = await request(app)
      .post("/api/platform/sms-templates")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send({});
    expect(post.status).toBe(403);

    const put = await request(app)
      .put("/api/platform/sms-templates/5")
      .set("Authorization", `Bearer ${platformToken()}`)
      .set("x-csrf-token", CSRF)
      .send({});
    expect(put.status).toBe(403);
  });
});
