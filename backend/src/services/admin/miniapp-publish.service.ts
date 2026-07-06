import fs from "node:fs";
import path from "node:path";
import { queryWithTenant, queryOneWithTenant, query, queryOne } from "../../shared/db.js";

// ========== 占位符 → sys_config key 映射 ==========

const PLACEHOLDER_CONFIG_MAP: Record<string, string> = {
  __API_BASE__: "miniapp.api_base",
  __STORE_ID__: "miniapp.store_id",
  __STORE_NAME__: "miniapp.store_name",
  __PAYMENT_MCH_ID__: "miniapp.payment_mch_id",
  __PAYMENT_KEY__: "miniapp.payment_key",
  __PAYMENT_NOTIFY_URL__: "miniapp.payment_notify_url",
  __PAYMENT_ENABLE__: "miniapp.payment_enable",
  __SYNC_WS_URL__: "miniapp.sync_ws_url",
  __SYNC_POLL_INTERVAL__: "miniapp.sync_poll_interval",
  __SYNC_ENABLED__: "miniapp.sync_enabled",
  __PAGE_HOME_MODE__: "miniapp.page_home_mode",
  __PAGE_SHOW_SEARCH__: "miniapp.page_show_search",
  __PAGE_SHOW_CART__: "miniapp.page_show_cart",
  __PAGE_SHOW_PRICE__: "miniapp.page_show_price",
  __PAGE_SHOW_WHOLESALE_PRICE__: "miniapp.page_show_wholesale_price",
  __PAGE_SHOW_STOCK__: "miniapp.page_show_stock",
  __PAGE_SHOW_CATEGORY__: "miniapp.page_show_category",
  __PAGE_ORDER_BUTTON_TEXT__: "miniapp.page_order_button_text",
  __THEME_NAME__: "miniapp.theme_name",
  __BRAND_NAME__: "miniapp.brand_name",
  __BRAND_SLOGAN__: "miniapp.brand_slogan",
  __COLOR_PRIMARY__: "miniapp.color_primary",
  __NAV_BG_COLOR__: "miniapp.nav_bg_color",
  __NAV_TEXT_COLOR__: "miniapp.nav_text_color",
};

const ALL_PLACEHOLDERS = Object.keys(PLACEHOLDER_CONFIG_MAP);

const DEFAULT_VALUES: Record<string, string> = {
  __API_BASE__: "https://api.onepan.cn/api",
  __STORE_ID__: "1",
  __STORE_NAME__: "智享商城",
  __PAYMENT_MCH_ID__: "",
  __PAYMENT_KEY__: "",
  __PAYMENT_NOTIFY_URL__: "",
  __PAYMENT_ENABLE__: "true",
  __SYNC_WS_URL__: "wss://ws.onepan.cn/sync",
  __SYNC_POLL_INTERVAL__: "10000",
  __SYNC_ENABLED__: "true",
  __PAGE_HOME_MODE__: "standard",
  __PAGE_SHOW_SEARCH__: "true",
  __PAGE_SHOW_CART__: "true",
  __PAGE_SHOW_PRICE__: "true",
  __PAGE_SHOW_WHOLESALE_PRICE__: "false",
  __PAGE_SHOW_STOCK__: "true",
  __PAGE_SHOW_CATEGORY__: "true",
  __PAGE_ORDER_BUTTON_TEXT__: "加入下单",
  __THEME_NAME__: "liquor-blue",
  __BRAND_NAME__: "智享商城",
  __BRAND_SLOGAN__: "正品酒水，极速配送",
  __COLOR_PRIMARY__: "#1677FF",
  __NAV_BG_COLOR__: "#1677FF",
  __NAV_TEXT_COLOR__: "#ffffff",
};

// ========== 模板占位符替换 ==========

