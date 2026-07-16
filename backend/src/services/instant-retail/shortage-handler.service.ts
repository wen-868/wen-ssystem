import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { batchDeductStock, batchRestoreStock } from "./inventory-deduction.service";

interface OrderItem { product_id: number; quantity: number; }

// 检测缺货
export async function checkStock(storeId: number, items: OrderItem[], tenantId: string): Promise<{ ok: boolean; shortages: Array<{ productId: number; stock: number }> }> {
  const shortages: Array<{ productId: number; stock: number }> = [];
  for (const item of items) {
    const product = await queryOneWithTenant<any>(
      "SELECT id, stock FROM t_retail_product WHERE id = ? AND store_id = ? AND tenant_id = ?",
      [item.product_id, storeId, tenantId], tenantId
    );
    if (!product || product.stock < item.quantity) {
      shortages.push({ productId: item.product_id, stock: product?.stock ?? 0 });
    }
  }
  return { ok: shortages.length === 0, shortages };
}

// 处理缺货 - 自动拒单
export async function handleShortage(orderNo: string, platform: string, platformOrderId: string, reason: string, tenantId: string) {
  await queryWithTenant(
    "UPDATE t_retail_order SET order_status = 'CANCELLED', cancel_reason = ? WHERE order_no = ? AND tenant_id = ?",
    [reason, orderNo, tenantId], tenantId
  );
  return { orderNo, cancelled: true, reason };
}

// 确认接单 - 含库存检测和扣减
export async function confirmOrderWithStockCheck(orderNo: string, storeId: number, items: OrderItem[], tenantId: string): Promise<{ success: boolean; reason?: string }> {
  const stockCheck = await checkStock(storeId, items, tenantId);
  if (!stockCheck.ok) {
    const reason = `商品库存不足: ${stockCheck.shortages.map(s => `商品${s.productId}(库存${s.stock})`).join(", ")}`;
    await handleShortage(orderNo, "", "", reason, tenantId);
    return { success: false, reason };
  }
  const deductResult = await batchDeductStock(items.map(i => ({ productId: i.product_id, quantity: i.quantity })), tenantId);
  if (!deductResult.success) {
    await handleShortage(orderNo, "", "", "库存扣减失败", tenantId);
    return { success: false, reason: "库存扣减失败" };
  }
  await queryWithTenant(
    "UPDATE t_retail_order SET order_status = 'ACCEPTED' WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId], tenantId
  );
  return { success: true };
}

// 取消订单 - 回退库存
export async function cancelOrderWithRestore(orderNo: string, reason: string, items: OrderItem[], tenantId: string) {
  await batchRestoreStock(items.map(i => ({ productId: i.product_id, quantity: i.quantity })), tenantId);
  await queryWithTenant(
    "UPDATE t_retail_order SET order_status = 'CANCELLED', cancel_reason = ? WHERE order_no = ? AND tenant_id = ?",
    [reason, orderNo, tenantId], tenantId
  );
  return { orderNo, cancelled: true };
}