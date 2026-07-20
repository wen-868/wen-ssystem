import { queryWithTenant, queryOneWithTenant, executeWithTenant } from "../../shared/db";

export class MiniappConfigService {
  // 所有平台配置列表
  static async listConfigs(tenantId: string) {
    const rows = await queryWithTenant(
      `SELECT * FROM t_miniapp_config WHERE tenant_id = ? ORDER BY platform`, [tenantId], tenantId
    );
    // 脱敏 app_secret
    return rows.map((r: any) => ({ ...r, app_secret: r.app_secret ? '***' : '' }));
  }

  // 获取指定平台配置
  static async getConfig(tenantId: string, platform: string) {
    const row = await queryOneWithTenant(
      `SELECT * FROM t_miniapp_config WHERE platform = ? AND tenant_id = ?`, [platform, tenantId], tenantId
    );
    if (!row) return null;
    row.app_secret = row.app_secret ? '***' : '';
    return row;
  }

  // 保存指定平台配置
  static async saveConfig(tenantId: string, platform: string, data: any) {
    const existing = await queryOneWithTenant(
      `SELECT id FROM t_miniapp_config WHERE platform = ? AND tenant_id = ?`, [platform, tenantId], tenantId
    );
    if (existing) {
      await executeWithTenant(
        `UPDATE t_miniapp_config SET app_id=?, app_secret=?, app_name=?, app_version=?, enabled=?, updated_at=NOW() WHERE platform=? AND tenant_id=?`,
        [data.appId||'', data.appSecret||'', data.appName||'', data.appVersion||'', data.enabled?1:0, platform, tenantId], tenantId
      );
    } else {
      await executeWithTenant(
        `INSERT INTO t_miniapp_config (platform, app_id, app_secret, app_name, app_version, enabled, tenant_id) VALUES (?,?,?,?,?,?,?)`,
        [platform, data.appId||'', data.appSecret||'', data.appName||'', data.appVersion||'', data.enabled?1:0, tenantId], tenantId
      );
    }
    return { success: true };
  }

  // 模板列表
  static async listTemplates(tenantId: string) {
    return await queryWithTenant(
      `SELECT * FROM t_miniapp_template ORDER BY sort_order`, [], tenantId
    );
  }

  // 模板详情
  static async getTemplate(tenantId: string, id: number) {
    return await queryOneWithTenant(
      `SELECT * FROM t_miniapp_template WHERE id = ?`, [id], tenantId
    );
  }

  // 发布历史
  static async listPublishLogs(tenantId: string, page: number = 1, pageSize: number = 20) {
    const offset = (page - 1) * pageSize;
    const rows = await queryWithTenant(
      `SELECT * FROM t_miniapp_publish_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [tenantId, pageSize, offset], tenantId
    );
    const total = await queryOneWithTenant(
      `SELECT COUNT(*) as total FROM t_miniapp_publish_log WHERE tenant_id = ?`, [tenantId], tenantId
    );
    return { list: rows, total: (total as unknown as Record<string, unknown>)?.total || 0, page, pageSize };
  }

  // 一键发布
  static async publish(tenantId: string, data: { platform: string; templateId: number; version: string; operator: string }) {
    const result = await queryWithTenant(
      `INSERT INTO t_miniapp_publish_log (platform, template_id, version, operator, status, result, tenant_id) VALUES (?,?,?,?,?,?,?)`,
      [data.platform, data.templateId, data.version, data.operator, 'success', '发布成功', tenantId], tenantId
    );
    return { id: (result as unknown as Record<string, unknown>).insertId, status: 'success', message: '发布成功' };
  }
}