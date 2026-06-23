import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const instantRetailRouter = Router();

// ========== 店铺配置管理 ==========

// 获取店铺配置
instantRetailRouter.get("/shop-config", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const config = await queryOne<any>(
    `SELECT id, shop_name AS shopName, shop_logo AS shopLogo, shop_description AS shopDescription,
            contact_phone AS contactPhone, business_hours AS businessHours,
            delivery_enabled AS deliveryEnabled, pickup_enabled AS pickupEnabled,
            min_order_amount AS minOrderAmount, delivery_fee AS deliveryFee,
            free_delivery_amount AS freeDeliveryAmount, delivery_radius AS deliveryRadius,
            estimated_delivery_time AS estimatedDeliveryTime, announcement,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM retail_shop_config
     WHERE tenant_id = ?`,
    [tenantId]
  );

  res.json(ok(config || {}));
}));

// 创建/更新店铺配置
instantRetailRouter.post("/shop-config", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const body = z.object({
    shopName: z.string().min(1).max(128),
    shopLogo: z.string().max(255).optional(),
    shopDescription: z.string().max(500).optional(),
    contactPhone: z.string().max(20).optional(),
    businessHours: z.string().max(100).optional(),
    deliveryEnabled: z.number().int().min(0).max(1).default(1),
    pickupEnabled: z.number().int().min(0).max(1).default(1),
    minOrderAmount: z.number().min(0).default(0),
    deliveryFee: z.number().min(0).default(0),
    freeDeliveryAmount: z.number().min(0).optional(),
    deliveryRadius: z.number().int().min(0).optional(),
    estimatedDeliveryTime: z.string().max(50).optional(),
    announcement: z.string().optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id FROM retail_shop_config WHERE tenant_id = ?",
    [tenantId]
  );

  if (existing) {
    // 更新
    await query(
      `UPDATE retail_shop_config SET
        shop_name = ?, shop_logo = ?, shop_description = ?, contact_phone = ?,
        business_hours = ?, delivery_enabled = ?, pickup_enabled = ?,
        min_order_amount = ?, delivery_fee = ?, free_delivery_amount = ?,
        delivery_radius = ?, estimated_delivery_time = ?, announcement = ?
       WHERE tenant_id = ?`,
      [
        body.shopName, body.shopLogo || null, body.shopDescription || null,
        body.contactPhone || null, body.businessHours || null,
        body.deliveryEnabled, body.pickupEnabled,
        body.minOrderAmount, body.deliveryFee, body.freeDeliveryAmount || null,
        body.deliveryRadius || null, body.estimatedDeliveryTime || null,
        body.announcement || null, tenantId
      ]
    );
  } else {
    // 创建
    await query(
      `INSERT INTO retail_shop_config (
        shop_name, shop_logo, shop_description, contact_phone, business_hours,
        delivery_enabled, pickup_enabled, min_order_amount, delivery_fee,
        free_delivery_amount, delivery_radius, estimated_delivery_time,
        announcement, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.shopName, body.shopLogo || null, body.shopDescription || null,
        body.contactPhone || null, body.businessHours || null,
        body.deliveryEnabled, body.pickupEnabled,
        body.minOrderAmount, body.deliveryFee, body.freeDeliveryAmount || null,
        body.deliveryRadius || null, body.estimatedDeliveryTime || null,
        body.announcement || null, tenantId
      ]
    );
  }

  res.json(ok({ success: true }));
}));

// ========== 分类管理 ==========

// 获取分类列表
instantRetailRouter.get("/categories", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const categories = await query<any>(
    `SELECT id, category_name AS categoryName, category_icon AS categoryIcon,
            parent_id AS parentId, sort_order AS sortOrder, status,
            created_at AS createdAt
     FROM retail_category
     WHERE tenant_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [tenantId]
  );

  res.json(ok({ total: categories.length, records: categories }));
}));

