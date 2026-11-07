/**
 * TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01（P1-2）：租户启停（TENANT_TOGGLE）统一审计入口
 *
 * 缺口：租户启停的成功/业务失败（400/404）/重复提交/RBAC 403 四类结果此前未进
 * 同一审计写入口。本函数是**唯一**写入口：两套 toggle 写路径
 * （活路径 services/platform-tenant.service.ts::toggleTenantStatus +
 *  legacy 路径 services/platform/tenant-admin.service.ts::updatePlatformTenant
 *  的 status 写分支）以及无效状态前置分支，全部经由本函数落
 *  t_platform_audit_log（复用既有 insertPlatformAuditLog 设施，零 DDL：
 *  不新建表、不新建权限码），与 SERVER-SIDE-RBAC 的 PERMISSION_DENIED
 *  留痕同表同设施（独立成文件是为了让单测可对 insertPlatformAuditLog
 *  打桩而不替换真身入口）。
 *
 * 审计字段（卡面 §三.2）：操作者 admin_id/admin_name、动作 TENANT_TOGGLE、
 *   目标租户 id/name、fromStatus→toStatus、结果 SUCCESS/REJECTED/FAILED、
 *   来源 ui/api/system、traceId —— 全部进 detail JSON 与既有列。
 * 安全：内容只有状态与标识，不含密码/token/cookie/完整敏感请求体。
 * 韧性（卡面 §三.5）：审计写失败 **不阻断也不回滚** 已生效的 toggle ——
 *   catch + error 级日志（稳定标记 [tenant-toggle-audit]）+ 进程内可观测计数。
 */
import logger from "../../shared/logger";
import { insertPlatformAuditLog } from "./platform-audit-log.service";

/** 审计结果：成功 / 被拒（RBAC 403 等拒绝面）/ 业务失败（400/404） */
export type TenantToggleAuditResult = "SUCCESS" | "REJECTED" | "FAILED";

/** 来源：ui（管理台界面）/ api（直接 API 调用）/ system（服务内部触发） */
export type TenantToggleSource = "ui" | "api" | "system";

/** toggle 写路径传给统一审计入口的操作者上下文（由控制器从 req 构造） */
export interface TenantToggleAuditContext {
  operatorId: number | string;
  operatorName: string;
  source: TenantToggleSource;
  /** 与 API 响应体 traceId 同值（四方一致：响应/DB/审计行/traceId） */
  traceId: string;
  ip?: string | null;
}

export interface TenantToggleAuditInput extends TenantToggleAuditContext {
  targetTenantId: string;
  targetTenantName?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  result: TenantToggleAuditResult;
  /** 业务失败/被拒原因（如 invalid_status(400) / tenant_not_found(404)） */
  failReason?: string | null;
  /** 重复提交（并发二次 toggle / 目标状态与当前一致）标记 */
  duplicate?: boolean;
}

/** 可观测指标：TENANT_TOGGLE 审计写失败进程内累计（只在本入口自增） */
let tenantToggleAuditWriteFailureCount = 0;

export function getTenantToggleAuditWriteFailureCount(): number {
  return tenantToggleAuditWriteFailureCount;
}

export async function recordTenantToggleAudit(input: TenantToggleAuditInput): Promise<void> {
  try {
    await insertPlatformAuditLog({
      adminId: Number(input.operatorId ?? 0) || 0,
      adminName: String(input.operatorName ?? ""),
      module: "tenant",
      action: "TENANT_TOGGLE",
      auditType: "TENANT_TOGGLE",
      description:
        `租户启停（${input.result}）：${input.targetTenantName ?? input.targetTenantId} ` +
        `${input.fromStatus ?? "?"}→${input.toStatus ?? "?"}`,
      targetType: "tenant",
      targetId: input.targetTenantId,
      ip: input.ip ?? null,
      detail: {
        result: input.result,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        targetTenantId: input.targetTenantId,
        targetTenantName: input.targetTenantName ?? null,
        source: input.source,
        traceId: input.traceId,
        duplicate: input.duplicate === true,
        failReason: input.failReason ?? null,
      },
    });
  } catch (error) {
    tenantToggleAuditWriteFailureCount += 1;
    logger.error(
      `[tenant-toggle-audit] 审计写入失败（不影响业务结果，已计数 ` +
        `count=${tenantToggleAuditWriteFailureCount}）：targetTenantId=${input.targetTenantId} ` +
        `result=${input.result} traceId=${input.traceId} ` +
        `err=${error instanceof Error ? error.message : String(error)}`
    );
  }
}
