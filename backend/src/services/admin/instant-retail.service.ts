﻿﻿﻿/**
 * 即时零售统一 Service 层
 * 整合 webhook 处理、平台配置管理、订单接单、履约操作
 * 底层委托给 services/instant-retail/ 下的子服务模块
 */

import { z } from "zod";
import logger from "../../shared/logger";
import { query, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { getAdapter, parsePlatformType, parseUnifiedOrder } from "../instant-retail/adapters/index";
import type { PlatformType } from "../instant-retail/types";
import { maskConfig, getPlatformConfig, getPlatformConfigWithTenant } from "../instant-retail/common.service";

// ========== 类型定义 ==========

interface OrderNoRow {
  order_no: string;
}

/** COUNT(*) AS total 查询行 */
interface CountTotalRow {
  total: number | string;
}

/** id 查询行 */
interface IdRow {
  id: number | string;
}

/** 平台配置列表行（简要） */
interface PlatformConfigListRow {
  platform: string;
  storeId: string | null;
  enabled: number | string;
  merchantId: string | null;
  updatedAt: string | Date | null;
}

/** 平台配置详情行 */
interface PlatformConfigDetailRow {
  id: number | string;
  platform: string;
  storeId: string | null;
  appKey: string | null;
  appSecret: string | null;
  merchantId: string | null;
  enabled: number | string;
  configJson: string | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

/** 平台配置存在性检查行 */
interface PlatformConfigExistingRow {
  id: number | string;
  store_id: string | null;
  app_key: string | null;
  app_secret: string | null;
  merchant_id: string | null;
  config_json: string | null;
}

/** 平台订单列表/详情行 */
interface PlatformOrderListRow {
  platformOrderId: string;
  platform: string;
  storeId: string | null;
  status: string;
  orderDataJson: string | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

/** 平台订单状态查询行 */
interface PlatformOrderStatusRow {
  platform: string;
  storeId: string | null;
  status: string;
}

/** 零售店铺配置行 */
interface RetailShopConfigRow {
  id: number | string;
  shopName: string | null;
  shopLogo: string | null;
  shopDescription: string | null;
  contactPhone: string | null;
  businessHours: string | null;
  deliveryEnabled: number | string;
  pickupEnabled: number | string;
  minOrderAmount: number | string;
  deliveryFee: number | string;
  freeDeliveryAmount: number | string | null;
  deliveryRadius: number | string | null;
  estimatedDeliveryTime: string | null;
  announcement: string | null;
  status: number | string;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

/** 零售分类行 */
interface RetailCategoryRow {
  id: number | string;
  categoryName: string;
  categoryIcon: string | null;
  parentId: number | string;
  sortOrder: number | string;
  status: number | string;
  createdAt: string | Date;
}

/** 零售商品列表行 */
interface RetailProductListRow {
  id: number | string;
  productId: number | string;
  categoryId: number | string | null;
  retailPrice: number | string;
  originalPrice: number | string | null;
  stock: number | string;
  salesCount: number | string;
  isRecommended: number | string;
  isHot: number | string;
  isNew: number | string;
  sortOrder: number | string;
  status: number | string;
  productName: string | null;
  skuCode: string | null;
  unit: string | null;
  productImage: string | null;
}

/** 商品 SKU id/name 查询行 */
interface ProductSkuIdNameRow {
  id: number | string;
  name: string;
}

/** 零售订单列表行 */
interface RetailOrderListRow {
  id: number | string;
  orderNo: string;
  platform: string | null;
  platformOrderId: string | null;
  userId: number | string | null;
  userName: string | null;
  userPhone: string | null;
  totalAmount: number | string;
  discountAmount: number | string | null;
  deliveryFee: number | string | null;
  payAmount: number | string;
  deliveryType: string | null;
  deliveryAddress: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentTime: string | Date | null;
  orderStatus: string;
  cancelReason: string | null;
  cancelledAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
}

/** 零售订单详情行 */
interface RetailOrderDetailRow {
  id: number | string;
  orderNo: string;
  userId: number | string | null;
  userName: string | null;
  userPhone: string | null;
  totalAmount: number | string;
  discountAmount: number | string | null;
  deliveryFee: number | string | null;
  payAmount: number | string;
  deliveryType: string | null;
  deliveryAddress: string | null;
  deliveryTime: string | Date | null;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverLatitude: number | string | null;
  receiverLongitude: number | string | null;
  remark: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentTime: string | Date | null;
  transactionNo: string | null;
  orderStatus: string;
  cancelReason: string | null;
  cancelledAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
}

/** 零售订单明细行 */
interface RetailOrderItemRow {
  productId: number | string;
  productName: string | null;
  productImage: string | null;
  price: number | string;
  quantity: number | string;
  subtotal: number | string;
}

/** 零售订单状态查询行 */
interface RetailOrderStatusRow {
  id: number | string;
  order_status: string;
}

/** 零售轮播图行 */
interface RetailBannerRow {
  id: number | string;
  bannerTitle: string;
  bannerImage: string;
  linkType: string | null;
  linkValue: string | null;
  sortOrder: number | string;
  status: number | string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  createdAt: string | Date;
}

/** 订单同步请求参数 */
interface SyncOrdersBody {
  startTime?: string;
  endTime?: string;
  pageSize?: number;
}

/** 商品同步请求参数 */
interface SyncProductsBody {
  cursor?: string;
  limit?: number;
}

/** 配送信息 */
interface DeliveryBody {
  deliveryCompany?: string;
  deliveryNo?: string;
  deliveryMan?: string;
  deliveryPhone?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Webhook 处理
// ────────────────────────────────────────────────────────────────────────────

function buildWebhookResponse(platform: PlatformType, success: boolean, message?: string) {
  if (platform === "JD") {
    return success ? { code: "0", message: message ?? "success" } : { code: "1", message: message ?? "error" };
  }
  if (platform === "MEITUAN") {
    return success ? { data: "OK" } : { data: "FAIL", message: message ?? "error" };
  }
  if (platform === "ELEME") {
    return success ? { code: "200", message: message ?? "success" } : { code: "500", message: message ?? "error" };
  }
  return { code: success ? "0" : "1", message: message ?? (success ? "success" : "error") };
}

export async function handleWebhook(platform: PlatformType, rawBody: Record<string, unknown>, signature: string, timestamp: string) {
  const config = await getPlatformConfig(platform);
  if (!config) {
    logger.warn(`[Webhook] ${platform} 无配置，跳过处理`);
    return { status: 200, response: buildWebhookResponse(platform, true) };
  }

  const adapter = getAdapter(platform, config);

  const verifyResult = await adapter.verifyWebhook(rawBody, signature, timestamp);
  if (!verifyResult.valid) {
    logger.warn(`[Webhook] ${platform} 验签失败`, { signature, timestamp });
    return { status: 400, response: buildWebhookResponse(platform, false, "验签失败") };
  }

  const unified = parseUnifiedOrder(platform, verifyResult.payload ?? rawBody);

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO t_platform_order
         (platform_order_id, platform, store_id, status, order_data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         order_data_json = VALUES(order_data_json),
         updated_at = NOW()`,
      [
        unified.platformOrderId,
        platform,
        unified.storeId,
        unified.status,
        JSON.stringify(rawBody)
      ]
    );

    if (unified.status === "ACCEPTED" || unified.status === "PENDING") {
      const [existingRows] = await conn.query(
        `SELECT order_no FROM t_miniapp_order WHERE order_no = ? LIMIT 1`,
        [unified.orderId]
      ) as unknown as [OrderNoRow[], unknown];
      if (existingRows.length === 0) {
        await conn.execute(
          `INSERT INTO t_miniapp_order
             (order_no, store_id, customer_type, fulfillment_type, order_status, pay_status,
              payable_amount, receiver_name, receiver_mobile, receiver_address, remark, created_at)
           VALUES (?, ?, 'RETAIL', 'DELIVERY', 'PENDING_PAYMENT', 'UNPAID',
                   ?, ?, ?, ?, ?, NOW())`,
          [
            unified.orderId,
            unified.storeId || config.storeId || "1",
            unified.payAmount,
            unified.address.name,
            unified.address.phone,
            `${unified.address.province}${unified.address.city}${unified.address.district}${unified.address.detail}`,
            unified.remark ?? null
          ]
        );
        for (const item of unified.items) {
          await conn.execute(
            `INSERT INTO t_miniapp_order_item
               (order_no, sku_id, sku_name, qty, reserved_qty, unit_price, price_type, subtotal_amount)
             VALUES (?, ?, ?, ?, ?, ?, 'RETAIL', ?)`,
            [
              unified.orderId,
              item.localSkuId || 0,
              item.name,
              item.quantity,
              item.quantity,
              item.unitPrice,
              item.totalPrice
            ]
          );
        }
      }
    }
  });

  return { status: 200, response: buildWebhookResponse(platform, true) };
}

// ────────────────────────────────────────────────────────────────────────────
// 平台管理
// ────────────────────────────────────────────────────────────────────────────

export async function getPlatforms(tenantId: string) {
  const rows = await queryWithTenant<PlatformConfigListRow>(
    `SELECT platform, store_id AS storeId, enabled, merchant_id AS merchantId, updated_at AS updatedAt
     FROM t_platform_config WHERE 1=1
     ORDER BY platform`,
    [],
    tenantId
  );
  const allPlatforms = ["JD", "MEITUAN", "ELEME"];
  const records = allPlatforms.map((p) => {
    const found = rows.find((r) => r.platform === p);
    return {
      platform: p,
      enabled: !!found?.enabled,
      storeId: found?.storeId ?? null,
      merchantId: found?.merchantId ?? null,
      configured: !!found
    };
  });
  return { records };
}

export async function getConfigs(tenantId: string) {
  const rows = await queryWithTenant<PlatformConfigDetailRow>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_config
     ORDER BY platform`,
    [],
    tenantId
  );
  const records = rows.map((r) => maskConfig(r));
  return { records };
}

export async function getConfigByPlatform(platform: string, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  const row = await queryOneWithTenant<PlatformConfigDetailRow>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_config WHERE platform = ? LIMIT 1`,
    [parsedPlatform],
    tenantId
  );
  if (!row) return null;
  return maskConfig(row);
}

export async function upsertConfig(body: unknown, tenantId: string) {
  const parsedBody = z.object({
    platform: z.string(),
    storeId: z.string().optional(),
    appKey: z.string().optional(),
    appSecret: z.string().optional(),
    merchantId: z.string().optional(),
    configJson: z.record(z.unknown()).nullable().optional()
  }).parse(body);

  const platform = parsePlatformType(parsedBody.platform);
  const existing = await queryOneWithTenant<PlatformConfigExistingRow>(
    `SELECT id, store_id as store_id, app_key as app_key, app_secret as app_secret, merchant_id as merchant_id, config_json as config_json FROM t_platform_config WHERE platform = ? LIMIT 1`,
    [platform],
    tenantId
  );

  if (existing) {
    await queryWithTenant(
      `UPDATE t_platform_config
       SET store_id = ?, app_key = ?, app_secret = ?, merchant_id = ?, config_json = ?, updated_at = NOW()
       WHERE platform = ?`,
      [
        parsedBody.storeId ?? existing.store_id ?? "",
        parsedBody.appKey ?? existing.app_key ?? "",
        parsedBody.appSecret ?? existing.app_secret ?? "",
        parsedBody.merchantId ?? existing.merchant_id ?? "",
        parsedBody.configJson ? JSON.stringify(parsedBody.configJson) : existing.config_json ?? null,
        platform
      ],
      tenantId
    );
  } else {
    await query(
      `INSERT INTO t_platform_config
         (platform, store_id, app_key, app_secret, merchant_id, config_json, enabled, created_at, updated_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), ?)`,
      [
        platform,
        parsedBody.storeId ?? "",
        parsedBody.appKey ?? "",
        parsedBody.appSecret ?? "",
        parsedBody.merchantId ?? "",
        parsedBody.configJson ? JSON.stringify(parsedBody.configJson) : null,
        tenantId
      ]
    );
  }

  const row = await queryOneWithTenant<PlatformConfigDetailRow>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_config WHERE platform = ? LIMIT 1`,
    [platform],
    tenantId
  );
  return maskConfig(row);
}

export async function testConnection(platform: string, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  const config = await getPlatformConfigWithTenant(parsedPlatform, undefined, tenantId);
  if (!config) {
    return { found: false };
  }
  const adapter = getAdapter(parsedPlatform, config);
  try {
    const result = await adapter.authenticate();
    return { found: true, platform: parsedPlatform, connected: true, tokenUpdated: !!result.accessToken };
  } catch (err: unknown) {
    return { found: true, platform: parsedPlatform, connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function syncOrders(platform: string, body: SyncOrdersBody, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  const config = await getPlatformConfigWithTenant(parsedPlatform, undefined, tenantId);
  if (!config) {
    return { found: false };
  }
  const adapter = getAdapter(parsedPlatform, config);
  const result = await adapter.syncOrders({
    startTime: body.startTime ? new Date(body.startTime) : undefined,
    endTime: body.endTime ? new Date(body.endTime) : undefined,
  });
  await transaction(async (conn) => {
    for (const order of result.orders) {
      await conn.execute(
        `INSERT INTO t_platform_order
           (platform_order_id, platform, store_id, status, order_data_json, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           order_data_json = VALUES(order_data_json),
           updated_at = NOW()`,
        [
          order.platformOrderId,
          parsedPlatform,
          order.storeId,
          order.status,
          JSON.stringify(order.platformRawData ?? {}),
          tenantId
        ]
      );
    }
  });
  return { found: true, platform: parsedPlatform, synced: result.orders.length, hasMore: result.hasMore };
}

export async function syncProducts(platform: string, body: Record<string, unknown>, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  const config = await getPlatformConfigWithTenant(parsedPlatform, undefined, tenantId);
  if (!config) {
    return { found: false };
  }
  const adapter = getAdapter(parsedPlatform, config);
  const result = await adapter.syncProducts(body);
  return { found: true, platform: parsedPlatform, synced: result.products.length, hasMore: result.hasMore };
}

export async function deleteConfig(platform: string, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  await queryWithTenant(
    `DELETE FROM t_platform_config WHERE platform = ?`,
    [parsedPlatform],
    tenantId
  );
  return { platform: parsedPlatform, deleted: true };
}

// ────────────────────────────────────────────────────────────────────────────
// 门店端订单查询
// ────────────────────────────────────────────────────────────────────────────

export async function listOrders(
  page: number,
  pageSize: number,
  storeId: string | null,
  platform: string | null,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (storeId) {
    conditions.push("store_id = ?");
    params.push(String(storeId));
  }
  if (platform) {
    conditions.push("platform = ?");
    params.push(parsePlatformType(platform));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await queryWithTenant<PlatformOrderListRow>(
    `SELECT platform_order_id AS platformOrderId, platform, store_id AS storeId,
            status, order_data_json AS orderDataJson, created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_order
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_platform_order ${where}`,
    params,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function getOrderDetail(platformOrderId: string, tenantId: string) {
  const order = await queryOneWithTenant<PlatformOrderListRow>(
    `SELECT platform_order_id AS platformOrderId, platform, store_id AS storeId,
            status, order_data_json AS orderDataJson, created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  return order ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// 门店端订单操作
// ────────────────────────────────────────────────────────────────────────────

export async function confirmOrder(platformOrderId: string, tenantId: string) {
  const row = await queryOneWithTenant<PlatformOrderStatusRow>(
    `SELECT platform, store_id AS storeId, status FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId ?? undefined, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.confirmOrder(platformOrderId);
  if (success) {
    await queryWithTenant(
      `UPDATE t_platform_order SET status = 'ACCEPTED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "ACCEPTED" };
}

export async function startDelivery(platformOrderId: string, body: DeliveryBody, tenantId: string) {
  const row = await queryOneWithTenant<PlatformOrderStatusRow>(
    `SELECT platform, store_id AS storeId, status FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId ?? undefined, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.startDelivery(platformOrderId, body);
  if (success) {
    await queryWithTenant(
      `UPDATE t_platform_order SET status = 'DELIVERING', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "DELIVERING" };
}

export async function completeDelivery(platformOrderId: string, tenantId: string) {
  const row = await queryOneWithTenant<PlatformOrderStatusRow>(
    `SELECT platform, store_id AS storeId, status FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId ?? undefined, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.completeDelivery(platformOrderId);
  if (success) {
    await queryWithTenant(
      `UPDATE t_platform_order SET status = 'COMPLETED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "COMPLETED" };
}

export async function cancelOrder(platformOrderId: string, reason: string | undefined, tenantId: string) {
  z.object({ reason: z.string().optional() }).parse({ reason });

  const row = await queryOneWithTenant<PlatformOrderStatusRow>(
    `SELECT platform, store_id AS storeId, status FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId ?? undefined, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.cancelOrder(platformOrderId, reason);
  if (success) {
    await queryWithTenant(
      `UPDATE t_platform_order SET status = 'CANCELLED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "CANCELLED" };
}

// ════════════════════════════════════════════════════════════════════════════
// 即时零售管理后台（instant-retail-new 模块）
// ════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// 店铺配置管理
// ────────────────────────────────────────────────────────────────────────────

// 1. 获取店铺配置
export async function getShopConfig(tenantId: string) {
  const config = await queryOneWithTenant<RetailShopConfigRow>(
    `SELECT id, shop_name AS shopName, shop_logo AS shopLogo, shop_description AS shopDescription,
            contact_phone AS contactPhone, business_hours AS businessHours,
            delivery_enabled AS deliveryEnabled, pickup_enabled AS pickupEnabled,
            min_order_amount AS minOrderAmount, delivery_fee AS deliveryFee,
            free_delivery_amount AS freeDeliveryAmount, delivery_radius AS deliveryRadius,
            estimated_delivery_time AS estimatedDeliveryTime, announcement,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM t_retail_shop_config
     WHERE tenant_id = ?`,
    [tenantId],
    tenantId
  );
  return config || {};
}

// 2. 创建/更新店铺配置
export async function saveShopConfig(body: {
  shopName: string;
  shopLogo?: string;
  shopDescription?: string;
  contactPhone?: string;
  businessHours?: string;
  deliveryEnabled: number;
  pickupEnabled: number;
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryAmount?: number;
  deliveryRadius?: number;
  estimatedDeliveryTime?: string;
  announcement?: string;
}, tenantId: string) {
  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_retail_shop_config WHERE tenant_id = ?",
    [tenantId],
    tenantId
  );

  if (existing) {
    await queryWithTenant(
      `UPDATE t_retail_shop_config SET
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
      ],
      tenantId
    );
  } else {
    await queryWithTenant(
      `INSERT INTO t_retail_shop_config (
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
      ],
      tenantId
    );
  }

  return { success: true };
}

// ────────────────────────────────────────────────────────────────────────────
// 分类管理
// ────────────────────────────────────────────────────────────────────────────

// 3. 获取分类列表
export async function listCategories(tenantId: string) {
  const categories = await queryWithTenant<RetailCategoryRow>(
    `SELECT id, category_name AS categoryName, category_icon AS categoryIcon,
            parent_id AS parentId, sort_order AS sortOrder, status,
            created_at AS createdAt
     FROM t_retail_category
     WHERE tenant_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [tenantId],
    tenantId
  );
  return { total: categories.length, records: categories };
}

// 4. 创建分类
export async function createCategory(body: {
  categoryName: string;
  categoryIcon?: string;
  parentId: number;
  sortOrder: number;
}, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO t_retail_category (category_name, category_icon, parent_id, sort_order, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.categoryName, body.categoryIcon || null, body.parentId, body.sortOrder, tenantId],
    tenantId
  );
  return { success: true };
}

// ────────────────────────────────────────────────────────────────────────────
// 商品管理
// ────────────────────────────────────────────────────────────────────────────

// 5. 获取即时零售商品列表
export async function listRetailProducts(params: {
  tenantId: string;
  categoryId?: number;
  status?: string;
  isRecommended?: number;
  isHot?: number;
  isNew?: number;
  page: number;
  pageSize: number;
}) {
  const { tenantId, categoryId, status, isRecommended, isHot, isNew, page, pageSize } = params;

  const conditions: string[] = ["rp.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (categoryId) {
    conditions.push("rp.category_id = ?");
    queryParams.push(categoryId);
  }
  if (status) {
    conditions.push("rp.status = ?");
    queryParams.push(status);
  }
  if (isRecommended !== undefined) {
    conditions.push("rp.is_recommended = ?");
    queryParams.push(isRecommended);
  }
  if (isHot !== undefined) {
    conditions.push("rp.is_hot = ?");
    queryParams.push(isHot);
  }
  if (isNew !== undefined) {
    conditions.push("rp.is_new = ?");
    queryParams.push(isNew);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<RetailProductListRow>(
    `SELECT rp.id, rp.product_id AS productId, rp.category_id AS categoryId,
            rp.retail_price AS retailPrice, rp.original_price AS originalPrice,
            rp.stock, rp.sales_count AS salesCount,
            rp.is_recommended AS isRecommended, rp.is_hot AS isHot, rp.is_new AS isNew,
            rp.sort_order AS sortOrder, rp.status,
            ps.name AS productName, ps.sku_code AS skuCode, ps.unit,
            ps.image AS productImage
     FROM t_retail_product rp
     LEFT JOIN t_product_sku ps ON ps.id = rp.product_id
     ${where}
     ORDER BY rp.sort_order ASC, rp.id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_retail_product rp ${where}`,
    queryParams,
    tenantId
  );

  return { total: Number(totalRow?.total ?? 0), page, pageSize, records };
}

// 6. 添加商品到即时零售
export async function addRetailProduct(body: {
  productId: number;
  categoryId?: number;
  retailPrice: number;
  originalPrice?: number;
  stock: number;
  isRecommended: number;
  isHot: number;
  isNew: number;
  sortOrder: number;
}, tenantId: string) {
  const product = await queryOneWithTenant<ProductSkuIdNameRow>(
    "SELECT id, name FROM t_product_sku WHERE id = ? AND tenant_id = ?",
    [body.productId, tenantId],
    tenantId
  );

  if (!product) throw Object.assign(new Error("商品不存在"), { statusCode: 404 });

  await queryWithTenant(
    `INSERT INTO t_retail_product (
      product_id, category_id, retail_price, original_price, stock,
      is_recommended, is_hot, is_new, sort_order, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.productId, body.categoryId || null, body.retailPrice,
      body.originalPrice || body.retailPrice, body.stock,
      body.isRecommended, body.isHot, body.isNew, body.sortOrder, tenantId
    ],
    tenantId
  );

  return { success: true };
}

// ────────────────────────────────────────────────────────────────────────────
// 订单管理
// ────────────────────────────────────────────────────────────────────────────

// 7. 订单列表
export async function listRetailOrders(params: {
  tenantId: string;
  orderStatus?: string;
  paymentStatus?: string;
  platform?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, orderStatus, paymentStatus, platform, keyword, startDate, endDate, page, pageSize } = params;

  const conditions: string[] = ["tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (orderStatus) {
    conditions.push("order_status = ?");
    queryParams.push(orderStatus);
  }
  if (paymentStatus) {
    conditions.push("payment_status = ?");
    queryParams.push(paymentStatus);
  }
  if (platform) {
    conditions.push("platform = ?");
    queryParams.push(platform);
  }
  if (keyword) {
    const like = `%${keyword}%`;
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_phone LIKE ? OR user_name LIKE ?)");
    queryParams.push(like, like, like, like);
  }
  if (startDate) {
    conditions.push("DATE(created_at) >= ?");
    queryParams.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(created_at) <= ?");
    queryParams.push(endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<RetailOrderListRow>(
    `SELECT id, order_no AS orderNo, user_id AS userId, user_name AS userName,
            user_phone AS userPhone, total_amount AS totalAmount,
            discount_amount AS discountAmount, delivery_fee AS deliveryFee,
            pay_amount AS payAmount, delivery_type AS deliveryType,
            delivery_address AS deliveryAddress, receiver_name AS receiverName,
            receiver_phone AS receiverPhone, payment_status AS paymentStatus,
            payment_method AS paymentMethod, payment_time AS paymentTime,
            order_status AS orderStatus, cancel_reason AS cancelReason,
            cancelled_at AS cancelledAt, completed_at AS completedAt,
            platform, platform_order_id AS platformOrderId,
            created_at AS createdAt
     FROM t_retail_order
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_retail_order ${where}`,
    queryParams,
    tenantId
  );

  return { total: Number(totalRow?.total ?? 0), page, pageSize, records };
}

// 8. 订单详情 + items
export async function getRetailOrderDetail(orderNo: string, tenantId: string) {
  const order = await queryOneWithTenant<RetailOrderDetailRow>(
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
     FROM t_retail_order
     WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId],
    tenantId
  );

  if (!order) throw Object.assign(new Error("订单不存在"), { statusCode: 404 });

  const items = await queryWithTenant<RetailOrderItemRow>(
    `SELECT product_id AS productId, product_name AS productName,
            product_image AS productImage, price, quantity, subtotal
     FROM t_retail_order_item
     WHERE order_id = ?`,
    [order.id],
    tenantId
  );

  return { ...order, items };
}

// 9. 更新订单状态
export async function updateRetailOrderStatus(params: {
  orderNo: string;
  tenantId: string;
  orderStatus: string;
  cancelReason?: string;
}) {
  const { orderNo, tenantId, orderStatus, cancelReason } = params;

  const order = await queryOneWithTenant<RetailOrderStatusRow>(
    "SELECT id, order_status FROM t_retail_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId],
    tenantId
  );

  if (!order) throw Object.assign(new Error("订单不存在"), { statusCode: 404 });

  const updates: string[] = ["order_status = ?", "updated_at = NOW()"];
  const updateParams: unknown[] = [orderStatus];

  if (orderStatus === "CANCELLED") {
    updates.push("cancel_reason = ?", "cancelled_at = NOW()");
    updateParams.push(cancelReason || null, new Date());
  } else if (orderStatus === "COMPLETED") {
    updates.push("completed_at = NOW()");
    updateParams.push(new Date());
  }

  updateParams.push(orderNo, tenantId);
  await queryWithTenant(
    `UPDATE t_retail_order SET ${updates.join(", ")} WHERE order_no = ? AND tenant_id = ?`,
    updateParams,
    tenantId
  );

  return { order_no: orderNo, order_status: orderStatus };
}

// ────────────────────────────────────────────────────────────────────────────
// 轮播图管理
// ────────────────────────────────────────────────────────────────────────────

// 10. 获取轮播图列表
export async function listBanners(tenantId: string) {
  const banners = await queryWithTenant<RetailBannerRow>(
    `SELECT id, banner_title AS bannerTitle, banner_image AS bannerImage,
            link_type AS linkType, link_value AS linkValue,
            sort_order AS sortOrder, status, start_time AS startTime,
            end_time AS endTime, created_at AS createdAt
     FROM t_retail_banner
     WHERE tenant_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [tenantId],
    tenantId
  );
  return { total: banners.length, records: banners };
}

// 11. 创建轮播图
export async function createBanner(body: {
  bannerTitle: string;
  bannerImage: string;
  linkType?: string;
  linkValue?: string;
  sortOrder: number;
  startTime?: string;
  endTime?: string;
}, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO t_retail_banner (
      banner_title, banner_image, link_type, link_value,
      sort_order, start_time, end_time, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.bannerTitle, body.bannerImage, body.linkType || null,
      body.linkValue || null, body.sortOrder, body.startTime || null,
      body.endTime || null, tenantId
    ],
    tenantId
  );
  return { success: true };
}
