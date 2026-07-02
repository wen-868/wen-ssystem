import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function listTemplates(tenantId: string) {
  return queryWithTenant<any>(
    "SELECT id, name, description, version, category, thumbnail, status, config_json AS configJson, page_count AS pageCount, component_count AS componentCount, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt FROM miniapp_template WHERE tenant_id = ? ORDER BY sort_order, id",
    [tenantId],
    tenantId
  );
}

export async function getTemplateDetail(tenantId: string, id: number) {
  return queryOneWithTenant<any>(
    "SELECT id, name, description, version, category, thumbnail, status, config_json AS configJson, page_count AS pageCount, component_count AS componentCount, is_default AS isDefault, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM miniapp_template WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
}

export async function createTemplate(tenantId: string, body: any) {
  const result = await queryWithTenant(
    "INSERT INTO miniapp_template (tenant_id, name, description, version, category, thumbnail, status, config_json, page_count, component_count, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [tenantId, body.name, body.description || "", body.version || "1.0.0", body.category || "general", body.thumbnail || "", body.status || "draft", JSON.stringify(body.configJson || {}), body.pageCount || 0, body.componentCount || 0, body.isDefault ? 1 : 0, body.sortOrder || 0],
    tenantId
  );
  // 如果设为默认，取消其他默认
  if (body.isDefault) {
    await queryWithTenant(
      "UPDATE miniapp_template SET is_default = 0 WHERE tenant_id = ? AND id != ?",
      [tenantId, (result as any).insertId],
      tenantId
    );
  }
  return { id: (result as any).insertId };
}

export async function updateTemplate(tenantId: string, id: number, body: any) {
  const sets: string[] = [];
  const params: any[] = [];
  const map: Record<string, string> = {
    name: "name", description: "description", version: "version",
    category: "category", thumbnail: "thumbnail", status: "status",
    configJson: "config_json", pageCount: "page_count",
    componentCount: "component_count", isDefault: "is_default",
    sortOrder: "sort_order",
  };
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) {
      let val = body[key];
      if (key === "isDefault") val = val ? 1 : 0;
      if (key === "configJson") val = JSON.stringify(val);
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }
  if (sets.length > 0) {
    params.push(id, tenantId);
    await queryWithTenant(
      `UPDATE miniapp_template SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      params,
      tenantId
    );
  }
  if (body.isDefault) {
    await queryWithTenant(
      "UPDATE miniapp_template SET is_default = 0 WHERE tenant_id = ? AND id != ?",
      [tenantId, id],
      tenantId
    );
  }
  return { success: true };
}

export async function deleteTemplate(tenantId: string, id: number) {
  await queryWithTenant("DELETE FROM miniapp_template WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { success: true };
}

export async function setDefaultTemplate(tenantId: string, id: number) {
  await queryWithTenant("UPDATE miniapp_template SET is_default = 0 WHERE tenant_id = ?", [tenantId], tenantId);
  await queryWithTenant("UPDATE miniapp_template SET is_default = 1 WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { success: true };
}

export async function applyTemplate(tenantId: string, templateId: number, platform: string = "WECHAT") {
  const template = await getTemplateDetail(tenantId, templateId);
  if (!template) throw new Error("模板不存在");
  await queryWithTenant(
    "UPDATE miniapp_config SET template_id = ?, updated_at = NOW() WHERE tenant_id = ? AND platform = ?",
    [templateId, tenantId, platform],
    tenantId
  );
  return { success: true, templateName: template.name };
}

export async function getPreviewConfig(tenantId: string, platform: string = "WECHAT") {
  const [config, template] = await Promise.all([
    queryOneWithTenant<any>(
      "SELECT app_id AS appId, app_name AS appName, template_id AS templateId, status FROM miniapp_config WHERE tenant_id = ? AND platform = ?",
      [tenantId, platform],
      tenantId
    ),
    queryOneWithTenant<any>(
      "SELECT t.id, t.name, t.config_json AS configJson FROM miniapp_config c JOIN miniapp_template t ON c.template_id = t.id WHERE c.tenant_id = ? AND c.platform = ?",
      [tenantId, platform],
      tenantId
    ),
  ]);
  return {
    appId: config?.appId,
    appName: config?.appName,
    status: config?.status,
    template: template ? { id: template.id, name: template.name, configJson: template.configJson } : null,
  };
}