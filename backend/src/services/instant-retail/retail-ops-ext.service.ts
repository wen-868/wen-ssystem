/**
 * 即时零售管理扩展 Service 层（ajian_retail_fix_01）
 *
 * 用途：补齐工作台缺失的 5 类接口数据逻辑：
 *   1. 商品货架 shelf（t_retail_product + t_product_sku + t_product_spu）
 *   2. 在线支付 payments（t_payment_order，来源 MINIAPP_ORDER）
 *   3. 配送管理 deliveries（t_delivery_record + t_retail_order）
 *   4. 60 秒接单看板 order-board（t_platform_order）
 *   5. 购物车分析 retail-cart/analysis（t_retail_cart）
 *
 * 说明：
 *   - 所有查询显式带 tenant_id 条件（queryWithTenant 检测到 tenant_id 后不再自动注入，
 *     因此 JOIN 场景必须在 WHERE 中完整覆盖租户过滤）。
 *   - 状态字段输出统一为前端契约：支付 status（UNPAID/PAID/REFUNDED）、
 *     配送 deliveryStatus（PENDING/ASSIGNED/PICKING/DELIVERING/COMPLETED/CANCELLED）。
 */

import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────

/** t_retail_product JOIN 商品行（货架） */
interface ShelfProductRow {
  id: number;
  productId: number;
  skuId: number | null;
  categoryId: number | null;
  retailPrice: number | string;
  originalPrice: number | string | null;
  stock: number;
  salesCount: number;
  sortOrder: number;
  shelfStatus: string;
  isRecommended: number;
  isHot: number;
  isNew: number;
  sku: string | null;
  barcode: string | null;
  productName: string | null;
  productImage: string | null;
  unit: string | null;
}

/** t_payment_order 支付单行 */
interface PaymentOrderRow {
  paymentNo: string;
  orderNo: string;
  amount: number | string;
  method: string;
  status: string;
  transactionNo: string | null;
  paidAt: string | Date | null;
  createdAt: string | Date;
}

/** t_delivery_record JOIN t_retail_order 配送行 */
interface DeliveryRecordRow {
  id: number;
  deliveryNo: string | null;
  deliveryStatus: string;
  rider: string | null;
  riderPhone: string | null;
  riderId: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  orderNo: string | null;
  customer: string | null;
  address: string | null;
  amount: number | string | null;
}

/** t_platform_order 接单看板行 */
interface PlatformOrderRow {
  id: number;
  platformOrderId: string;
  platform: string;
  status: string;
  orderDataJson: string | null;
  createdAt: string | Date;
}

/** COUNT(*) AS total 聚合行 */
interface CountTotalRow {
  total: number;
}

/** COUNT(*) AS cnt 聚合行 */
interface CountCntRow {
  cnt: number;
}

/** t_product_sku 存在性行 */
interface SkuIdRow {
  id: number;
}

/** 购物车总览聚合行 */
interface CartOverviewRow {
  totalCarts: number;
  totalItems: number;
  checkedItems: number;
  totalAmount: number | string;
}

/** 购物车商品分布行 */
interface CartProductRow {
  skuId: number;
  skuName: string | null;
  sku: string | null;
  quantity: number;
  amount: number | string;
  count: number;
}

/** 最近购物车行 */
interface RecentCartRow {
  id: number;
  userId: number;
  storeId: number;
  skuId: number;
  boxQty: number;
  bottleQty: number;
  checked: number;
  skuName: string | null;
  sku: string | null;
  createdAt: string | Date;
}

/** 货架商品对外行 */
export interface ShelfProductOutput {
  id: number;
  productId: number;
  categoryId: number | null;
  productName: string | null;
  sku: string | null;
  barcode: string | null;
  productImage: string | null;
  retailPrice: number;
  originalPrice: number | null;
  stock: number;
  sales: number;
  sort: number;
  shelfStatus: string;
  tags: string[];
}

/** 支付记录对外行 */
export interface PaymentOutput {
  paymentNo: string;
  orderNo: string;
  amount: number;
  method: string;
  status: string;
  transactionNo: string | null;
  paidAt: string | Date | null;
  createdAt: string | Date;
  refundedAt: string | Date | null;
  remark: string | null;
}

