import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { ok } from "../shared/response.js";

export const reportRouter = Router();

// ========== 销售报表 ==========

// 销售日报（指定日期范围，按天汇总：订单数/金额/回款/退货）
reportRouter.get("/sales-daily", requireAuth, asyncHandler(async (req, res) => {
  const dateStart = parseDateParam(req.query.dateStart, (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })());
  const dateEnd = parseDateParam(req.query.dateEnd, new Date().toISOString().slice(0, 10));
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const conditions: string[] = ["DATE(sb.created_at) BETWEEN ? AND ?"];
  const params: unknown[] = [dateStart, dateEnd];
  if (storeId) {
    conditions.push("sb.store_id = ?");
    params.push(storeId);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT DATE(sb.created_at) AS date,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COUNT(DISTINCT sb.customer_id) AS customerCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
            COALESCE(SUM(sb.unreceived_amount), 0) AS unreceivedAmount
     FROM sale_bill sb
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED') AND ${where}
     GROUP BY DATE(sb.created_at)
     ORDER BY date ASC`,
    params
  );

  // 查询每天的退货数据
  const returnRecords = await query<any>(
    `SELECT DATE(sr.created_at) AS date,
            COUNT(DISTINCT sr.return_no) AS returnCount,
            COALESCE(SUM(sr.refund_amount), 0) AS returnAmount
     FROM sale_return sr
     WHERE sr.return_status NOT IN ('VOIDED') AND DATE(sr.created_at) BETWEEN ? AND ?
     ${storeId ? "AND sr.store_id = ?" : ""}
     GROUP BY DATE(sr.created_at)`,
    storeId ? [dateStart, dateEnd, storeId] : [dateStart, dateEnd]
  );

  const returnMap = new Map<string, { returnCount: number; returnAmount: number }>();
  for (const r of returnRecords) {
    returnMap.set(r.date, { returnCount: Number(r.returnCount), returnAmount: Number(r.returnAmount) });
  }

  const result = records.map((r: any) => {
    const ret = returnMap.get(r.date) || { returnCount: 0, returnAmount: 0 };
    const orderCount = Number(r.orderCount);
    const salesAmount = Number(r.salesAmount);
    return {
      date: r.date,
      orderCount,
      customerCount: Number(r.customerCount),
      avgOrderAmount: orderCount > 0 ? Math.round((salesAmount / orderCount) * 100) / 100 : 0,
      salesAmount,
      receivedAmount: Number(r.receivedAmount),
      unreceivedAmount: Number(r.unreceivedAmount),
      returnCount: ret.returnCount,
      returnAmount: ret.returnAmount
    };
  });

  res.json(ok(result));
}));

// 销售排行（支持按商品/客户/业务员维度，指定时间范围）
reportRouter.get("/sales-ranking", requireAuth, asyncHandler(async (req, res) => {
  const dimension = z.enum(["product", "customer", "staff"]).parse(req.query.dimension || "product");
  const dateStart = parseDateParam(req.query.dateStart, (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })());
  const dateEnd = parseDateParam(req.query.dateEnd, new Date().toISOString().slice(0, 10));
  const limit = Math.min(Number(req.query.limit || 20), 100);

  let records: any[];

  if (dimension === "product") {
    records = await query<any>(
      `SELECT sbi.sku_id AS id, sbi.sku_name AS name,
              SUM(sbi.total_bottle_qty) AS totalQty,
              COALESCE(SUM(sbi.subtotal_amount), 0) AS totalAmount
       FROM sale_bill_item sbi
       JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sbi.sku_id, sbi.sku_name
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [dateStart, dateEnd, limit]
    );
  } else if (dimension === "customer") {
    records = await query<any>(
      `SELECT sb.customer_id AS id, sb.customer_name AS name, sb.customer_mobile AS mobile,
              COUNT(DISTINCT sb.bill_no) AS orderCount,
              COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
              COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
       FROM sale_bill sb
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND sb.customer_id IS NOT NULL
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sb.customer_id, sb.customer_name, sb.customer_mobile
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [dateStart, dateEnd, limit]
    );
  } else {
    records = await query<any>(
      `SELECT sb.operator_id AS id, u.real_name AS name,
              COUNT(DISTINCT sb.bill_no) AS orderCount,
              COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
              COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
       FROM sale_bill sb
       LEFT JOIN sys_user u ON u.id = sb.operator_id
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sb.operator_id, u.real_name
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [dateStart, dateEnd, limit]
    );
  }

  res.json(ok(records.map((r: any) => ({
    ...r,
    totalQty: Number(r.totalQty ?? 0),
    totalAmount: Number(r.totalAmount ?? 0),
    receivedAmount: Number(r.receivedAmount ?? 0),
    orderCount: Number(r.orderCount ?? 0)
  }))));
}));

