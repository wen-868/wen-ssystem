import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

// 收款漏斗分析
export async function getCollectionFunnel(params: { tenantId: string; startDate?: string; endDate?: string; storeId?: number }) {
  const { tenantId, startDate, endDate, storeId } = params;
  const conditions: string[] = ["cl.tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("cl.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("cl.created_at <= ?"); values.push(endDate); }
  if (storeId) { conditions.push("cl.store_id = ?"); values.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const shareCount = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_collection_link cl ${where}`, values, tenantId);
  const viewCount = await queryOneWithTenant<any>(`SELECT COUNT(DISTINCT cvl.link_no) AS cnt FROM t_collection_view_log cvl JOIN t_collection_link cl ON cl.link_no = cvl.link_no ${where}`, values, tenantId);
  // where 恒非空（至少包含 cl.tenant_id = ?），直接用 AND 拼接
  const payCount = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_collection_link cl ${where} AND cl.status = 'PAID'`, values, tenantId);
  const payAmount = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(cl.paid_amount), 0) AS amount FROM t_collection_link cl ${where} AND cl.status = 'PAID'`, values, tenantId);
  const totalShare = Number(shareCount?.cnt ?? 0);
  const totalView = Number(viewCount?.cnt ?? 0);
  const totalPay = Number(payCount?.cnt ?? 0);
  return {
    shareCount: totalShare,
    viewCount: totalView,
    payCount: totalPay,
    payAmount: Number(payAmount?.amount ?? 0),
    viewRate: totalShare > 0 ? Math.round((totalView / totalShare) * 10000) / 100 : 0,
    payRate: totalView > 0 ? Math.round((totalPay / totalView) * 10000) / 100 : 0,
    overallConversionRate: totalShare > 0 ? Math.round((totalPay / totalShare) * 10000) / 100 : 0,
  };
}

// 渠道转化率
export async function getChannelConversion(params: { tenantId: string; startDate?: string; endDate?: string; storeId?: number }) {
  const { tenantId, startDate, endDate, storeId } = params;
  const conditions: string[] = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<any>(
    `SELECT share_channel AS channel,
            COUNT(*) AS totalCount,
            COALESCE(SUM(amount), 0) AS totalAmount,
            COUNT(CASE WHEN status = 'PAID' THEN 1 END) AS paidCount,
            COALESCE(SUM(CASE WHEN status = 'PAID' THEN paid_amount ELSE 0 END), 0) AS paidAmount,
            CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(CASE WHEN status = 'PAID' THEN 1 END) * 100.0 / COUNT(*), 2) ELSE 0 END AS conversionRate
     FROM t_collection_link ${where}
     GROUP BY share_channel ORDER BY totalCount DESC`,
    values, tenantId
  );
}

// 超时未付分析
export async function getCollectionTimeout(params: { tenantId: string; startDate?: string; endDate?: string; storeId?: number }) {
  const { tenantId, startDate, endDate, storeId } = params;
  const conditions: string[] = ["cl.tenant_id = ?", "cl.status NOT IN ('PAID', 'REVOKED')"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("cl.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("cl.created_at <= ?"); values.push(endDate); }
  if (storeId) { conditions.push("cl.store_id = ?"); values.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_collection_link cl ${where}`, values, tenantId);
  const timeout30min = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amount FROM t_collection_link cl ${where} AND TIMESTAMPDIFF(MINUTE, cl.created_at, NOW()) < 30`, values, tenantId);
  const timeout30to60 = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amount FROM t_collection_link cl ${where} AND TIMESTAMPDIFF(MINUTE, cl.created_at, NOW()) BETWEEN 30 AND 60`, values, tenantId);
  const timeout1to2 = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amount FROM t_collection_link cl ${where} AND TIMESTAMPDIFF(MINUTE, cl.created_at, NOW()) BETWEEN 60 AND 120`, values, tenantId);
  const timeout2to24 = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amount FROM t_collection_link cl ${where} AND TIMESTAMPDIFF(MINUTE, cl.created_at, NOW()) BETWEEN 120 AND 1440`, values, tenantId);
  const timeout24plus = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amount FROM t_collection_link cl ${where} AND TIMESTAMPDIFF(MINUTE, cl.created_at, NOW()) > 1440`, values, tenantId);
  const avgTimeout = await queryOneWithTenant<any>(`SELECT AVG(TIMESTAMPDIFF(MINUTE, cl.created_at, NOW())) AS avgMinutes FROM t_collection_link cl ${where}`, values, tenantId);
  const totalLinks = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_collection_link cl WHERE cl.tenant_id = ? ${startDate ? "AND cl.created_at >= ?" : ""} ${endDate ? "AND cl.created_at <= ?" : ""} ${storeId ? "AND cl.store_id = ?" : ""}`, values, tenantId);
  const totalAll = Number(totalLinks?.cnt ?? 0);
  return {
    timeoutCount: Number(total?.cnt ?? 0),
    timeoutAmount: 0,
    timeoutRate: totalAll > 0 ? Math.round((Number(total?.cnt ?? 0) / totalAll) * 10000) / 100 : 0,
    avgTimeoutMinutes: Math.round(Number(avgTimeout?.avgMinutes ?? 0)),
    intervals: [
      { label: "<30分钟", count: Number(timeout30min?.cnt ?? 0), amount: Number(timeout30min?.amount ?? 0) },
      { label: "30-60分钟", count: Number(timeout30to60?.cnt ?? 0), amount: Number(timeout30to60?.amount ?? 0) },
      { label: "1-2小时", count: Number(timeout1to2?.cnt ?? 0), amount: Number(timeout1to2?.amount ?? 0) },
      { label: "2-24小时", count: Number(timeout2to24?.cnt ?? 0), amount: Number(timeout2to24?.amount ?? 0) },
      { label: "24小时以上", count: Number(timeout24plus?.cnt ?? 0), amount: Number(timeout24plus?.amount ?? 0) },
    ],
  };
}