/** 配送单对外行 */
export interface DeliveryOutput {
  id: number;
  deliveryNo: string | null;
  orderNo: string | null;
  customer: string | null;
  address: string | null;
  deliveryStatus: string;
  rider: string | null;
  riderPhone: string | null;
  estimatedTime: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** 接单看板订单项 */
export interface OrderBoardItem {
  id: string;
  orderNo: string;
  platform: string;
  customer: string | null;
  amount: number;
  itemCount: number;
  items: Array<{ id: string; name: string; qty: number; price: number }>;
  remark: string | null;
  createTime: string;
  createTimestamp: number;
  status: "pending" | "processing" | "completed";
  statusText?: string;
  rider?: { name: string; phone: string } | null;
  completeTime?: string;
}

// ────────────────────────────────────────────────────────────
// 通用工具
// ────────────────────────────────────────────────────────────

/** 数字转换兜底 */
function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** 时间转 HH:mm:ss */
function formatTime(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 货架行 → 对外行（标签数组化） */
function mapShelfRow(row: ShelfProductRow): ShelfProductOutput {
  const tags: string[] = [];
  if (Number(row.isRecommended) === 1) tags.push("RECOMMEND");
  if (Number(row.isHot) === 1) tags.push("HOT");
  if (Number(row.isNew) === 1) tags.push("NEW");
  return {
    id: row.id,
    productId: row.productId,
    categoryId: row.categoryId,
    productName: row.productName,
    sku: row.sku,
    barcode: row.barcode,
    productImage: row.productImage,
    retailPrice: toNumber(row.retailPrice),
    originalPrice: row.originalPrice === null || row.originalPrice === undefined ? null : toNumber(row.originalPrice),
    stock: toNumber(row.stock),
    sales: toNumber(row.salesCount),
    sort: toNumber(row.sortOrder),
    shelfStatus: row.shelfStatus || "ON",
    tags,
  };
}

/** 支付状态映射：t_payment_order.status → 前端契约 */
function mapPaymentStatus(status: string): string {
  switch (status) {
    case "SUCCESS":
      return "PAID";
    case "REFUNDED":
      return "REFUNDED";
    case "PENDING":
    case "FAILED":
    case "CLOSED":
    default:
      return "UNPAID";
  }
}

/** 支付状态反查：前端 → t_payment_order.status SQL 条件片段 */
function paymentStatusCondition(status: string): string {
  if (status === "PAID") return "status = 'SUCCESS'";
  if (status === "REFUNDED") return "status = 'REFUNDED'";
  return "status IN ('PENDING','FAILED','CLOSED')";
}

/** 配送状态映射：t_delivery_record.status → 前端契约 */
function mapDeliveryStatus(status: string): string {
  return status === "PICKED_UP" ? "PICKING" : status;
}

/** 配送状态反查：前端 → t_delivery_record.status */
function deliveryStatusToDb(status: string): string {
  return status === "PICKING" ? "PICKED_UP" : status;
}

/** 平台订单行 → 接单看板项 */
function mapOrderBoardItem(row: PlatformOrderRow): OrderBoardItem {
  let parsed: Record<string, unknown> | null = null;
  try {
    const raw = row.orderDataJson ? JSON.parse(row.orderDataJson) : null;
    parsed = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  } catch {
    parsed = null;
  }
  const data = parsed ?? {};
  const itemsRaw = (Array.isArray(data.items) ? data.items : Array.isArray(data.orderItems) ? data.orderItems : []) as Array<Record<string, unknown>>;
  const items = itemsRaw.map((it, idx) => ({
    id: String(it.id ?? it.skuId ?? it.productId ?? idx),
    name: String(it.name ?? it.skuName ?? it.product_name ?? it.sku_name ?? "商品"),
    qty: toNumber(it.qty ?? it.quantity ?? it.count ?? 1),
    price: toNumber(it.price ?? it.unitPrice ?? it.unit_price ?? 0),
  }));
  const amount = toNumber(data.payAmount ?? data.payableAmount ?? data.totalAmount ?? data.pay_amount ?? data.total_amount ?? data.amount ?? 0);
  const createTimestamp = new Date(row.createdAt).getTime() || Date.now();
  const status = row.status === "PENDING" ? "pending" : row.status === "COMPLETED" ? "completed" : "processing";
  const base: OrderBoardItem = {
    id: String(row.id),
    orderNo: row.platformOrderId,
    platform: row.platform.toLowerCase(),
    customer: String(data.customerName ?? data.userName ?? data.receiverName ?? data.receiver_name ?? data.customer ?? ""),
    amount,
    itemCount: items.length,
    items,
    remark: data.remark ? String(data.remark) : null,
    createTime: formatTime(row.createdAt),
    createTimestamp,
    status,
    statusText: status === "processing" ? (row.status === "DELIVERING" ? "配送中" : "备货中") : undefined,
    rider: null,
  };
  if (status === "completed") {
    base.completeTime = formatTime(row.createdAt);
  }
  return base;
}

// ────────────────────────────────────────────────────────────
// 1. 商品货架 shelf
// ────────────────────────────────────────────────────────────

/** 货架商品列表（分页 + keyword/category/status/tag 筛选） */
export async function listShelfProducts(params: {
  tenantId: string;
  keyword?: string;
  category?: number;
  status?: string;
  tag?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, keyword, category, status, tag, page, pageSize } = params;
  const conditions = ["rp.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (category) {
    conditions.push("rp.category_id = ?");
    values.push(category);
  }
  if (status) {
    conditions.push("rp.status = ?");
    values.push(status);
  }
  if (tag === "RECOMMEND") {
    conditions.push("rp.is_recommended = 1");
  } else if (tag === "HOT") {
    conditions.push("rp.is_hot = 1");
  } else if (tag === "NEW") {
    conditions.push("rp.is_new = 1");
  }
  if (keyword) {
    conditions.push("(spu.name LIKE ? OR ps.sku_code LIKE ? OR ps.barcode LIKE ?)");
    const like = `%${keyword}%`;
    values.push(like, like, like);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const joinSql = `FROM t_retail_product rp
     LEFT JOIN t_product_sku ps ON ps.id = rp.product_id
     LEFT JOIN t_product_spu spu ON spu.id = ps.spu_id`;

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total ${joinSql} ${where}`,
    values,
    tenantId
  );
  const rows = await queryWithTenant<ShelfProductRow>(
    `SELECT rp.id, rp.product_id AS productId, rp.sku_id AS skuId, rp.category_id AS categoryId,
            rp.retail_price AS retailPrice, rp.original_price AS originalPrice,
            rp.stock, rp.sales_count AS salesCount, rp.sort_order AS sortOrder,
            rp.status AS shelfStatus, rp.is_recommended AS isRecommended,
            rp.is_hot AS isHot, rp.is_new AS isNew,
            ps.sku_code AS sku, ps.barcode,
            spu.name AS productName, spu.main_image AS productImage, spu.unit
     ${joinSql} ${where}
     ORDER BY rp.sort_order ASC, rp.id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows.map(mapShelfRow),
  };
}

/** 上架/新增货架商品 */
export async function addShelfProduct(
  body: {
    skuId: number;
    categoryId?: number;
    retailPrice: number;
    originalPrice?: number;
    stock?: number;
    tags?: string[];
    sort?: number;
    status?: string;
  },
  tenantId: string
) {
  const sku = await queryOneWithTenant<SkuIdRow>(
    "SELECT id FROM t_product_sku WHERE id = ? AND tenant_id = ?",
    [body.skuId, tenantId],
    tenantId
  );
  if (!sku) {
    throw Object.assign(new Error("商品(SKU)不存在"), { statusCode: 404 });
  }
  const tags = body.tags ?? [];
  const result = await queryWithTenant(
    `INSERT INTO t_retail_product (
       product_id, sku_id, category_id, retail_price, original_price, stock,
       sales_count, is_recommended, is_hot, is_new, sort_order, status, store_id, tenant_id
     ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      body.skuId,
      body.skuId,
      body.categoryId ?? null,
      body.retailPrice,
      body.originalPrice ?? null,
      body.stock ?? 0,
      tags.includes("RECOMMEND") ? 1 : 0,
      tags.includes("HOT") ? 1 : 0,
      tags.includes("NEW") ? 1 : 0,
      body.sort ?? 0,
      body.status ?? "ON",
      tenantId,
    ],
    tenantId
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

/** 编辑货架商品 */
export async function updateShelfProduct(
  id: number,
  body: {
    categoryId?: number | null;
    retailPrice?: number;
    originalPrice?: number | null;
    stock?: number;
    tags?: string[];
    sort?: number;
    status?: string;
  },
  tenantId: string
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (body.categoryId !== undefined) {
    fields.push("category_id = ?");
    values.push(body.categoryId);
  }
  if (body.retailPrice !== undefined) {
    fields.push("retail_price = ?");
    values.push(body.retailPrice);
  }
  if (body.originalPrice !== undefined) {
    fields.push("original_price = ?");
    values.push(body.originalPrice);
  }
  if (body.stock !== undefined) {
    fields.push("stock = ?");
    values.push(body.stock);
  }
  if (body.sort !== undefined) {
    fields.push("sort_order = ?");
    values.push(body.sort);
  }
  if (body.status !== undefined) {
    fields.push("status = ?");
    values.push(body.status);
  }
  if (body.tags !== undefined) {
    const tags = body.tags;
    fields.push("is_recommended = ?");
    values.push(tags.includes("RECOMMEND") ? 1 : 0);
    fields.push("is_hot = ?");
    values.push(tags.includes("HOT") ? 1 : 0);
    fields.push("is_new = ?");
    values.push(tags.includes("NEW") ? 1 : 0);
  }
  if (fields.length === 0) {
    return { id };
  }
  values.push(id, tenantId);
  await queryWithTenant(
    `UPDATE t_retail_product SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
    values,
    tenantId
  );
  return { id };
}

/** 移除货架商品（下架删除） */
export async function removeShelfProduct(id: number, tenantId: string) {
  await queryWithTenant(
    "DELETE FROM t_retail_product WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
}

// ────────────────────────────────────────────────────────────
// 2. 在线支付 payments
// ────────────────────────────────────────────────────────────

/** 支付记录列表（t_payment_order，来源 MINIAPP_ORDER） */
export async function listPayments(params: {
  tenantId: string;
  orderNo?: string;
  paymentMethod?: string;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, orderNo, paymentMethod, status, dateStart, dateEnd, page, pageSize } = params;
  const conditions = ["tenant_id = ?", "source_type = 'MINIAPP_ORDER'"];
  const values: unknown[] = [tenantId];

  if (orderNo) {
    conditions.push("source_no LIKE ?");
    values.push(`%${orderNo}%`);
  }
  if (paymentMethod) {
    conditions.push("channel = ?");
    values.push(paymentMethod);
  }
  if (status) {
    conditions.push(paymentStatusCondition(status));
  }
  if (dateStart) {
    conditions.push("created_at >= ?");
    values.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("created_at <= ?");
    values.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_payment_order ${where}`,
    values,
    tenantId
  );
  const rows = await queryWithTenant<PaymentOrderRow>(
    `SELECT pay_no AS paymentNo, source_no AS orderNo, amount,
            channel AS method, status,
            wx_transaction_id AS transactionNo, paid_at AS paidAt, created_at AS createdAt
     FROM t_payment_order ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows.map((row): PaymentOutput => ({
      paymentNo: row.paymentNo,
      orderNo: row.orderNo,
      amount: toNumber(row.amount),
      method: row.method,
      status: mapPaymentStatus(row.status),
      transactionNo: row.transactionNo,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      refundedAt: null,
      remark: null,
    })),
  };
}

/** 支付记录详情 */
export async function getPaymentDetail(paymentNo: string, tenantId: string) {
  const row = await queryOneWithTenant<PaymentOrderRow>(
    `SELECT pay_no AS paymentNo, source_no AS orderNo, amount,
            channel AS method, status,
            wx_transaction_id AS transactionNo, paid_at AS paidAt, created_at AS createdAt
     FROM t_payment_order WHERE pay_no = ? AND tenant_id = ?`,
    [paymentNo, tenantId],
    tenantId
  );
  if (!row) return null;
  return {
    paymentNo: row.paymentNo,
    orderNo: row.orderNo,
    amount: toNumber(row.amount),
    method: row.method,
    status: mapPaymentStatus(row.status),
    transactionNo: row.transactionNo,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    refundedAt: null,
    remark: null,
  } as PaymentOutput;
}

// ────────────────────────────────────────────────────────────
// 3. 配送管理 deliveries（I 配送管理 + M 履约调度）
// ────────────────────────────────────────────────────────────

/** 配送单列表 */
export async function listDeliveries(params: {
  tenantId: string;
  orderNo?: string;
  deliveryStatus?: string;
  dateStart?: string;
  dateEnd?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, orderNo, deliveryStatus, dateStart, dateEnd, page, pageSize } = params;
  const conditions = ["dr.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (orderNo) {
    conditions.push("ro.order_no LIKE ?");
    values.push(`%${orderNo}%`);
  }
  if (deliveryStatus) {
    conditions.push("dr.status = ?");
    values.push(deliveryStatusToDb(deliveryStatus));
  }
  if (dateStart) {
    conditions.push("dr.created_at >= ?");
    values.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("dr.created_at <= ?");
    values.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const joinSql = `FROM t_delivery_record dr
     LEFT JOIN t_retail_order ro ON ro.id = dr.order_id AND ro.tenant_id = dr.tenant_id`;

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total ${joinSql} ${where}`,
    values,
    tenantId
  );
  const rows = await queryWithTenant<DeliveryRecordRow>(
    `SELECT dr.id, dr.delivery_no AS deliveryNo, dr.status AS deliveryStatus,
            dr.rider_name AS rider, dr.rider_phone AS riderPhone, dr.rider_id AS riderId,
            dr.created_at AS createdAt, dr.updated_at AS updatedAt,
            ro.order_no AS orderNo, ro.receiver_name AS customer, ro.delivery_address AS address,
            ro.pay_amount AS amount
     ${joinSql} ${where}
     ORDER BY dr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows.map((row): DeliveryOutput => ({
      id: row.id,
      deliveryNo: row.deliveryNo,
      orderNo: row.orderNo,
      customer: row.customer,
      address: row.address,
      deliveryStatus: mapDeliveryStatus(row.deliveryStatus),
      rider: row.rider,
      riderPhone: row.riderPhone,
      estimatedTime: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  };
}

/** 分配骑手 */
export async function assignDeliveryRider(deliveryId: number, body: { riderId: number; riderName: string }, tenantId: string) {
  const result = await queryWithTenant(
    "UPDATE t_delivery_record SET rider_id = ?, rider_name = ?, status = 'ASSIGNED', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [body.riderId, body.riderName, deliveryId, tenantId],
    tenantId
  );
  const affectedRows = Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
  if (affectedRows === 0) {
    throw Object.assign(new Error("配送单不存在"), { statusCode: 404 });
  }
  return { id: deliveryId, deliveryStatus: "ASSIGNED" };
}

/** 更新配送状态 */
export async function updateDeliveryStatus(deliveryId: number, status: string, tenantId: string) {
  const dbStatus = deliveryStatusToDb(status);
  const fields: string[] = ["status = ?"];
  const values: unknown[] = [dbStatus];
  if (dbStatus === "PICKED_UP") {
    fields.push("picked_up_at = NOW()");
  }
  if (dbStatus === "COMPLETED") {
    fields.push("delivered_at = NOW()");
  }
  fields.push("updated_at = NOW()");
  values.push(deliveryId, tenantId);
  const result = await queryWithTenant(
    `UPDATE t_delivery_record SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
    values,
    tenantId
  );
  const affectedRows = Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
  if (affectedRows === 0) {
    throw Object.assign(new Error("配送单不存在"), { statusCode: 404 });
  }
  return { id: deliveryId, deliveryStatus: status };
}

// ────────────────────────────────────────────────────────────
// 4. 60 秒接单看板 order-board（K）
// ────────────────────────────────────────────────────────────

/** 接单看板：待接单/进行中/已完成三列聚合 */
export async function getOrderBoard(tenantId: string) {
  const rows = await queryWithTenant<PlatformOrderRow>(
    `SELECT id, platform_order_id AS platformOrderId, platform, status,
            order_data_json AS orderDataJson, created_at AS createdAt
     FROM t_platform_order
     WHERE tenant_id = ? AND status IN ('PENDING','ACCEPTED','PREPARING','DELIVERING','COMPLETED')
     ORDER BY created_at DESC
     LIMIT 200`,
    [tenantId],
    tenantId
  );

  const items = rows.map(mapOrderBoardItem);
  const pending = items.filter((it) => it.status === "pending");
  const processing = items.filter((it) => it.status === "processing");
  const completed = items.filter((it) => it.status === "completed");
  const urgentCount = pending.filter((it) => Date.now() - it.createTimestamp > 30_000).length;

  return {
    pending,
    processing,
    completed,
    stats: {
      pendingCount: pending.length,
      processingCount: processing.length,
      completedCount: completed.length,
      urgentCount,
    },
  };
}

// ────────────────────────────────────────────────────────────
// 5. 购物车分析 retail-cart/analysis（E）
// ────────────────────────────────────────────────────────────

/** 购物车分析：总览 + 商品分布 + 最近购物车 */
export async function getRetailCartAnalysis(tenantId: string) {
  const overview = await queryOneWithTenant<CartOverviewRow>(
    `SELECT COUNT(DISTINCT c.user_id, c.store_id) AS totalCarts,
            COALESCE(SUM(c.box_qty + c.bottle_qty), 0) AS totalItems,
            COALESCE(SUM(CASE WHEN c.checked = 1 THEN c.box_qty + c.bottle_qty ELSE 0 END), 0) AS checkedItems,
            COALESCE(SUM((c.box_qty + c.bottle_qty) * COALESCE(pp.retail_price, 0)), 0) AS totalAmount
     FROM t_retail_cart c
     LEFT JOIN t_product_price pp ON pp.sku_id = c.sku_id
     WHERE c.tenant_id = ?`,
    [tenantId],
    tenantId
  );

  const distribution = await queryWithTenant<CartProductRow>(
    `SELECT c.sku_id AS skuId, spu.name AS skuName, ps.sku_code AS sku,
            SUM(c.box_qty + c.bottle_qty) AS quantity,
            COALESCE(SUM((c.box_qty + c.bottle_qty) * COALESCE(pp.retail_price, 0)), 0) AS amount,
            COUNT(*) AS count
     FROM t_retail_cart c
     LEFT JOIN t_product_sku ps ON ps.id = c.sku_id
     LEFT JOIN t_product_spu spu ON spu.id = ps.spu_id
     LEFT JOIN t_product_price pp ON pp.sku_id = c.sku_id
     WHERE c.tenant_id = ?
     GROUP BY c.sku_id, spu.name, ps.sku_code
     ORDER BY quantity DESC
     LIMIT 10`,
    [tenantId],
    tenantId
  );

  const recentCarts = await queryWithTenant<RecentCartRow>(
    `SELECT c.id, c.user_id AS userId, c.store_id AS storeId, c.sku_id AS skuId,
            c.box_qty AS boxQty, c.bottle_qty AS bottleQty, c.checked,
            spu.name AS skuName, ps.sku_code AS sku, c.created_at AS createdAt
     FROM t_retail_cart c
     LEFT JOIN t_product_sku ps ON ps.id = c.sku_id
     LEFT JOIN t_product_spu spu ON spu.id = ps.spu_id
     WHERE c.tenant_id = ?
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT 10`,
    [tenantId],
    tenantId
  );

  const productDistribution = distribution.map((row) => ({
    skuId: row.skuId,
    skuName: row.skuName,
    sku: row.sku,
    quantity: toNumber(row.quantity),
    amount: toNumber(row.amount),
    count: toNumber(row.count),
  }));

  return {
    totalCarts: Number(overview?.totalCarts ?? 0),
    totalItems: Number(overview?.totalItems ?? 0),
    checkedItems: Number(overview?.checkedItems ?? 0),
    totalAmount: toNumber(overview?.totalAmount ?? 0),
    productDistribution,
    topProducts: productDistribution,
    recentCarts: recentCarts.map((row) => ({
      id: row.id,
      userId: row.userId,
      storeId: row.storeId,
      skuId: row.skuId,
      boxQty: toNumber(row.boxQty),
      bottleQty: toNumber(row.bottleQty),
      checked: Number(row.checked) === 1,
      skuName: row.skuName,
      sku: row.sku,
      createdAt: row.createdAt,
    })),
  };
}
