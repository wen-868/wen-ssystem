import { applyTenantRegister, approveTenantApplication, rejectTenantApplication, listTenantApplications, getTenantApplication } from "../../services/tenant-register.service";
import { ok } from "../../shared/response";

export async function handleApplyTenantRegister(req: any, res: any) {
  const result = await applyTenantRegister(req.body);
  res.json(ok({ applicationId: result.applicationId, message: "申请已提交，等待平台管理员审核" }));
}

export async function handleListApplications(req: any, res: any) {
  const status = req.query.status as string | undefined;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await listTenantApplications({ status, page, pageSize });
  res.json(ok(result));
}

export async function handleGetApplication(req: any, res: any) {
  const application = await getTenantApplication(Number(req.params.id));
  if (!application) {
    res.status(404).json({ success: false, code: "404", message: "申请不存在" });
    return;
  }
  res.json(ok(application));
}

export async function handleApproveApplication(req: any, res: any) {
  const { reviewerId } = req.body;
  const result = await approveTenantApplication(Number(req.params.id), reviewerId || req.user?.id);
  res.json(ok(result));
}

export async function handleRejectApplication(req: any, res: any) {
  const { rejectReason, reviewerId } = req.body;
  if (!rejectReason) {
    res.status(400).json({ success: false, code: "400", message: "驳回原因不能为空" });
    return;
  }
  const result = await rejectTenantApplication(Number(req.params.id), reviewerId || req.user?.id, rejectReason);
  res.json(ok(result));
}
