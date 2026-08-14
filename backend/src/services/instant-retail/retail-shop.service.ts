import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type {
  RetailShopConfigInput,
  RetailCategoryInput,
  RetailProductInput,
  RetailBannerInput,
  RetailCategoryTreeNode,
} from "./types";

/** t_retail_shop_config 全字段行 */
interface RetailShopConfigRow {
  id: number; store_id: number; shop_name: string; shop_logo: string | null;
  shop_description: string | null; contact_phone: string | null;
  business_hours: string | null; delivery_enabled: number; pickup_enabled: number;
  min_order_amount: number | string; delivery_fee: number | string;
  delivery_radius: number | string | null; estimated_delivery_time: string | null;
  announcement: string | null; status: string; tenant_id: string;
  created_at: string | Date; updated_at: string | Date;
}

/** t_retail_shop_config 仅 id 行（存在性判断） */
interface RetailShopConfigIdRow {
  id: number;
}

/** t_store 仅 id 行（默认门店回退） */
interface StoreIdRow {
  id: number;
}

/** t_retail_category 全字段行 */
interface RetailCategoryRow {
  id: number; category_name: string; category_icon: string | null;
  parent_id: number | null; sort_order: number; status: string;
  tenant_id: string; store_id: number | null;
  created_at: string | Date; updated_at: string | Date;
  /** 兼容字段（部分查询可能返回 camelCase 命名） */
  parentId?: number | null;
}

/** COUNT(*) AS cnt 聚合行 */
interface CountCntRow {
  cnt: number;
}

/** t_retail_product 全字段行 */
interface RetailProductRow {
  id: number; product_id: number; sku_id: number | null; category_id: number | null;
  retail_price: number | string; original_price: number | string | null;
  stock: number; sales_count: number; is_recommended: number; is_hot: number;
  is_new: number; sort_order: number; status: string;
  tenant_id: string; store_id: number | null;
  created_at: string | Date; updated_at: string | Date;
}

/** t_retail_order 全字段行 */
interface RetailOrderRow {
  id: number; order_no: string; user_id: number | null; store_id: number | null;
  total_amount: number | string; discount_amount: number | string;
  delivery_fee: number | string; pay_amount: number | string;
  delivery_type: string; delivery_address: string | null;
  receiver_name: string | null; receiver_phone: string | null;
  receiver_latitude: number | string | null; receiver_longitude: number | string | null;
  remark: string | null; payment_status: string; payment_method: string | null;
  payment_time: string | Date | null; transaction_no: string | null;
  order_status: string; cancel_reason: string | null;
  platform: string | null; platform_order_id: string | null;
  tenant_id: string; created_at: string | Date; updated_at: string | Date;
}

/** t_retail_order 仅 id/order_status 行（状态校验） */
interface RetailOrderStatusRow {
  id: number; order_status: string;
}

/** t_retail_order_item 全字段行 */
interface RetailOrderItemRow {
  id: number; order_id: number; product_id: number; sku_id: number | null;
  product_name: string; product_image: string | null;
  price: number | string; quantity: number; subtotal: number | string;
  tenant_id: string; created_at: string | Date;
}

/** t_retail_banner 全字段行 */
interface RetailBannerRow {
  id: number; banner_title: string | null; banner_image: string;
  link_type: string | null; link_value: string | null;
  sort_order: number; status: string;
  start_time: string | Date | null; end_time: string | Date | null;
  store_id: number | null; tenant_id: string;
  created_at: string | Date; updated_at: string | Date;
}

/** 无 storeId 时回退租户默认门店（取该租户首个门店） */
async function resolveDefaultStoreId(tenantId: string): Promise<number | undefined> {
  const row = await queryOneWithTenant<StoreIdRow>(
    "SELECT id FROM t_store WHERE tenant_id = ? ORDER BY id ASC LIMIT 1",
    [tenantId],
    tenantId
  );
  return row?.id;
}

/** 门店配置入参归一化：camelCase（API）→ snake_case（DB），兼容两种命名 */
function normalizeShopConfigInput(data: RetailShopConfigInput): RetailShopConfigInput {
  return {
    shop_name: data.shop_name !== undefined ? data.shop_name : data.shopName,
    shop_logo: data.shop_logo !== undefined ? data.shop_logo
      : (data.shopLogo !== undefined ? data.shopLogo : data.logo),
    shop_description: data.shop_description !== undefined ? data.shop_description : data.description,
    contact_phone: data.contact_phone !== undefined ? data.contact_phone : data.phone,
    business_hours: data.business_hours !== undefined ? data.business_hours : data.businessHours,
    delivery_enabled: data.delivery_enabled !== undefined ? data.delivery_enabled : data.deliveryEnabled,
    pickup_enabled: data.pickup_enabled !== undefined ? data.pickup_enabled : data.pickupEnabled,
    min_order_amount: data.min_order_amount !== undefined ? data.min_order_amount : data.minOrderAmount,
    delivery_fee: data.delivery_fee !== undefined ? data.delivery_fee : data.deliveryFee,
    delivery_radius: data.delivery_radius !== undefined ? data.delivery_radius : data.deliveryRange,
    estimated_delivery_time: data.estimated_delivery_time !== undefined ? data.estimated_delivery_time : data.estimatedTime,
    announcement: data.announcement,
    status: data.status,
  };
}

