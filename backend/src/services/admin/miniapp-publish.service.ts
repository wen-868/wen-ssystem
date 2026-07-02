import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function publish(tenantId: string, body: any, platform: string = "WECHAT") {
  // 检查配置完整性
  const config = await queryOneWithTenant<any>(
    "SELECT app_id AS appId, app_name AS appName, status, template_id AS templateId FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  if (!config) throw new Error("未配置小程序信息");
  if (!config.appId) throw new Error("AppID 未配置");
  if (!config.templateId) throw new Error("未选择模板");

  const version = body.version || `1.0.${Date.now()}`;
  const remark = body.remark || "";

  // 更新发布状态
  await queryWithTenant(
    "UPDATE miniapp_config SET status = 'published', app_version = ?, audit_status = 'published', updated_at = NOW() WHERE tenant_id = ? AND platform = ?",
    [version, tenantId, platform],
    tenantId
  );

  // 记录发布日志
  const publishLogId = await queryWithTenant(
    "INSERT INTO miniapp_publish_log (tenant_id, platform, version, remark, status) VALUES (?, ?, ?, ?, 'published')",
    [tenantId, platform, version, remark],
    tenantId
  );

  return {
    success: true,
    version,
    appName: config.appName,
    publishLogId: (publishLogId as any).insertId,
  };
}

export async function rollback(tenantId: string, version: string, platform: string = "WECHAT") {
  await queryWithTenant(
    "UPDATE miniapp_config SET app_version = ?, status = 'published', updated_at = NOW() WHERE tenant_id = ? AND platform = ?",
    [version, tenantId, platform],
    tenantId
  );
  await queryWithTenant(
    "INSERT INTO miniapp_publish_log (tenant_id, platform, version, remark, status) VALUES (?, ?, ?, ?, 'rollback')",
    [tenantId, platform, version, `回滚到版本 ${version}`],
    tenantId
  );
  return { success: true, version };
}

export async function submitAudit(tenantId: string, body: any, platform: string = "WECHAT") {
  await queryWithTenant(
    "UPDATE miniapp_config SET audit_status = 'submitted', audit_reason = ?, updated_at = NOW() WHERE tenant_id = ? AND platform = ?",
    [body.remark || "", tenantId, platform],
    tenantId
  );

  await queryWithTenant(
    "INSERT INTO miniapp_publish_log (tenant_id, platform, version, remark, status) VALUES (?, ?, ?, ?, 'audit_submitted')",
    [tenantId, platform, body.version || `1.0.${Date.now()}`, body.remark || ""],
    tenantId
  );
  return { success: true };
}

export async function getPublishHistory(tenantId: string, page: number, pageSize: number, platform: string = "WECHAT") {
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    queryWithTenant<any>(
      "SELECT id, version, remark, status, created_at AS createdAt FROM miniapp_publish_log WHERE tenant_id = ? AND platform = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [tenantId, platform, pageSize, offset],
      tenantId
    ),
    queryOneWithTenant<any>(
      "SELECT COUNT(*) AS total FROM miniapp_publish_log WHERE tenant_id = ? AND platform = ?",
      [tenantId, platform],
      tenantId
    ),
  ]);
  return { list: rows, total: total?.total || 0, page, pageSize };
}

export async function getCurrentVersion(tenantId: string, platform: string = "WECHAT") {
  const row = await queryOneWithTenant<any>(
    "SELECT app_version AS appVersion, status, audit_status AS auditStatus, updated_at AS updatedAt FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
    [tenantId, platform],
    tenantId
  );
  return row || null;
}