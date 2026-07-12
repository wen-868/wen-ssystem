import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/stock-warning.service", () => ({
  getStockWarnings: vi.fn(),
  batchConfigStockWarning: vi.fn(),
  getStockWarningConfigs: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as stockWarningService from "../../../services/admin/stock-warning.service";
import { ok } from "../../../shared/response";
import {
  getStockWarnings,
  batchConfigStockWarning,
  getStockWarningConfigs,
} from "../../../controllers/admin/stock-warning.controller";

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

describe("stock-warning.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getStockWarnings - 应返回库存预警列表", async () => {
    (stockWarningService.getStockWarnings as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getStockWarnings(req as any, res as any);
    expect(stockWarningService.getStockWarnings).toHaveBeenCalledWith("t1", undefined);
    expect(ok).toHaveBeenCalled();
  });

  it("getStockWarnings - 应按门店筛选", async () => {
    (stockWarningService.getStockWarnings as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "1" } });
    const res = mockRes();
    await getStockWarnings(req as any, res as any);
    expect(stockWarningService.getStockWarnings).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("batchConfigStockWarning - 应批量配置库存预警", async () => {
    (stockWarningService.batchConfigStockWarning as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { storeId: 1, configs: [{ skuId: 1, minStock: 10, maxStock: 100 }] } });
    const res = mockRes();
    await batchConfigStockWarning(req as any, res as any);
    expect(stockWarningService.batchConfigStockWarning).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getStockWarningConfigs - 应返回库存预警配置", async () => {
    (stockWarningService.getStockWarningConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getStockWarningConfigs(req as any, res as any);
    expect(stockWarningService.getStockWarningConfigs).toHaveBeenCalledWith("t1", undefined);
    expect(ok).toHaveBeenCalled();
  });

  it("getStockWarningConfigs - 应按门店筛选", async () => {
    (stockWarningService.getStockWarningConfigs as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "2" } });
    const res = mockRes();
    await getStockWarningConfigs(req as any, res as any);
    expect(stockWarningService.getStockWarningConfigs).toHaveBeenCalledWith("t1", 2);
    expect(ok).toHaveBeenCalled();
  });
});
