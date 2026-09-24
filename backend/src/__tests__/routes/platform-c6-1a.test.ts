/**
 * R101-C6-1A 路由级测试（后端域 ② 类 11 条的接线与端点）
 *
 * 覆盖：
 *   GET  /api/platform/admins                    （#41 挂载既有实现）
 *   POST /api/platform/admins/invite             （#45 建号，裁定 R6 一次性口令）
 *   POST /api/platform/admins/:id/reset-password （#51 管理员代重置）
 *   PUT  /api/platform/admins/:id/status         （#53 挂载既有实现）
 *   POST /api/padmin/app-versions/draft          （#34 草稿）
 *   POST /api/padmin/app-versions/:id/{pause,resume,archive}（#36 放量/归档）
 *   POST /api/padmin/app-versions/:id/rollback   （#39 回滚）
 *   POST /api/platform/library/brands/:id/auth-letter （#27 授权书，178 迁移加列）
 *   POST /api/platform/config/logo               （#80 Logo 上传，只落盘不写 t_platform_config）
 *
 * 范式：真实 `requirePlatformAuth`（无令牌 ⇒ 401 反测）+ 真实路由 + 真实 controller/service，
 * 只把 DB 访问（shared/db）替换为内存桩 —— 断言因此是端点级真实行为，不是 mock 自证。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
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
import { platformRouter } from "../../routes/platform.routes";
import { appVersionAdminRouter } from "../../routes/platform-app-version.routes";
import { platformLibraryRouter } from "../../routes/platform-library.routes";
import { platformConfigRouter } from "../../routes/platform-config.routes";

/** 真实平台令牌（与 platform-auth 登录签发的 claims 同形） */
const TOKEN = jwt.sign(
  { type: "platform_admin", id: 1, username: "admin", realName: "凌舟" },
  env.JWT_SECRET,
  {
    algorithm: "HS256",
    issuer: PLATFORM_JWT_ISSUER,
    audience: PLATFORM_JWT_AUDIENCE,
    expiresIn: "1h"
  }
);

function buildApp(prefix: string, router: any) {
  const app = express();
  app.use(express.json());
  app.use(prefix, requirePlatformAuth, router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    // 与生产 errorHandler 同口径：zod 校验失败按 400（生产 error-handler.ts 先判 ZodError）
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

const platformApp = buildApp("/api/platform", platformRouter);
const padminApp = buildApp("/api/padmin", appVersionAdminRouter);
const libraryApp = buildApp("/api/platform/library", platformLibraryRouter);
const configApp = buildApp("/api/platform/config", platformConfigRouter);

const authed = (r: request.Test) => r.set("Authorization", `Bearer ${TOKEN}`);

beforeEach(() => {
  hoisted.query.mockReset();
  hoisted.queryOne.mockReset();
  hoisted.queryWithTenant.mockReset();
});

describe("C6-1A · 鉴权反测（真实 requirePlatformAuth）", () => {
  it("无令牌访问 /api/platform/admins 必须 401（端点不是裸奔的）", async () => {
    const res = await request(platformApp).get("/api/platform/admins");
    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("无令牌访问版本草稿端点必须 401", async () => {
    const res = await request(padminApp).post("/api/padmin/app-versions/draft").send({
      platform: "admin_web",
      versionCode: 9,
      versionName: "0.9.0"
    });
    expect(res.status).toBe(401);
  });
});

describe("C6-1A · #41/#53/#64 平台管理员端点挂载", () => {
  it("GET /api/platform/admins 返回既有服务层结果（未重写实现）", async () => {
    hoisted.query.mockResolvedValue([{ id: 1, username: "admin", realName: "平台超管", role: "SUPER_ADMIN" }]);
    hoisted.queryOne.mockResolvedValue({ total: 1 });

    const res = await authed(request(platformApp).get("/api/platform/admins?page=1&pageSize=20"));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.records).toHaveLength(1);
    expect(String(hoisted.query.mock.calls[0][0])).toContain("FROM t_platform_admin");
  });

  it("PUT /api/platform/admins/:id/status 走既有 updatePlatformAdminStatus（TINYINT 1/0）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 7 });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(platformApp).put("/api/platform/admins/7/status").send({ status: "DISABLED" })
    );

    expect(res.status).toBe(200);
    const updateCall = hoisted.query.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE t_platform_admin SET status")
    );
    expect(updateCall).toBeTruthy();
    expect((updateCall as any)[1][0]).toBe(0);
  });
});

