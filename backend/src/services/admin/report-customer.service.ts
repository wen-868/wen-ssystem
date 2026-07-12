import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// 复购率分析
export async function getRepurchaseAnalysis(params: { tenantId: string; startDate?: string; endDate?: string; storeId?: number }) {
  const { tenantId, startDate, endDate, storeId } = params;
  const conditions: string[] = ["sb.tenant_id = ?", "sb.business_status = 'CREATED'"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("sb.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("sb.created_at <= ?"); values.push(endDate); }
  if (storeId) { conditions.push("sb.store_id = ?"); values.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const totalCustomers = await queryOneWithTenant<any>(`SELECT COUNT(DISTINCT customer_id) AS cnt FROM t_sale_bill ${where}`, values, tenantId);
  const repurchaseCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM (SELECT customer_id FROM t_sale_bill ${where} GROUP BY customer_id HAVING COUNT(bill_no) > 1) t`,
    values, tenantId
  );
  const totalOrders = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_sale_bill ${where}`, values, tenantId);
  const repurchaseOrders = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM t_sale_bill sb WHERE sb.tenant_id = ? AND sb.business_status = 'CREATED' ${startDate ? "AND sb.created_at >= ?" : ""} ${endDate ? "AND sb.created_at <= ?" : ""} ${storeId ? "AND sb.store_id = ?" : ""} AND sb.customer_id IN (SELECT customer_id FROM t_sale_bill WHERE tenant_id = ? ${startDate ? "AND created_at >= ?" : ""} ${endDate ? "AND created_at <= ?" : ""} ${storeId ? "AND store_id = ?" : ""} GROUP BY customer_id HAVING COUNT(bill_no) > 1)`,
    values, tenantId
  );
  const totalC = Number(totalCustomers?.cnt ?? 0);
  const repurchaseC = Number(repurchaseCustomers?.cnt ?? 0);
  const totalO = Number(totalOrders?.cnt ?? 0);
  const repurchaseO = Number(repurchaseOrders?.cnt ?? 0);
  // 按月复购率趋势
  const trend = await queryWithTenant<any>(
    `SELECT DATE_FORMAT(sb.created_at, '%Y-%m') AS month,
            COUNT(DISTINCT sb.customer_id) AS totalCustomers,
            SUM(CASE WHEN t.customer_id IS NOT NULL THEN 1 ELSE 0 END) AS repurchaseCustomers
     FROM t_sale_bill sb
     LEFT JOIN (SELECT customer_id FROM t_sale_bill WHERE tenant_id = ? ${startDate ? "AND created_at >= ?" : ""} ${endDate ? "AND created_at <= ?" : ""} ${storeId ? "AND store_id = ?" : ""} GROUP BY customer_id HAVING COUNT(bill_no) > 1) t ON t.customer_id = sb.customer_id
     ${where}
     GROUP BY DATE_FORMAT(sb.created_at, '%Y-%m') ORDER BY month`,
    values, tenantId
  );
  return {
    repurchaseRate: totalC > 0 ? Math.round((repurchaseC / totalC) * 10000) / 100 : 0,
    repurchaseCustomerCount: repurchaseC,
    totalCustomerCount: totalC,
    repurchaseOrderCount: repurchaseO,
    totalOrderCount: totalO,
    repurchaseOrderRate: totalO > 0 ? Math.round((repurchaseO / totalO) * 10000) / 100 : 0,
    trend,
  };
}

// 客单价分布
export async function getAvgOrderValueDistribution(params: { tenantId: string; startDate?: string; endDate?: string; storeId?: number }) {
  const { tenantId, startDate, endDate, storeId } = params;
  const conditions: string[] = ["sb.tenant_id = ?", "sb.business_status = 'CREATED'"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("sb.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("sb.created_at <= ?"); values.push(endDate); }
  if (storeId) { conditions.push("sb.store_id = ?"); values.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const avgOrderValue = await queryOneWithTenant<any>(`SELECT AVG(receivable_amount) AS avgValue FROM t_sale_bill ${where}`, values, tenantId);
  const intervals = [
    { label: "<100", min: 0, max: 100 },
    { label: "100-300", min: 100, max: 300 },
    { label: "300-500", min: 300, max: 500 },
    { label: "500-1000", min: 500, max: 1000 },
    { label: "1000-3000", min: 1000, max: 3000 },
    { label: "3000+", min: 3000, max: 999999999 },
  ];
  const result = await Promise.all(intervals.map(async (iv) => {
    const row = await queryOneWithTenant<any>(
      `SELECT COUNT(*) AS orderCount, COUNT(DISTINCT customer_id) AS customerCount, COALESCE(SUM(receivable_amount), 0) AS totalAmount
       FROM t_sale_bill ${where} AND receivable_amount >= ? AND receivable_amount < ?`,
      [...values, iv.min, iv.max], tenantId
    );
    return { label: iv.label, customerCount: Number(row?.customerCount ?? 0), orderCount: Number(row?.orderCount ?? 0), totalAmount: Number(row?.totalAmount ?? 0) };
  }));
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_sale_bill ${where}`, values, tenantId);
  const totalOrders = Number(total?.cnt ?? 0);
  return {
    avgOrderValue: Math.round(Number(avgOrderValue?.avgValue ?? 0) * 100) / 100,
    totalOrders,
    distribution: result.map((r) => ({ ...r, pct: totalOrders > 0 ? Math.round((r.orderCount / totalOrders) * 10000) / 100 : 0 })),
  };
}

// RFM分析
export async function getRFMAnalysis(params: { tenantId: string; storeId?: number }) {
  const { tenantId, storeId } = params;
  const storeCondition = storeId ? "AND store_id = ?" : "";
  const values: unknown[] = storeId ? [tenantId, storeId] : [tenantId];
  const rfm = await queryWithTenant<any>(
    `SELECT customer_id AS customerId, m.name AS customerName,
            DATEDIFF(NOW(), MAX(created_at)) AS recencyDays,
            COUNT(DISTINCT bill_no) AS frequency,
            COALESCE(SUM(receivable_amount), 0) AS monetary
     FROM t_sale_bill sb
     LEFT JOIN member m ON m.id = sb.customer_id
     WHERE sb.tenant_id = ? AND sb.business_status = 'CREATED' ${storeCondition}
     GROUP BY customer_id, m.name`,
    values, tenantId
  );
  if (rfm.length === 0) return { groups: [], totalCustomers: 0 };
  const sortedR = [...rfm].sort((a, b) => a.recencyDays - b.recencyDays);
  const sortedF = [...rfm].sort((a, b) => b.frequency - a.frequency);
  const sortedM = [...rfm].sort((a, b) => b.monetary - a.monetary);
  // rfm.length > 0 已由前面 if 保证，sortedR[idx] 必然存在，无需 ?. 和 ?? 0
  const rMid = sortedR[Math.floor(sortedR.length / 2)].recencyDays;
  const fMid = sortedF[Math.floor(sortedF.length / 2)].frequency;
  const mMid = sortedM[Math.floor(sortedM.length / 2)].monetary;
  const groups = rfm.map((c) => {
    const rScore = c.recencyDays <= rMid ? 2 : 1;
    const fScore = c.frequency >= fMid ? 2 : 1;
    const mScore = c.monetary >= mMid ? 2 : 1;
    let rfmGroup = "一般挽留客户";
    if (rScore === 2 && fScore === 2 && mScore === 2) rfmGroup = "重要价值客户";
    else if (rScore === 2 && fScore === 1 && mScore === 2) rfmGroup = "重要发展客户";
    else if (rScore === 1 && fScore === 2 && mScore === 2) rfmGroup = "重要保持客户";
    else if (rScore === 1 && fScore === 1 && mScore === 2) rfmGroup = "重要挽留客户";
    else if (rScore === 2 && fScore === 2 && mScore === 1) rfmGroup = "一般价值客户";
    else if (rScore === 2 && fScore === 1 && mScore === 1) rfmGroup = "一般发展客户";
    else if (rScore === 1 && fScore === 2 && mScore === 1) rfmGroup = "一般保持客户";
    return { ...c, rScore, fScore, mScore, rfmGroup };
  });
  const groupSummary = new Map<string, { count: number; avgMonetary: number }>();
  for (const g of groups) {
    const entry = groupSummary.get(g.rfmGroup) || { count: 0, avgMonetary: 0 };
    entry.count++;
    entry.avgMonetary += g.monetary;
    groupSummary.set(g.rfmGroup, entry);
  }
  return {
    totalCustomers: groups.length,
    groups: Array.from(groupSummary.entries()).map(([name, data]) => ({
      rfmGroup: name, customerCount: data.count, avgMonetary: Math.round(data.avgMonetary / data.count * 100) / 100,
    })),
    customers: groups,
  };
}

// 客户贡献排行
export async function getCustomerContributionRanking(params: { tenantId: string; startDate?: string; endDate?: string; storeId?: number; limit?: number }) {
  const { tenantId, startDate, endDate, storeId, limit = 20 } = params;
  const conditions: string[] = ["sb.tenant_id = ?", "sb.business_status = 'CREATED'"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("sb.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("sb.created_at <= ?"); values.push(endDate); }
  if (storeId) { conditions.push("sb.store_id = ?"); values.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<any>(
    `SELECT sb.customer_id AS customerId, m.name AS customerName, m.mobile,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(sb.receivable_amount) - SUM(sb.unreceived_amount), 0) AS paidAmount,
            AVG(sb.receivable_amount) AS avgOrderValue
     FROM t_sale_bill sb
     LEFT JOIN member m ON m.id = sb.customer_id
     ${where} AND sb.customer_id IS NOT NULL
     GROUP BY sb.customer_id, m.name, m.mobile
     ORDER BY totalAmount DESC
     LIMIT ?`,
    [...values, limit], tenantId
  );
}

// 新增客户趋势
export async function getNewCustomerTrend(params: { tenantId: string; groupBy?: string; storeId?: number }) {
  const { tenantId, groupBy = "day", storeId } = params;
  const storeCondition = storeId ? "AND store_id = ?" : "";
  const values: unknown[] = storeId ? [tenantId, storeId] : [tenantId];
  let dateFormat: string;
  if (groupBy === "month") dateFormat = "DATE_FORMAT(created_at, '%Y-%m')";
  else if (groupBy === "week") dateFormat = "DATE_FORMAT(created_at, '%Y-%u')";
  else dateFormat = "DATE(created_at)";
  return queryWithTenant<any>(
    `SELECT ${dateFormat} AS period, COUNT(*) AS newCustomerCount
     FROM member
     WHERE tenant_id = ? ${storeCondition}
     GROUP BY period ORDER BY period`,
    values, tenantId
  );
}

// 流失客户分析
export async function getLostCustomerAnalysis(params: { tenantId: string; daysThreshold?: number; storeId?: number }) {
  const { tenantId, daysThreshold = 90, storeId } = params;
  const storeCondition = storeId ? "AND sb.store_id = ?" : "";
  const values: unknown[] = [tenantId, daysThreshold];
  if (storeId) values.push(storeId);
  const totalCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt FROM t_sale_bill WHERE tenant_id = ? AND business_status = 'CREATED' ${storeCondition}`,
    storeId ? [tenantId, storeId] : [tenantId], tenantId
  );
  const lostCustomers = await queryWithTenant<any>(
    `SELECT sb.customer_id AS customerId, m.name AS customerName, m.mobile,
            MAX(sb.created_at) AS lastOrderDate,
            DATEDIFF(NOW(), MAX(sb.created_at)) AS daysSinceLastOrder,
            COUNT(DISTINCT sb.bill_no) AS totalOrders,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount
     FROM t_sale_bill sb
     LEFT JOIN member m ON m.id = sb.customer_id
     WHERE sb.tenant_id = ? AND sb.business_status = 'CREATED' ${storeCondition}
     GROUP BY sb.customer_id, m.name, m.mobile
     HAVING DATEDIFF(NOW(), MAX(sb.created_at)) > ?
     ORDER BY daysSinceLastOrder DESC`,
    values, tenantId
  );
  const total = Number(totalCustomers?.cnt ?? 0);
  return {
    totalCustomers: total,
    lostCustomerCount: lostCustomers.length,
    lostRate: total > 0 ? Math.round((lostCustomers.length / total) * 10000) / 100 : 0,
    daysThreshold,
    customers: lostCustomers,
  };
}
