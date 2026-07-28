import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/alert.service", () => ({
  listAlerts: vi.fn(),
  getAlertCounts: vi.fn(),
  handleAlert: vi.fn(),
  listAlertRules: vi.fn(),
  updateAlertRule: vi.fn(),
  runAllAlertChecks: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as alertService from "@services/alert.service";
import { ok } from "@shared/response";
import {
  list,
  count,
  handle,
  rules,
  updateRule,
  check,
  listAlerts,
  getAlertCounts,
  handleAlert,
  listAlertRules,
  updateAlertRule,
  runCheck,
} from "@controllers/admin/alert.controller";

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

describe("alert.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list - 应返回预警列表", async () => {
    (alertService.listAlerts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(alertService.listAlerts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("count - 应返回预警统计", async () => {
    (alertService.getAlertCounts as any).mockResolvedValue({ total: 0, unhandled: 0 });
    const req = mockReq();
    const res = mockRes();
    await count(req as any, res as any, vi.fn());
    expect(alertService.getAlertCounts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("handle - 应处理预警", async () => {
    (alertService.handleAlert as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 }, body: { action: "HANDLE", remark: "处理备注" } });
    const res = mockRes();
    await handle(req as any, res as any, vi.fn());
    expect(alertService.handleAlert).toHaveBeenCalledWith(1, "t1", "HANDLE", "处理备注", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("handle - zod验证失败", async () => {
    const req = mockReq({ params: { id: 1 }, body: { action: "INVALID" } });
    const res = mockRes();
    await expect(handle(req as any, res as any, vi.fn())).rejects.toThrow();
  });

  it("rules - 应返回预警规则列表", async () => {
    (alertService.listAlertRules as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await rules(req as any, res as any, vi.fn());
    expect(alertService.listAlertRules).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateRule - 应更新预警规则", async () => {
    (alertService.updateAlertRule as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 }, body: { enabled: true, thresholdValue: 100 } });
    const res = mockRes();
    await updateRule(req as any, res as any, vi.fn());
    expect(alertService.updateAlertRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("check - 应执行预警检查", async () => {
    (alertService.runAllAlertChecks as any).mockResolvedValue({ total: 0 });
    const req = mockReq();
    const res = mockRes();
    await check(req as any, res as any, vi.fn());
    expect(alertService.runAllAlertChecks).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("list - 不传page和pageSize时使用默认值", async () => {
    (alertService.listAlerts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(alertService.listAlerts).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20,
    }));
  });

  it("handle - user不存在时使用默认值0和system", async () => {
    (alertService.handleAlert as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 }, body: { action: "HANDLE" }, user: undefined });
    const res = mockRes();
    await handle(req as any, res as any, vi.fn());
    expect(alertService.handleAlert).toHaveBeenCalledWith(1, "t1", "HANDLE", undefined, 0, "system");
  });

  describe("aliases", () => {
    it("listAlerts should equal list", () => {
      expect(listAlerts).toBe(list);
    });

    it("getAlertCounts should equal count", () => {
      expect(getAlertCounts).toBe(count);
    });

    it("handleAlert should equal handle", () => {
      expect(handleAlert).toBe(handle);
    });

    it("listAlertRules should equal rules", () => {
      expect(listAlertRules).toBe(rules);
    });

    it("updateAlertRule should equal updateRule", () => {
      expect(updateAlertRule).toBe(updateRule);
    });

    it("runCheck should equal check", () => {
      expect(runCheck).toBe(check);
    });
  });
});