// 日期格式校验正则
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** 校验日期参数格式，不合法则抛出 ZodError（400） */
function parseDateParam(value: unknown, fallback?: string): string {
  const str = String(value ?? "");
  if (str === "" && fallback !== undefined) return fallback;
  if (!DATE_REGEX.test(str)) {
    throw new z.ZodError([
      { code: z.ZodIssueCode.custom, path: ["date"], message: `日期格式不正确，应为 YYYY-MM-DD，实际为: ${str || "空"}` }
    ]);
  }
  return str;
}

// 销售趋势（按月/周/日，近12个月数据）
reportRouter.get("/sales-trend", requireAuth, asyncHandler(async (req, res) => {
  const granularity = z.enum(["month", "week", "day"]).parse(req.query.granularity || "month");

  // 白名单映射：只允许预定义的 dateFormat 和 intervalExpr，不直接拼入 SQL
  const formatMap: Record<string, { dateFormat: string; intervalExpr: string }> = {
    month: { dateFormat: "%Y-%m", intervalExpr: "12 MONTH" },
    week: { dateFormat: "%Y-%u", intervalExpr: "12 WEEK" },
    day: { dateFormat: "%Y-%m-%d", intervalExpr: "30 DAY" }
  };
  const { dateFormat, intervalExpr } = formatMap[granularity];

  const records = await query<any>(
    `SELECT DATE_FORMAT(sb.created_at, ?) AS period,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
     FROM sale_bill sb
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.created_at >= DATE_SUB(CURDATE(), INTERVAL ?)
     GROUP BY period
     ORDER BY period ASC`,
    [dateFormat, intervalExpr]
  );

  res.json(ok(records.map((r: any) => ({
    period: r.period,
    orderCount: Number(r.orderCount),
    salesAmount: Number(r.salesAmount),
    receivedAmount: Number(r.receivedAmount)
  }))));
}));

// 客户贡献分析（累计购买金额/频次/客单价/毛利）
reportRouter.get("/customer-contribution", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const dateStart = req.query.dateStart ? parseDateParam(req.query.dateStart) : undefined;
  const dateEnd = req.query.dateEnd ? parseDateParam(req.query.dateEnd) : undefined;

  const conditions: string[] = ["sb.business_status NOT IN ('DRAFT', 'VOIDED')", "sb.customer_id IS NOT NULL"];
  const params: unknown[] = [];

  if (dateStart) {
    conditions.push("DATE(sb.created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(sb.created_at) <= ?");
    params.push(dateEnd);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT sb.customer_id AS customerId,
            sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
            COALESCE(SUM(sb.unreceived_amount), 0) AS unpaidAmount,
            CASE WHEN COUNT(DISTINCT sb.bill_no) > 0
              THEN SUM(sb.receivable_amount) / COUNT(DISTINCT sb.bill_no)
              ELSE 0
            END AS avgOrderAmount
     FROM sale_bill sb
     WHERE ${where}
     GROUP BY sb.customer_id, sb.customer_name, sb.customer_mobile
     ORDER BY totalAmount DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(DISTINCT sb.customer_id) AS total
     FROM sale_bill sb
     WHERE ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: records.map((r: any) => ({
      ...r,
      orderCount: Number(r.orderCount),
      totalAmount: Number(r.totalAmount),
      receivedAmount: Number(r.receivedAmount),
      unpaidAmount: Number(r.unpaidAmount),
      avgOrderAmount: Number(r.avgOrderAmount ?? 0)
    }))
  }));
}));

