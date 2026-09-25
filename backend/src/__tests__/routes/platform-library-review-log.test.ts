/**
 * C6-2-T5 路由级测试：商品库审核流水（迁移 183 + 读端点 + 既有状态机留痕）
 *
 * 覆盖：
 *   GET /api/platform/library/spus/:id/review-logs  读端点（正例 / 空态 / 404 / 400 / 无令牌 401）
 *   PUT /api/platform/library/spus/:id/status       成功分支写流水（action 推导 / from→to / 操作人 / reason）
 *
 * 范式与 S3-110、C6-1A 路由测试一致：真实 `requirePlatformAuth` + 真实路由 + 真实 controller/service，
 * 只把 DB 访问（shared/db）替换为内存桩 —— 断言是端点级真实行为，不是 mock 自证。
 *
 * 既有语义冻结（派单卡红线③）：本文件不改动 `platform-s3-110.test.ts` 的 9 条断言，
 * 且用例⑨ 反向复核"UPDATE 仍走 shared/db.query、参数仍为 [status, reviewedBy, id]"。
 *
 * 反测敏感性（徒手反测记录见回传卡证据栏）：
 *   去掉成功分支的 INSERT ⇒ 用例⑧⑩⑪⑫⑬ 必红；
 *   action 推导改成恒为 'APPROVE' ⇒ 用例⑧（OFFLINE）与⑫（REJECT）必红；
 *   读端点 ORDER BY 改回升序 ⇒ 用例④ 必红。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
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

/** 真实平台令牌（与 platform-auth 登录签发的 claims 同形：含 username / realName） */
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

/** 只有 username、没有 realName 的令牌（验证 operator_name 的回落口径） */
const TOKEN_NO_REALNAME = jwt.sign(
  { type: "platform_admin", id: 9, username: "ops09" },
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
    res.status(err?.statusCode || 500).json({
      code: String(err?.statusCode || 500),
      msg: err?.message || "服务器内部错误"
    });
  });
  return app;
}

const libraryApp = buildApp("/api/platform/library", platformLibraryRouter);

const authed = (r: request.Test, token = TOKEN) => r.set("Authorization", `Bearer ${token}`);

/** 取"写流水"的那条 INSERT 调用 */
function insertCall() {
  return hoisted.query.mock.calls.find((c) =>
    String(c[0]).includes("INSERT INTO t_library_spu_review_log")
  );
}

beforeEach(() => {
  hoisted.query.mockReset();
  hoisted.queryOne.mockReset();
  hoisted.queryWithTenant.mockReset();
});

