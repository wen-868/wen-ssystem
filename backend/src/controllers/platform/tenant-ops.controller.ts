import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import {
  QUOTA_EXPAND_FIELDS,
  expandTenantQuota,
  proxyLogin,
  resetTenantUserPassword,
  type OperatorInfo,
} from "../../services/platform/tenant-ops.service";

/**
 * C1-2 A4 / A5：租户写操作
 * - 参数缺失在本层挡（400 且不调 service）；数值/幅度/有效期在 service 层校验（400）
 * - 两条写操作均写 `t_platform_audit_log` 留痕（见 service）
 */

function operatorOf(req: any): OperatorInfo {
  const user = req.user ?? {};
  return {
    id: Number(user.id ?? 0),
    name: String(user.username || user.realName || "platform_admin"),
  };
}

function clientIp(req: any): string | null {
  const raw = req.ip ?? req.headers?.["x-forwarded-for"] ?? null;
  return raw ? String(raw).split(",")[0].trim().slice(0, 45) : null;
}

/** POST /api/platform/tenants/:id/proxy-login - 代登录（写操作 + 审计留痕） */
export const proxyLoginCtrl = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  if (!id) {
    return next(new AppError("租户 ID 不能为空", 400));
  }
  const body = req.body ?? {};
  if (typeof body.reason !== "string" || body.reason.trim().length < 2) {
    return next(new AppError("代登录事由必填（2-200 字）", 400));
  }

  const result = await proxyLogin(
    String(id),
    {
      reason: body.reason,
      username: body.username == null ? undefined : String(body.username),
    },
    operatorOf(req),
    clientIp(req)
  );
  res.json(ok(result));
});

/** POST /api/platform/tenants/:id/quota-expand - 临时扩容（写操作 + 审计留痕） */
export const expandTenantQuotaCtrl = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  if (!id) {
    return next(new AppError("租户 ID 不能为空", 400));
  }
  const body = req.body ?? {};
  if (body.field == null || body.field === "") {
    return next(new AppError(`扩容维度必填（可选：${QUOTA_EXPAND_FIELDS.join(" / ")}）`, 400));
  }
  if (body.amount == null || body.amount === "") {
    return next(new AppError("扩容幅度必填", 400));
  }
  if (body.days == null || body.days === "") {
    return next(new AppError("有效期（天）必填", 400));
  }

  const result = await expandTenantQuota(
    String(id),
    {
      field: String(body.field),
      amount: Number(body.amount),
      days: Number(body.days),
      reason: body.reason == null ? undefined : String(body.reason),
    },
    operatorOf(req),
    clientIp(req)
  );
  res.json(ok(result));
});

/**
 * POST /api/platform/tenants/:tenantId/users/:userId/reset-password - 代重置租户账号口令
 * （S3-172，写操作 + 审计留痕；要求「忘记密码怎么找回」的紧急完善）
 *
 * 入参校验在本层挡（400 且不调 service）；「userId 是否确属该 tenantId」由 service
 * 用 `WHERE id = ? AND tenant_id = ?` 判定（不命中 ⇒ 404，不允许跨租户重置）。
 */
export const resetTenantUserPasswordCtrl = asyncHandler(async (req, res, next) => {
  const tenantId = req.params.tenantId;
  if (!tenantId) {
    return next(new AppError("租户 ID 不能为空", 400));
  }

  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError("账号 ID 不合法", 400));
  }

  const result = await resetTenantUserPassword(
    String(tenantId),
    userId,
    operatorOf(req),
    clientIp(req)
  );
  res.json(ok(result));
});
