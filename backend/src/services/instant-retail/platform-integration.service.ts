import { z } from "zod";
import logger from "../../shared/logger";
import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { getAdapter, parsePlatformType, parseUnifiedOrder } from "./adapters/index";
import type { PlatformType, SyncOrdersParams, SyncProductsParams } from "./types";
import { maskConfig, getPlatformConfig, getPlatformConfigWithTenant } from "./common.service";

// ========== 类型定义 ==========

interface OrderNoRow {
  order_no: string;
}

/** 平台配置列表行（getPlatforms 简要字段） */
interface PlatformConfigListRow {
  platform: string;
  storeId: string;
  enabled: number;
  merchantId: string;
  updatedAt: string | Date;
}

/** 平台配置行（带别名，getConfigs/getConfigByPlatform/upsertConfig 返回） */
interface PlatformConfigRow {
  id: number;
  platform: string;
  storeId: string;
  appKey: string;
  appSecret: string;
  merchantId: string;
  enabled: number;
  configJson: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** 平台配置已存在行（upsertConfig 查询是否已存在，snake_case 字段） */
interface PlatformConfigExistingRow {
  id: number;
  store_id: string;
  app_key: string;
  app_secret: string;
  merchant_id: string;
  config_json: string | null;
}

export function buildWebhookResponse(platform: PlatformType, success: boolean, message?: string) {
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
    return { success: true, response: buildWebhookResponse(platform, true), status: 200 };
  }

  const adapter = getAdapter(platform, config);

  const verifyResult = await adapter.verifyWebhook(rawBody, signature, timestamp);
  if (!verifyResult.valid) {
    logger.warn(`[Webhook] ${platform} 验签失败`, { signature, timestamp });
    return { success: false, response: buildWebhookResponse(platform, false, "验签失败"), status: 400 };
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

  return { success: true, response: buildWebhookResponse(platform, true), status: 200 };
}

export async function getPlatforms(tenantId: string) {
  const rows = await queryWithTenant<PlatformConfigListRow>(
    `SELECT platform, store_id AS storeId, enabled, merchant_id AS merchantId, updated_at AS updatedAt
     FROM t_platform_config
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
  const rows = await queryWithTenant<PlatformConfigRow>(
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
  const row = await queryOneWithTenant<PlatformConfigRow>(
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

  const row = await queryOneWithTenant<PlatformConfigRow>(
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
    return { found: true, platform: parsedPlatform, connected: false, error: (err as Error)?.message ?? String(err) };
  }
}

export async function syncOrders(platform: string, body: SyncOrdersParams, tenantId: string) {
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

export async function syncProducts(platform: string, body: unknown, tenantId: string) {
  const parsedPlatform = parsePlatformType(platform);
  const config = await getPlatformConfigWithTenant(parsedPlatform, undefined, tenantId);
  if (!config) {
    return { found: false };
  }
  const adapter = getAdapter(parsedPlatform, config);
  const result = await adapter.syncProducts(body as SyncProductsParams);
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
