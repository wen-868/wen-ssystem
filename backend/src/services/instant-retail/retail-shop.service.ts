import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function getShopConfig(storeId: number | undefined, tenantId: string) {
  if (!storeId) return null;
  return queryOneWithTenant<any>("SELECT * FROM retail_shop_config WHERE store_id = ? AND tenant_id = ?", [storeId, tenantId], tenantId);
}

export async function saveShopConfig(storeId: number | undefined, data: any, tenantId: string) {
  if (!storeId) throw new Error("门店ID不能为空");
  const existing = await queryOneWithTenant<any>("SELECT id FROM retail_shop_config WHERE store_id = ? AND tenant_id = ?", [storeId, tenantId], tenantId);
  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.shop_name !== undefined) { fields.push("shop_name = ?"); values.push(data.shop_name); }
    if (data.shop_logo !== undefined) { fields.push("shop_logo = ?"); values.push(data.shop_logo); }
    if (data.shop_description !== undefined) { fields.push("shop_description = ?"); values.push(data.shop_description); }
    if (data.contact_phone !== undefined) { fields.push("contact_phone = ?"); values.push(data.contact_phone); }
    if (data.business_hours !== undefined) { fields.push("business_hours = ?"); values.push(data.business_hours); }
    if (data.delivery_enabled !== undefined) { fields.push("delivery_enabled = ?"); values.push(data.delivery_enabled ? 1 : 0); }
    if (data.pickup_enabled !== undefined) { fields.push("pickup_enabled = ?"); values.push(data.pickup_enabled ? 1 : 0); }
    if (data.min_order_amount !== undefined) { fields.push("min_order_amount = ?"); values.push(data.min_order_amount); }
    if (data.delivery_fee !== undefined) { fields.push("delivery_fee = ?"); values.push(data.delivery_fee); }
    if (data.delivery_radius !== undefined) { fields.push("delivery_radius = ?"); values.push(data.delivery_radius); }
    if (data.estimated_delivery_time !== undefined) { fields.push("estimated_delivery_time = ?"); values.push(data.estimated_delivery_time); }
    if (data.announcement !== undefined) { fields.push("announcement = ?"); values.push(data.announcement); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (fields.length > 0) {
      values.push(storeId, tenantId);
      await queryWithTenant(`UPDATE retail_shop_config SET ${fields.join(", ")} WHERE store_id = ? AND tenant_id = ?`, values, tenantId);
    }
    return { id: existing.id };
  } else {
    const result = await queryWithTenant(
      `INSERT INTO retail_shop_config (store_id, shop_name, shop_logo, shop_description, contact_phone, business_hours, delivery_enabled, pickup_enabled, min_order_amount, delivery_fee, delivery_radius, estimated_delivery_time, announcement, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [storeId, data.shop_name ?? "", data.shop_logo ?? null, data.shop_description ?? null, data.contact_phone ?? null, data.business_hours ?? null,
       data.delivery_enabled !== undefined ? (data.delivery_enabled ? 1 : 0) : 1, data.pickup_enabled !== undefined ? (data.pickup_enabled ? 1 : 0) : 1,
       data.min_order_amount ?? 0, data.delivery_fee ?? 0, data.delivery_radius ?? null, data.estimated_delivery_time ?? null,
       data.announcement ?? null, data.status ?? "OPEN", tenantId], tenantId
    );
    return { id: (result as any).insertId };
  }
}

export async function listCategories(storeId: number | undefined, tenantId: string) {
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  const rows = await queryWithTenant<any>(`SELECT * FROM retail_category WHERE ${conditions.join(" AND ")} ORDER BY sort_order`, values, tenantId);
  return buildCategoryTree(rows);
}

function buildCategoryTree(list: any[], parentId: number | null = null): any[] {
  return list.filter((item) => item.parent_id === parentId || item.parentId === parentId).map((item) => ({
    id: item.id, name: item.category_name, icon: item.category_icon,
    parentId: item.parent_id, sortOrder: item.sort_order, status: item.status,
    children: buildCategoryTree(list, item.id),
  }));
}

export async function createCategory(storeId: number | undefined, data: any, tenantId: string) {
  const result = await queryWithTenant(
    "INSERT INTO retail_category (category_name, category_icon, parent_id, sort_order, status, store_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [data.category_name, data.category_icon ?? null, data.parent_id ?? null, data.sort_order ?? 0, data.status ?? "ON", storeId ?? null, tenantId], tenantId
  );
  return { id: (result as any).insertId };
}

export async function updateCategory(id: number, data: any, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.category_name !== undefined) { fields.push("category_name = ?"); values.push(data.category_name); }
  if (data.category_icon !== undefined) { fields.push("category_icon = ?"); values.push(data.category_icon); }
  if (data.parent_id !== undefined) { fields.push("parent_id = ?"); values.push(data.parent_id); }
  if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
  if (fields.length === 0) return { id };
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE retail_category SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteCategory(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM retail_category WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function listRetailProducts(params: {
  storeId?: number; tenantId: string; page: number; pageSize: number;
  categoryId?: number; keyword?: string; status?: string;
}) {
  const { storeId, tenantId, page, pageSize, categoryId, keyword, status } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (categoryId) { conditions.push("category_id = ?"); values.push(categoryId); }
  if (keyword) { conditions.push("product_name LIKE ?"); values.push(`%${keyword}%`); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM retail_product ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT * FROM retail_product ${where} ORDER BY sort_order, id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function addRetailProduct(storeId: number | undefined, data: any, tenantId: string) {
  const result = await queryWithTenant(
    `INSERT INTO retail_product (product_id, sku_id, category_id, retail_price, original_price, stock, sales_count, is_recommended, is_hot, is_new, sort_order, status, store_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.product_id, data.sku_id ?? null, data.category_id ?? null, data.retail_price, data.original_price ?? null,
     data.stock ?? 0, 0, data.is_recommended ? 1 : 0, data.is_hot ? 1 : 0, data.is_new ? 1 : 0,
     data.sort_order ?? 0, data.status ?? "ON", storeId ?? null, tenantId], tenantId
  );
  return { id: (result as any).insertId };
}