export async function getPublishConfigs(tenantId: string): Promise<Record<string, string>> {
  const configKeys = Object.values(PLACEHOLDER_CONFIG_MAP);
  const placeholders = Object.keys(PLACEHOLDER_CONFIG_MAP);
  const result: Record<string, string> = {};

  const records = await query<any>(
    `SELECT config_key AS configKey, config_value AS configValue
     FROM t_sys_config
     WHERE config_key IN (${configKeys.map(() => "?").join(",")})
       AND tenant_id = ?`,
    [...configKeys, tenantId]
  );

  const configMap: Record<string, string> = {};
  for (const r of records) {
    configMap[r.configKey] = r.configValue;
  }

  for (const placeholder of placeholders) {
    const configKey = PLACEHOLDER_CONFIG_MAP[placeholder];
    result[placeholder] = configMap[configKey] ?? DEFAULT_VALUES[placeholder] ?? "";
  }

  return result;
}

export async function renderTemplate(tenantId: string): Promise<string> {
  const templatePath = path.resolve("miniapp/config.template.js");
  let template = fs.readFileSync(templatePath, "utf-8");

  const configs = await getPublishConfigs(tenantId);

  for (const placeholder of ALL_PLACEHOLDERS) {
    const value = configs[placeholder] ?? DEFAULT_VALUES[placeholder] ?? "";
    template = template.replaceAll(placeholder, value);
  }

  return template;
}

export async function validatePlaceholders(tenantId: string): Promise<{
  valid: boolean;
  missing: string[];
  extra: string[];
}> {
  const configs = await getPublishConfigs(tenantId);
  const missing: string[] = [];
  const extra: string[] = [];

  for (const placeholder of ALL_PLACEHOLDERS) {
    if (!configs[placeholder] && !DEFAULT_VALUES[placeholder]) {
      missing.push(placeholder);
    }
  }

  const configKeys = Object.values(PLACEHOLDER_CONFIG_MAP);
  const records = await query<any>(
    `SELECT config_key AS configKey
     FROM t_sys_config
     WHERE config_key NOT IN (${configKeys.map(() => "?").join(",")})
       AND config_key LIKE 'miniapp.%'
       AND tenant_id = ?`,
    [...configKeys, tenantId]
  );
  extra.push(...records.map((r: any) => r.configKey));

  return { valid: missing.length === 0 && extra.length === 0, missing, extra };
}

export function getTemplatePlaceholders(): string[] {
  return [...ALL_PLACEHOLDERS];
}

// ========== 发布/回滚/审核 ==========

export async function publish(tenantId: string, body: any, platform: string = "WECHAT") {
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

  // 渲染模板：替换占位符 → 写入 miniapp/config.js
  const rendered = await renderTemplate(tenantId);
  const outputPath = path.resolve("miniapp/config.js");
  fs.writeFileSync(outputPath, rendered, "utf-8");

  await queryWithTenant(
    "UPDATE miniapp_config SET status = 'published', app_version = ?, audit_status = 'published', updated_at = NOW() WHERE tenant_id = ? AND platform = ?",
    [version, tenantId, platform],
    tenantId
  );

  const publishLogId = await queryWithTenant(
    "INSERT INTO miniapp_publish_log (tenant_id, platform, version, remark, status, action, result) VALUES (?, ?, ?, ?, 'published', 'publish', 'success')",
    [tenantId, platform, version, remark],
    tenantId
  );

  return {
    success: true,
    version,
    appName: config.appName,
    publishLogId: (publishLogId as unknown as Record<string, unknown>).insertId,
  };
}

export async function rollback(tenantId: string, version: string, platform: string = "WECHAT") {
  await queryWithTenant(
    "UPDATE miniapp_config SET app_version = ?, status = 'published', updated_at = NOW() WHERE tenant_id = ? AND platform = ?",
    [version, tenantId, platform],
    tenantId
  );
  await queryWithTenant(
    "INSERT INTO miniapp_publish_log (tenant_id, platform, version, remark, status, action, result) VALUES (?, ?, ?, ?, 'rollback', 'rollback', 'success')",
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
    "INSERT INTO miniapp_publish_log (tenant_id, platform, version, remark, status, action, result) VALUES (?, ?, ?, ?, 'audit_submitted', 'audit_submit', 'success')",
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