// ========== 采购报表 ==========

// 采购汇总（指定时间范围：采购数/金额/到货/退货）
reportRouter.get("/purchase-summary", requireAuth, asyncHandler(async (req, res) => {
  const dateStart = parseDateParam(req.query.dateStart, (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })());
  const dateEnd = parseDateParam(req.query.dateEnd, new Date().toISOString().slice(0, 10));

  const orderStats = await queryOne<any>(
    `SELECT COUNT(*) AS orderCount,
            COALESCE(SUM(goods_amount), 0) AS goodsAmount,
            COALESCE(SUM(tax_amount), 0) AS taxAmount,
            COALESCE(SUM(payable_amount), 0) AS payableAmount,
            COALESCE(SUM(paid_amount), 0) AS paidAmount,
            COALESCE(SUM(unpaid_amount), 0) AS unpaidAmount
     FROM purchase_order
     WHERE order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [dateStart, dateEnd]
  );

  const stockStats = await queryOne<any>(
    `SELECT COUNT(*) AS stockCount,
            COALESCE(SUM(total_amount), 0) AS stockAmount
     FROM purchase_in_stock
     WHERE stock_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [dateStart, dateEnd]
  );

  const returnStats = await queryOne<any>(
    `SELECT COUNT(*) AS returnCount,
            COALESCE(SUM(total_amount), 0) AS returnAmount
     FROM purchase_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [dateStart, dateEnd]
  );

  res.json(ok({
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
  }));
}));

// 供应商采购排行
reportRouter.get("/supplier-ranking", requireAuth, asyncHandler(async (req, res) => {
  const dateStart = parseDateParam(req.query.dateStart, (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })());
  const dateEnd = parseDateParam(req.query.dateEnd, new Date().toISOString().slice(0, 10));
  const limit = Math.min(Number(req.query.limit || 20), 100);

  const records = await query<any>(
    `SELECT po.supplier_id AS supplierId, po.supplier_name AS supplierName,
            COUNT(DISTINCT po.order_no) AS orderCount,
            COALESCE(SUM(po.payable_amount), 0) AS totalAmount,
            COALESCE(SUM(po.paid_amount), 0) AS paidAmount,
            COALESCE(SUM(po.unpaid_amount), 0) AS unpaidAmount
     FROM purchase_order po
     WHERE po.order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE(po.created_at) BETWEEN ? AND ?
     GROUP BY po.supplier_id, po.supplier_name
     ORDER BY totalAmount DESC
     LIMIT ?`,
    [dateStart, dateEnd, limit]
  );

  res.json(ok(records.map((r: any) => ({
    ...r,
    orderCount: Number(r.orderCount),
    totalAmount: Number(r.totalAmount),
    paidAmount: Number(r.paidAmount),
    unpaidAmount: Number(r.unpaidAmount)
  }))));
}));

// ========== 库存报表 ==========

// 库存汇总（按商品/仓库：库存数量/金额/可用量）
reportRouter.get("/inventory-summary", requireAuth, asyncHandler(async (req, res) => {
  const groupBy = z.enum(["product", "store"]).parse(req.query.groupBy || "product");
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (storeId) {
    conditions.push("ib.store_id = ?");
    params.push(storeId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let records: any[];

  if (groupBy === "product") {
    records = await query<any>(
      `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName, ps.sku_code AS skuCode,
              ps.barcode, pp.cost_price AS costPrice,
              SUM(ib.physical_qty) AS totalPhysicalQty,
              SUM(ib.locked_qty) AS totalLockedQty,
              SUM(ib.available_qty) AS totalAvailableQty,
              SUM(ib.physical_qty) * pp.cost_price AS totalAmount
       FROM inventory_balance ib
       LEFT JOIN product_sku ps ON ps.id = ib.sku_id
       LEFT JOIN product_price pp ON pp.sku_id = ib.sku_id
       ${where}
       GROUP BY ib.sku_id, ps.sku_name, ps.sku_code, ps.barcode, pp.cost_price
       ORDER BY totalAmount DESC`,
      params
    );
  } else {
    records = await query<any>(
      `SELECT ib.store_id AS storeId, s.name AS storeName,
              COUNT(DISTINCT ib.sku_id) AS skuCount,
              SUM(ib.physical_qty) AS totalPhysicalQty,
              SUM(ib.locked_qty) AS totalLockedQty,
              SUM(ib.available_qty) AS totalAvailableQty
       FROM inventory_balance ib
       LEFT JOIN store s ON s.id = ib.store_id
       ${where}
       GROUP BY ib.store_id, s.name
       ORDER BY totalPhysicalQty DESC`,
      params
    );
  }

  res.json(ok(records.map((r: any) => ({
    ...r,
    totalPhysicalQty: Number(r.totalPhysicalQty ?? 0),
    totalLockedQty: Number(r.totalLockedQty ?? 0),
    totalAvailableQty: Number(r.totalAvailableQty ?? 0),
    totalAmount: Number(r.totalAmount ?? 0),
    skuCount: Number(r.skuCount ?? 0)
  }))));
}));

// 库存周转分析（周转率/周转天数）
reportRouter.get("/inventory-turnover", requireAuth, asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months || 3), 12);
  const dateStart = new Date();
  dateStart.setMonth(dateStart.getMonth() - months);

  // 计算每个SKU在时间范围内的销售出库量
  const salesData = await query<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
            SUM(sbi.total_bottle_qty) AS totalSoldQty,
            COALESCE(SUM(sbi.subtotal_amount), 0) AS totalSalesAmount
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.created_at >= ?
     GROUP BY sbi.sku_id, sbi.sku_name`,
    [dateStart.toISOString().slice(0, 10)]
  );

  // 当前库存
  const inventoryData = await query<any>(
    `SELECT sku_id AS skuId, SUM(physical_qty) AS totalQty
     FROM inventory_balance
     GROUP BY sku_id`,
    []
  );

  const inventoryMap = new Map<number, number>();
  for (const inv of inventoryData) {
    inventoryMap.set(inv.skuId, Number(inv.totalQty));
  }

  const result = salesData
    .map((s: any) => {
      const avgInventory = inventoryMap.get(s.skuId) ?? 0;
      const totalSoldQty = Number(s.totalSoldQty);
      // 周转率 = 销售量 / 平均库存量
      const turnoverRate = avgInventory > 0 ? Math.round((totalSoldQty / avgInventory) * 100) / 100 : 0;
      // 周转天数 = 分析天数 / 周转率
      const analysisDays = months * 30;
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

  res.json(ok(result));
}));

// 库龄分析（按库龄段统计：30天内/30-90天/90-180天/180天以上）
reportRouter.get("/inventory-age", requireAuth, asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (storeId) {
    conditions.push("psi.store_id = ?");
    params.push(storeId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 使用入库记录的入库时间来计算库龄
  const records = await query<any>(
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
      FROM purchase_in_stock_item psi
      JOIN purchase_in_stock pis ON pis.stock_no = psi.stock_no
      JOIN product_sku ps ON ps.id = psi.sku_id
      ${where}
      ORDER BY ageDays DESC`,
    params
  );

  // 按库龄段汇总
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

  res.json(ok({ summary, details }));
}));

// ========== 财务报表 ==========

// 应收应付汇总（按客户/供应商）
reportRouter.get("/receivable-payable", requireAuth, asyncHandler(async (req, res) => {
  const rpDateStart = req.query.dateStart ? parseDateParam(req.query.dateStart) : undefined;
  const rpDateEnd = req.query.dateEnd ? parseDateParam(req.query.dateEnd) : undefined;

  // 构建时间条件
  const receivableConditions: string[] = [
    "sb.business_status NOT IN ('DRAFT', 'VOIDED')",
    "sb.customer_id IS NOT NULL",
    "sb.unreceived_amount > 0"
  ];
  const receivableParams: unknown[] = [];
  if (rpDateStart && rpDateEnd) {
    receivableConditions.push("DATE(sb.created_at) BETWEEN ? AND ?");
    receivableParams.push(rpDateStart, rpDateEnd);
  }
  const receivableWhere = receivableConditions.join(" AND ");

  const payableConditions: string[] = [
    "po.order_status NOT IN ('DRAFT', 'CANCELLED')",
    "po.unpaid_amount > 0"
  ];
  const payableParams: unknown[] = [];
  if (rpDateStart && rpDateEnd) {
    payableConditions.push("DATE(po.created_at) BETWEEN ? AND ?");
    payableParams.push(rpDateStart, rpDateEnd);
  }
  const payableWhere = payableConditions.join(" AND ");

  // 应收汇总（按客户）
  const receivable = await query<any>(
    `SELECT sb.customer_id AS customerId, sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile,
            COUNT(DISTINCT sb.bill_no) AS billCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalReceivable,
            COALESCE(SUM(sb.received_amount), 0) AS totalReceived,
            COALESCE(SUM(sb.unreceived_amount), 0) AS totalUnreceived
     FROM sale_bill sb
     WHERE ${receivableWhere}
     GROUP BY sb.customer_id, sb.customer_name, sb.customer_mobile
     ORDER BY totalUnreceived DESC`,
    receivableParams
  );

  // 应付汇总（按供应商）
  const payable = await query<any>(
    `SELECT po.supplier_id AS supplierId, po.supplier_name AS supplierName,
            COUNT(DISTINCT po.order_no) AS orderCount,
            COALESCE(SUM(po.payable_amount), 0) AS totalPayable,
            COALESCE(SUM(po.paid_amount), 0) AS totalPaid,
            COALESCE(SUM(po.unpaid_amount), 0) AS totalUnpaid
     FROM purchase_order po
     WHERE ${payableWhere}
     GROUP BY po.supplier_id, po.supplier_name
     ORDER BY totalUnpaid DESC`,
    payableParams
  );

  const totalReceivable = receivable.reduce((sum: number, r: any) => sum + Number(r.totalUnreceived), 0);
  const totalPayable = payable.reduce((sum: number, r: any) => sum + Number(r.totalUnpaid), 0);

  res.json(ok({
    totalReceivable,
    totalPayable,
    receivableList: receivable.map((r: any) => ({
      ...r,
      billCount: Number(r.billCount),
      totalReceivable: Number(r.totalReceivable),
      totalReceived: Number(r.totalReceived),
      totalUnreceived: Number(r.totalUnreceived)
    })),
    payableList: payable.map((r: any) => ({
      ...r,
      orderCount: Number(r.orderCount),
      totalPayable: Number(r.totalPayable),
      totalPaid: Number(r.totalPaid),
      totalUnpaid: Number(r.totalUnpaid)
    }))
  }));
}));

// 回款分析（按时间/客户/业务员）
reportRouter.get("/payment-analysis", requireAuth, asyncHandler(async (req, res) => {
  const dateStart = parseDateParam(req.query.dateStart, (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })());
  const dateEnd = parseDateParam(req.query.dateEnd, new Date().toISOString().slice(0, 10));
  const groupBy = z.enum(["date", "customer", "staff"]).parse(req.query.groupBy || "date");

  let records: any[];

  if (groupBy === "date") {
    records = await query<any>(
      `SELECT DATE(payment_date) AS period,
              COUNT(*) AS paymentCount,
              COALESCE(SUM(amount), 0) AS totalAmount
       FROM customer_payment
       WHERE status NOT IN ('VOIDED')
         AND payment_date BETWEEN ? AND ?
       GROUP BY DATE(payment_date)
       ORDER BY period ASC`,
      [dateStart, dateEnd]
    );
  } else if (groupBy === "customer") {
    records = await query<any>(
      `SELECT customer_id AS customerId, customer_name AS customerName,
              COUNT(*) AS paymentCount,
              COALESCE(SUM(amount), 0) AS totalAmount
       FROM customer_payment
       WHERE status NOT IN ('VOIDED')
         AND payment_date BETWEEN ? AND ?
       GROUP BY customer_id, customer_name
       ORDER BY totalAmount DESC`,
      [dateStart, dateEnd]
    );
  } else {
    records = await query<any>(
      `SELECT cp.operator_id AS staffId, u.real_name AS staffName,
              COUNT(*) AS paymentCount,
              COALESCE(SUM(cp.amount), 0) AS totalAmount
       FROM customer_payment cp
       LEFT JOIN sys_user u ON u.id = cp.operator_id
       WHERE cp.status NOT IN ('VOIDED')
         AND cp.payment_date BETWEEN ? AND ?
       GROUP BY cp.operator_id, u.real_name
       ORDER BY totalAmount DESC`,
      [dateStart, dateEnd]
    );
  }

  res.json(ok(records.map((r: any) => ({
    ...r,
    paymentCount: Number(r.paymentCount ?? 0),
    totalAmount: Number(r.totalAmount ?? 0)
  }))));
}));

// 利润表（收入-成本-费用=利润）
reportRouter.get("/profit", requireAuth, asyncHandler(async (req, res) => {
  const dateStart = parseDateParam(req.query.dateStart, (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })());
  const dateEnd = parseDateParam(req.query.dateEnd, new Date().toISOString().slice(0, 10));

  // 销售收入
  const salesIncome = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalAmount
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [dateStart, dateEnd]
  );

  // 销售成本（按成本价计算）
  const salesCost = await queryOne<any>(
    `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price), 0) AS totalCost
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     JOIN product_price pp ON pp.sku_id = sbi.sku_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) BETWEEN ? AND ?`,
    [dateStart, dateEnd]
  );

  // 退货金额
  const returnAmount = await queryOne<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM sale_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [dateStart, dateEnd]
  );

  // 采购退货退款（冲减成本）
  const purchaseReturnAmount = await queryOne<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM purchase_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [dateStart, dateEnd]
  );

  const income = Number(salesIncome?.totalAmount ?? 0);
  const cost = Number(salesCost?.totalCost ?? 0) - Number(purchaseReturnAmount?.totalAmount ?? 0);
  const returns = Number(returnAmount?.totalAmount ?? 0);
  const grossProfit = income - cost - returns;
  const grossProfitRate = income > 0 ? Math.round((grossProfit / income) * 10000) / 100 : 0;

  // 计算上一周期（相同天数的上一段时间）的销售额和毛利
  const startDate = new Date(dateStart);
  const endDate = new Date(dateEnd);
  const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);
  const prevDateStart = prevStart.toISOString().slice(0, 10);
  const prevDateEnd = prevEnd.toISOString().slice(0, 10);

  const prevSalesIncome = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalAmount
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd]
  );

  const prevSalesCost = await queryOne<any>(
    `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price), 0) AS totalCost
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     JOIN product_price pp ON pp.sku_id = sbi.sku_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd]
  );

  const prevReturnAmount = await queryOne<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM sale_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd]
  );

  const prevPurchaseReturnAmount = await queryOne<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM purchase_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd]
  );

  const prevIncome = Number(prevSalesIncome?.totalAmount ?? 0);
  const prevCost = Number(prevSalesCost?.totalCost ?? 0) - Number(prevPurchaseReturnAmount?.totalAmount ?? 0);
  const prevReturns = Number(prevReturnAmount?.totalAmount ?? 0);
  const prevGrossProfit = prevIncome - prevCost - prevReturns;

  const salesGrowthRate = prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 10000) / 100 : 0;
  const profitGrowthRate = prevGrossProfit !== 0 ? Math.round(((grossProfit - prevGrossProfit) / Math.abs(prevGrossProfit)) * 10000) / 100 : (grossProfit > 0 ? 100 : 0);

  res.json(ok({
    dateStart,
    dateEnd,
    income,
    cost: Math.max(cost, 0),
    returns,
    grossProfit,
    grossProfitRate,
    salesGrowthRate,
    profitGrowthRate,
    prevDateStart,
    prevDateEnd,
    prevIncome,
    prevGrossProfit
  }));
}));

