import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/share.service.js", () => ({
  getCollectionLink: vi.fn(),
  payCollection: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as shareService from "../../services/share.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  getCollectionLink,
  payCollection,
} from "../../controllers/share.controller.js";

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

describe("share.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCollectionLink - 应返回收款链接信息", async () => {
    (shareService.getCollectionLink as any).mockResolvedValue({ token: "abc123", amount: 100 });
    const req = mockReq({ params: { token: "abc123" } });
    const res = mockRes();
    await getCollectionLink(req as any, res as any);
    expect(shareService.getCollectionLink).toHaveBeenCalledWith("abc123");
    expect(ok).toHaveBeenCalled();
  });

  it("payCollection - 应支付收款链接", async () => {
    (shareService.payCollection as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { token: "abc123" } });
    const res = mockRes();
    await payCollection(req as any, res as any);
    expect(shareService.payCollection).toHaveBeenCalledWith("abc123");
    expect(ok).toHaveBeenCalled();
  });
});
