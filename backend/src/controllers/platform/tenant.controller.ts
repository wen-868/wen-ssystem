import { v4 as uuid } from "uuid";
import { ok, fail } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import {
  listTenants,
  getTenantById,
  checkTenantNameExists,
  createTenant,
  updateTenant,
  toggleTenantStatus,
  type TenantStatus,
} from "../../services/platform-tenant.service";
// TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01：唯一审计写入口（service 层统一入口，控制器只传上下文）
// TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01-F1：来源归一上提为单一真源 normalizeTenantToggleSource
import {
  recordTenantToggleAudit,
  normalizeTenantToggleSource,
} from "../../services/admin/platform-audit-tenant-toggle.service";
import type {
  TenantToggleAuditContext,
  TenantToggleSource,
} from "../../services/admin/platform-audit-tenant-toggle.service";

/** 租户列表 */
export async function listPlatformTenants(req: any, res: any) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword as string | undefined;
  const result = await listTenants(page, pageSize, keyword);
  res.json(ok(result));
}

/** 租户详情 */
export async function getPlatformTenantById(req: any, res: any) {
  const tenant = await getTenantById(String(req.params.id));
  if (!tenant) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(tenant));
}

/** 创建租户 */
export async function createPlatformTenant(req: any, res: any) {
  const { tenantName, contactName, contactMobile, contactEmail, adminUsername, adminPassword, expireAt } = req.body;

  if (!tenantName || !contactName || !contactMobile || !adminUsername || !adminPassword) {
    res.status(400).json(fail("缺少必填字段", "400"));
    return;
  }

  const exists = await checkTenantNameExists(tenantName);
  if (exists) {
    res.status(400).json(fail("租户名称已存在", "400"));
    return;
  }

  const tenantId = await createTenant({
    tenantName, contactName, contactMobile, contactEmail, adminUsername, adminPassword, expireAt
  });

  res.json(ok({ id: tenantId }));
}

/** 更新租户 */
export async function updatePlatformTenant(req: any, res: any) {
  await updateTenant(String(req.params.id), req.body);
  res.json(ok({ success: true }));
}

/**
 * TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01：来源归一（ui/api/system）。
 * TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01-F1：实现上提至
 * services/admin/platform-audit-tenant-toggle.service::normalizeTenantToggleSource
 * （单一真源，守卫 403 分支与 legacy 控制器共用），此处仅保留薄转发，语义逐字不变。
 */
function normalizeToggleSource(req: any): TenantToggleSource {
  return normalizeTenantToggleSource(req);
}

/**
 * 启用/禁用租户（POST /api/platform/tenants/:id/toggle）
 *
 * TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01：四类结果统一审计闭环 ——
 *   · 成功 / 无效状态 400 / 未知租户 404：审计行由 service 层统一入口
 *     （toggleTenantStatus → recordTenantToggleAudit）写入，控制器只注入
 *     操作者/来源/traceId 上下文，不在控制器散写审计 SQL；
 *   · RBAC 403：中央守卫 PERMISSION_DENIED 留痕（detail.result=REJECTED，
 *     同一设施同一表）承担；
 *   · traceId 由控制器生成并贯穿「响应体 ↔ 审计行」（四方一致）；
 *     响应契约不变：成功 { code:"0", data:{success,status}, traceId }、
 *     400/404 { code, msg, traceId }，文案与旧实现逐字一致。
 */
export async function togglePlatformTenantStatus(req: any, res: any) {
  const traceId = uuid();
  const ctx: TenantToggleAuditContext = {
    operatorId: req.user?.id ?? 0,
    operatorName: String(req.user?.username ?? req.user?.realName ?? ""),
    source: normalizeToggleSource(req),
    traceId,
    ip: typeof req.ip === "string" ? req.ip : null,
  };
  // 前置参数校验与旧实现逐字同义（400「无效的状态值」，且不触 service/库）；
  // 该 FAILED 结果同样走唯一审计写入口（recordTenantToggleAudit）留痕，非散写 SQL。
  const { status } = req.body ?? {};
  if (!["ACTIVE", "DISABLED"].includes(status)) {
    await recordTenantToggleAudit({
      operatorId: ctx.operatorId,
      operatorName: ctx.operatorName,
      targetTenantId: String(req.params.id),
      fromStatus: null,
      toStatus: String(status ?? ""),
      result: "FAILED",
      failReason: "invalid_status(400)",
      source: ctx.source,
      traceId,
      ip: ctx.ip,
    });
    res.status(400).json({ ...fail("无效的状态值", "400"), traceId });
    return;
  }
  try {
    // 业务失败（未知租户 404，含 FAILED 审计行）由 service 统一判定与留痕
    const applied = await toggleTenantStatus(String(req.params.id), status as TenantStatus, ctx);
    res.json({ ...ok({ success: true, status: applied }), traceId });
  } catch (error) {
    if (error instanceof AppError) {
      // 业务失败审计行已由 service 写入；响应带同一 traceId（四方一致）
      res.status(error.statusCode).json({ ...fail(error.message, String(error.statusCode)), traceId });
      return;
    }
    throw error;
  }
}
