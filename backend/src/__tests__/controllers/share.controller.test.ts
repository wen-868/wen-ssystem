import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/share.service.js", () => ({
  getCollectionLink: vi.fn(),
  payCollection: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as shareService from "../../../services/share.service.js";
import { ok } from "../../../shared/response.js";
import { getCollectionLink, payCollection } from "../../../controllers/share.controller.js";

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

describe("share.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCollectionLink - 应获取收款链接", async () => {
    (shareService.getCollectionLink as any).mockResolvedValue({ token: "test-token" });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionLink(req as any, res as any);
    expect(shareService.getCollectionLink).toHaveBeenCalledWith("test-token");
    expect(ok).toHaveBeenCalled();
  });

  it("payCollection - 应支付收款", async () => {
    (shareService.payCollection as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await payCollection(req as any, res as any);
    expect(shareService.payCollection).toHaveBeenCalledWith("test-token");
    expect(ok).toHaveBeenCalled();
  });
});