import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as approvalRecordsService from "../../services/admin/approval-records.service";

export const listInstances = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const businessType = req.query.businessType ? String(req.query.businessType) : null;
  const status = req.query.status ? String(req.query.status) : null;
  const applicantId = req.query.applicantId ? Number(req.query.applicantId) : null;

  const result = await approvalRecordsService.listInstances(page, pageSize, businessType, status, applicantId, tenantId);
  res.json(ok(result));
});

export const submitApproval = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    businessType: z.enum(["PURCHASE_ORDER", "SALE_RETURN", "PRICE_CHANGE", "CREDIT_LIMIT"]),
    businessNo: z.string().min(1),
    businessTitle: z.string().min(1),
    remark: z.string().optional()
  }).parse(req.body);

  const result = await approvalRecordsService.submitApproval(
    body,
    req.user!.id ?? 0,
    req.user!.username ?? "系统用户",
    tenantId
  );
  res.json(ok(result));
});

export const getInstanceDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await approvalRecordsService.getInstanceDetail(req.params.instanceNo, tenantId);
  if (!result) {
    res.status(404).json(fail("审批实例不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const listTasks = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const approverId = req.query.approverId ? Number(req.query.approverId) : req.user!.id;
  const taskStatus = req.query.taskStatus ? String(req.query.taskStatus) : "PENDING";

  const result = await approvalRecordsService.listTasks(page, pageSize, approverId, taskStatus, tenantId);
  res.json(ok(result));
});

export const approveTask = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const taskId = Number(req.params.id);
  const body = z.object({
    comment: z.string().optional()
  }).parse(req.body);

  const result = await approvalRecordsService.approveTask(
    taskId,
    body.comment,
    req.user!.id,
    req.user!.username ?? "系统用户",
    tenantId
  );
  res.json(ok(result));
});

export const rejectTask = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const taskId = Number(req.params.id);
  const body = z.object({
    comment: z.string().min(1, "驳回原因不能为空")
  }).parse(req.body);

  const result = await approvalRecordsService.rejectTask(
    taskId,
    body.comment,
    req.user!.id,
    req.user!.username ?? "系统用户",
    tenantId
  );
  res.json(ok(result));
});

export const listNotifications = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const recipientId = req.query.recipientId ? Number(req.query.recipientId) : req.user!.id;
  const readStatus = req.query.readStatus !== undefined ? Number(req.query.readStatus) : null;

  const result = await approvalRecordsService.listNotifications(page, pageSize, recipientId, readStatus, tenantId);
  res.json(ok(result));
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);

  const result = await approvalRecordsService.markNotificationRead(id, req.user!.id, tenantId);
  res.json(ok(result));
});
