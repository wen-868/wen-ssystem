import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as approvalRecordsService from "../../services/admin/approval-records.service";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 从查询参数中提取分页参数（默认 page=1, pageSize=20） */
function getPagination(req: any) {
  return {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  };
}

/** 从请求中提取操作人信息 */
function getOperator(req: any) {
  return {
    id: req.user!.id ?? 0,
    name: req.user!.username ?? "系统用户",
  };
}

/** 从查询参数中提取可选字符串（有值返回 string，无值返回 null） */
function getQueryStringOrNull(req: any, key: string): string | null {
  return req.query[key] ? String(req.query[key]) : null;
}

/** 从查询参数中提取可选数字（有值返回 number，无值返回 null） */
function getQueryNumberOrNull(req: any, key: string): number | null {
  return req.query[key] ? Number(req.query[key]) : null;
}

export const listInstances = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const businessType = getQueryStringOrNull(req, "businessType");
  const status = getQueryStringOrNull(req, "status");
  const applicantId = getQueryNumberOrNull(req, "applicantId");

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

  const { id, name } = getOperator(req);
  const result = await approvalRecordsService.submitApproval(
    body,
    id,
    name,
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
  const { page, pageSize } = getPagination(req);
  const approverId = getQueryNumberOrNull(req, "approverId") ?? req.user!.id;
  const taskStatus = getQueryStringOrNull(req, "taskStatus") ?? "PENDING";

  const result = await approvalRecordsService.listTasks(page, pageSize, approverId, taskStatus, tenantId);
  res.json(ok(result));
});

export const approveTask = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const taskId = Number(req.params.id);
  const body = z.object({
    comment: z.string().optional()
  }).parse(req.body);

  const { name } = getOperator(req);
  const result = await approvalRecordsService.approveTask(
    taskId,
    body.comment,
    req.user!.id,
    name,
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

  const { name } = getOperator(req);
  const result = await approvalRecordsService.rejectTask(
    taskId,
    body.comment,
    req.user!.id,
    name,
    tenantId
  );
  res.json(ok(result));
});

export const listNotifications = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const recipientId = getQueryNumberOrNull(req, "recipientId") ?? req.user!.id;
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
