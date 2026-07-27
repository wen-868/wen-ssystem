import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** 智能补货建议行 */
interface PurchaseSuggestionRow {
  skuId: number | string;
  skuName: string;
  currentStock: number | string;
  safetyStock: number | string | null;
  shortage: number | string;
  inTransitQty: number | string;
  monthlyAvgSales: number | string;
}

/** SKU 库存信息行（下划线字段名） */
interface SkuInfoRow {
  sku_name: string;
  safety_stock: number | string | null;
  physical_qty: number | string | null;
}

/** 采购计划列表行（关联供应商/门店） */
interface PurchasePlanListRow {
  planNo: string;
  supplierId: number | string;
  supplierName: string | null;
  storeId: number | string;
  storeName: string | null;
  planStatus: string;
  goodsAmount: number | string;
  createdAt: string | Date;
}

/** 采购计划行（SELECT plan_no, supplier_id, store_id, plan_status，下划线字段名） */
interface PurchasePlanRow {
  plan_no: string;
  supplier_id: number | string;
  store_id: number | string;
  plan_status: string;
}

/** 采购计划明细行（SELECT sku_id, suggest_qty，suggestQty 用于算术运算故用 number） */
interface PurchasePlanItemRow {
  skuId: number | string;
  suggestQty: number;
}

/** 商品采购价行 */
interface ProductPriceRow {
  purchasePrice: number | string | null;
}

/** COUNT(*) AS total 结果行 */
interface CountTotalRow {
  total: number;
}

// 智能补货建议
export async function suggestPurchasePlan(tenantId: string, storeId?: number) {
  const storeCondition = storeId ? "AND ib.store_id = ?" : "";
  const params: unknown[] = [tenantId];
  if (storeId) params.push(storeId);
  const suggestions = await queryWithTenant<PurchaseSuggestionRow>(
    `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.physical_qty AS currentStock, ps.safety_stock AS safetyStock,
            COALESCE(ps.safety_stock - ib.physical_qty, 0) AS shortage,
            COALESCE((
              SELECT COALESCE(SUM(poi.order_qty), 0)
              FROM t_purchase_order_item poi
              JOIN t_purchase_order po ON po.order_no = poi.order_no AND po.tenant_id = poi.tenant_id
              WHERE poi.sku_id = ib.sku_id AND po.order_status IN ('PENDING', 'APPROVED', 'IN_TRANSIT')
                AND po.tenant_id = ?
            ), 0) AS inTransitQty,
            COALESCE((
              SELECT ROUND(SUM(sbi.total_bottle_qty) / 30, 1)
              FROM t_sale_bill_item sbi
              JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
              WHERE sbi.sku_id = ib.sku_id AND sb.tenant_id = ?
                AND sb.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ), 0) AS monthlyAvgSales
     FROM t_inventory_balance ib
     JOIN t_product_sku ps ON ps.id = ib.sku_id
     WHERE ib.tenant_id = ? ${storeCondition}
       AND ps.safety_stock IS NOT NULL
       AND ib.physical_qty < ps.safety_stock
     ORDER BY shortage DESC
     LIMIT 100`,
    [tenantId, tenantId, ...params],
    tenantId
  );
  return suggestions.map((s: PurchaseSuggestionRow) => {
    const currentStock = Number(s.currentStock ?? 0);
    const safetyStock = Number(s.safetyStock ?? 0);
    const monthlyAvgSales = Number(s.monthlyAvgSales ?? 0);
    const inTransitQty = Number(s.inTransitQty ?? 0);
    const suggestQty = Math.max(0, safetyStock - currentStock - inTransitQty + Math.ceil(monthlyAvgSales * 0.5));
    let reason = `当前库存${currentStock}低于安全库存${safetyStock}`;
    if (inTransitQty > 0) reason += `，在途${inTransitQty}`;
    return {
      skuId: s.skuId, skuName: s.skuName,
      currentStock, safetyStock,
      monthlyAvgSales, inTransitQty,
      suggestQty, reason
    };
  });
}