// 创建分类
instantRetailRouter.post("/categories", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const body = z.object({
    categoryName: z.string().min(1).max(64),
    categoryIcon: z.string().max(255).optional(),
    parentId: z.number().int().default(0),
    sortOrder: z.number().int().default(0),
  }).parse(req.body);

  await query(
    `INSERT INTO retail_category (category_name, category_icon, parent_id, sort_order, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.categoryName, body.categoryIcon || null, body.parentId, body.sortOrder, tenantId]
  );

  res.json(ok({ success: true }));
}));

// ========== 商品管理 ==========

// 获取即时零售商品列表
instantRetailRouter.get("/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { categoryId, status, isRecommended, isHot, isNew, page = 1, pageSize = 20 } = req.query;

  const conditions: string[] = ["rp.tenant_id = ?"];
  const params: any[] = [tenantId];

  if (categoryId) {
    conditions.push("rp.category_id = ?");
    params.push(Number(categoryId));
  }
  if (status) {
    conditions.push("rp.status = ?");
    params.push(status);
  }
  if (isRecommended !== undefined) {
    conditions.push("rp.is_recommended = ?");
    params.push(Number(isRecommended));
  }
  if (isHot !== undefined) {
    conditions.push("rp.is_hot = ?");
    params.push(Number(isHot));
  }
  if (isNew !== undefined) {
    conditions.push("rp.is_new = ?");
    params.push(Number(isNew));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT rp.id, rp.product_id AS productId, rp.category_id AS categoryId,
            rp.retail_price AS retailPrice, rp.original_price AS originalPrice,
            rp.stock, rp.sales_count AS salesCount,
            rp.is_recommended AS isRecommended, rp.is_hot AS isHot, rp.is_new AS isNew,
            rp.sort_order AS sortOrder, rp.status,
            ps.name AS productName, ps.sku_code AS skuCode, ps.unit,
            ps.image AS productImage
     FROM retail_product rp
     LEFT JOIN product_sku ps ON ps.id = rp.product_id
     ${where}
     ORDER BY rp.sort_order ASC, rp.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM retail_product rp ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// 添加商品到即时零售
instantRetailRouter.post("/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const body = z.object({
    productId: z.number().int().positive(),
    categoryId: z.number().int().optional(),
    retailPrice: z.number().min(0),
    originalPrice: z.number().min(0).optional(),
    stock: z.number().int().min(0).default(0),
    isRecommended: z.number().int().min(0).max(1).default(0),
    isHot: z.number().int().min(0).max(1).default(0),
    isNew: z.number().int().min(0).max(1).default(0),
    sortOrder: z.number().int().default(0),
  }).parse(req.body);

  // 验证商品是否存在
  const product = await queryOne<any>(
    "SELECT id, name FROM product_sku WHERE id = ? AND tenant_id = ?",
    [body.productId, tenantId]
  );

  if (!product) {
    res.status(404).json({ code: "404", message: "商品不存在" });
    return;
  }

  await query(
    `INSERT INTO retail_product (
      product_id, category_id, retail_price, original_price, stock,
      is_recommended, is_hot, is_new, sort_order, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.productId, body.categoryId || null, body.retailPrice,
      body.originalPrice || body.retailPrice, body.stock,
      body.isRecommended, body.isHot, body.isNew, body.sortOrder, tenantId
    ]
  );

  res.json(ok({ success: true }));
}));

// ========== 订单管理 ==========

