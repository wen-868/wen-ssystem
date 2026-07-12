import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/points.service", () => ({
  listPointsRules: vi.fn(),
  createPointsRule: vi.fn(),
  updatePointsRule: vi.fn(),
  adjustCustomerPoints: vi.fn(),
  getCustomerPointsRecords: vi.fn(),
  listLevelConfigs: vi.fn(),
  createLevelConfig: vi.fn(),
  updateLevelConfig: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as pointsService from "../../../services/admin/points.service";
import { ok } from "../../../shared/response";
import {
  listPointsRules,
  createPointsRule,
  updatePointsRule,
  adjustCustomerPoints,
  getCustomerPointsRecords,
  listLevelConfigs,
  createLevelConfig,
  updateLevelConfig,
} from "../../../controllers/admin/points.controller";

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

describe("points.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listPointsRules - 应返回积分规则列表", async () => {
    (pointsService.listPointsRules as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listPointsRules(req as any, res as any);
    expect(pointsService.listPointsRules).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createPointsRule - 应创建积分规则", async () => {
    (pointsService.createPointsRule as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { ruleName: "消费积分", earnType: "SPEND", earnRate: 10, dailyLimit: 100 } });
    const res = mockRes();
    await createPointsRule(req as any, res as any);
    expect(pointsService.createPointsRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updatePointsRule - 应更新积分规则", async () => {
    (pointsService.updatePointsRule as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { ruleName: "新规则名", earnRate: 20, dailyLimit: 200, enabled: 1 } });
    const res = mockRes();
    await updatePointsRule(req as any, res as any);
    expect(pointsService.updatePointsRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("adjustCustomerPoints - 应调整客户积分", async () => {
    (pointsService.adjustCustomerPoints as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { points: 100, type: "ADD", remark: "测试调整" } });
    const res = mockRes();
    await adjustCustomerPoints(req as any, res as any);
    expect(pointsService.adjustCustomerPoints).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerPointsRecords - 应返回客户积分记录", async () => {
    (pointsService.getCustomerPointsRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: { page: 1, pageSize: 10, type: "ADD" } });
    const res = mockRes();
    await getCustomerPointsRecords(req as any, res as any);
    expect(pointsService.getCustomerPointsRecords).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listLevelConfigs - 应返回等级配置列表", async () => {
    (pointsService.listLevelConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listLevelConfigs(req as any, res as any);
    expect(pointsService.listLevelConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createLevelConfig - 应创建等级配置", async () => {
    (pointsService.createLevelConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { levelName: "黄金会员", minPoints: 0, maxPoints: 1000, discountRate: 0.95, benefits: {} } });
    const res = mockRes();
    await createLevelConfig(req as any, res as any);
    expect(pointsService.createLevelConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateLevelConfig - 应更新等级配置", async () => {
    (pointsService.updateLevelConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { levelName: "新名称", minPoints: 100, maxPoints: 2000, discountRate: 0.9, benefits: {} } });
    const res = mockRes();
    await updateLevelConfig(req as any, res as any);
    expect(pointsService.updateLevelConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerPointsRecords - 不传page和pageSize时使用默认值1和20", async () => {
    (pointsService.getCustomerPointsRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: {} });
    const res = mockRes();
    await getCustomerPointsRecords(req as any, res as any);
    expect(pointsService.getCustomerPointsRecords).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20,
    }));
  });

  it("getCustomerPointsRecords - 不传type时type为undefined", async () => {
    (pointsService.getCustomerPointsRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: { page: "1", pageSize: "10" } });
    const res = mockRes();
    await getCustomerPointsRecords(req as any, res as any);
    expect(pointsService.getCustomerPointsRecords).toHaveBeenCalledWith(expect.objectContaining({
      type: undefined,
    }));
  });
});