// 收款趋势
export async function getCollectionDailyTrend(params: { tenantId: string; startDate?: string; endDate?: string; storeId?: number }) {
  const { tenantId, startDate, endDate, storeId } = params;
  const conditions: string[] = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<any>(
    `SELECT DATE(created_at) AS date,
            COUNT(*) AS totalCount,
            COUNT(CASE WHEN status = 'PAID' THEN 1 END) AS paidCount,
            COALESCE(SUM(CASE WHEN status = 'PAID' THEN paid_amount ELSE 0 END), 0) AS paidAmount,
            COALESCE(SUM(amount), 0) AS totalAmount
     FROM t_collection_link ${where}
     GROUP BY DATE(created_at) ORDER BY date`,
    values, tenantId
  );
}

// 收款总览
export async function getCollectionSummary(params: { tenantId: string; storeId?: number }) {
  const { tenantId, storeId } = params;
  const storeCondition = storeId ? "AND store_id = ?" : "";
  const values: unknown[] = storeId ? [tenantId, storeId] : [tenantId];
  const total = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(paid_amount), 0) AS amount FROM t_collection_link WHERE tenant_id = ? AND status = 'PAID' ${storeCondition}`, values, tenantId);
  const month = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(paid_amount), 0) AS amount FROM t_collection_link WHERE tenant_id = ? AND status = 'PAID' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') ${storeCondition}`, values, tenantId);
  const today = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(paid_amount), 0) AS amount FROM t_collection_link WHERE tenant_id = ? AND status = 'PAID' AND DATE(created_at) = CURDATE() ${storeCondition}`, values, tenantId);
  const refund = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(amount), 0) AS amount FROM t_refund_order WHERE tenant_id = ? AND status = 'SUCCESS' ${storeCondition}`, values, tenantId);
  const totalPaid = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_collection_link WHERE tenant_id = ? AND status = 'PAID' ${storeCondition}`, values, tenantId);
  const avgCycle = await queryOneWithTenant<any>(`SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, paid_at)) AS avgHours FROM t_collection_link WHERE tenant_id = ? AND status = 'PAID' AND paid_at IS NOT NULL ${storeCondition}`, values, tenantId);
  const totalAll = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(amount), 0) AS amount FROM t_collection_link WHERE tenant_id = ? ${storeCondition}`, values, tenantId);
  return {
    totalCollection: Number(total?.amount ?? 0),
    monthCollection: Number(month?.amount ?? 0),
    todayCollection: Number(today?.amount ?? 0),
    refundAmount: Number(refund?.amount ?? 0),
    refundRate: Number(totalAll?.amount ?? 0) > 0 ? Math.round((Number(refund?.amount ?? 0) / Number(totalAll!.amount)) * 10000) / 100 : 0,
    avgCollectionHours: Math.round(Number(avgCycle?.avgHours ?? 0)),
    totalPaidCount: Number(totalPaid?.cnt ?? 0),
  };
}
