/**
 * 管理端库存报损报溢 controller 单元测试
 * 被测文件：src/controllers/admin/inventory-loss-gain.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  reportLossGain: vi.fn(),
  listLossGains: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/inventory-loss-gain.service", () => ({
  reportLossGain: mocks.reportLossGain,
  listLossGains: mocks.listLossGains,
}));

import {
  reportLossGain,
  listLossGains,
} from "../../../controllers/admin/inventory-loss-gain.controller";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin inventory-loss-gain.controller", () => {
  it("reportLossGain 成功报损报溢", async () => {
    mocks.reportLossGain.mockResolvedValue({ id: 1, success: true });
    const req = mockReq({
      body: { storeId: 1, type: "LOSS", skuId: 10, qty: 2, costPrice: 50, reason: "破损" },
    });
    const res = mockRes();
    await reportLossGain(req, res, vi.fn());
    expect(mocks.reportLossGain).toHaveBeenCalledWith({
      storeId: 1, type: "LOSS", skuId: 10, qty: 2, costPrice: 50, reason: "破损",
      operatorId: 1, tenantId: "t1",
    });
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1, success: true });
  });

  it("reportLossGain 传递 operatorId 和 tenantId", async () => {
    mocks.reportLossGain.mockResolvedValue({ id: 2 });
    const req = mockReq({
      user: { id: 99, username: "manager" },
      body: { storeId: 2, type: "GAIN", skuId: 5, qty: 1, costPrice: 20, reason: "盘盈" },
    });
    const res = mockRes();
    await reportLossGain(req, res, vi.fn());
    expect(mocks.reportLossGain).toHaveBeenCalledWith(expect.objectContaining({
      operatorId: 99,
      tenantId: "t1",
    }));
  });

  it("reportLossGain 调用 res.json 返回 ok 包装结果", async () => {
    mocks.reportLossGain.mockResolvedValue({ id: 3 });
    const req = mockReq({ body: { storeId: 1, type: "LOSS", skuId: 1, qty: 1 } });
    const res = mockRes();
    await reportLossGain(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 3 } });
  });

  it("listLossGains 默认分页参数", async () => {
    mocks.listLossGains.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listLossGains(req, res, vi.fn());
    expect(mocks.listLossGains).toHaveBeenCalledWith({
      storeId: undefined, type: undefined, page: 1, pageSize: 20, tenantId: "t1",
    });
  });

  it("listLossGains 传入 storeId 时转换为数字", async () => {
    mocks.listLossGains.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { storeId: "5", type: "GAIN" } });
    const res = mockRes();
    await listLossGains(req, res, vi.fn());
    expect(mocks.listLossGains).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 5,
      type: "GAIN",
    }));
  });

  it("listLossGains 自定义分页", async () => {
    mocks.listLossGains.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { page: "3", pageSize: "50" } });
    const res = mockRes();
    await listLossGains(req, res, vi.fn());
    expect(mocks.listLossGains).toHaveBeenCalledWith(expect.objectContaining({
      page: 3,
      pageSize: 50,
    }));
  });

  it("listLossGains 不传 storeId 时为 undefined", async () => {
    mocks.listLossGains.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { type: "LOSS" } });
    const res = mockRes();
    await listLossGains(req, res, vi.fn());
    expect(mocks.listLossGains).toHaveBeenCalledWith(expect.objectContaining({
      storeId: undefined,
      type: "LOSS",
    }));
  });
});
