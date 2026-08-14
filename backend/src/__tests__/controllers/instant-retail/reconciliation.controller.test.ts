import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/instant-retail/reconciliation.service", () => ({
  getReconciliationSummary: vi.fn(),
  listReconciliationRecords: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/instant-retail/reconciliation.service";
import { ok } from "../../../shared/response";
import { getReconciliationSummary, listReconciliationRecords } from "../../../controllers/instant-retail/reconciliation.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
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

describe("instant-retail/reconciliation.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getReconciliationSummary - 应返回对账汇总", async () => {
    (svc.getReconciliationSummary as any).mockResolvedValue({ totalAmount: 1000 });
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31", platform: "MEITUAN", storeId: "1" } });
    const res = mockRes();
    await getReconciliationSummary(req as any, res as any, vi.fn());
    expect(svc.getReconciliationSummary).toHaveBeenCalledWith({
      tenantId: "t1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      platform: "MEITUAN",
      storeId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getReconciliationSummary - 无 storeId 时为 undefined", async () => {
    (svc.getReconciliationSummary as any).mockResolvedValue({});
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getReconciliationSummary(req as any, res as any, vi.fn());
    expect(svc.getReconciliationSummary).toHaveBeenCalledWith(expect.objectContaining({
      storeId: undefined,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("listReconciliationRecords - 应返回对账记录列表", async () => {
    (svc.listReconciliationRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: "2", pageSize: "10", platform: "JD", startDate: "2026-01-01", endDate: "2026-01-31", storeId: "1" } });
    const res = mockRes();
    await listReconciliationRecords(req as any, res as any, vi.fn());
    expect(svc.listReconciliationRecords).toHaveBeenCalledWith({
      tenantId: "t1",
      page: 2,
      pageSize: 10,
      platform: "JD",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      storeId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listReconciliationRecords - 无参数时使用默认值", async () => {
    (svc.listReconciliationRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listReconciliationRecords(req as any, res as any, vi.fn());
    expect(svc.listReconciliationRecords).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      pageSize: 20,
    }));
    expect(ok).toHaveBeenCalled();
  });
});