export async function updateRetailProduct(id: number, data: any, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.category_id !== undefined) { fields.push("category_id = ?"); values.push(data.category_id); }
  if (data.retail_price !== undefined) { fields.push("retail_price = ?"); values.push(data.retail_price); }
  if (data.original_price !== undefined) { fields.push("original_price = ?"); values.push(data.original_price); }
  if (data.stock !== undefined) { fields.push("stock = ?"); values.push(data.stock); }
  if (data.is_recommended !== undefined) { fields.push("is_recommended = ?"); values.push(data.is_recommended ? 1 : 0); }
  if (data.is_hot !== undefined) { fields.push("is_hot = ?"); values.push(data.is_hot ? 1 : 0); }
  if (data.is_new !== undefined) { fields.push("is_new = ?"); values.push(data.is_new ? 1 : 0); }
  if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
  if (fields.length === 0) return { id };
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE retail_product SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteRetailProduct(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM retail_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function listRetailOrders(params: {
  storeId?: number; tenantId: string; page: number; pageSize: number;
  status?: string; orderNo?: string; startDate?: string; endDate?: string;
}) {
  const { storeId, tenantId, page, pageSize, status, orderNo, startDate, endDate } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (status) { conditions.push("order_status = ?"); values.push(status); }
  if (orderNo) { conditions.push("order_no = ?"); values.push(orderNo); }
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM retail_order ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT * FROM retail_order ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getRetailOrderDetail(orderNo: string, tenantId: string) {
  const order = await queryOneWithTenant<any>("SELECT * FROM retail_order WHERE order_no = ? AND tenant_id = ?", [orderNo, tenantId], tenantId);
  if (!order) return null;
  const items = await queryWithTenant<any>("SELECT * FROM retail_order_item WHERE order_id = ? AND tenant_id = ?", [order.id, tenantId], tenantId);
  return { ...order, items };
}

export async function updateRetailOrderStatus(orderNo: string, status: string, reason: string | undefined, tenantId: string) {
  const order = await queryOneWithTenant<any>("SELECT id, order_status FROM retail_order WHERE order_no = ? AND tenant_id = ?", [orderNo, tenantId], tenantId);
  if (!order) throw new Error("订单不存在");
  const fields: string[] = ["order_status = ?"];
  const values: unknown[] = [status];
  if (status === "CANCELLED" && reason) { fields.push("cancel_reason = ?"); values.push(reason); }
  values.push(orderNo, tenantId);
  await queryWithTenant(`UPDATE retail_order SET ${fields.join(", ")} WHERE order_no = ? AND tenant_id = ?`, values, tenantId);
  return { orderNo, status };
}

export async function listBanners(storeId: number | undefined, tenantId: string) {
  const conditions = ["tenant_id = ?", "status = 'ON'"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  const now = new Date();
  conditions.push("(start_time IS NULL OR start_time <= ?)"); values.push(now);
  conditions.push("(end_time IS NULL OR end_time >= ?)"); values.push(now);
  return queryWithTenant<any>(
    `SELECT * FROM retail_banner WHERE ${conditions.join(" AND ")} ORDER BY sort_order`,
    values, tenantId
  );
}

export async function createBanner(storeId: number | undefined, data: any, tenantId: string) {
  const result = await queryWithTenant(
    "INSERT INTO retail_banner (banner_title, banner_image, link_type, link_value, sort_order, status, start_time, end_time, store_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [data.banner_title ?? null, data.banner_image, data.link_type ?? "NONE", data.link_value ?? null,
     data.sort_order ?? 0, data.status ?? "ON", data.start_time ?? null, data.end_time ?? null,
     storeId ?? null, tenantId], tenantId
  );
  return { id: (result as any).insertId };
}

export async function updateBanner(id: number, data: any, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.banner_title !== undefined) { fields.push("banner_title = ?"); values.push(data.banner_title); }
  if (data.banner_image !== undefined) { fields.push("banner_image = ?"); values.push(data.banner_image); }
  if (data.link_type !== undefined) { fields.push("link_type = ?"); values.push(data.link_type); }
  if (data.link_value !== undefined) { fields.push("link_value = ?"); values.push(data.link_value); }
  if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
  if (data.start_time !== undefined) { fields.push("start_time = ?"); values.push(data.start_time); }
  if (data.end_time !== undefined) { fields.push("end_time = ?"); values.push(data.end_time); }
  if (fields.length === 0) return { id };
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE retail_banner SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteBanner(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM retail_banner WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}