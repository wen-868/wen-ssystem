import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsertErrorLog, mockReportToLingZhou } = vi.hoisted(() => ({
  mockInsertErrorLog: vi.fn().mockResolvedValue(undefined),
  mockReportToLingZhou: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock("../../services/admin/error-log.service", () => ({
  insertErrorLog: mockInsertErrorLog,
}));

vi.mock("../../shared/feishu-report", () => ({
  reportToLingZhou: mockReportToLingZhou,
}));

import { errorResponseInterceptor } from "../../shared/error-response-interceptor";
import type { Request, NextFunction } from "express";

function mockReqRes(
  url = "/api/test",
  method = "GET",
  user?: { id: number },
  tenantId: number | string | null = "default",
  originalUrl?: string
) {
  const req = {
    originalUrl: originalUrl !== undefined ? originalUrl : url,
    url,
    method,
    user,
    tenantId,
  } as unknown as Request;

  let statusCode = 200;
  const jsonPayloads: any[] = [];

  const res = {
    status: vi.fn((code: number) => { statusCode = code; return res; }),
    json: vi.fn((body: any) => { jsonPayloads.push({ statusCode, body }); return res; }),
    _getStatusCode: () => statusCode,
    _getPayloads: () => jsonPayloads,
  } as any;

  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("error-response-interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应调用 next()", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it("2xx 状态码不应记录错误日志", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(200).json({ msg: "ok" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("400 状态码应记录 validation 类型错误", () => {
    const { req, res, next } = mockReqRes("/api/test", "POST", { id: 1 });
    errorResponseInterceptor(req, res as any, next);

    res.status(400).json({ msg: "参数错误" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "validation",
        severity: "WARN",
        message: "参数错误",
        status_code: 400,
      })
    );
  });

  it("401 状态码应记录 auth 类型错误", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(401).json({ msg: "未登录" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "auth",
        severity: "WARN",
      })
    );
  });

  it("403 状态码应记录 auth 类型错误 + ERROR 级别", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(403).json({ msg: "无权限" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "auth",
        severity: "ERROR",
      })
    );
  });

  it("404 状态码应记录 not_found 类型错误", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(404).json({ msg: "未找到" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "not_found",
      })
    );
  });

  it("500 状态码应记录 server 类型错误 + ERROR 级别", () => {
    const { req, res, next } = mockReqRes("/api/crash", "POST", { id: 42 });
    errorResponseInterceptor(req, res as any, next);

    res.status(500).json({ msg: "服务器内部错误" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "server",
        severity: "ERROR",
        message: "服务器内部错误",
        status_code: 500,
        user_id: 42,
        request_url: "/api/crash",
        request_method: "POST",
      })
    );
  });

  it("422 状态码应记录 validation 类型错误", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(422).json({ msg: "验证失败" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "validation",
      })
    );
  });

  it("429 状态码应记录 business 类型 + ERROR 级别", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(429).json({ msg: "请求过于频繁" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "business",
        severity: "ERROR",
      })
    );
  });

  it("其他 4xx 状态码应记录 business 类型", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(409).json({ msg: "冲突" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "business",
      })
    );
  });

  it("无 user 时 user_id 应为 null", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(400).json({ msg: "错误" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
      })
    );
  });

  it("body.message 存在时应使用 message", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(400).json({ message: "自定义错误消息" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "自定义错误消息",
      })
    );
  });

  it("body 无 message/msg 时应使用默认消息", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(400).json({ foo: "bar" });
    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "请求错误",
      })
    );
  });

  it("500 错误且 userId=null, tenantId=null 时，飞书告警中应显示\"未登录\"和\"N/A\"", () => {
    const { req, res, next } = mockReqRes("/api/error", "POST", undefined, null);
    errorResponseInterceptor(req, res as any, next);

    res.status(500).json({ msg: "服务器内部错误" });

    expect(mockReportToLingZhou).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "系统错误告警",
        status: "BLOCKED",
        details: expect.arrayContaining([
          { label: "用户ID", value: "未登录" },
          { label: "租户ID", value: "N/A" },
        ]),
      })
    );
  });

  it("500 错误且有 user 和 tenantId 时，飞书告警中应显示实际 userId 和 tenantId", () => {
    const { req, res, next } = mockReqRes("/api/crash", "POST", { id: 123 }, 456);
    errorResponseInterceptor(req, res as any, next);

    res.status(500).json({ msg: "服务器内部错误" });

    expect(mockReportToLingZhou).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "系统错误告警",
        status: "BLOCKED",
        summary: "[POST] /api/crash — 服务器内部错误",
        details: expect.arrayContaining([
          { label: "请求URL", value: "POST /api/crash" },
          { label: "用户ID", value: 123 },
          { label: "租户ID", value: 456 },
          { label: "状态码", value: "500" },
          { label: "错误消息", value: "服务器内部错误" },
        ]),
      })
    );
  });

  it("req.originalUrl 不存在时应回退到 req.url", () => {
    const { req, res, next } = mockReqRes(
      "/api/fallback",
      "GET",
      { id: 1 },
      1,
      undefined as any
    );
    (req as any).originalUrl = undefined;
    errorResponseInterceptor(req, res as any, next);

    res.status(500).json({ msg: "错误" });

    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        request_url: "/api/fallback",
      })
    );

    expect(mockReportToLingZhou).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "[GET] /api/fallback — 错误",
        details: expect.arrayContaining([
          { label: "请求URL", value: "GET /api/fallback" },
        ]),
      })
    );
  });

  it("req.originalUrl 和 req.url 都为 undefined 时 requestUrl 应为空字符串", () => {
    const { req, res, next } = mockReqRes();
    (req as any).originalUrl = undefined;
    (req as any).url = undefined;
    errorResponseInterceptor(req, res as any, next);

    res.status(500).json({ msg: "错误" });

    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        request_url: "",
      })
    );

    expect(mockReportToLingZhou).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "[GET]  — 错误",
        details: expect.arrayContaining([
          { label: "请求URL", value: "GET " },
        ]),
      })
    );
  });

  it("req.method 为 undefined 时 requestMethod 应为空字符串", () => {
    const { req, res, next } = mockReqRes();
    (req as any).method = undefined;
    errorResponseInterceptor(req, res as any, next);

    res.status(500).json({ msg: "错误" });

    expect(mockInsertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        request_method: "",
      })
    );

    expect(mockReportToLingZhou).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "[] /api/test — 错误",
        details: expect.arrayContaining([
          { label: "请求URL", value: " /api/test" },
        ]),
      })
    );
  });

  it("insertErrorLog reject 时 catch 回调应被触发且不抛出", async () => {
    mockInsertErrorLog.mockRejectedValueOnce(new Error("db error"));
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    expect(() => res.status(400).json({ msg: "错误" })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("reportToLingZhou reject 时 catch 回调应被触发且不抛出", async () => {
    mockReportToLingZhou.mockRejectedValueOnce(new Error("feishu error"));
    const { req, res, next } = mockReqRes("/api/crash", "POST", { id: 1 });
    errorResponseInterceptor(req, res as any, next);

    expect(() => res.status(500).json({ msg: "服务器错误" })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
