import { queryOneWithTenant, executeWithTenant, queryWithTenant } from "../../shared/db";

/**
 * 收银硬件配置（租户级）
 *
 * 客显/电子秤为终端本地设备，串口参数存浏览器 localStorage、经本地打印助手
 * 驱动；云喇叭/云闪付等服务端通道配置存本表。收款盒子沿用 t_payment_config
 * 的 box_config 字段（见 payment-box.service）。
 */

export const HARDWARE_CATEGORIES = [
  "customer_display",
  "scale",
  "cloud_speaker",
  "unionpay",
] as const;

export type HardwareCategory = (typeof HARDWARE_CATEGORIES)[number];

/** 敏感字段名：返回前端前脱敏 */
const SECRET_KEYS = new Set(["secret", "apiKey", "apiSecret", "token", "password", "privateKey", "activationCode"]);

function maskValue(value: unknown, key: string): unknown {
  if (typeof value === "string" && value && SECRET_KEYS.has(key)) {
    return value.length <= 8 ? "****" : `${value.slice(0, 4)}****${value.slice(-4)}`;
  }
  if (value && typeof value === "object") {
    return maskDeep(value as Record<string, unknown>);
  }
  return value;
}

function maskDeep(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = maskValue(v, k);
  return out;
}

export class HardwareConfigService {
  /** 读取单个分类配置 */
  static async getConfig(tenantId: string, category: string) {
    const row = await queryOneWithTenant(
      `SELECT category, enabled, config_json FROM t_hardware_config WHERE tenant_id = ? AND category = ?`,
      [tenantId, category],
      tenantId
    );
    if (!row) return { category, enabled: false, config: {} };
    let config: Record<string, unknown> = {};
    try {
      config = row.config_json ? JSON.parse(row.config_json) : {};
    } catch { /* 忽略解析错误 */ }
    return { category, enabled: Number(row.enabled) === 1, config: maskDeep(config) };
  }

  /** 保存配置（upsert） */
  static async saveConfig(tenantId: string, category: string, config: Record<string, unknown>, enabled: boolean) {
    const json = JSON.stringify(config || {});
    const existing = await queryOneWithTenant(
      `SELECT id FROM t_hardware_config WHERE tenant_id = ? AND category = ?`,
      [tenantId, category],
      tenantId
    );
    if (existing) {
      await executeWithTenant(
        `UPDATE t_hardware_config SET config_json = ?, enabled = ?, updated_at = NOW() WHERE id = ?`,
        [json, enabled ? 1 : 0, existing.id],
        tenantId
      );
    } else {
      await executeWithTenant(
        `INSERT INTO t_hardware_config (tenant_id, category, config_json, enabled) VALUES (?, ?, ?, ?)`,
        [tenantId, category, json, enabled ? 1 : 0],
        tenantId
      );
    }
    return { success: true, category, enabled };
  }

  /** 全部硬件配置（脱敏） */
  static async listConfigs(tenantId: string) {
    const rows = await queryWithTenant(
      `SELECT category, enabled, config_json FROM t_hardware_config WHERE tenant_id = ?`,
      [tenantId],
      tenantId
    );
    return rows.map((row: Record<string, unknown>) => {
      let config: Record<string, unknown> = {};
      try {
        config = row.config_json ? JSON.parse(String(row.config_json)) : {};
      } catch { /* 忽略 */ }
      return {
        category: row.category,
        enabled: Number(row.enabled) === 1,
        config: maskDeep(config),
      };
    });
  }

  /** 读取完整配置（服务端内部用，含敏感字段） */
  static async getRawConfig(tenantId: string, category: string): Promise<{ enabled: boolean; config: Record<string, unknown> }> {
    const row = await queryOneWithTenant(
      `SELECT enabled, config_json FROM t_hardware_config WHERE tenant_id = ? AND category = ?`,
      [tenantId, category],
      tenantId
    );
    if (!row) return { enabled: false, config: {} };
    let config: Record<string, unknown> = {};
    try {
      config = row.config_json ? JSON.parse(row.config_json) : {};
    } catch { /* 忽略 */ }
    return { enabled: Number(row.enabled) === 1, config };
  }
}
