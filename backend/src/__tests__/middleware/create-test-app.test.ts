/**
 * 夹具自测：`src/__tests__/fixtures/create-test-app.ts` 的兜底错误处理器
 * 必须与生产错误处理**保真**——生产 `src/middleware/error-handler.ts:18`
 * 先判 ZodError 并统一返回 400，夹具此前的状态码只认 `err.statusCode`，
 * 会把参数校验失败错报成 500（派单 C2-0b）。
 * 本文件不引用任何 C2-0 产物（控制器/路由/服务），可独立合并到 main。
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { Router } from "express";
import { ZodError, z } from "zod";
import { createTestApp } from "../fixtures/create-test-app";

const bodySchema = z.object({ name: z.string() });

describe("fixtures/create-test-app · 兜底错误处理器保真度", () => {
  it("路由内抛出 ZodError ⇒ 400 + code '400' + success false + msg 取首个字段错误（与生产一致）", async () => {
    const router = Router();
    router.post("/strict", (req, _res) => {
      // 同步抛出：Express 4 会捕获路由处理器的同步异常并交给错误中间件
      bodySchema.parse(req.body);
    });
    const app = createTestApp({ prefix: "/api/test", router });

    // 同一 schema、同一入参，独立取一次 zod 的首个字段错误文案，用于锁定夹具 msg 口径
    let firstIssueMessage = "";
    try {
      bodySchema.parse({ name: 123 });
    } catch (e) {
      firstIssueMessage = (e as ZodError).errors[0]?.message || "";
    }
    expect(firstIssueMessage).not.toBe("");

    const res = await request(app).post("/api/test/strict").send({ name: 123 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    expect(res.body.success).toBe(false);
    expect(typeof res.body.msg).toBe("string");
    expect(res.body.msg.length).toBeGreaterThan(0);
    expect(res.body.msg).toBe(firstIssueMessage);
  });

  it("普通 Error（无 statusCode）⇒ 仍为 500，msg 取 err.message（证明未改变其它行为）", async () => {
    const router = Router();
    router.get("/boom", () => {
      throw new Error("业务异常");
    });
    const app = createTestApp({ prefix: "/api/test", router });

    const res = await request(app).get("/api/test/boom");

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("500");
    expect(res.body.msg).toBe("业务异常");
  });
});