// 生成采购计划
export async function createPurchasePlan(params: {
  supplierId: number; storeId: number; items: { skuId: number; suggestQty: number }[];
  tenantId: string;
}) {
  const { supplierId, storeId, items, tenantId } = params;
  const planNo = makeBizNo("JH");
  let goodsAmount = 0;
  await queryWithTenant(
    `INSERT INTO t_purchase_plan (plan_no, supplier_id, store_id, plan_status, goods_amount, tenant_id)
     VALUES (?, ?, ?, 'DRAFT', 0, ?)`,
    [planNo, supplierId, storeId, tenantId],
    tenantId
  );
  for (const item of items) {
    const skuInfo = await queryOneWithTenant<SkuInfoRow>(
      `SELECT ps.sku_name, ps.safety_stock, ib.physical_qty
       FROM t_product_sku ps
       LEFT JOIN t_inventory_balance ib ON ib.sku_id = ps.id AND ib.tenant_id = ?
       WHERE ps.id = ? AND ps.tenant_id = ?`,
      [tenantId, item.skuId, tenantId],
      tenantId
    );
    const currentStock = Number(skuInfo?.physical_qty ?? 0);
    const safetyStock = Number(skuInfo?.safety_stock ?? 0);
    const monthlyAvgSales = 0; // simplified
    await queryWithTenant(
      `INSERT INTO t_purchase_plan_item (plan_no, sku_id, suggest_qty, current_stock, safety_stock, monthly_avg_sales, in_transit_qty, reason, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [planNo, item.skuId, item.suggestQty, currentStock, safetyStock, monthlyAvgSales, `当前库存${currentStock}低于安全库存${safetyStock}`, tenantId],
      tenantId
    );
    goodsAmount += item.suggestQty * 0; // price would come from t_last purchase price
  }
  await queryWithTenant(
    "UPDATE t_purchase_plan SET goods_amount = ? WHERE plan_no = ? AND tenant_id = ?",
    [goodsAmount, planNo, tenantId],
    tenantId
  );
  return { planNo, supplierId, storeId, itemsCount: items.length };
}

// 采购计划列表
export async function listPurchasePlans(params: {
  supplierId?: number; status?: string; page: number; pageSize: number; tenantId: string;
}) {
  const { supplierId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["pp.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];
  if (supplierId !== undefined) { conditions.push("pp.supplier_id = ?"); queryParams.push(supplierId); }
  if (status) { conditions.push("pp.plan_status = ?"); queryParams.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<PurchasePlanListRow>(
    `SELECT pp.plan_no AS planNo, pp.supplier_id AS supplierId,
            s.name AS supplierName, pp.store_id AS storeId,
            st.name AS storeName, pp.plan_status AS planStatus,
            pp.goods_amount AS goodsAmount, pp.created_at AS createdAt
     FROM t_purchase_plan pp
     LEFT JOIN t_supplier s ON s.id = pp.supplier_id
     LEFT JOIN t_store st ON st.id = pp.store_id
     ${where}
     ORDER BY pp.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_purchase_plan pp ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// 采购计划转采购订单
export async function convertPurchasePlan(planNo: string, tenantId: string) {
  const plan = await queryOneWithTenant<PurchasePlanRow>(
    "SELECT plan_no, supplier_id, store_id, plan_status FROM t_purchase_plan WHERE plan_no = ? AND tenant_id = ?",
    [planNo, tenantId],
    tenantId
  );
  if (!plan) throw new Error("采购计划不存在");
  if (plan.plan_status !== "DRAFT" && plan.plan_status !== "CONFIRMED") throw new Error("计划已转换");
  const items = await queryWithTenant<PurchasePlanItemRow>(
    "SELECT sku_id AS skuId, suggest_qty AS suggestQty FROM t_purchase_plan_item WHERE plan_no = ? AND tenant_id = ?",
    [planNo, tenantId],
    tenantId
  );
  const orderNo = makeBizNo("CG");
  await queryWithTenant(
    `INSERT INTO t_purchase_order (order_no, supplier_id, store_id, order_status, goods_amount, tenant_id)
     VALUES (?, ?, ?, 'PENDING', 0, ?)`,
    [orderNo, plan.supplier_id, plan.store_id, tenantId],
    tenantId
  );
  let totalAmount = 0;
  for (const item of items) {
    const price = await queryOneWithTenant<ProductPriceRow>(
      "SELECT purchase_price AS purchasePrice FROM t_product_price WHERE sku_id = ? AND tenant_id = ?",
      [item.skuId, tenantId],
      tenantId
    );
    const unitPrice = Number(price?.purchasePrice ?? 0);
    const amount = item.suggestQty * unitPrice;
    totalAmount += amount;
    await queryWithTenant(
      `INSERT INTO t_purchase_order_item (order_no, sku_id, order_qty, unit_price, amount, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderNo, item.skuId, item.suggestQty, unitPrice, amount, tenantId],
      tenantId
    );
  }
  await queryWithTenant(
    "UPDATE t_purchase_order SET goods_amount = ? WHERE order_no = ? AND tenant_id = ?",
    [totalAmount, orderNo, tenantId],
    tenantId
  );
  await queryWithTenant(
    "UPDATE t_purchase_plan SET plan_status = 'CONVERTED' WHERE plan_no = ? AND tenant_id = ?",
    [planNo, tenantId],
    tenantId
  );
  return { planNo, orderNo, status: "CONVERTED", totalAmount };
}