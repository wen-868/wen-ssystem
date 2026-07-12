import { z } from "zod";
import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { parsePlatformType } from "./adapters/index";
import { getAdapter } from "./adapters/index";
import { getPlatformConfigWithTenant } from "./common.service";

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
