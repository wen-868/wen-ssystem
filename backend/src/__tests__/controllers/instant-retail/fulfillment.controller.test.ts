import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/instant-retail/fulfillment.service", () => ({
  startDelivery: vi.fn(),
  completeDelivery: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as fulfillmentService from "../../../services/instant-retail/fulfillment.service";
import { ok, fail } from "../../../shared/response";
import { startDelivery, completeDelivery } from "../../../controllers/instant-retail/fulfillment.controller";

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

describe("instant-retail/fulfillment.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("startDelivery - 订单不存在应返回404", async () => {
    (fulfillmentService.startDelivery as any).mockResolvedValue({ found: false });
    const req = mockReq({ params: { platformOrderId: "ORD999" }, body: {} });
    const res = mockRes();
    await startDelivery(req as any, res as any, vi.fn());
    expect(fulfillmentService.startDelivery).toHaveBeenCalledWith("ORD999", {}, "t1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("startDelivery - 平台配置不存在应返回404", async () => {
    (fulfillmentService.startDelivery as any).mockResolvedValue({ found: true, configFound: false });
    const req = mockReq({ params: { platformOrderId: "ORD001" }, body: {} });
    const res = mockRes();
    await startDelivery(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("startDelivery - 应开始配送", async () => {
    (fulfillmentService.startDelivery as any).mockResolvedValue({
      found: true,
      configFound: true,
      platformOrderId: "ORD001",
      success: true,
      status: "DELIVERING",
    });
    const req = mockReq({ params: { platformOrderId: "ORD001" }, body: { courier: "张三" } });
    const res = mockRes();
    await startDelivery(req as any, res as any, vi.fn());
    expect(fulfillmentService.startDelivery).toHaveBeenCalledWith("ORD001", { courier: "张三" }, "t1");
    expect(ok).toHaveBeenCalledWith({ platformOrderId: "ORD001", success: true, status: "DELIVERING" });
  });

  it("completeDelivery - 订单不存在应返回404", async () => {
    (fulfillmentService.completeDelivery as any).mockResolvedValue({ found: false });
    const req = mockReq({ params: { platformOrderId: "ORD999" } });
    const res = mockRes();
    await completeDelivery(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("completeDelivery - 平台配置不存在应返回404", async () => {
    (fulfillmentService.completeDelivery as any).mockResolvedValue({ found: true, configFound: false });
    const req = mockReq({ params: { platformOrderId: "ORD001" } });
    const res = mockRes();
    await completeDelivery(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("completeDelivery - 应完成配送", async () => {
    (fulfillmentService.completeDelivery as any).mockResolvedValue({
      found: true,
      configFound: true,
      platformOrderId: "ORD001",
      success: true,
      status: "COMPLETED",
    });
    const req = mockReq({ params: { platformOrderId: "ORD001" } });
    const res = mockRes();
    await completeDelivery(req as any, res as any, vi.fn());
    expect(fulfillmentService.completeDelivery).toHaveBeenCalledWith("ORD001", "t1");
    expect(ok).toHaveBeenCalledWith({ platformOrderId: "ORD001", success: true, status: "COMPLETED" });
  });
});
