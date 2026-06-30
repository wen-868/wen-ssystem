import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

// 扣减库存 - 数据库行级锁版本
export async function deductStock(productId: number, quantity: number, tenantId: string): Promise<boolean> {
  const product = await queryOneWithTenant<any>(
    "SELECT id, stock FROM retail_product WHERE id = ? AND tenant_id = ? FOR UPDATE",
    [productId, tenantId], tenantId
  );
  if (!product) return false;
  if (product.stock < quantity) return false;
  await queryWithTenant(
    "UPDATE retail_product SET stock = stock - ?, sales_count = sales_count + ? WHERE id = ? AND tenant_id = ?",
    [quantity, quantity, productId, tenantId], tenantId
  );
  return true;
}

// 回退库存
export async function restoreStock(productId: number, quantity: number, tenantId: string) {
  await queryWithTenant(
    "UPDATE retail_product SET stock = stock + ?, sales_count = sales_count - ? WHERE id = ? AND tenant_id = ?",
    [quantity, quantity, productId, tenantId], tenantId
  );
}

// 批量扣减库存
export async function batchDeductStock(items: Array<{ productId: number; quantity: number }>, tenantId: string): Promise<{ success: boolean; failedProductId?: number }> {
  for (const item of items) {
    const ok = await deductStock(item.productId, item.quantity, tenantId);
    if (!ok) {
      return { success: false, failedProductId: item.productId };
    }
  }
  return { success: true };
}

// 批量回退库存
export async function batchRestoreStock(items: Array<{ productId: number; quantity: number }>, tenantId: string) {
  for (const item of items) {
    await restoreStock(item.productId, item.quantity, tenantId);
  }
}

// 获取库存状态
export async function getStockStatus(productId: number, tenantId: string) {
  return queryOneWithTenant<any>("SELECT id, stock, status FROM retail_product WHERE id = ? AND tenant_id = ?", [productId, tenantId], tenantId);
}