// 经营概况仪表盘数据（关键指标一览）
reportRouter.get("/business-overview", requireAuth, asyncHandler(async (_req, res) => {
  // 今日销售
  const todaySales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = CURDATE()`
  );

  // 昨日销售（用于计算增长率）
  const yesterdaySales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
  );

  const todayAmount = Number(todaySales?.amount ?? 0);
  const todayCount = Number(todaySales?.count ?? 0);
  const yesterdayAmount = Number(yesterdaySales?.amount ?? 0);
  const yesterdayCount = Number(yesterdaySales?.count ?? 0);

  const salesGrowthRate = yesterdayAmount > 0
    ? Math.round(((todayAmount - yesterdayAmount) / yesterdayAmount) * 10000) / 100
    : (todayAmount > 0 ? 100 : 0);
  const orderGrowthRate = yesterdayCount > 0
    ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 10000) / 100
    : (todayCount > 0 ? 100 : 0);

  // 本月销售
  const monthSales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`
  );

  // 本年销售
  const yearSales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y')`
  );

  // 总应收
  const totalReceivable = await queryOne<any>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS amount
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND unreceived_amount > 0`
  );

  // 总应付
  const totalPayable = await queryOne<any>(
    `SELECT COALESCE(SUM(unpaid_amount), 0) AS amount
     FROM purchase_order
     WHERE order_status NOT IN ('DRAFT', 'CANCELLED')
       AND unpaid_amount > 0`
  );

  // 库存总值
  const inventoryValue = await queryOne<any>(
    `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount
     FROM inventory_balance ib
     JOIN product_price pp ON pp.sku_id = ib.sku_id`
  );

  // 客户总数
  const customerCount = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM member WHERE status = 1"
  );

  // 供应商总数
  const supplierCount = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM supplier WHERE status = 1"
  );

  // 本月采购
  const monthPurchase = await queryOne<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM purchase_order
     WHERE order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`
  );

  res.json(ok({
    todaySalesAmount: todayAmount,
    todayOrderCount: todayCount,
    salesGrowthRate,
    orderGrowthRate,
    monthSalesAmount: Number(monthSales?.amount ?? 0),
    monthOrderCount: Number(monthSales?.count ?? 0),
    yearSalesAmount: Number(yearSales?.amount ?? 0),
    yearOrderCount: Number(yearSales?.count ?? 0),
    totalReceivable: Number(totalReceivable?.amount ?? 0),
    totalPayable: Number(totalPayable?.amount ?? 0),
    inventoryValue: Number(inventoryValue?.amount ?? 0),
    customerCount: Number(customerCount?.count ?? 0),
    supplierCount: Number(supplierCount?.count ?? 0),
    monthPurchaseAmount: Number(monthPurchase?.amount ?? 0),
    monthPurchaseCount: Number(monthPurchase?.count ?? 0)
  }));
}));
