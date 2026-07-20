import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

function safeJsonParse(val: any, fallback: any) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

export async function listTemplates(tenantId: string) {
  const rows = await queryWithTenant<any>(
    `SELECT id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order, created_at AS createdAt, updated_at AS updatedAt
     FROM t_miniapp_template WHERE (tenant_id = ? OR tenant_id = 'DEFAULT') AND status = 'active'
     ORDER BY sort_order ASC, id ASC`,
    [tenantId],
    tenantId
  );
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail,
    previewUrls: safeJsonParse(row.preview_urls, []),
    styleConfig: safeJsonParse(row.style_config, {}),
    pageConfig: safeJsonParse(row.page_config, {}),
    version: row.version,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getTemplateDetail(tenantId: string, id: number) {
  const row = await queryOneWithTenant<any>(
    `SELECT id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order, created_at AS createdAt, updated_at AS updatedAt
     FROM t_miniapp_template WHERE id = ? AND (tenant_id = ? OR tenant_id = 'DEFAULT')`,
    [id, tenantId],
    tenantId
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail,
    previewUrls: safeJsonParse(row.preview_urls, []),
    styleConfig: safeJsonParse(row.style_config, {}),
    pageConfig: safeJsonParse(row.page_config, {}),
    version: row.version,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createTemplate(tenantId: string, body: any) {
  const result = await queryWithTenant(
    `INSERT INTO t_miniapp_template (tenant_id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, body.name, body.description || "", body.thumbnail || "",
      JSON.stringify(body.previewUrls || []),
      JSON.stringify(body.styleConfig || {}),
      JSON.stringify(body.pageConfig || {}),
      body.version || "1.0.0", body.status || "active", body.sortOrder || 0],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateTemplate(tenantId: string, id: number, body: any) {
  const sets: string[] = [];
  const params: any[] = [];
  const map: Record<string, string> = {
    name: "name", description: "description", thumbnail: "thumbnail",
    previewUrls: "preview_urls", styleConfig: "style_config", pageConfig: "page_config",
    version: "version", status: "status", sortOrder: "sort_order",
  };
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) {
      let val = body[key];
      if (key === "previewUrls" || key === "styleConfig" || key === "pageConfig") {
        val = JSON.stringify(val);
      }
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }
  if (sets.length > 0) {
    params.push(id, tenantId);
    await queryWithTenant(
      `UPDATE t_miniapp_template SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ? AND (tenant_id = ? OR tenant_id = 'DEFAULT')`,
      params,
      tenantId
    );
  }
  return { success: true };
}

export async function deleteTemplate(tenantId: string, id: number) {
  await queryWithTenant(
    "DELETE FROM t_miniapp_template WHERE id = ? AND (tenant_id = ? OR tenant_id = 'DEFAULT')",
    [id, tenantId],
    tenantId
  );
  return { success: true };
}

export async function applyTemplate(tenantId: string, templateId: number, platform: string = "WECHAT") {
  const template = await getTemplateDetail(tenantId, templateId);
  if (!template) throw new Error("模板不存在");
  await queryWithTenant(
    "UPDATE t_miniapp_config SET template_id = ?, updated_at = NOW() WHERE tenant_id = ? AND platform = ?",
    [templateId, tenantId, platform],
    tenantId
  );
  return { success: true, templateName: template.name };
}

export async function getPreviewConfig(tenantId: string, platform: string = "WECHAT") {
  const [config, template] = await Promise.all([
    queryOneWithTenant<any>(
      "SELECT app_id AS appId, app_name AS appName, template_id AS templateId, status FROM t_miniapp_config WHERE tenant_id = ? AND platform = ?",
      [tenantId, platform],
      tenantId
    ),
    queryOneWithTenant<any>(
      "SELECT t.id, t.name, t.style_config AS styleConfig FROM t_miniapp_config c JOIN t_miniapp_template t ON c.template_id = t.id WHERE c.tenant_id = ? AND c.platform = ?",
      [tenantId, platform],
      tenantId
    ),
  ]);
  return {
    appId: config?.appId,
    appName: config?.appName,
    status: config?.status,
    template: template ? { id: template.id, name: template.name, styleConfig: safeJsonParse(template.styleConfig, {}) } : null,
  };
}