describe("C6-2-T5 · GET /spus/:id/review-logs（审核流水读端点）", () => {
  it("① 无令牌访问必须 401 且零查库（端点是平台令牌保护的）", async () => {
    const res = await request(libraryApp).get("/api/platform/library/spus/5/review-logs");
    expect(res.status).toBe(401);
    expect(hoisted.queryOne).not.toHaveBeenCalled();
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("② 空态：SPU 存在但无流水 ⇒ 200 + logs: []（诚实空态，不伪造记录）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 5 });
    hoisted.query.mockResolvedValue([]);

    const res = await authed(request(libraryApp).get("/api/platform/library/spus/5/review-logs"));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.logs).toEqual([]);
  });

  it("③ 正例：逐字返回 7 个 camelCase 字段（id/action/fromStatus/toStatus/operatorId/operatorName/reason/createdAt）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 5 });
    hoisted.query.mockResolvedValue([
      {
        id: 2,
        action: "OFFLINE",
        fromStatus: "APPROVED",
        toStatus: "OFFLINE",
        operatorId: 1,
        operatorName: "凌舟",
        reason: "违规下架",
        createdAt: "2026-09-26T02:00:00.000Z"
      },
      {
        id: 1,
        action: "APPROVE",
        fromStatus: "PENDING",
        toStatus: "APPROVED",
        operatorId: 1,
        operatorName: "凌舟",
        reason: null,
        createdAt: "2026-09-25T02:00:00.000Z"
      }
    ]);

    const res = await authed(request(libraryApp).get("/api/platform/library/spus/5/review-logs"));

    expect(res.status).toBe(200);
    expect(res.body.data.logs).toHaveLength(2);
    expect(res.body.data.logs[0]).toEqual({
      id: 2,
      action: "OFFLINE",
      fromStatus: "APPROVED",
      toStatus: "OFFLINE",
      operatorId: 1,
      operatorName: "凌舟",
      reason: "违规下架",
      createdAt: "2026-09-26T02:00:00.000Z"
    });
    expect(res.body.data.logs[1].reason).toBe(null);
    // 排序口径由 SQL 保证（mock 桩不排序，故这里断言 SQL 文本；反测：改回升序必红）
    const sql = String(hoisted.query.mock.calls[0][0]);
    expect(sql).toContain("FROM t_library_spu_review_log");
    expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(hoisted.query.mock.calls[0][1]).toEqual([5]);
    expect(String(hoisted.queryOne.mock.calls[0][0])).toContain("FROM t_library_spu");
  });

  it("④ SPU 不存在 ⇒ 404（不得用空数组冒充「无流水」）", async () => {
    hoisted.queryOne.mockResolvedValue(null);

    const res = await authed(request(libraryApp).get("/api/platform/library/spus/404/review-logs"));

    expect(res.status).toBe(404);
    expect(res.body.msg).toBe("SPU不存在");
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("⑤ 非法 SPU ID ⇒ 400 且不进入服务层", async () => {
    const res = await authed(request(libraryApp).get("/api/platform/library/spus/abc/review-logs"));
    expect(res.status).toBe(400);
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});

describe("C6-2-T5 · PUT /spus/:id/status 成功分支写流水（既有状态机留痕）", () => {
  it("⑥ APPROVED → OFFLINE：流水 +1，action=OFFLINE，from_status/to_status 取真实前后值", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 5, status: "APPROVED" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp)
        .put("/api/platform/library/spus/5/status")
        .send({ status: "OFFLINE", reason: "违规下架" })
    );

    expect(res.status).toBe(200);
    const call = insertCall();
    expect(call).toBeTruthy();
    expect((call as any)[1]).toEqual([5, "OFFLINE", "APPROVED", "OFFLINE", 1, "凌舟", "违规下架"]);
  });

  it("⑦ 既有语义不变：返回体仍是 {id,status,reviewedBy}，UPDATE 参数仍是 [status,reviewedBy,id]", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 5, status: "APPROVED" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/5/status").send({ status: "OFFLINE" })
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 5, status: "OFFLINE", reviewedBy: 1 });
    const updateCall = hoisted.query.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE t_library_spu")
    );
    expect(updateCall).toBeTruthy();
    expect(String((updateCall as any)[0])).toContain("UPDATE t_library_spu SET status = ?");
    expect((updateCall as any)[1]).toEqual(["OFFLINE", 1, 5]);
  });

  it("⑧ PENDING → APPROVED 的 action = APPROVE（审核通过）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 7, status: "PENDING" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/7/status").send({ status: "APPROVED" })
    );

    expect(res.status).toBe(200);
    expect((insertCall() as any)?.[1]).toEqual([7, "APPROVE", "PENDING", "APPROVED", 1, "凌舟", null]);
  });

  it("⑨ OFFLINE → APPROVED（重新上架）的 action = APPROVE，from_status = OFFLINE", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 6, status: "OFFLINE" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/6/status").send({ status: "APPROVED" })
    );

    expect(res.status).toBe(200);
    expect((insertCall() as any)?.[1]).toEqual([6, "APPROVE", "OFFLINE", "APPROVED", 1, "凌舟", null]);
  });

  it("⑩ PENDING → REJECTED 的 action = REJECT（驳回理由落在 reason）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 9, status: "PENDING" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp)
        .put("/api/platform/library/spus/9/status")
        .send({ status: "REJECTED", reason: "资质不全" })
    );

    expect(res.status).toBe(200);
    expect((insertCall() as any)?.[1]).toEqual([9, "REJECT", "PENDING", "REJECTED", 1, "凌舟", "资质不全"]);
  });

  it("⑪ 操作人取自平台令牌主体：无 realName 回落 username；未填 reason ⇒ NULL（不写空串）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 11, status: "PENDING" });
    hoisted.query.mockResolvedValue({ affectedRows: 1 });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/11/status").send({ status: "APPROVED" }),
      TOKEN_NO_REALNAME
    );

    expect(res.status).toBe(200);
    expect((insertCall() as any)?.[1]).toEqual([11, "APPROVE", "PENDING", "APPROVED", 9, "ops09", null]);
  });

  it("⑫ 既有反测保持：PENDING → OFFLINE 仍 400 且一行流水都不写", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 8, status: "PENDING" });

    const res = await authed(
      request(libraryApp).put("/api/platform/library/spus/8/status").send({ status: "OFFLINE" })
    );

    expect(res.status).toBe(400);
    expect(insertCall()).toBeUndefined();
    expect(
      hoisted.query.mock.calls.some((c) => String(c[0]).includes("UPDATE t_library_spu"))
    ).toBe(false);
  });

  it("⑬ 无令牌调用状态流转端点仍 401（鉴权未放松）", async () => {
    const res = await request(libraryApp)
      .put("/api/platform/library/spus/5/status")
      .send({ status: "OFFLINE" });
    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});
