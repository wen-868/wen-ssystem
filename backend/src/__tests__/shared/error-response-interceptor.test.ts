import { describe, it, expect, vi, beforeEach } from "vitest";

// R55-02 后，errorResponseInterceptor 不再调用 reportToLingZhou / insertErrorLog，
// 飞书告警统一由 errorHandler 负责。这里 mock insertErrorLog 仅用于断言"不被调用"。
const { mockInsertErrorLog } = vi.hoisted(() => ({
  mockInsertErrorLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/admin/error-log.service", () => ({
  insertErrorLog: mockInsertErrorLog,
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

  it("应调用 next() 透传请求", () => {
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

  it("400 状态码不应记录错误日志（统一由 errorHandler 负责）", () => {
    const { req, res, next } = mockReqRes("/api/test", "POST", { id: 1 });
    errorResponseInterceptor(req, res as any, next);

    res.status(400).json({ msg: "参数错误" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("401 状态码不应记录错误日志", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(401).json({ msg: "未登录" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("403 状态码不应记录错误日志", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(403).json({ msg: "无权限" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("404 状态码不应记录错误日志", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(404).json({ msg: "未找到" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("422 状态码不应记录错误日志", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(422).json({ msg: "验证失败" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("429 状态码不应记录错误日志", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(429).json({ msg: "请求过于频繁" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("其他 4xx 状态码不应记录错误日志", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    res.status(409).json({ msg: "冲突" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("500 状态码不再触发飞书告警（告警由 errorHandler 统一负责，R55-02）", () => {
    const { req, res, next } = mockReqRes("/api/crash", "POST", { id: 42 });
    errorResponseInterceptor(req, res as any, next);

    // 5xx 响应正常返回，errorResponseInterceptor 不再拦截、不再告警、不再写日志
    res.status(500).json({ msg: "服务器内部错误" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("500 错误且无 user/tenantId 时也不触发任何副作用", () => {
    const { req, res, next } = mockReqRes("/api/error", "POST", undefined, null);
    errorResponseInterceptor(req, res as any, next);

    res.status(500).json({ msg: "服务器内部错误" });
    expect(mockInsertErrorLog).not.toHaveBeenCalled();
  });

  it("5xx 响应体应原样透传，不被中间件修改", () => {
    const { req, res, next } = mockReqRes();
    errorResponseInterceptor(req, res as any, next);

    const body = { code: "500", msg: "降级", data: null };
    res.status(503).json(body);
    // res.json 被调用一次，且传入的 body 未被修改
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res._getPayloads()[0].body).toEqual(body);
    expect(res._getPayloads()[0].statusCode).toBe(503);
  });
});
