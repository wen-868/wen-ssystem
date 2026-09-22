import { query, queryOne } from "../../shared/db";

/**
 * C2-0 实现段：公告模板清单（t_platform_config，config_key='announcement:templates'）
 *
 * 依据：docs/tasks/cards/R101-C2-0-凌舟裁定.md §二（草案 5 采纳推荐方案：0 DDL，复用 KV 表）。
 * 落库约定（与 R97-01 平台系统设置、S2-02 套餐策略包同表同模式）：
 *   t_platform_config
 *     platform   = 'SAAS'
 *     tenant_id  = 'platform'
 *     config_key = 'announcement:templates'
 *     category   = 'announcement'
 *
 * 口径：
 * - 未配置 ⇒ { records: [], total: 0 }，**不造默认模板**（不得用「催缴/升级引导/维护通知」
 *   等样板内容冒充已配置）；
 * - 整包覆盖保存：落库的是完整 records 数组（先 zod 校验，见 controller），
 *   保存 [] 即清空（等价于未配置），不保留历史副本。
 */

const PLATFORM = "SAAS";
const TENANT_ID = "platform";
const CATEGORY = "announcement";
const CONFIG_KEY = "announcement:templates";

export interface AnnouncementTemplateItem {
  code: string;
  name: string;
  content: string;
}

interface ConfigRow {
  id: number;
  config_value: string | null;
}

function sanitize(records: unknown): AnnouncementTemplateItem[] {
  if (!Array.isArray(records)) return [];
  const list: AnnouncementTemplateItem[] = [];
  for (const entry of records) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { code?: unknown; name?: unknown; content?: unknown };
    const code = String(item.code ?? "").trim();
    const name = String(item.name ?? "").trim();
    const content = typeof item.content === "string" ? item.content : "";
    if (!code || !name) continue;
    list.push({ code, name, content });
  }
  return list;
}

/** 读取公告模板清单；无行 / 脏 JSON ⇒ { records: [], total: 0 } */
export async function getAnnouncementTemplates(): Promise<{
  records: AnnouncementTemplateItem[];
  total: number;
}> {
  const row = await queryOne<ConfigRow>(
    `SELECT id, config_value FROM t_platform_config
      WHERE config_key = ? AND platform = ? LIMIT 1`,
    [CONFIG_KEY, PLATFORM]
  );
  if (!row?.config_value) {
    return { records: [], total: 0 };
  }
  try {
    const records = sanitize(JSON.parse(row.config_value));
    return { records, total: records.length };
  } catch {
    // JSON 解析失败：按「未配置」处理，避免脏数据污染前端模板列表
    return { records: [], total: 0 };
  }
}

/** 整包覆盖保存公告模板清单 */
export async function saveAnnouncementTemplates(
  records: AnnouncementTemplateItem[],
  operator: string
): Promise<{ saved: boolean; total: number; records: AnnouncementTemplateItem[] }> {
  const normalized = sanitize(records);
  const json = JSON.stringify(normalized);

  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM t_platform_config
      WHERE config_key = ? AND platform = ? LIMIT 1`,
    [CONFIG_KEY, PLATFORM]
  );

  if (existing) {
    await query(
      `UPDATE t_platform_config
          SET config_value = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ?`,
      [json, operator, existing.id]
    );
  } else {
    await query(
      `INSERT INTO t_platform_config
         (platform, store_id, enabled, tenant_id, config_key, config_value, category, description, updated_by)
       VALUES (?, NULL, 1, ?, ?, ?, ?, ?, ?)`,
      [PLATFORM, TENANT_ID, CONFIG_KEY, json, CATEGORY, "平台公告模板清单", operator]
    );
  }

  return { saved: true, total: normalized.length, records: normalized };
}
