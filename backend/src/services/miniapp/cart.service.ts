import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { shouldReserveStock, type CustomerType } from "../../shared/fulfillment.js";

export async function getCartList(tenantId: string, customerId: number, customerType: string) {
  const rows = await queryWithTenant<any>(
    `SELECT c.id, c.sku_id AS skuId, c.quantity,
            s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM cart_item c
     JOIN product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
     JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = 1 AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
     WHERE c.customer_id = ?
     ORDER BY c.added_at DESC`,
    [customerId],
    tenantId
  );
  const items = rows.map((row: any) => {
    const wholesaleVisible = shouldReserveStock(customerType as CustomerType) && row.wholesalePrice != null;
    const price = wholesaleVisible ? Number(row.wholesalePrice) : Number(row.miniappPrice ?? row.retailPrice);
    return {
      id: row.id,
      skuId: row.skuId,
      skuName: row.skuName,
      spuName: row.spuName,
      image: row.image,
      price,
      quantity: row.quantity,
      availableQty: Number(row.availableQty),
      subtotal: Number((price * row.quantity).toFixed(2)),
      priceType: wholesaleVisible ? "WHOLESALE" : "RETAIL"
    };
  });
  const totalAmount = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const totalQty = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  return { items, totalAmount: Number(totalAmount.toFixed(2)), totalQty };
}

export async function addToCart(tenantId: string, customerId: number, skuId: number, quantity: number) {
  const sku = await queryOneWithTenant<any>(
    `SELECT s.id, s.sku_name FROM product_sku s JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id WHERE s.id = ? AND p.status = 'ON_SALE'`,
    [skuId],
    tenantId
  );
  if (!sku) {
    return { success: false, message: "商品不存在或已下架" };
  }

  const existing = await queryOneWithTenant<any>(
    `SELECT id, quantity FROM cart_item WHERE customer_id = ? AND sku_id = ?`,
    [customerId, skuId],
    tenantId
  );
  if (existing) {
    await queryWithTenant(
      `UPDATE cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?`,
      [quantity, existing.id],
      tenantId
    );
  } else {
    await queryWithTenant(
      `INSERT INTO cart_item (customer_id, sku_id, quantity) VALUES (?, ?, ?)`,
      [customerId, skuId, quantity],
      tenantId
    );
  }
  return { success: true, message: "已加入购物车" };
}

export async function updateCartItemQuantity(tenantId: string, customerId: number, skuId: number, quantity: number) {
  if (quantity === 0) {
    await queryWithTenant(
      `DELETE FROM cart_item WHERE customer_id = ? AND sku_id = ?`,
      [customerId, skuId],
      tenantId
    );
    return { success: true, message: "已更新" };
  } else {
    const result = await queryWithTenant(
      `UPDATE cart_item SET quantity = ?, updated_at = NOW() WHERE customer_id = ? AND sku_id = ?`,
      [quantity, customerId, skuId],
      tenantId
    );
    if ((result as unknown as { affectedRows: number }).affectedRows === 0) {
      return { success: false, message: "购物车中无此商品" };
    }
    return { success: true, message: "已更新" };
  }
}

export async function deleteCartItem(tenantId: string, customerId: number, skuId: number) {
  await queryWithTenant(
    `DELETE FROM cart_item WHERE customer_id = ? AND sku_id = ?`,
    [customerId, skuId],
    tenantId
  );
  return { message: "已删除" };
}

export async function clearCart(tenantId: string, customerId: number) {
  await queryWithTenant(
    `DELETE FROM cart_item WHERE customer_id = ?`,
    [customerId],
    tenantId
  );
  return { message: "购物车已清空" };
}

export async function getCartCount(tenantId: string, customerId: number) {
  const row = await queryOneWithTenant<{ total: number }>(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM cart_item WHERE customer_id = ?`,
    [customerId],
    tenantId
  );
  return { count: Number(row?.total ?? 0) };
}
