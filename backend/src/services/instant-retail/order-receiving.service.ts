import { z } from "zod";
import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { parsePlatformType } from "./adapters/index";
import { getAdapter } from "./adapters/index";
import { getPlatformConfigWithTenant } from "./common.service";
import { warnIfStockShortage } from "./shortage-handler.service";
import logger from "../../shared/logger";

// ==================== 类型定义 ====================

/** 平台订单行（详情/列表） */
interface PlatformOrderRow {
  platformOrderId: string;
  platform: string;
  storeId: string;
  status: string;
  orderDataJson: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** 平台订单简要行（接单/取消/配送前查询） */
interface PlatformOrderBriefRow {
  platform: string;
  storeId: string;
  status: string;
}

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

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
  const records = await queryWithTenant<PlatformOrderRow>(
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
  const order = await queryOneWithTenant<PlatformOrderRow>(
    `SELECT platform_order_id AS platformOrderId, platform, store_id AS storeId,
            status, order_data_json AS orderDataJson, created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
    [platformOrderId],
    tenantId
  );
  return order ?? null;
}

export async function confirmOrder(platformOrderId: string, tenantId: string) {
  const row = await queryOneWithTenant<PlatformOrderBriefRow>(
    `SELECT platform, store_id AS storeId, status FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
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
      `UPDATE t_platform_order SET status = 'ACCEPTED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  // S3-79（业主裁定"仅告警"）：接单成功后校验库存，缺货只告警、**不拒单**；告警链路异常不影响接单
  let stockWarnings: Array<{ productId: number; stock: number }> = [];
  if (success) {
    try {
      const orderRow = await queryOneWithTenant<{ orderDataJson: string | null }>(
        `SELECT order_data_json AS orderDataJson FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
        [platformOrderId],
        tenantId
      );
      const warned = await warnIfStockShortage({
        orderNo: platformOrderId,
        platform,
        storeId: Number(row.storeId ?? 0),
        orderDataJson: orderRow?.orderDataJson ?? null,
        tenantId,
      });
      stockWarnings = warned.shortages;
    } catch (e) {
      logger.warn(`[order-receiving] 缺货告警执行失败（不影响接单）: ${(e as Error).message}`);
    }
  }
  return { found: true, configFound: true, platformOrderId, success, status: "ACCEPTED", stockWarnings };
}

export async function cancelOrder(platformOrderId: string, reason: string | undefined, tenantId: string) {
  z.object({ reason: z.string().optional() }).parse({ reason });

  const row = await queryOneWithTenant<PlatformOrderBriefRow>(
    `SELECT platform, store_id AS storeId, status FROM t_platform_order WHERE platform_order_id = ? LIMIT 1`,
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
      `UPDATE t_platform_order SET status = 'CANCELLED', updated_at = NOW() WHERE platform_order_id = ?`,
      [platformOrderId],
      tenantId
    );
  }
  return { found: true, configFound: true, platformOrderId, success, status: "CANCELLED" };
}
