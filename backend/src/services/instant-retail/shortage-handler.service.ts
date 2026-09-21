/**
 * 缺货处理（**仅告警**版）
 *
 * 业主 2026-09-22 裁定：平台订单出现缺货时 **仅告警，不自动拒单**。
 * ⇒ 本文件只做三件事：① 校验库存 ② 记日志 ③ 通知租户管理员（走"落库 + 推送"入口）。
 * **不取消订单、不扣减库存** —— 原「自动拒单 / 扣减库存」编排已删除：既与业主决策相反，也从未被任何代码调用。
 *
 * 关联：S3-79（清理专项发现的未接线缺口）、S3-78（通知推送）
 */
import { queryOneWithTenant, queryOne } from "../../shared/db";
import { parseUnifiedOrder } from "./adapters/index";
import type { PlatformType } from "./types";
import { sendNotificationWithPush } from "../admin/notification-sender.service";
import logger from "../../shared/logger";

/** 待校验的商品项（product_id = 本地商品 id，即统一订单里的 localSkuId） */
export interface OrderItem {
  product_id: number;
  quantity: number;
}

/** 零售商品库存行 */
interface RetailProductStockRow {
  id: number;
  stock: number;
}

interface TenantAdminRow {
  id: number;
}

/** 检测缺货：返回库存不足的商品及其当前库存 */
export async function checkStock(
  storeId: number,
  items: OrderItem[],
  tenantId: string
): Promise<{ ok: boolean; shortages: Array<{ productId: number; stock: number }> }> {
  const shortages: Array<{ productId: number; stock: number }> = [];
  for (const item of items) {
    const product = await queryOneWithTenant<RetailProductStockRow>(
      "SELECT id, stock FROM t_retail_product WHERE id = ? AND store_id = ? AND tenant_id = ?",
      [item.product_id, storeId, tenantId],
      tenantId
    );
    if (!product || Number(product.stock) < item.quantity) {
      shortages.push({ productId: item.product_id, stock: product ? Number(product.stock) : 0 });
    }
  }
  return { ok: shortages.length === 0, shortages };
}

/**
 * 从「平台原始报文」提取待校验商品项。
 *
 * `t_platform_order.order_data_json` 存的是**平台原始报文**（各平台字段名不同），
 * 故复用 `parseUnifiedOrder()` 已做好的跨平台归一化（items/products/orderItems/detail + qty/quantity/num/count）。
 * `localSkuId === '0'` 表示平台未给本地商品 id（无法校验）⇒ 跳过，避免误报缺货。
 */
export function extractOrderItems(platform: PlatformType, orderDataJson: string | null | undefined): OrderItem[] {
  if (!orderDataJson) return [];
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(orderDataJson) as Record<string, unknown>;
  } catch {
    logger.warn("[shortage] order_data_json 解析失败，跳过库存校验");
    return [];
  }
  const unified = parseUnifiedOrder(platform, raw);
  return unified.items
    .map((it) => ({ product_id: Number(it.localSkuId), quantity: Number(it.quantity) }))
    .filter((it) => Number.isFinite(it.product_id) && it.product_id > 0 && it.quantity > 0);
}

/** 找租户管理员（与 monitor.service 同口径：优先 admin / tenant_admin） */
export async function findTenantAdminId(tenantId: string): Promise<number | null> {
  const admin = await queryOne<TenantAdminRow>(
    `SELECT id FROM t_sys_user
     WHERE tenant_id = ? AND username IN ('admin', 'tenant_admin')
     ORDER BY FIELD(username, 'admin', 'tenant_admin')
     LIMIT 1`,
    [tenantId]
  );
  return admin?.id ?? null;
}

/**
 * 缺货告警（**仅告警**，绝不拦截接单）
 *
 * - 有缺货：`logger.warn` + 给租户管理员发一条 ALERT 通知（落库 + 推送；推送失败不影响记录）
 * - 无缺货 / 无法解析 / 任何异常：静默返回，**不得影响接单主流程**
 */
export async function warnIfStockShortage(params: {
  orderNo: string;
  platform: PlatformType;
  storeId: number;
  orderDataJson: string | null | undefined;
  tenantId: string;
}): Promise<{ checked: number; shortages: Array<{ productId: number; stock: number }> }> {
  const { orderNo, platform, storeId, orderDataJson, tenantId } = params;
  try {
    const items = extractOrderItems(platform, orderDataJson);
    if (items.length === 0) return { checked: 0, shortages: [] };

    const stockCheck = await checkStock(storeId, items, tenantId);
    if (stockCheck.ok) return { checked: items.length, shortages: [] };

    const detail = stockCheck.shortages.map((s) => `商品${s.productId}(库存${s.stock})`).join("、");
    logger.warn(`[shortage] 平台订单 ${orderNo} 存在缺货风险（仅告警，未拒单）: ${detail}`);

    // 通知单独 try/catch：通知发不出去也必须把 shortages 传回去（否则前端看不到缺货明细）
    try {
      const adminId = await findTenantAdminId(tenantId);
      if (adminId) {
        await sendNotificationWithPush({
          recipientId: adminId,
          recipientType: "ADMIN",
          title: "⚠️ 平台订单存在缺货风险",
          content: `订单 ${orderNo}：${detail}。已按「仅告警」策略放行接单，请及时核对库存或联系顾客。`,
          type: "ALERT",
          relatedType: "platform_order",
          relatedId: null,
          tenantId,
        });
      } else {
        logger.warn(`[shortage] 租户 ${tenantId} 无管理员用户，跳过缺货告警通知（订单 ${orderNo}）`);
      }
    } catch (notifyErr) {
      logger.error(`[shortage] 缺货告警通知失败（不影响接单与返回值）: ${(notifyErr as Error).message}`);
    }

    return { checked: items.length, shortages: stockCheck.shortages };
  } catch (err) {
    // 告警链路任何异常都不得影响接单
    logger.error(`[shortage] 缺货告警执行异常（不影响接单）: ${(err as Error).message}`);
    return { checked: 0, shortages: [] };
  }
}
