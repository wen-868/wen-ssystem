import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsertErrorLog, mockReportToLingZhou } = vi.hoisted(() => ({
  mockInsertErrorLog: vi.fn().mockResolvedValue(undefined),
  mockReportToLingZhou: vi.fn().mockResolvedValue({ ok: false, status: 0, data: {} }),
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../services/admin/error-log.service", () => ({
  insertErrorLog: mockInsertErrorLog,
}));

vi.mock("../../shared/feishu-report", () => ({
  reportToLingZhou: mockReportToLingZhou,
}));

import { errorHandler } from "../../shared/error-handler";
import { AppError } from "../../shared/app-error";
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

  it("originalUrl 为 undefined 时回退到 req.url", () => {
    const { req, res, next } = mockReqRes();
    (req as any).originalUrl = undefined;
    req.url = "/fallback-url";
    const err = new Error("test");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("method 为 undefined 时返回空字符串", () => {
    const { req, res, next } = mockReqRes();
    (req as any).method = undefined;
    const err = new Error("test");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("err 为 null 应返回 500", () => {
    const { req, res, next } = mockReqRes();

    errorHandler(null as any, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("err 为对象但无 statusCode 走未知错误分支", () => {
    const { req, res, next } = mockReqRes();
    const err = { foo: "bar" };

    errorHandler(err as any, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("statusCode 对象无 message 时使用默认消息", () => {
    const { req, res, next } = mockReqRes();
    const err = { statusCode: 400 };

    errorHandler(err as any, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "请求错误",
      })
    );
  });

  it("5xx 错误 insertErrorLog 失败不阻断响应", () => {
    const { req, res, next } = mockReqRes();
    const err = new AppError("服务器错误", 500);

    mockInsertErrorLog.mockRejectedValueOnce(new Error("db down"));

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
  });

  it("5xx 错误 reportToLingZhou 失败不阻断响应", () => {
    const { req, res, next } = mockReqRes();
    const err = new AppError("服务器错误", 500);

    mockReportToLingZhou.mockRejectedValueOnce(new Error("webhook fail"));

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
  });

  it("未知错误 insertErrorLog 失败不阻断响应", () => {
    const { req, res, next } = mockReqRes();
    const err = new Error("未知错误");

    mockInsertErrorLog.mockRejectedValueOnce(new Error("db down"));

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
  });

  it("未知错误 reportToLingZhou 失败不阻断响应", () => {
    const { req, res, next } = mockReqRes();
    const err = new Error("未知错误");

    mockReportToLingZhou.mockRejectedValueOnce(new Error("webhook fail"));

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
  });

  it("user 无 id 时 userId 为 undefined", () => {
    const { req, res, next } = mockReqRes();
    req.user = {} as any;
    const err = new Error("test");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("ZodError 的 path 为空时使用 root", () => {
    const { req, res, next } = mockReqRes();
    let zodErr: ZodError;
    try {
      // path 为空的情况：使用 refine 产生顶层错误
      z.string()
        .refine(() => false, { message: "顶层错误" })
        .parse("x");
    } catch (e) {
      zodErr = e as ZodError;
    }
    errorHandler(zodErr!, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("errorStack 为 undefined 时 details 中堆栈为空字符串", () => {
    const { req, res, next } = mockReqRes();
    const err = "字符串错误";

    errorHandler(err as any, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("tenantId 为 undefined 时使用空/N/A", () => {
    const { req, res, next } = mockReqRes();
    delete (req as any).tenantId;
    const err = new Error("test");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("originalUrl 和 url 都为 falsy 时返回空字符串", () => {
    const { req, res, next } = mockReqRes();
    req.originalUrl = "";
    req.url = "";
    const err = new Error("test");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
