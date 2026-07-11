import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/alert.service.js", () => ({
  listAlerts: vi.fn(),
  getAlertCounts: vi.fn(),
  handleAlert: vi.fn(),
  listAlertRules: vi.fn(),
  updateAlertRule: vi.fn(),
  runAllAlertChecks: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as alertService from "../../services/alert.service.js";
import { ok, fail } from "../../shared/response.js";
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
} from "../../controllers/alert.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
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
    await list(req as any, res as any);
    expect(alertService.listAlerts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("count - 应返回预警数量", async () => {
    (alertService.getAlertCounts as any).mockResolvedValue({ total: 10 });
    const req = mockReq();
    const res = mockRes();
    await count(req as any, res as any);
    expect(alertService.getAlertCounts).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("handle - 应处理预警", async () => {
    (alertService.handleAlert as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { action: "HANDLE", remark: "已处理" } });
    const res = mockRes();
    await handle(req as any, res as any);
    expect(alertService.handleAlert).toHaveBeenCalledWith(1, "t1", "HANDLE", "已处理", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("rules - 应返回预警规则列表", async () => {
    (alertService.listAlertRules as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await rules(req as any, res as any);
    expect(alertService.listAlertRules).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateRule - 应更新预警规则", async () => {
    (alertService.updateAlertRule as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { enabled: true, thresholdValue: 100 } });
    const res = mockRes();
    await updateRule(req as any, res as any);
    expect(alertService.updateAlertRule).toHaveBeenCalledWith(1, "t1", { enabled: true, thresholdValue: 100 });
    expect(ok).toHaveBeenCalled();
  });

  it("check - 应运行预警检查", async () => {
    (alertService.runAllAlertChecks as any).mockResolvedValue({ total: 5 });
    const req = mockReq();
    const res = mockRes();
    await check(req as any, res as any);
    expect(alertService.runAllAlertChecks).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listAlerts - 别名应与list一致", async () => {
    expect(listAlerts).toBe(list);
  });

  it("getAlertCounts - 别名应与count一致", async () => {
    expect(getAlertCounts).toBe(count);
  });

  it("handleAlert - 别名应与handle一致", async () => {
    expect(handleAlert).toBe(handle);
  });

  it("listAlertRules - 别名应与rules一致", async () => {
    expect(listAlertRules).toBe(rules);
  });

  it("updateAlertRule - 别名应与updateRule一致", async () => {
    expect(updateAlertRule).toBe(updateRule);
  });

  it("runCheck - 别名应与check一致", async () => {
    expect(runCheck).toBe(check);
  });
});