/** 分类入参归一化：camelCase（API）→ snake_case（DB），兼容两种命名 */
function normalizeCategoryInput(data: RetailCategoryInput): RetailCategoryInput {
  return {
    category_name: data.category_name !== undefined ? data.category_name : data.name,
    category_icon: data.category_icon !== undefined ? data.category_icon
      : (data.icon !== undefined ? data.icon : undefined),
    parent_id: data.parent_id !== undefined ? data.parent_id : data.parentId,
    sort_order: data.sort_order !== undefined ? data.sort_order : data.sortNo,
    status: data.status,
  };
}

/** 轮播图入参归一化：camelCase（API）→ snake_case（DB），兼容两种命名；linkUrl 缺失 linkType 时按协议推断 */
function normalizeBannerInput(data: RetailBannerInput): RetailBannerInput {
  const linkValue = data.link_value !== undefined ? data.link_value
    : (data.linkUrl !== undefined ? data.linkUrl : undefined);
  const hasLinkValue = linkValue !== null && linkValue !== undefined && linkValue !== "";
  let linkType: string | undefined = data.link_type !== undefined ? data.link_type : (data.linkType ?? undefined);
  if (linkType === undefined && hasLinkValue) {
    linkType = /^https?:\/\//i.test(String(linkValue)) ? "URL" : "NONE";
  }
  return {
    banner_title: data.banner_title !== undefined ? data.banner_title
      : (data.title !== undefined ? data.title : undefined),
    banner_image: data.banner_image !== undefined ? data.banner_image : data.imageUrl,
    link_type: linkType,
    link_value: linkValue,
    sort_order: data.sort_order !== undefined ? data.sort_order : data.sortNo,
    status: data.status,
    start_time: data.start_time !== undefined ? data.start_time
      : (data.startTime !== undefined ? data.startTime : undefined),
    end_time: data.end_time !== undefined ? data.end_time
      : (data.endTime !== undefined ? data.endTime : undefined),
  };
}

export async function getShopConfig(storeId: number | undefined, tenantId: string) {
  if (!storeId) storeId = await resolveDefaultStoreId(tenantId);
  if (!storeId) return null;
  return queryOneWithTenant<RetailShopConfigRow>("SELECT * FROM t_retail_shop_config WHERE store_id = ? AND tenant_id = ?", [storeId, tenantId], tenantId);
}

