import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/transfer-execution.service.js", () => ({
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
import { ok, fail } from "../../../shared/response.js";
import { receiveTransferOrder, getInTransitOrders, getMyShipments } from "../../../controllers/store/transfer-execution.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser", storeId: 1 },
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

describe("store/transfer-execution.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("receiveTransferOrder - 应接收调拨单", async () => {
    (transferExecutionService.receiveTransferOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { id: "1" },
      body: { items: [{ itemId: 1, receivedQty: 10 }] },
    });
    const res = mockRes();
    await receiveTransferOrder(req as any, res as any);
    expect(transferExecutionService.receiveTransferOrder).toHaveBeenCalledWith(
      1,
      "t1",
      1,
      [{ itemId: 1, receivedQty: 10 }]
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getInTransitOrders - 未关联门店应返回400", async () => {
    const req = mockReq({ user: { id: 1, username: "storeuser", storeId: undefined } });
    const res = mockRes();
    await getInTransitOrders(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("未关联门店");
  });

  it("getInTransitOrders - 应返回在途调拨单", async () => {
    (transferExecutionService.getInTransitOrders as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getInTransitOrders(req as any, res as any);
    expect(transferExecutionService.getInTransitOrders).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getMyShipments - 未关联门店应返回400", async () => {
    const req = mockReq({ user: { id: 1, username: "storeuser", storeId: undefined } });
    const res = mockRes();
    await getMyShipments(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("未关联门店");
  });

  it("getMyShipments - 应返回我的发货单", async () => {
    (transferExecutionService.getMyShipments as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getMyShipments(req as any, res as any);
    expect(transferExecutionService.getMyShipments).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