describe("C6-1A · #45 建号（邀请）与 #51 重置密码", () => {
  it("POST /api/platform/admins/invite 返回一次性初始口令（服务端生成 12 位）", async () => {
    hoisted.queryOne.mockResolvedValue(null);
    hoisted.query.mockResolvedValue({ insertId: 21, affectedRows: 1 });

    const res = await authed(
      request(platformApp).post("/api/platform/admins/invite").send({
        username: "ops01",
        name: "运营一号",
        phone: "13800138000",
        role: "ADMIN"
      })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(21);
    expect(res.body.data.passwordShownOnce).toBe(true);
    expect(String(res.body.data.initialPassword)).toHaveLength(12);
  });

  it("POST /api/platform/admins/invite 缺姓名时 400（zod 校验，不落库）", async () => {
    const res = await authed(
      request(platformApp)
        .post("/api/platform/admins/invite")
        .send({ username: "ops02", phone: "13800138001", role: "ADMIN" })
    );
    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("POST /api/platform/admins/:id/reset-password 重置并一次性返回新口令", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 3, username: "ops03", realName: "运营三号" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(request(platformApp).post("/api/platform/admins/3/reset-password"));

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("ops03");
    expect(String(res.body.data.initialPassword)).toHaveLength(12);
    expect(
      hoisted.query.mock.calls.some((c) => String(c[0]).includes("UPDATE t_platform_admin"))
    ).toBe(true);
  });

  it("管理员 ID 非法时 400（不进入服务层）", async () => {
    const res = await authed(request(platformApp).post("/api/platform/admins/abc/reset-password"));
    expect(res.status).toBe(400);
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});

describe("C6-1A · #34/#36/#39 应用版本端点", () => {
  it("POST /api/padmin/app-versions/draft 存草稿（status=DRAFT / enabled=0）", async () => {
    hoisted.queryOne.mockResolvedValue(null);
    hoisted.query.mockResolvedValue({ insertId: 31, affectedRows: 1 });

    const res = await authed(
      request(padminApp).post("/api/padmin/app-versions/draft").send({
        platform: "app_mobile",
        versionCode: 9,
        versionName: "1.9.0",
        updateNote: "草稿"
      })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("DRAFT");
    const sql = String(hoisted.query.mock.calls[0][0]);
    expect(sql).toContain("INSERT INTO t_app_version");
    expect(sql).toContain("'DRAFT'");
  });

  it("POST /api/padmin/app-versions/draft 重复版本号走 UPDATE（不新增行）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 31 });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(padminApp).post("/api/padmin/app-versions/draft").send({
        platform: "app_mobile",
        versionCode: 9,
        versionName: "1.9.0"
      })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(31);
    expect(String(hoisted.query.mock.calls[0][0])).toContain("UPDATE t_app_version");
  });

  it("POST /api/padmin/app-versions/:id/pause → 200 PAUSED 并写审计", async () => {
    hoisted.queryOne.mockResolvedValue({
      id: 5,
      platform: "app_mobile",
      versionCode: 7,
      versionName: "1.7.0",
      status: "PUBLISHED"
    });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(request(padminApp).post("/api/padmin/app-versions/5/pause"));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PAUSED");
    expect(
      hoisted.query.mock.calls.some((c) => String(c[0]).includes("INSERT INTO t_platform_audit_log"))
    ).toBe(true);
  });

  it("POST /api/padmin/app-versions/:id/archive → 200 ARCHIVED（archived_at 落列）", async () => {
    hoisted.queryOne.mockResolvedValue({
      id: 6,
      platform: "admin_web",
      versionCode: 3,
      versionName: "0.3.0",
      status: "PUBLISHED"
    });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(request(padminApp).post("/api/padmin/app-versions/6/archive"));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ARCHIVED");
    expect(
      hoisted.query.mock.calls.some((c) => String(c[0]).includes("archived_at=NOW()"))
    ).toBe(true);
  });

  it("POST /api/padmin/app-versions/:id/rollback → 200（目标已发布且早于当前启用版本）", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce({
        id: 3,
        platform: "admin_web",
        versionCode: 2,
        versionName: "0.2.0",
        status: "PUBLISHED"
      })
      .mockResolvedValueOnce({ id: 6, versionCode: 3 });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(request(padminApp).post("/api/padmin/app-versions/3/rollback"));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ versionCode: 2, enabled: true, status: "PUBLISHED" });
  });

  it("回滚目标为草稿时 400（该红就红）", async () => {
    hoisted.queryOne.mockResolvedValueOnce({
      id: 4,
      platform: "admin_web",
      versionCode: 4,
      versionName: "0.4.0",
      status: "DRAFT"
    });

    const res = await authed(request(padminApp).post("/api/padmin/app-versions/4/rollback"));

    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("C6-1A · #27 品牌授权书上传", () => {
  it("合法 PDF：返回 /uploads/brand-auth-letter/ 下的 URL 并回写三列", async () => {
    hoisted.queryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes("auth_letter_url AS authLetterUrl")) {
        return {
          authLetterUrl: "http://saas.onepan.cn/uploads/brand-auth-letter/brand-3-x.pdf",
          authExpiredAt: "2027-01-01",
          authStatus: "AUTHORIZED"
        };
      }
      return { id: 3 };
    });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp)
        .post("/api/platform/library/brands/3/auth-letter")
        .field("authExpiredAt", "2027-01-01")
        .attach("file", Buffer.from("%PDF-1.4 test"), "letter.pdf")
    );

    expect(res.status).toBe(200);
    expect(res.body.data.path).toContain("/uploads/brand-auth-letter/");
    expect(res.body.data.authStatus).toBe("AUTHORIZED");
    const updateSql = String(
      (hoisted.query.mock.calls.find((c) => String(c[0]).includes("UPDATE t_library_brand")) ?? [])[0]
    );
    expect(updateSql).toContain("auth_letter_url = ?");
    expect(updateSql).toContain("auth_status = ?");
  });

  it("缺文件时 400（不许把「无文件」当成功）", async () => {
    const res = await authed(request(libraryApp).post("/api/platform/library/brands/3/auth-letter"));
    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("非法扩展名（exe）时 400 且不落盘不落库", async () => {
    const res = await authed(
      request(libraryApp)
        .post("/api/platform/library/brands/3/auth-letter")
        .attach("file", Buffer.from("MZ"), "evil.exe")
    );
    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("C6-1A · #80 平台 Logo 上传（只落盘，不写 t_platform_config）", () => {
  it("合法图片：200 且 persisted=false（明确未写配置表）", async () => {
    const res = await authed(
      request(configApp)
        .post("/api/platform/config/logo")
        .attach("file", Buffer.from("89504e470d0a1a0a", "hex"), "logo.png")
    );

    expect(res.status).toBe(200);
    expect(res.body.data.path).toContain("/uploads/platform-logo/");
    expect(res.body.data.persisted).toBe(false);
    // 红线④：不得新增对 t_platform_config 的写入
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("缺文件时 400", async () => {
    const res = await authed(request(configApp).post("/api/platform/config/logo"));
    expect(res.status).toBe(400);
  });
});
