/**
 * S3-110 路由级测试
 *
 * 覆盖：
 *   GET /api/platform/library/categories   ① 类目只读聚合（+ 无令牌 401 反测）
 *   PUT /api/platform/library/spus/:id/status  ② 状态机放开 APPROVED ↔ OFFLINE
 *      正向：APPROVED→OFFLINE、OFFLINE→APPROVED（各 200）；PENDING→APPROVED（审核不变）
 *      反测：PENDING→OFFLINE 仍 400（证明确实只放开了目标转移，不是"状态机全放开"）
 *      边界：APPROVED→REJECTED 仍 400、非法状态值仍 400（不进入服务层）
 *
 * 范式与 C6-1A 路由测试一致：真实 `requirePlatformAuth`（无令牌 ⇒ 401）+ 真实路由 + 真实
 * controller/service，只把 DB 访问（shared/db）替换为内存桩 —— 断言是端点级真实行为，不是 mock 自证。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import jwt from "jsonwebtoken";

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
    // S3-121：reviewSpu 的 UPDATE + 流水 INSERT 已收进同一事务；
    // 事务内的 execute/query 一律指向同一个 hoisted.query，既有断言原样成立。
    transaction: async (fn: any) =>
      fn({ query: hoisted.query, execute: hoisted.query, queryOne: hoisted.queryOne }),
    queryWithTenant: hoisted.queryWithTenant
  };
});

import { env } from "../../config/env";
import {
  PLATFORM_JWT_AUDIENCE,
  PLATFORM_JWT_ISSUER,
  requirePlatformAuth
} from "../../middleware/auth";
import { platformLibraryRouter } from "../../routes/platform-library.routes";

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
  // S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
  app.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
  app.use(prefix, requirePlatformAuth, router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({
      code: String(err?.statusCode || 500),
      msg: err?.message || "服务器内部错误"
    });
  });
  return app;
}

const libraryApp = buildApp("/api/platform/library", platformLibraryRouter);

const authed = (r: request.Test) => r.set("Authorization", `Bearer ${TOKEN}`);

beforeEach(() => {
  hoisted.query.mockReset();
  hoisted.queryOne.mockReset();
  hoisted.queryWithTenant.mockReset();
});

describe("S3-110 ① · GET /api/platform/library/categories（只读聚合）", () => {
  it("反测：无令牌访问必须 401（端点是平台令牌保护的）", async () => {
    const res = await request(libraryApp).get("/api/platform/library/categories");
    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("正向：返回 tenantId / tenantName / categoryId / name / parentId / status / productCount", async () => {
    hoisted.query.mockResolvedValue([
      {
        tenantId: "t-1001",
        tenantName: "长沙智享酒业",
        categoryId: 11,
        name: "白酒",
        parentId: null,
        status: 1,
        productCount: 7
      },
      {
        tenantId: "t-1002",
        tenantName: "株洲名酒行",
        categoryId: 12,
        name: "啤酒",
        parentId: 11,
        status: 0,
        productCount: 0
      }
    ]);

    const res = await authed(request(libraryApp).get("/api/platform/library/categories"));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      tenantId: "t-1001",
      tenantName: "长沙智享酒业",
      categoryId: 11,
      name: "白酒",
      parentId: null,
      status: 1,
      productCount: 7
    });
    expect(res.body.data[1].productCount).toBe(0);

    // 只读证明：唯一一条 SQL 必须是 SELECT，且不得出现任何写语句
    expect(hoisted.query).toHaveBeenCalledTimes(1);
    const sql = String(hoisted.query.mock.calls[0][0]);
    expect(sql).toContain("FROM t_product_category");
    expect(sql).toContain("LEFT JOIN t_tenant");
    expect(sql).toContain("t_product_spu");
    expect(sql).toMatch(/^\s*SELECT/i);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b/i);
    // 不带 tenant 过滤（平台侧跨租户只读），故不走 queryWithTenant / queryOne
    expect(hoisted.queryWithTenant).not.toHaveBeenCalled();
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});

describe("S3-110 ② · PUT /spus/:id/status 状态机（APPROVED ↔ OFFLINE）", () => {
  it("APPROVED → OFFLINE 返回 200 并落 UPDATE", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 5, status: "APPROVED" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/5/status").send({ status: "OFFLINE" })
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 5, status: "OFFLINE" });
    const updateSql = String(
      (hoisted.query.mock.calls.find((c) => String(c[0]).includes("UPDATE t_library_spu")) ?? [])[0] ?? ""
    );
    expect(updateSql).toContain("UPDATE t_library_spu SET status = ?");
    const updateParams = (hoisted.query.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE t_library_spu")
    ) ?? [])[1];
    expect(updateParams).toEqual(["OFFLINE", 1, 5]);
  });

  it("OFFLINE → APPROVED 返回 200（重新上架）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 6, status: "OFFLINE" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/6/status").send({ status: "APPROVED" })
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 6, status: "APPROVED" });
  });

  it("PENDING → APPROVED 仍返回 200（审核路径保持不变）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 7, status: "PENDING" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/7/status").send({ status: "APPROVED" })
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 7, status: "APPROVED" });
  });

  it("反测：PENDING → OFFLINE 仍 400（只放开 APPROVED ↔ OFFLINE，不放宽审核路径）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 8, status: "PENDING" });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/8/status").send({ status: "OFFLINE" })
    );

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain("PENDING");
    expect(res.body.msg).toContain("OFFLINE");
    // 未发生任何写
    expect(
      hoisted.query.mock.calls.some((c) => String(c[0]).includes("UPDATE t_library_spu"))
    ).toBe(false);
  });

  it("边界：APPROVED → REJECTED 仍 400（不得把已发布商品改判为驳回）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 9, status: "APPROVED" });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/9/status").send({ status: "REJECTED" })
    );

    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("边界：非法状态值仍 400 且不进入服务层查询", async () => {
    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/10/status").send({ status: "SOLD_OUT" })
    );

    expect(res.status).toBe(400);
    expect(hoisted.queryOne).not.toHaveBeenCalled();
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("无令牌调用状态流转端点必须 401", async () => {
    const res = await request(libraryApp)
      .put("/api/platform/library/spus/5/status")
      .send({ status: "OFFLINE" });
    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});
