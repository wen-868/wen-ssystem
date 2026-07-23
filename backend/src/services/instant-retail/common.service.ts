import { queryOne, queryOneWithTenant } from "../../shared/db";
import type { PlatformType, PlatformCredentials } from "./types";

/** 平台配置行 */
interface PlatformConfigRow {
  id: number;
  tenant_id: string;
  store_id: number;
  platform: string;
  app_key: string;
  app_secret: string;
  merchant_id: string;
  access_token: string;
  refresh_token: string;
  token_expire_at: string;
  enabled: number;
  config_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function maskConfig(config: any) {
  if (!config) return null;
  return {
    ...config,
    appSecret: config.appSecret ? "***" : undefined,
    accessToken: config.accessToken ? "***" : undefined,
    refreshToken: config.refreshToken ? "***" : undefined
  };
}

export async function getPlatformConfig(
  platform: PlatformType,
  storeId?: string | number,
  tenantId?: string
): Promise<PlatformCredentials | null> {
  const conditions: string[] = ["platform = ?"];
  const params: unknown[] = [platform];
  if (storeId) {
    conditions.push("store_id = ?");
    params.push(String(storeId));
  }
  if (tenantId) {
    conditions.push("tenant_id = ?");
    params.push(tenantId);
  }
  const sql = `SELECT * FROM t_platform_config WHERE ${conditions.join(" AND ")} LIMIT 1`;
  const row = await queryOne<PlatformConfigRow>(sql, params);
  if (!row) return null;
  return {
    platform: row.platform as PlatformType,
    storeId: String(row.store_id ?? ""),
    appKey: String(row.app_key ?? ""),
    appSecret: String(row.app_secret ?? ""),
    merchantId: String(row.merchant_id ?? ""),
    accessToken: String(row.access_token ?? ""),
    refreshToken: String(row.refresh_token ?? ""),
    tokenExpireAt: row.token_expire_at ? new Date(row.token_expire_at) : new Date(),
    enabled: Boolean(row.enabled ?? 1),
    configJson: row.config_json ? (typeof row.config_json === "string" ? JSON.parse(row.config_json) : row.config_json) : null
  };
}

export async function getPlatformConfigWithTenant(
  platform: PlatformType,
  storeId: string | number | undefined,
  tenantId: string
): Promise<PlatformCredentials | null> {
  const conditions: string[] = ["platform = ?"];
  const params: unknown[] = [platform];
  if (storeId) {
    conditions.push("store_id = ?");
    params.push(String(storeId));
  }
  const where = conditions.join(" AND ");
  const sql = `SELECT * FROM t_platform_config WHERE ${where} LIMIT 1`;
  const row = await queryOneWithTenant<PlatformConfigRow>(sql, params, tenantId);
  if (!row) return null;
  return {
    platform: row.platform as PlatformType,
    storeId: String(row.store_id ?? ""),
    appKey: String(row.app_key ?? ""),
    appSecret: String(row.app_secret ?? ""),
    merchantId: String(row.merchant_id ?? ""),
    accessToken: String(row.access_token ?? ""),
    refreshToken: String(row.refresh_token ?? ""),
    tokenExpireAt: row.token_expire_at ? new Date(row.token_expire_at) : new Date(),
    enabled: Boolean(row.enabled ?? 1),
    configJson: row.config_json ? (typeof row.config_json === "string" ? JSON.parse(row.config_json) : row.config_json) : null
  };
}
