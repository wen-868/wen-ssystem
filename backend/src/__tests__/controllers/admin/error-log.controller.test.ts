import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/error-log.service", () => ({
  insertErrorLog: vi.fn(),
  listErrorLogs: vi.fn(),
  cleanupOldLogs: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as errorLogService from "../../../services/admin/error-log.service";
import { ok } from "../../../shared/response";
import {
  reportFrontendError,
  listErrorLogs,
} from "../../../controllers/admin/error-log.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("error-log.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reportFrontendError - 应上报前端错误", async () => {
    (errorLogService.insertErrorLog as any).mockResolvedValue(undefined);
    const req = mockReq({
      body: {
        error_type: "frontend",
        message: "测试错误",
        stack: "Error: test\n    at foo.js:1:1",
        url: "https://example.com",
      },
    });
    const res = mockRes();
    await reportFrontendError(req as any, res as any, vi.fn());
    expect(errorLogService.insertErrorLog).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith(null);
  });

  it("reportFrontendError - 缺少字段应使用默认值", async () => {
    (errorLogService.insertErrorLog as any).mockResolvedValue(undefined);
    const req = mockReq({ body: {} });
    const res = mockRes();
    await reportFrontendError(req as any, res as any, vi.fn());
    expect(errorLogService.insertErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "frontend",
        severity: "ERROR",
        message: "前端未知错误",
        source: "frontend",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("listErrorLogs - 应返回错误日志列表", async () => {
    (errorLogService.listErrorLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listErrorLogs(req as any, res as any, vi.fn());
    expect(errorLogService.listErrorLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listErrorLogs - 应支持筛选参数", async () => {
    (errorLogService.listErrorLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: {
        error_type: "frontend",
        severity: "ERROR",
        source: "frontend",
        keyword: "测试",
        page: 2,
        pageSize: 10,
      },
    });
    const res = mockRes();
    await listErrorLogs(req as any, res as any, vi.fn());
    expect(errorLogService.listErrorLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "frontend",
        severity: "ERROR",
        source: "frontend",
        keyword: "测试",
        page: 2,
        pageSize: 10,
      })
    );
    expect(ok).toHaveBeenCalled();
  });
});
