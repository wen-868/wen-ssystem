import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/transfer-execution.service.js", () => ({
  cancelTransferOrder: vi.fn(),
  shipTransferOrder: vi.fn(),
  receiveTransferOrder: vi.fn(),
  getInTransitOrders: vi.fn(),
  getMyShipments: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as transferExecutionService from "../../../services/transfer-execution.service.js";
import { ok } from "../../../shared/response.js";
import {
  cancelTransferOrder,
  shipTransferOrder,
} from "../../../controllers/admin/transfer-execution.controller.js";

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

describe("transfer-execution.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancelTransferOrder - 应取消调拨单", async () => {
    (transferExecutionService.cancelTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await cancelTransferOrder(req as any, res as any);
    expect(transferExecutionService.cancelTransferOrder).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("shipTransferOrder - 应发货调拨单", async () => {
    (transferExecutionService.shipTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await shipTransferOrder(req as any, res as any);
    expect(transferExecutionService.shipTransferOrder).toHaveBeenCalledWith(1, "t1", 1);
    expect(ok).toHaveBeenCalled();
  });
});
