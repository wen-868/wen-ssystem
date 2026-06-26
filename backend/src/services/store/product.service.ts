import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function listProducts(params: {
  keyword?: string;
  barcode?: string;
  storeId: number;
  tenantId: string;
}) {
  const { keyword = "", barcode = "", storeId, tenantId } = params;
  const records = await queryWithTenant<any>(
    `SELECT s.id AS skuId, s.sku_code AS skuCode, p.name AS productName, s.sku_name AS skuName,
            s.barcode, pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice,
            pp.store_price AS storePrice, ib.available_qty AS availableQty
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'OFFLINE' AND ib.tenant_id = s.tenant_id
     WHERE s.tenant_id = ?
       AND p.status = 'ON_SALE'
       AND (? = '' OR p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ?)
       AND (? = '' OR s.barcode = ?)
     ORDER BY s.id DESC
     LIMIT 50`,
    [storeId, tenantId, keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, barcode, barcode],
    tenantId
  );
  return { records };
}

export async function listMembers(params: {
  keyword?: string;
  tenantId: string;
}) {
  const { keyword = "", tenantId } = params;
  const records = await queryWithTenant<any>(
    `SELECT id AS memberId, name, mobile, customer_type AS customerType, status
     FROM member
     WHERE tenant_id = ?
       AND status = 1
       AND (? = '' OR name LIKE ? OR mobile LIKE ?)
     ORDER BY id DESC
     LIMIT 50`,
    [tenantId, keyword, `%${keyword}%`, `%${keyword}%`],
    tenantId
  );
  return { records };
}