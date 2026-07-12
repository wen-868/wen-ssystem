import { z } from "zod";
import { queryWithTenant, queryOneWithTenant } from "../../../shared/db";
import { parseDateParam, getDefaultDateStart, getDefaultDateEnd } from "../../../shared/date-utils";

export async function getInventorySummary(
  tenantId: string,
  groupBy: "product" | "store" = "product",
  storeId?: number
) {
  const g = z.enum(["product", "store"]).parse(groupBy);

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (storeId) {
    conditions.push("ib.store_id = ?");
    params.push(storeId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let records: any[];

  if (g === "product") {
    records = await queryWithTenant<any>(
      `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName, ps.sku_code AS skuCode,
              ps.barcode, pp.cost_price AS costPrice,
              SUM(ib.physical_qty) AS totalPhysicalQty,
              SUM(ib.locked_qty) AS totalLockedQty,
              SUM(ib.available_qty) AS totalAvailableQty,
              SUM(ib.physical_qty) * pp.cost_price AS totalAmount
       FROM t_inventory_balance ib
       LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
       LEFT JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id
       ${where}
       GROUP BY ib.sku_id, ps.sku_name, ps.sku_code, ps.barcode, pp.cost_price
       ORDER BY totalAmount DESC`,
      params,
      tenantId
    );
  } else {
    records = await queryWithTenant<any>(
      `SELECT ib.store_id AS storeId, s.name AS storeName,
              COUNT(DISTINCT ib.sku_id) AS skuCount,
              SUM(ib.physical_qty) AS totalPhysicalQty,
              SUM(ib.locked_qty) AS totalLockedQty,
              SUM(ib.available_qty) AS totalAvailableQty
       FROM t_inventory_balance ib
       LEFT JOIN store s ON s.id = ib.store_id
       ${where}
       GROUP BY ib.store_id, s.name
       ORDER BY totalPhysicalQty DESC`,
      params,
      tenantId
    );
  }

  return records.map((r: any) => ({
    ...r,
    totalPhysicalQty: Number(r.totalPhysicalQty ?? 0),
    totalLockedQty: Number(r.totalLockedQty ?? 0),
    totalAvailableQty: Number(r.totalAvailableQty ?? 0),
    totalAmount: Number(r.totalAmount ?? 0),
    skuCount: Number(r.skuCount ?? 0)
  }));
}

export async function getInventoryTurnover(
  tenantId: string,
  months: number = 3
) {
  const m = Math.min(Number(months || 3), 12);
  const dateStart = new Date();
  dateStart.setMonth(dateStart.getMonth() - m);

  const salesData = await queryWithTenant<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
            SUM(sbi.total_bottle_qty) AS totalSoldQty,
            COALESCE(SUM(sbi.subtotal_amount), 0) AS totalSalesAmount
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.created_at >= ?
     GROUP BY sbi.sku_id, sbi.sku_name`,
    [dateStart.toISOString().slice(0, 10)],
    tenantId
  );

  const inventoryData = await queryWithTenant<any>(
    `SELECT sku_id AS skuId, SUM(physical_qty) AS totalQty
     FROM t_inventory_balance
     GROUP BY sku_id`,
    [],
    tenantId
  );

  const inventoryMap = new Map<number, number>();
  for (const inv of inventoryData) {
    inventoryMap.set(inv.skuId, Number(inv.totalQty));
  }

  const result = salesData
    .map((s: any) => {
      const avgInventory = inventoryMap.get(s.skuId) ?? 0;
      const totalSoldQty = Number(s.totalSoldQty);
      const turnoverRate = avgInventory > 0 ? Math.round((totalSoldQty / avgInventory) * 100) / 100 : 0;
      const analysisDays = m * 30;
      const turnoverDays = turnoverRate > 0 ? Math.round((analysisDays / turnoverRate) * 100) / 100 : 0;

      return {
        skuId: s.skuId,
        skuName: s.skuName,
        totalSoldQty,
        totalSalesAmount: Number(s.totalSalesAmount),
        avgInventory: avgInventory,
        turnoverRate,
        turnoverDays
      };
    })
    .sort((a: any, b: any) => b.turnoverRate - a.turnoverRate);

  return result;
}

export async function getInventoryAge(
  tenantId: string,
  storeId?: number
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (storeId) {
    conditions.push("psi.store_id = ?");
    params.push(storeId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT
        ps.sku_id AS skuId,
        ps.sku_name AS skuName,
        psi.sku_id AS psiSkuId,
        psi.batch_no AS batchNo,
        psi.production_date AS productionDate,
        psi.expiry_date AS expiryDate,
        psi.total_bottle_qty AS qty,
        psi.created_at AS inStockDate,
        DATEDIFF(CURDATE(), psi.created_at) AS ageDays
      FROM t_purchase_in_stock_item psi
      JOIN t_purchase_in_stock pis ON pis.stock_no = psi.stock_no AND pis.tenant_id = psi.tenant_id
      JOIN t_product_sku ps ON ps.id = psi.sku_id AND ps.tenant_id = psi.tenant_id
      ${where}
      ORDER BY ageDays DESC`,
    params,
    tenantId
  );

  const summary = {
    within30: { qty: 0, amount: 0, count: 0 },
    days30to90: { qty: 0, amount: 0, count: 0 },
    days90to180: { qty: 0, amount: 0, count: 0 },
    over180: { qty: 0, amount: 0, count: 0 }
  };

  const details: any[] = [];

  for (const r of records) {
    const ageDays = Number(r.ageDays ?? 0);
    const qty = Number(r.qty ?? 0);
    const item = {
      skuId: r.skuId,
      skuName: r.skuName,
      batchNo: r.batchNo,
      inStockDate: r.inStockDate,
      ageDays,
      qty
    };
    details.push(item);

    if (ageDays <= 30) {
      summary.within30.qty += qty;
      summary.within30.count += 1;
    } else if (ageDays <= 90) {
      summary.days30to90.qty += qty;
      summary.days30to90.count += 1;
    } else if (ageDays <= 180) {
      summary.days90to180.qty += qty;
      summary.days90to180.count += 1;
    } else {
      summary.over180.qty += qty;
      summary.over180.count += 1;
    }
  }

  return { summary, details };
}

export async function getPurchaseSummary(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string
) {
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());

  const orderStats = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS orderCount,
            COALESCE(SUM(goods_amount), 0) AS goodsAmount,
            COALESCE(SUM(tax_amount), 0) AS taxAmount,
            COALESCE(SUM(payable_amount), 0) AS payableAmount,
            COALESCE(SUM(paid_amount), 0) AS paidAmount,
            COALESCE(SUM(unpaid_amount), 0) AS unpaidAmount
     FROM t_purchase_order
     WHERE order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [start, end],
    tenantId
  );

  const stockStats = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS stockCount,
            COALESCE(SUM(total_amount), 0) AS stockAmount
     FROM t_purchase_in_stock
     WHERE stock_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [start, end],
    tenantId
  );

  const returnStats = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS returnCount,
            COALESCE(SUM(total_amount), 0) AS returnAmount
     FROM t_purchase_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [start, end],
    tenantId
  );

  return {
    orderCount: Number(orderStats?.orderCount ?? 0),
    goodsAmount: Number(orderStats?.goodsAmount ?? 0),
    taxAmount: Number(orderStats?.taxAmount ?? 0),
    payableAmount: Number(orderStats?.payableAmount ?? 0),
    paidAmount: Number(orderStats?.paidAmount ?? 0),
    unpaidAmount: Number(orderStats?.unpaidAmount ?? 0),
    stockCount: Number(stockStats?.stockCount ?? 0),
    stockAmount: Number(stockStats?.stockAmount ?? 0),
    returnCount: Number(returnStats?.returnCount ?? 0),
    returnAmount: Number(returnStats?.returnAmount ?? 0)
  };
}

export async function getSupplierRanking(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string,
  limit: number = 20
) {
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());
  const lim = Math.min(Number(limit || 20), 100);

  const records = await queryWithTenant<any>(
    `SELECT po.supplier_id AS supplierId, po.supplier_name AS supplierName,
            COUNT(DISTINCT po.order_no) AS orderCount,
            COALESCE(SUM(po.payable_amount), 0) AS totalAmount,
            COALESCE(SUM(po.paid_amount), 0) AS paidAmount,
            COALESCE(SUM(po.unpaid_amount), 0) AS unpaidAmount
     FROM t_purchase_order po
     WHERE po.order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE(po.created_at) BETWEEN ? AND ?
     GROUP BY po.supplier_id, po.supplier_name
     ORDER BY totalAmount DESC
     LIMIT ?`,
    [start, end, lim],
    tenantId
  );

  return records.map((r: any) => ({
    ...r,
    orderCount: Number(r.orderCount),
    totalAmount: Number(r.totalAmount),
    paidAmount: Number(r.paidAmount),
    unpaidAmount: Number(r.unpaidAmount)
  }));
}
