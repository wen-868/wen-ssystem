/**
 * TOTAL-MEMBER-STATUS-CONTRACT-01 · updateMemberManage 状态开关契约（controller zod 层）
 *
 * 缺口：zod schema 未显式接收 status ⇒ zod 默认剥离未知键 ⇒ PUT {status} 静默丢弃 ⇒ 200 伪成功。
 * 本文件证明：
 *  a) zod 显式接受 status，且仅接受数字 0/1（传入 service 的 body 携带该值）；
 *  b) 非法类型（"0"/"1"/true/null）与非法值（2/1.5）⇒ ZodError（生产 error-handler 映射 400，
 *     HTTP 级 400 断言见 __tests__/routes/member-status-contract-wiring.test.ts）；
 *  c) 不带 status 的既有编辑请求不受影响（零回归）；service 抛 404 时原样上抛。
 *
 * 反测：mutation③（非法值放行，如放宽为 z.number()/z.any()）⇒ 非法值用例必红。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError } from "zod";

const svcMock = vi.hoisted(() => ({
  listMemberManage: vi.fn(),
  createMemberManage: vi.fn(),
  updateMemberManage: vi.fn(),
  getMemberDetail: vi.fn(),
  getMemberPoints: vi.fn(),
  getMemberPointsLogs: vi.fn(),
  getMemberOrders: vi.fn(),
}));

vi.mock("../../../services/store/member.service", () => svcMock);
vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import { updateMemberManage } from "../../../controllers/store/member.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser" },
  query: {},
  params: { id: "5" },
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
};

describe("store/member.controller · updateMemberManage 状态开关契约（TOTAL-MEMBER-STATUS-CONTRACT-01）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svcMock.getMemberDetail.mockResolvedValue({ id: 5, status: 0 });
  });

  it("合法 status=0：透传给 service（body 携带 status:0）", async () => {
    svcMock.updateMemberManage.mockResolvedValue({ affectedRows: 1 });
    const req = mockReq({ body: { status: 0 } });
    const res = mockRes();

    await updateMemberManage(req as any, res as any, vi.fn());

    expect(svcMock.updateMemberManage).toHaveBeenCalledWith("t1", 5, { status: 0 });
    expect(res.json).toHaveBeenCalled();
  });

  it("合法 status=1：透传给 service（body 携带 status:1）", async () => {
    svcMock.updateMemberManage.mockResolvedValue({ affectedRows: 1 });
    const req = mockReq({ body: { status: 1 } });
    const res = mockRes();

    await updateMemberManage(req as any, res as any, vi.fn());

    expect(svcMock.updateMemberManage).toHaveBeenCalledWith("t1", 5, { status: 1 });
  });

  it.each(['"0"', 2, '"1"', 1.5, true, null])(
    "非法值/非法类型 status=%s ⇒ ZodError（生产映射 400），service 不被调用",
    async (bad) => {
      const req = mockReq({ body: { status: bad as any } });
      const res = mockRes();

      await expect(updateMemberManage(req as any, res as any, vi.fn())).rejects.toBeInstanceOf(ZodError);
      expect(svcMock.updateMemberManage).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    }
  );

  it("零回归：不带 status 的既有编辑请求仍按原样透传", async () => {
    svcMock.updateMemberManage.mockResolvedValue({ affectedRows: 1 });
    const body = { name: "张三", mobile: "13800000000", customerType: "RETAIL" };
    const req = mockReq({ body: { ...body } });
    const res = mockRes();

    await updateMemberManage(req as any, res as any, vi.fn());

    expect(svcMock.updateMemberManage).toHaveBeenCalledWith("t1", 5, body);
    expect(res.json).toHaveBeenCalled();
  });

  it("service 抛 404（会员不存在/跨租户）时原样上抛，不吞错", async () => {
    svcMock.updateMemberManage.mockRejectedValue(
      Object.assign(new Error("会员不存在"), { statusCode: 404 })
    );
    const req = mockReq({ body: { status: 0 } });
    const res = mockRes();

    await expect(updateMemberManage(req as any, res as any, vi.fn())).rejects.toMatchObject({
      statusCode: 404,
      message: "会员不存在",
    });
  });
});
