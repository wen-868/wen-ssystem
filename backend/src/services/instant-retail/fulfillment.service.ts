import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { parsePlatformType } from "./adapters/index";
import { getAdapter } from "./adapters/index";
import { getPlatformConfigWithTenant } from "./common.service";
import type { DeliveryBodyInput } from "./types";

// ==================== 类型定义 ====================

/** 平台订单简要行（配送前查询） */
interface PlatformOrderBriefRow {
  platform: string;
  storeId: string;
  status: string;
}

export async function startDelivery(platformOrderId: string, body: DeliveryBodyInput, tenantId: string) {
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
