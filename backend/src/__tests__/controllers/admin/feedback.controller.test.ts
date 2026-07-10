/**
 * 管理端意见反馈 controller 单元测试
 * 被测文件：src/controllers/admin/feedback.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  insertFeedback: vi.fn(),
  listFeedbacks: vi.fn(),
  updateFeedbackStatus: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/feedback.service.js", () => ({
  insertFeedback: mocks.insertFeedback,
  listFeedbacks: mocks.listFeedbacks,
  updateFeedbackStatus: mocks.updateFeedbackStatus,
}));

import {
  submitFeedback,
  getFeedbacks,
  updateFeedback,
} from "../../../controllers/admin/feedback.controller.js";

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

describe("admin feedback.controller", () => {
  it("submitFeedback 成功提交反馈并返回 id", async () => {
    mocks.insertFeedback.mockResolvedValue(100);
    const req = mockReq({
      body: { type: "BUG", title: "标题", content: "内容", contact: "13800000000" },
    });
    const res = mockRes();
    await submitFeedback(req, res);
    expect(mocks.insertFeedback).toHaveBeenCalledWith(expect.objectContaining({
      type: "BUG", title: "标题", content: "内容", contact: "13800000000",
      user_id: 1, tenant_id: "t1",
    }));
    expect(mocks.ok).toHaveBeenCalledWith({ id: 100 });
  });

  it("submitFeedback 缺少 tenantId 时使用 default", async () => {
    mocks.insertFeedback.mockResolvedValue(101);
    const req = mockReq({ tenantId: undefined, body: { type: "FEATURE", title: "t", content: "c" } });
    const res = mockRes();
    await submitFeedback(req, res);
    expect(mocks.insertFeedback).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: "default",
    }));
  });

  it("submitFeedback 调用 res.json 返回 ok 包装结果", async () => {
    mocks.insertFeedback.mockResolvedValue(102);
    const req = mockReq({ body: { type: "IMPROVEMENT", title: "t", content: "c" } });
    const res = mockRes();
    await submitFeedback(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 102 } });
  });

  it("getFeedbacks 默认分页参数", async () => {
    mocks.listFeedbacks.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getFeedbacks(req, res);
    expect(mocks.listFeedbacks).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, tenant_id: "t1",
    }));
  });

  it("getFeedbacks 传入筛选条件并限制 pageSize 上限 100", async () => {
    mocks.listFeedbacks.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { type: "BUG", status: "PENDING", keyword: "kw", page: "2", pageSize: "200" } });
    const res = mockRes();
    await getFeedbacks(req, res);
    expect(mocks.listFeedbacks).toHaveBeenCalledWith(expect.objectContaining({
      type: "BUG", status: "PENDING", keyword: "kw", page: 2, pageSize: 100,
    }));
  });

  it("getFeedbacks 缺少 tenantId 时使用 default", async () => {
    mocks.listFeedbacks.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ tenantId: undefined });
    const res = mockRes();
    await getFeedbacks(req, res);
    expect(mocks.listFeedbacks).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: "default",
    }));
  });

  it("updateFeedback 成功更新状态", async () => {
    mocks.updateFeedbackStatus.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "5" }, body: { status: "RESOLVED", reply: "已修复" } });
    const res = mockRes();
    await updateFeedback(req, res);
    expect(mocks.updateFeedbackStatus).toHaveBeenCalledWith(5, "RESOLVED", "已修复", "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ result: "更新成功" });
  });

  it("updateFeedback 不传 reply 时 reply 为 undefined", async () => {
    mocks.updateFeedbackStatus.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "6" }, body: { status: "REJECTED" } });
    const res = mockRes();
    await updateFeedback(req, res);
    expect(mocks.updateFeedbackStatus).toHaveBeenCalledWith(6, "REJECTED", undefined, "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { result: "更新成功" } });
  });

  it("getFeedbacks 调用 res.json 返回 ok 包装结果", async () => {
    mocks.listFeedbacks.mockResolvedValue({ list: [{ id: 1 }], total: 1 });
    const req = mockReq();
    const res = mockRes();
    await getFeedbacks(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { list: [{ id: 1 }], total: 1 } });
  });
});
