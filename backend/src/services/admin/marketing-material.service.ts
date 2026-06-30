import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { makeBizNo } from "../../shared/biz-no.js";

export async function createMaterial(data: any, tenantId: string, userId: number) {
  const code = makeBizNo("SC");
  const result = await queryWithTenant(
    `INSERT INTO marketing_material (material_code, material_name, material_desc, material_type, file_url, file_size, file_format, image_width, image_height, category_id, tags, usage_scene, related_activity_id, related_activity_type, tenant_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, data.material_name, data.material_desc ?? null, data.material_type, data.file_url, data.file_size ?? null, data.file_format ?? null, data.image_width ?? null, data.image_height ?? null, data.category_id ?? null, data.tags ? JSON.stringify(data.tags) : null, data.usage_scene ?? null, data.related_activity_id ?? null, data.related_activity_type ?? null, tenantId, userId], tenantId
  );
  return { id: (result as any).insertId, material_code: code };
}

export async function listMaterials(params: { tenantId: string; material_type?: string; category_id?: number; tags?: string; status?: string; page?: number; pageSize?: number }) {
  const { tenantId, material_type, category_id, tags, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (material_type) { conditions.push("material_type = ?"); values.push(material_type); }
  if (category_id) { conditions.push("category_id = ?"); values.push(category_id); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  if (tags) { conditions.push("JSON_CONTAINS(tags, ?)"); values.push(JSON.stringify(tags)); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM marketing_material ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT * FROM marketing_material ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getMaterialDetail(id: number, tenantId: string) {
  const material = await queryOneWithTenant<any>("SELECT * FROM marketing_material WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (material) {
    await queryWithTenant("UPDATE marketing_material SET view_count = view_count + 1 WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  }
  return material;
}

export async function updateMaterial(id: number, data: any, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.material_name !== undefined) { fields.push("material_name = ?"); values.push(data.material_name); }
  if (data.material_desc !== undefined) { fields.push("material_desc = ?"); values.push(data.material_desc); }
  if (data.tags !== undefined) { fields.push("tags = ?"); values.push(JSON.stringify(data.tags)); }
  if (data.usage_scene !== undefined) { fields.push("usage_scene = ?"); values.push(data.usage_scene); }
  if (data.category_id !== undefined) { fields.push("category_id = ?"); values.push(data.category_id); }
  if (fields.length === 0) return null;
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE marketing_material SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteMaterial(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM marketing_material WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function publishMaterial(id: number, tenantId: string) {
  await queryWithTenant("UPDATE marketing_material SET status = 'PUBLISHED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function archiveMaterial(id: number, tenantId: string) {
  await queryWithTenant("UPDATE marketing_material SET status = 'ARCHIVED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

// 素材分类
export async function getMaterialCategories(tenantId: string) {
  const categories = await queryWithTenant<any>("SELECT * FROM material_category WHERE tenant_id = ? ORDER BY sort_order", [tenantId], tenantId);
  return buildCategoryTree(categories);
}

function buildCategoryTree(list: any[], parentId: number | null = null): any[] {
  return list.filter((item) => item.parent_id === parentId).map((item) => ({
    id: item.id, name: item.name, parentId: item.parent_id, sortOrder: item.sort_order,
    children: buildCategoryTree(list, item.id),
  }));
}

export async function createMaterialCategory(data: { name: string; parent_id?: number; sort_order?: number }, tenantId: string) {
  const result = await queryWithTenant(
    "INSERT INTO material_category (name, parent_id, sort_order, tenant_id) VALUES (?, ?, ?, ?)",
    [data.name, data.parent_id ?? null, data.sort_order ?? 0, tenantId], tenantId
  );
  return { id: (result as any).insertId };
}

export async function updateMaterialCategory(id: number, data: { name?: string; parent_id?: number; sort_order?: number }, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.parent_id !== undefined) { fields.push("parent_id = ?"); values.push(data.parent_id); }
  if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
  if (fields.length === 0) return;
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE material_category SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
}

export async function deleteMaterialCategory(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM material_category WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}