import { describe, it, expect, vi, beforeEach } from "vitest";

// mock db 和 error-log service
vi.mock("../../shared/db.js", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../services/admin/error-log.service.js", () => ({
  insertErrorLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../shared/feishu-report.js", () => ({
  reportToLingZhou: vi.fn().mockResolvedValue({ ok: false, status: 0, data: {} }),
}));

import { errorHandler } from "../../shared/error-handler.js";
import { AppError } from "../../shared/app-error.js";
import { ZodError, z } from "zod";
import type { Request, Response, NextFunction } from "express";

function mockReqRes() {
  const req = {
    originalUrl: "/api/test",
    url: "/api/test",
    method: "GET",
    user: { id: 1 },
    tenantId: "default",
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("error-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ZodError 应返回 400 + 字段错误列表", () => {
    const { req, res, next } = mockReqRes();
    const schema = z.object({ name: z.string() });
    let zodErr: ZodError;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodErr = e as ZodError;
    }
    errorHandler(zodErr!, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "400",
        msg: "参数校验失败",
        errors: expect.any(Array),
      })
    );
  });

  it("AppError（400）应返回对应状态码", () => {
    const { req, res, next } = mockReqRes();
    const err = new AppError("参数错误", 400);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "400",
        msg: "参数错误",
      })
    );
  });

  it("AppError（404）应返回 404", () => {
    const { req, res, next } = mockReqRes();
    const err = new AppError("未找到", 404);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("AppError（403）应返回 403", () => {
    const { req, res, next } = mockReqRes();
    const err = new AppError("无权限", 403);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("AppError（500）应返回 500 并触发告警", () => {
    const { req, res, next } = mockReqRes();
    const err = new AppError("服务器错误", 500);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "500",
        msg: "服务器错误",
      })
    );
  });

  it("普通 Error 应返回 500", () => {
    const { req, res, next } = mockReqRes();
    const err = new Error("未知错误");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "500",
        msg: "服务器内部错误",
      })
    );
  });

  it("字符串错误也应返回 500", () => {
    const { req, res, next } = mockReqRes();
    const err = "字符串错误";

    errorHandler(err as any, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("带 statusCode 的对象错误应使用对应状态码", () => {
    const { req, res, next } = mockReqRes();
    const err = Object.assign(new Error("自定义错误"), { statusCode: 422 });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "422",
        msg: "自定义错误",
      })
    );
  });
});
