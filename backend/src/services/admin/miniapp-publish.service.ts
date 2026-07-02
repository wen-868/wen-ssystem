import fs from "node:fs";
import path from "node:path";
import { query, queryOne } from "../../shared/db.js";

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

// 所有占位符列表（与 config.template.js 一致）
const ALL_PLACEHOLDERS = Object.keys(PLACEHOLDER_CONFIG_MAP);

// ========== 默认值（本地开发兜底） ==========

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

// ========== 核心方法 ==========

/**
 * 从 sys_config 表读取所有小程序发布配置
 */
export async function getPublishConfigs(tenantId: string): Promise<Record<string, string>> {
  const configKeys = Object.values(PLACEHOLDER_CONFIG_MAP);
  const placeholders = Object.keys(PLACEHOLDER_CONFIG_MAP);
  const result: Record<string, string> = {};

  // 批量查询 sys_config
  const records = await query<any>(
    `SELECT config_key AS configKey, config_value AS configValue
     FROM sys_config
     WHERE config_key IN (${configKeys.map(() => "?").join(",")})
       AND tenant_id = ?`,
    [...configKeys, tenantId]
  );

  const configMap: Record<string, string> = {};
  for (const r of records) {
    configMap[r.configKey] = r.configValue;
  }

  // 拼接结果：优先 DB 值，其次默认值
  for (const placeholder of placeholders) {
    const configKey = PLACEHOLDER_CONFIG_MAP[placeholder];
    result[placeholder] = configMap[configKey] ?? DEFAULT_VALUES[placeholder] ?? "";
  }

  return result;
}

/**
 * 读取并使用 DB 配置替换模板文件中的所有占位符
 * @returns 替换后的文件内容
 */
export async function renderTemplate(tenantId: string): Promise<string> {
  const templatePath = path.resolve("miniapp/config.template.js");
  let template = fs.readFileSync(templatePath, "utf-8");

  const configs = await getPublishConfigs(tenantId);

  for (const placeholder of ALL_PLACEHOLDERS) {
    const value = configs[placeholder] ?? DEFAULT_VALUES[placeholder] ?? "";
    // 将占位符替换为实际值（注意：模板中的自引用判断逻辑会导致替换后自动生效）
    template = template.replaceAll(placeholder, value);
  }

  return template;
}

/**
 * 验证占位符是否全部可替换
 * @returns { valid: boolean, missing: string[], extra: string[] }
 */
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

  // 检查 DB 中是否存在模板中未定义的占位符
  const configKeys = Object.values(PLACEHOLDER_CONFIG_MAP);
  const records = await query<any>(
    `SELECT config_key AS configKey
     FROM sys_config
     WHERE config_key NOT IN (${configKeys.map(() => "?").join(",")})
       AND config_key LIKE 'miniapp.%'
       AND tenant_id = ?`,
    [...configKeys, tenantId]
  );
  extra.push(...records.map((r: any) => r.configKey));

  return { valid: missing.length === 0 && extra.length === 0, missing, extra };
}

/**
 * 获取当前模板中定义的占位符列表（供前端展示）
 */
export function getTemplatePlaceholders(): string[] {
  return [...ALL_PLACEHOLDERS];
}