// 获取即时零售订单列表
instantRetailRouter.get("/orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { orderStatus, paymentStatus, startDate, endDate, page = 1, pageSize = 20 } = req.query;

  const conditions: string[] = ["tenant_id = ?"];
  const params: any[] = [tenantId];

  if (orderStatus) {
    conditions.push("order_status = ?");
    params.push(orderStatus);
  }
  if (paymentStatus) {
    conditions.push("payment_status = ?");
    params.push(paymentStatus);
  }
  if (startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT id, order_no AS orderNo, user_id AS userId, user_name AS userName,
            user_phone AS userPhone, total_amount AS totalAmount,
            discount_amount AS discountAmount, delivery_fee AS deliveryFee,
            pay_amount AS payAmount, delivery_type AS deliveryType,
            delivery_address AS deliveryAddress, receiver_name AS receiverName,
            receiver_phone AS receiverPhone, payment_status AS paymentStatus,
            payment_method AS paymentMethod, payment_time AS paymentTime,
            order_status AS orderStatus, cancel_reason AS cancelReason,
            cancelled_at AS cancelledAt, completed_at AS completedAt,
            created_at AS createdAt
     FROM retail_order
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM retail_order ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// 获取订单详情
instantRetailRouter.get("/orders/:orderNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { orderNo } = req.params;

  const order = await queryOne<any>(
    `SELECT id, order_no AS orderNo, user_id AS userId, user_name AS userName,
            user_phone AS userPhone, total_amount AS totalAmount,
            discount_amount AS discountAmount, delivery_fee AS deliveryFee,
            pay_amount AS payAmount, delivery_type AS deliveryType,
            delivery_address AS deliveryAddress, delivery_time AS deliveryTime,
            receiver_name AS receiverName, receiver_phone AS receiverPhone,
            receiver_latitude AS receiverLatitude, receiver_longitude AS receiverLongitude,
            remark, payment_status AS paymentStatus, payment_method AS paymentMethod,
            payment_time AS paymentTime, transaction_no AS transactionNo,
            order_status AS orderStatus, cancel_reason AS cancelReason,
            cancelled_at AS cancelledAt, completed_at AS completedAt,
            created_at AS createdAt
     FROM retail_order
     WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }

  // 查询订单商品
  const items = await query<any>(
    `SELECT product_id AS productId, product_name AS productName,
            product_image AS productImage, price, quantity, subtotal
     FROM retail_order_item
     WHERE order_id = ?`,
    [order.id]
  );

  res.json(ok({ ...order, items }));
}));

// 更新订单状态
instantRetailRouter.put("/orders/:orderNo/status", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { orderNo } = req.params;

  const body = z.object({
    orderStatus: z.enum(["PENDING", "CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED"]),
    cancelReason: z.string().max(255).optional(),
  }).parse(req.body);

  const order = await queryOne<any>(
    "SELECT id, order_status FROM retail_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }

  const updates: string[] = ["order_status = ?", "updated_at = NOW()"];
  const params: any[] = [body.orderStatus];

  if (body.orderStatus === "CANCELLED") {
    updates.push("cancel_reason = ?", "cancelled_at = NOW()");
    params.push(body.cancelReason || null, new Date());
  } else if (body.orderStatus === "COMPLETED") {
    updates.push("completed_at = NOW()");
    params.push(new Date());
  }

  params.push(orderNo, tenantId);
  await query(
    `UPDATE retail_order SET ${updates.join(", ")} WHERE order_no = ? AND tenant_id = ?`,
    params
  );

  res.json(ok({ order_no: orderNo, order_status: body.orderStatus }));
}));

// ========== 轮播图管理 ==========

// 获取轮播图列表
instantRetailRouter.get("/banners", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const banners = await query<any>(
    `SELECT id, banner_title AS bannerTitle, banner_image AS bannerImage,
            link_type AS linkType, link_value AS linkValue,
            sort_order AS sortOrder, status, start_time AS startTime,
            end_time AS endTime, created_at AS createdAt
     FROM retail_banner
     WHERE tenant_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [tenantId]
  );

  res.json(ok({ total: banners.length, records: banners }));
}));

// 创建轮播图
instantRetailRouter.post("/banners", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const body = z.object({
    bannerTitle: z.string().min(1).max(128),
    bannerImage: z.string().min(1).max(255),
    linkType: z.enum(["PRODUCT", "CATEGORY", "URL"]).optional(),
    linkValue: z.string().max(255).optional(),
    sortOrder: z.number().int().default(0),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  }).parse(req.body);

  await query(
    `INSERT INTO retail_banner (
      banner_title, banner_image, link_type, link_value,
      sort_order, start_time, end_time, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.bannerTitle, body.bannerImage, body.linkType || null,
      body.linkValue || null, body.sortOrder, body.startTime || null,
      body.endTime || null, tenantId
    ]
  );

  res.json(ok({ success: true }));
}));
