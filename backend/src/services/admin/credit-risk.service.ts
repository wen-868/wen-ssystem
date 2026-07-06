import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import type { ServiceContext, PageResult } from "../../types/index.js";

export async function getRiskCustomers(
  page: number,
  pageSize: number,
  ctx: ServiceContext
): Promise<PageResult<any>> {
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<any>(
    `SELECT cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.payment_term AS paymentTerm, cc.warning_threshold AS warningThreshold,
            cc.status AS creditStatus, cc.freeze_reason AS freezeReason,
            cc.frozen_at AS frozenAt,
            COALESCE(
              DATEDIFF(NOW(),
                CASE cc.payment_term
                  WHEN 'COD' THEN NOW()
                  WHEN 'NET_7' THEN DATE_SUB(NOW(), INTERVAL 7 DAY)
                  WHEN 'NET_15' THEN DATE_SUB(NOW(), INTERVAL 15 DAY)
                  WHEN 'NET_30' THEN DATE_SUB(NOW(), INTERVAL 30 DAY)
                  WHEN 'NET_60' THEN DATE_SUB(NOW(), INTERVAL 60 DAY)
                  WHEN 'NET_90' THEN DATE_SUB(NOW(), INTERVAL 90 DAY)
                END
              ), 0
            ) AS estimatedOverdueDays,
            CASE
              WHEN cc.status = 'FROZEN' THEN 'FROZEN'
              WHEN cc.credit_limit > 0 AND (cc.credit_used / cc.credit_limit) >= cc.warning_threshold THEN 'WARNING'
              WHEN cc.payment_term != 'COD' AND cc.credit_used > 0 AND
                   DATEDIFF(NOW(),
                     CASE cc.payment_term
                       WHEN 'NET_7' THEN DATE_SUB(NOW(), INTERVAL 7 DAY)
                       WHEN 'NET_15' THEN DATE_SUB(NOW(), INTERVAL 15 DAY)
                       WHEN 'NET_30' THEN DATE_SUB(NOW(), INTERVAL 30 DAY)
                       WHEN 'NET_60' THEN DATE_SUB(NOW(), INTERVAL 60 DAY)
                       WHEN 'NET_90' THEN DATE_SUB(NOW(), INTERVAL 90 DAY)
                     END
                   ) > 0 THEN 'OVERDUE'
              ELSE 'NORMAL'
            END AS riskLevel
     FROM t_customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     WHERE cc.tenant_id = ?
       AND (
         cc.status = 'FROZEN'
         OR (cc.credit_limit > 0 AND cc.credit_used / cc.credit_limit >= cc.warning_threshold)
         OR (cc.payment_term != 'COD' AND cc.credit_used > 0)
       )
     ORDER BY
       CASE cc.status WHEN 'FROZEN' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END,
       cc.credit_used DESC
     LIMIT ? OFFSET ?`,
    [ctx.tenantId, pageSize, offset],
    ctx.tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total
     FROM t_customer_credit cc
     WHERE cc.tenant_id = ?
       AND (
         cc.status = 'FROZEN'
         OR (cc.credit_limit > 0 AND cc.credit_used / cc.credit_limit >= cc.warning_threshold)
         OR (cc.payment_term != 'COD' AND cc.credit_used > 0)
       )`,
    [ctx.tenantId],
    ctx.tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}