export async function saveShopConfig(storeId: number | undefined, data: RetailShopConfigInput, tenantId: string) {
  const normalized = normalizeShopConfigInput(data);
  if (!storeId) storeId = await resolveDefaultStoreId(tenantId);
  if (!storeId) throw new Error("门店ID不能为空");
  const existing = await queryOneWithTenant<RetailShopConfigIdRow>("SELECT id FROM t_retail_shop_config WHERE store_id = ? AND tenant_id = ?", [storeId, tenantId], tenantId);
  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (normalized.shop_name !== undefined) { fields.push("shop_name = ?"); values.push(normalized.shop_name); }
    if (normalized.shop_logo !== undefined) { fields.push("shop_logo = ?"); values.push(normalized.shop_logo); }
    if (normalized.shop_description !== undefined) { fields.push("shop_description = ?"); values.push(normalized.shop_description); }
    if (normalized.contact_phone !== undefined) { fields.push("contact_phone = ?"); values.push(normalized.contact_phone); }
    if (normalized.business_hours !== undefined) { fields.push("business_hours = ?"); values.push(normalized.business_hours); }
    if (normalized.delivery_enabled !== undefined) { fields.push("delivery_enabled = ?"); values.push(normalized.delivery_enabled ? 1 : 0); }
    if (normalized.pickup_enabled !== undefined) { fields.push("pickup_enabled = ?"); values.push(normalized.pickup_enabled ? 1 : 0); }
    if (normalized.min_order_amount !== undefined) { fields.push("min_order_amount = ?"); values.push(normalized.min_order_amount); }
    if (normalized.delivery_fee !== undefined) { fields.push("delivery_fee = ?"); values.push(normalized.delivery_fee); }
    if (normalized.delivery_radius !== undefined) { fields.push("delivery_radius = ?"); values.push(normalized.delivery_radius); }
    if (normalized.estimated_delivery_time !== undefined) { fields.push("estimated_delivery_time = ?"); values.push(normalized.estimated_delivery_time); }
    if (normalized.announcement !== undefined) { fields.push("announcement = ?"); values.push(normalized.announcement); }
    if (normalized.status !== undefined) { fields.push("status = ?"); values.push(normalized.status); }
    if (fields.length > 0) {
      values.push(storeId, tenantId);
      await queryWithTenant(`UPDATE t_retail_shop_config SET ${fields.join(", ")} WHERE store_id = ? AND tenant_id = ?`, values, tenantId);
    }
    return { id: existing.id };
  } else {
    const result = await queryWithTenant(
      `INSERT INTO t_retail_shop_config (store_id, shop_name, shop_logo, shop_description, contact_phone, business_hours, delivery_enabled, pickup_enabled, min_order_amount, delivery_fee, delivery_radius, estimated_delivery_time, announcement, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [storeId, normalized.shop_name ?? "", normalized.shop_logo ?? null, normalized.shop_description ?? null, normalized.contact_phone ?? null, normalized.business_hours ?? null,
        normalized.delivery_enabled !== undefined ? (normalized.delivery_enabled ? 1 : 0) : 1, normalized.pickup_enabled !== undefined ? (normalized.pickup_enabled ? 1 : 0) : 1,
        normalized.min_order_amount ?? 0, normalized.delivery_fee ?? 0, normalized.delivery_radius ?? null, normalized.estimated_delivery_time ?? null,
        normalized.announcement ?? null, normalized.status ?? "OPEN", tenantId], tenantId
    );
    return { id: (result as unknown as { insertId: number }).insertId };
  }
}

export async function listCategories(storeId: number | undefined, tenantId: string) {
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  const rows = await queryWithTenant<RetailCategoryRow>(`SELECT * FROM t_retail_category WHERE ${conditions.join(" AND ")} ORDER BY sort_order`, values, tenantId);
  return buildCategoryTree(rows);
}

function buildCategoryTree(list: RetailCategoryRow[], parentId: number | null = null): RetailCategoryTreeNode[] {
  return list.filter((item) => item.parent_id === parentId || item.parentId === parentId).map((item) => ({
    id: item.id, name: item.category_name, icon: item.category_icon,
    parentId: item.parent_id, sortOrder: item.sort_order, status: item.status,
    children: buildCategoryTree(list, item.id),
  }));
}

export async function createCategory(storeId: number | undefined, data: RetailCategoryInput, tenantId: string) {
  const normalized = normalizeCategoryInput(data);
  const result = await queryWithTenant(
    "INSERT INTO t_retail_category (category_name, category_icon, parent_id, sort_order, status, store_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [normalized.category_name, normalized.category_icon ?? null, normalized.parent_id ?? null, normalized.sort_order ?? 0, normalized.status ?? "ON", storeId ?? null, tenantId], tenantId
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

export async function updateCategory(id: number, data: RetailCategoryInput, tenantId: string) {
  const normalized = normalizeCategoryInput(data);
  const fields: string[] = [];
  const values: unknown[] = [];
  if (normalized.category_name !== undefined) { fields.push("category_name = ?"); values.push(normalized.category_name); }
  if (normalized.category_icon !== undefined) { fields.push("category_icon = ?"); values.push(normalized.category_icon); }
  if (normalized.parent_id !== undefined) { fields.push("parent_id = ?"); values.push(normalized.parent_id); }
  if (normalized.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(normalized.sort_order); }
  if (normalized.status !== undefined) { fields.push("status = ?"); values.push(normalized.status); }
  if (fields.length === 0) return { id };
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE t_retail_category SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteCategory(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_retail_category WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
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
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_retail_product ${where}`, values, tenantId);
  const rows = await queryWithTenant<RetailProductRow>(
    `SELECT * FROM t_retail_product ${where} ORDER BY sort_order, id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function addRetailProduct(storeId: number | undefined, data: RetailProductInput, tenantId: string) {
  const result = await queryWithTenant(
    `INSERT INTO t_retail_product (product_id, sku_id, category_id, retail_price, original_price, stock, sales_count, is_recommended, is_hot, is_new, sort_order, status, store_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.product_id, data.sku_id ?? null, data.category_id ?? null, data.retail_price, data.original_price ?? null,
    data.stock ?? 0, 0, data.is_recommended ? 1 : 0, data.is_hot ? 1 : 0, data.is_new ? 1 : 0,
    data.sort_order ?? 0, data.status ?? "ON", storeId ?? null, tenantId], tenantId
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

export async function updateRetailProduct(id: number, data: RetailProductInput, tenantId: string) {
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
  await queryWithTenant(`UPDATE t_retail_product SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteRetailProduct(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_retail_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function listRetailOrders(params: {
  storeId?: number; tenantId: string; page: number; pageSize: number;
  status?: string; paymentStatus?: string; platform?: string; keyword?: string;
  orderNo?: string; startDate?: string; endDate?: string;
}) {
  const { storeId, tenantId, page, pageSize, status, paymentStatus, platform, keyword, orderNo, startDate, endDate } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (status) { conditions.push("order_status = ?"); values.push(status); }
  if (paymentStatus) { conditions.push("payment_status = ?"); values.push(paymentStatus); }
  if (platform) { conditions.push("platform = ?"); values.push(platform); }
  if (keyword) {
    const like = `%${keyword}%`;
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_phone LIKE ? OR user_name LIKE ?)");
    values.push(like, like, like, like);
  }
  if (orderNo) { conditions.push("order_no = ?"); values.push(orderNo); }
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_retail_order ${where}`, values, tenantId);
  const rows = await queryWithTenant<RetailOrderRow>(
    `SELECT * FROM t_retail_order ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getRetailOrderDetail(orderNo: string, tenantId: string) {
  const order = await queryOneWithTenant<RetailOrderRow>("SELECT * FROM t_retail_order WHERE order_no = ? AND tenant_id = ?", [orderNo, tenantId], tenantId);
  if (!order) return null;
  const items = await queryWithTenant<RetailOrderItemRow>("SELECT * FROM t_retail_order_item WHERE order_id = ? AND tenant_id = ?", [order.id, tenantId], tenantId);
  return { ...order, items };
}

export async function updateRetailOrderStatus(orderNo: string, status: string, reason: string | undefined, tenantId: string) {
  const order = await queryOneWithTenant<RetailOrderStatusRow>("SELECT id, order_status FROM t_retail_order WHERE order_no = ? AND tenant_id = ?", [orderNo, tenantId], tenantId);
  if (!order) throw new Error("订单不存在");
  const fields: string[] = ["order_status = ?"];
  const values: unknown[] = [status];
  if (status === "CANCELLED" && reason) { fields.push("cancel_reason = ?"); values.push(reason); }
  values.push(orderNo, tenantId);
  await queryWithTenant(`UPDATE t_retail_order SET ${fields.join(", ")} WHERE order_no = ? AND tenant_id = ?`, values, tenantId);
  return { orderNo, status };
}

export async function listBanners(storeId: number | undefined, tenantId: string) {
  const conditions = ["tenant_id = ?", "status = 'ON'"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  const now = new Date();
  conditions.push("(start_time IS NULL OR start_time <= ?)"); values.push(now);
  conditions.push("(end_time IS NULL OR end_time >= ?)"); values.push(now);
  return queryWithTenant<RetailBannerRow>(
    `SELECT * FROM t_retail_banner WHERE ${conditions.join(" AND ")} ORDER BY sort_order`,
    values, tenantId
  );
}

export async function createBanner(storeId: number | undefined, data: RetailBannerInput, tenantId: string) {
  const normalized = normalizeBannerInput(data);
  const result = await queryWithTenant(
    "INSERT INTO t_retail_banner (banner_title, banner_image, link_type, link_value, sort_order, status, start_time, end_time, store_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [normalized.banner_title ?? null, normalized.banner_image, normalized.link_type ?? "NONE", normalized.link_value ?? null,
    normalized.sort_order ?? 0, normalized.status ?? "ON", normalized.start_time ?? null, normalized.end_time ?? null,
    storeId ?? null, tenantId], tenantId
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

export async function updateBanner(id: number, data: RetailBannerInput, tenantId: string) {
  const normalized = normalizeBannerInput(data);
  const fields: string[] = [];
  const values: unknown[] = [];
  if (normalized.banner_title !== undefined) { fields.push("banner_title = ?"); values.push(normalized.banner_title); }
  if (normalized.banner_image !== undefined) { fields.push("banner_image = ?"); values.push(normalized.banner_image); }
  if (normalized.link_type !== undefined) { fields.push("link_type = ?"); values.push(normalized.link_type); }
  if (normalized.link_value !== undefined) { fields.push("link_value = ?"); values.push(normalized.link_value); }
  if (normalized.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(normalized.sort_order); }
  if (normalized.status !== undefined) { fields.push("status = ?"); values.push(normalized.status); }
  if (normalized.start_time !== undefined) { fields.push("start_time = ?"); values.push(normalized.start_time); }
  if (normalized.end_time !== undefined) { fields.push("end_time = ?"); values.push(normalized.end_time); }
  if (fields.length === 0) return { id };
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE t_retail_banner SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteBanner(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_retail_banner WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}
