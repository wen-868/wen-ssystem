/**
 * 管理端会员 controller 单元测试
 * 被测文件：src/controllers/admin/member.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  registerMember: vi.fn(),
  getMemberCard: vi.fn(),
  updateMemberLevel: vi.fn(),
  getMemberBenefits: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/member.service", () => ({
  registerMember: mocks.registerMember,
  getMemberCard: mocks.getMemberCard,
  updateMemberLevel: mocks.updateMemberLevel,
  getMemberBenefits: mocks.getMemberBenefits,
}));

import {
  registerMember,
  getMemberCard,
  updateMemberLevel,
  getMemberBenefits,
} from "../../../controllers/admin/member.controller";

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

describe("admin member.controller", () => {
  it("registerMember 成功注册并传递全部参数与 tenantId", async () => {
    mocks.registerMember.mockResolvedValue({ id: 1, name: "张三" });
    const req = mockReq({
      body: { name: "张三", mobile: "13800000000", password: "123456", referrerId: 2 },
    });
    const res = mockRes();
    await registerMember(req, res, vi.fn());
    expect(mocks.registerMember).toHaveBeenCalledWith({
      name: "张三",
      mobile: "13800000000",
      password: "123456",
      referrerId: 2,
      tenantId: "t1",
    });
    expect(res.json).toHaveBeenCalled();
  });

  it("registerMember referrerId 缺失时传 undefined", async () => {
    mocks.registerMember.mockResolvedValue({ id: 2 });
    const req = mockReq({ body: { name: "李四", mobile: "13900000000", password: "abc" } });
    const res = mockRes();
    await registerMember(req, res, vi.fn());
    expect(mocks.registerMember).toHaveBeenCalledWith(expect.objectContaining({
      name: "李四",
      referrerId: undefined,
      tenantId: "t1",
    }));
  });

  it("getMemberCard 根据 params.id 获取会员卡", async () => {
    mocks.getMemberCard.mockResolvedValue({ id: 5, level: "GOLD" });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    await getMemberCard(req, res, vi.fn());
    expect(mocks.getMemberCard).toHaveBeenCalledWith(5, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("updateMemberLevel 传递 id、levelName 和 tenantId", async () => {
    mocks.updateMemberLevel.mockResolvedValue({ id: 3, levelName: "PLATINUM" });
    const req = mockReq({ params: { id: "3" }, body: { levelName: "PLATINUM" } });
    const res = mockRes();
    await updateMemberLevel(req, res, vi.fn());
    expect(mocks.updateMemberLevel).toHaveBeenCalledWith(3, "PLATINUM", "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 3, levelName: "PLATINUM" });
  });

  it("getMemberBenefits 仅传 tenantId", async () => {
    mocks.getMemberBenefits.mockResolvedValue({ benefits: ["折扣", "积分"] });
    const req = mockReq();
    const res = mockRes();
    await getMemberBenefits(req, res, vi.fn());
    expect(mocks.getMemberBenefits).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("registerMember service 抛错时透传异常", async () => {
    mocks.registerMember.mockRejectedValue(new Error("手机号已注册"));
    const req = mockReq({ body: { name: "王五", mobile: "13800000000", password: "123" } });
    const res = mockRes();
    await expect(registerMember(req, res, vi.fn())).rejects.toThrow("手机号已注册");
  });
});
