import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/approval-records.service", () => ({
  listInstances: vi.fn(),
  submitApproval: vi.fn(),
  getInstanceDetail: vi.fn(),
  listTasks: vi.fn(),
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as approvalRecordsService from "../../../services/admin/approval-records.service";
import { ok, fail } from "../../../shared/response";
import {
  listInstances,
  submitApproval,
  getInstanceDetail,
  listTasks,
  approveTask,
  rejectTask,
  listNotifications,
  markNotificationRead,
} from "../../../controllers/admin/approval-records.controller";

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

describe("approval-records.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listInstances - 应返回审批实例列表", async () => {
    (approvalRecordsService.listInstances as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listInstances(req as any, res as any);
    expect(approvalRecordsService.listInstances).toHaveBeenCalledWith(1, 20, null, null, null, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listInstances - 应传递筛选参数", async () => {
    (approvalRecordsService.listInstances as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: {
        page: "2",
        pageSize: "10",
        businessType: "PURCHASE_ORDER",
        status: "PENDING",
        applicantId: "5",
      },
    });
    const res = mockRes();
    await listInstances(req as any, res as any);
    expect(approvalRecordsService.listInstances).toHaveBeenCalledWith(
      2,
      10,
      "PURCHASE_ORDER",
      "PENDING",
      5,
      "t1"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("submitApproval - 应提交审批", async () => {
    (approvalRecordsService.submitApproval as any).mockResolvedValue({ instanceNo: "AP001" });
    const req = mockReq({
      body: {
        businessType: "PURCHASE_ORDER",
        businessNo: "PO001",
        businessTitle: "采购订单审批",
        remark: "请审批",
      },
    });
    const res = mockRes();
    await submitApproval(req as any, res as any);
    expect(approvalRecordsService.submitApproval).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("submitApproval - 参数校验失败应抛错", async () => {
    const req = mockReq({ body: { businessType: "INVALID" } });
    const res = mockRes();
    await expect(submitApproval(req as any, res as any)).rejects.toThrow();
    expect(approvalRecordsService.submitApproval).not.toHaveBeenCalled();
  });

  it("getInstanceDetail - 应返回审批实例详情", async () => {
    (approvalRecordsService.getInstanceDetail as any).mockResolvedValue({
      instanceNo: "AP001",
      status: "PENDING",
    });
    const req = mockReq({ params: { instanceNo: "AP001" } });
    const res = mockRes();
    await getInstanceDetail(req as any, res as any);
    expect(approvalRecordsService.getInstanceDetail).toHaveBeenCalledWith("AP001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getInstanceDetail - 实例不存在应返回404", async () => {
    (approvalRecordsService.getInstanceDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { instanceNo: "INVALID" } });
    const res = mockRes();
    await getInstanceDetail(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("审批实例不存在", "404");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("listTasks - 应返回审批任务列表", async () => {
    (approvalRecordsService.listTasks as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listTasks(req as any, res as any);
    expect(approvalRecordsService.listTasks).toHaveBeenCalledWith(1, 20, 1, "PENDING", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listTasks - 应传递筛选参数", async () => {
    (approvalRecordsService.listTasks as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: { page: "2", pageSize: "10", approverId: "3", taskStatus: "APPROVED" },
    });
    const res = mockRes();
    await listTasks(req as any, res as any);
    expect(approvalRecordsService.listTasks).toHaveBeenCalledWith(2, 10, 3, "APPROVED", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("approveTask - 应通过审批任务", async () => {
    (approvalRecordsService.approveTask as any).mockResolvedValue({ taskId: 1, status: "APPROVED" });
    const req = mockReq({
      params: { id: "1" },
      body: { comment: "同意" },
    });
    const res = mockRes();
    await approveTask(req as any, res as any);
    expect(approvalRecordsService.approveTask).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("approveTask - 无备注也应通过", async () => {
    (approvalRecordsService.approveTask as any).mockResolvedValue({ taskId: 1, status: "APPROVED" });
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await approveTask(req as any, res as any);
    expect(approvalRecordsService.approveTask).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("rejectTask - 应驳回审批任务", async () => {
    (approvalRecordsService.rejectTask as any).mockResolvedValue({ taskId: 1, status: "REJECTED" });
    const req = mockReq({
      params: { id: "1" },
      body: { comment: "金额过大，请重新申请" },
    });
    const res = mockRes();
    await rejectTask(req as any, res as any);
    expect(approvalRecordsService.rejectTask).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("rejectTask - 无驳回原因应抛错", async () => {
    const req = mockReq({ params: { id: "1" }, body: { comment: "" } });
    const res = mockRes();
    await expect(rejectTask(req as any, res as any)).rejects.toThrow();
    expect(approvalRecordsService.rejectTask).not.toHaveBeenCalled();
  });

  it("listNotifications - 应返回通知列表", async () => {
    (approvalRecordsService.listNotifications as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listNotifications(req as any, res as any);
    expect(approvalRecordsService.listNotifications).toHaveBeenCalledWith(1, 20, 1, null, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listNotifications - 应传递筛选参数", async () => {
    (approvalRecordsService.listNotifications as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: { page: "2", pageSize: "10", recipientId: "5", readStatus: "0" },
    });
    const res = mockRes();
    await listNotifications(req as any, res as any);
    expect(approvalRecordsService.listNotifications).toHaveBeenCalledWith(2, 10, 5, 0, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("markNotificationRead - 应标记通知已读", async () => {
    (approvalRecordsService.markNotificationRead as any).mockResolvedValue({ id: 1, readStatus: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await markNotificationRead(req as any, res as any);
    expect(approvalRecordsService.markNotificationRead).toHaveBeenCalledWith(1, 1, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
