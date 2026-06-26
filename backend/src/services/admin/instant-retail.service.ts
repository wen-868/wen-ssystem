/**
 * 即时零售统一 Service 层
 * 整合 webhook 处理、平台配置管理、订单接单、履约操作
 * 底层委托给 services/instant-retail/ 下的子服务模块
 */

import { z } from "zod";
import { query, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { getAdapter, parsePlatformType, parseUnifiedOrder } from "../instant-retail/adapters/index.js";
import type { PlatformType } from "../instant-retail/types.js";
import { maskConfig, getPlatformConfig, getPlatformConfigWithTenant } from "../instant-retail/common.service.js";

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

export async function handleWebhook(platform: PlatformType, rawBody: any, signature: string, timestamp: string) {
  const config = await getPlatformConfig(platform);
  if (!config) {
    console.warn(`[Webhook] ${platform} 无配置，跳过处理`);
    return { status: 200, response: buildWebhookResponse(platform, true) };
  }

  const adapter = getAdapter(platform, config);

  const verifyResult = await adapter.verifyWebhook(rawBody, signature, timestamp);
  if (!verifyResult.valid) {
    console.warn(`[Webhook] ${platform} 验签失败`, { signature, timestamp });
    return { status: 400, response: buildWebhookResponse(platform, false, "验签失败") };
  }

  const unified = parseUnifiedOrder(platform, verifyResult.payload ?? rawBody);

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO platform_order
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
      const [existingRows] = await conn.query<any[]>(
        `SELECT order_no FROM miniapp_order WHERE order_no = ? LIMIT 1`,
        [unified.orderId]
      );
      if (existingRows.length === 0) {
        await conn.execute(
          `INSERT INTO miniapp_order
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
            `INSERT INTO miniapp_order_item
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
  const rows = await queryWithTenant<any>(
    `SELECT platform, store_id AS storeId, enabled, merchant_id AS merchantId, updated_at AS updatedAt
     FROM platform_config
     ORDER BY platform`,
    [],
    tenantId
  );
  const allPlatforms = ["JD", "MEITUAN", "ELEME"];
  const records = allPlatforms.map((p) => {
    const found = rows.find((r: any) => r.platform === p);
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
  const rows = await queryWithTenant<any>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_config
     ORDER BY platform`,
    [],
    tenantId
  );
  const records = rows.map((r: any) => maskConfig(r));
  return { records };
}

export async function getConfigByPlatform(platform: string, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  const row = await queryOneWithTenant<any>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_config WHERE platform = ? LIMIT 1`,
    [parsedPlatform],
    tenantId
  );
  if (!row) return null;
  return maskConfig(row);
}

export async function upsertConfig(body: any, tenantId: string) {
  const parsedBody = z.object({
    platform: z.string(),
    storeId: z.string().optional(),
    appKey: z.string().optional(),
    appSecret: z.string().optional(),
    merchantId: z.string().optional(),
    configJson: z.record(z.unknown()).nullable().optional()
  }).parse(body);

  const platform = parsePlatformType(parsedBody.platform);
  const existing = await queryOneWithTenant<any>(
    `SELECT id, store_id as store_id, app_key as app_key, app_secret as app_secret, merchant_id as merchant_id, config_json as config_json FROM platform_config WHERE platform = ? LIMIT 1`,
    [platform],
    tenantId
  );

  if (existing) {
    await queryWithTenant(
      `UPDATE platform_config
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
      `INSERT INTO platform_config
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

  const row = await queryOneWithTenant<any>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_config WHERE platform = ? LIMIT 1`,
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
  } catch (err: any) {
    return { found: true, platform: parsedPlatform, connected: false, error: err.message };
  }
}

export async function syncOrders(platform: string, body: any, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  const config = await getPlatformConfigWithTenant(parsedPlatform, undefined, tenantId);
  if (!config) {
    return { found: false };
  }
  const adapter = getAdapter(parsedPlatform, config);
  const result = await adapter.syncOrders(body);
  await transaction(async (conn) => {
    for (const order of result.orders) {
      await conn.execute(
        `INSERT INTO platform_order
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

export async function syncProducts(platform: string, body: any, tenantId: string) {
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
    `DELETE FROM platform_config WHERE platform = ?`,
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
  const records = await queryWithTenant<any>(
    `SELECT platform_order_id AS platformOrderId, platform, store_id AS storeId,
            status, order_data_json AS orderDataJson, created_at AS createdAt, updated_at AS updatedAt
     FROM platform_order
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM platform_order ${where}`,
    params,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function getOrderDetail(platformOrderId: string, tenantId: string) {
  const order = await queryOneWithTenant<any>(
    `SELECT platform_order_id AS platformOrderId, platform, store_id AS storeId,
            status, order_data_json AS orderDataJson, created_at AS createdAt, updated_at AS updatedAt
     FROM platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  return order ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// 门店端订单操作
// ────────────────────────────────────────────────────────────────────────────

export async function confirmOrder(platformOrderId: string, tenantId: string) {
  const row = await queryOneWithTenant<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.confirmOrder(platformOrderId);
  if (success) {
    await queryWithTenant(
      `UPDATE platform_order SET status = 'ACCEPTED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "ACCEPTED" };
}

export async function startDelivery(platformOrderId: string, body: any, tenantId: string) {
  const row = await queryOneWithTenant<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.startDelivery(platformOrderId, body);
  if (success) {
    await queryWithTenant(
      `UPDATE platform_order SET status = 'DELIVERING', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "DELIVERING" };
}

export async function completeDelivery(platformOrderId: string, tenantId: string) {
  const row = await queryOneWithTenant<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.completeDelivery(platformOrderId);
  if (success) {
    await queryWithTenant(
      `UPDATE platform_order SET status = 'COMPLETED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "COMPLETED" };
}

export async function cancelOrder(platformOrderId: string, reason: string | undefined, tenantId: string) {
  z.object({ reason: z.string().optional() }).parse({ reason });

  const row = await queryOneWithTenant<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  if (!row) {
    return { found: false };
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfigWithTenant(platform, row.storeId, tenantId);
  if (!config) {
    return { found: true, configFound: false };
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.cancelOrder(platformOrderId, reason);
  if (success) {
    await queryWithTenant(
      `UPDATE platform_order SET status = 'CANCELLED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "CANCELLED" };
}