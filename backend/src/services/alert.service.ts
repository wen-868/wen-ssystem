import { query, queryOne, transaction } from "../shared/db";
import logger from "../shared/logger";
import { makeBizNo } from "../shared/id";

async function getAllActiveTenants(): Promise<string[]> {
  const rows = await query<any>(
    "SELECT DISTINCT tenant_id FROM t_sys_user WHERE status = 1"
  );
  return rows.map((r: any) => r.tenant_id).filter(Boolean);
}

async function checkStockLowAlerts(tenantId: string): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM t_alert_rule WHERE tenant_id = ? AND rule_code = 'STOCK_LOW' AND enabled = 1",
    [tenantId]
  );
  if (!rule) return 0;

  const records = await query<any>(
    `SELECT ib.store_id AS storeId, ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.available_qty AS availableQty, ps.warning_threshold AS safetyStock
     FROM t_inventory_balance ib
     JOIN t_product_sku ps ON ps.id = ib.sku_id
     WHERE ib.tenant_id = ?
       AND ps.tenant_id = ?
       AND ib.available_qty < ps.warning_threshold
       AND ps.warning_threshold > 0`,
    [tenantId, tenantId]
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    const skuIds = records.map((r: any) => r.skuId);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_id FROM t_alert_record
       WHERE tenant_id = ? AND rule_type = 'STOCK_LOW' AND biz_type = 'SKU' AND status = 'PENDING' AND biz_id IN (?)`,
      [tenantId, skuIds]
    );
    const existingSet = new Set(existingRows.map((r: any) => Number(r.biz_id)));

    let count = 0;
    for (const r of records) {
      if (existingSet.has(r.skuId)) continue;
      const alertNo = makeBizNo("YJ");
      const level = r.availableQty <= Math.max(r.safetyStock * 0.3, 1) ? "CRITICAL" : "WARNING";
      await conn.execute(
        `INSERT INTO t_alert_record (tenant_id, alert_no, rule_id, rule_type, alert_level, title, description,
          biz_type, biz_id, biz_no, current_value, threshold_value, status)
         VALUES (?, ?, ?, 'STOCK_LOW', ?, ?, ?, 'SKU', ?, ?, ?, ?, 'PENDING')`,
        [
          tenantId, alertNo, rule.id, level,
          `库存不足预警：${r.skuName}`,
          `商品 ${r.skuName} 可用库存 ${r.availableQty} 瓶，低于安全库存 ${r.safetyStock} 瓶`,
          r.skuId, `SKU-${r.skuId}`,
          r.availableQty, r.safetyStock
        ]
      );
      count++;
    }
    return count;
  });
}

async function checkExpiryAlerts(tenantId: string): Promise<number> {
  const rules = await query<any>(
    "SELECT * FROM t_alert_rule WHERE tenant_id = ? AND rule_type = 'EXPIRY' AND enabled = 1",
    [tenantId]
  );
  if (rules.length === 0) return 0;

  let totalCount = 0;
  for (const rule of rules) {
    const days = Number(rule.threshold_value);
    const level = days <= 7 ? "CRITICAL" : days <= 30 ? "WARNING" : "INFO";

    const records = await query<any>(
      `SELECT psi.sku_id AS skuId, ps.sku_name AS skuName,
              psi.batch_no AS batchNo, psi.expiry_date AS expiryDate,
              psi.total_bottle_qty AS qty,
              DATEDIFF(psi.expiry_date, CURDATE()) AS remainingDays
       FROM t_purchase_in_stock_item psi
       JOIN t_purchase_in_stock pis ON pis.stock_no = psi.stock_no
       JOIN t_product_sku ps ON ps.id = psi.sku_id
       WHERE psi.tenant_id = ?
         AND pis.tenant_id = ?
         AND ps.tenant_id = ?
         AND psi.expiry_date IS NOT NULL
         AND DATEDIFF(psi.expiry_date, CURDATE()) BETWEEN 0 AND ?
         AND pis.stock_status NOT IN ('VOIDED')`,
      [tenantId, tenantId, tenantId, days]
    );

    if (records.length === 0) continue;

    const count = await transaction(async (conn) => {
      const skuIds = records.map((r: any) => r.skuId);
      const [existingRows] = await conn.query<any[]>(
        `SELECT biz_id, biz_no FROM t_alert_record
         WHERE tenant_id = ? AND rule_type = 'EXPIRY' AND biz_type = 'SKU' AND status = 'PENDING' AND biz_id IN (?)`,
        [tenantId, skuIds]
      );
      const existingSet = new Set(existingRows.map((r: any) => `${r.biz_id}:${r.biz_no}`));

      let cnt = 0;
      for (const r of records) {
        const bizNo = r.batchNo ?? `SKU-${r.skuId}`;
        if (existingSet.has(`${r.skuId}:${bizNo}`)) continue;
        const alertNo = makeBizNo("YJ");
        await conn.execute(
          `INSERT INTO t_alert_record (tenant_id, alert_no, rule_id, rule_type, alert_level, title, description,
            biz_type, biz_id, biz_no, current_value, threshold_value, status)
           VALUES (?, ?, ?, 'EXPIRY', ?, ?, ?, 'SKU', ?, ?, ?, ?, 'PENDING')`,
          [
            tenantId, alertNo, rule.id, level,
            `保质期预警：${r.skuName}`,
            `商品 ${r.skuName}（批次 ${r.batchNo ?? "无"}）有效期至 ${r.expiryDate}，剩余 ${r.remainingDays} 天`,
            r.skuId, bizNo,
            r.remainingDays, days
          ]
        );
        cnt++;
      }
      return cnt;
    });
    totalCount += count;
  }
  return totalCount;
}

async function checkCreditAlerts(tenantId: string): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM t_alert_rule WHERE tenant_id = ? AND rule_code = 'CREDIT_LIMIT' AND enabled = 1",
    [tenantId]
  );
  if (!rule) return 0;

  const threshold = Number(rule.threshold_value);

  const records = await query<any>(
    `SELECT sb.customer_id AS customerId, sb.customer_name AS customerName,
            COALESCE(SUM(sb.unreceived_amount), 0) AS totalDebt
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ?
       AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.customer_id IS NOT NULL
       AND sb.unreceived_amount > 0
     GROUP BY sb.customer_id, sb.customer_name`,
    [tenantId]
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    const customerIds = records.map((r: any) => r.customerId);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_id FROM t_alert_record
       WHERE tenant_id = ? AND rule_type = 'CREDIT' AND biz_type = 'CUSTOMER' AND status = 'PENDING' AND biz_id IN (?)`,
      [tenantId, customerIds]
    );
    const existingSet = new Set(existingRows.map((r: any) => Number(r.biz_id)));

    let count = 0;
    for (const r of records) {
      if (existingSet.has(r.customerId)) continue;
      const creditLimit = Number(r.totalDebt) * 1.2;
      if (creditLimit <= 0) continue;

      const debtRatio = (Number(r.totalDebt) / creditLimit) * 100;
      if (debtRatio >= threshold) {
        const alertNo = makeBizNo("YJ");
        const level = debtRatio >= 100 ? "CRITICAL" : "WARNING";
        await conn.execute(
          `INSERT INTO t_alert_record (tenant_id, alert_no, rule_id, rule_type, alert_level, title, description,
            biz_type, biz_id, biz_no, current_value, threshold_value, status)
           VALUES (?, ?, ?, 'CREDIT', ?, ?, ?, 'CUSTOMER', ?, ?, ?, ?, 'PENDING')`,
          [
            tenantId, alertNo, rule.id, level,
            `信用额度预警：${r.customerName}`,
            `客户 ${r.customerName} 欠款 ${r.totalDebt} 元，已达信用额度的 ${Math.round(debtRatio)}%`,
            r.customerId, `CUSTOMER-${r.customerId}`,
            debtRatio, threshold
          ]
        );
        count++;
      }
    }
    return count;
  });
}

async function checkOverdueAlerts(tenantId: string): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM t_alert_rule WHERE tenant_id = ? AND rule_code = 'PAYMENT_OVERDUE' AND enabled = 1",
    [tenantId]
  );
  if (!rule) return 0;

  const records = await query<any>(
    `SELECT bill_no AS billNo, customer_id AS customerId, customer_name AS customerName,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount,
            unreceived_amount AS unreceivedAmount, due_date AS dueDate,
            DATEDIFF(CURDATE(), due_date) AS overdueDays
     FROM t_sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND collection_status NOT IN ('PAID', 'CLOSED')
       AND due_date IS NOT NULL
       AND due_date < CURDATE()
       AND unreceived_amount > 0`,
    [tenantId]
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    const billNos = records.map((r: any) => r.billNo);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_no FROM t_alert_record
       WHERE tenant_id = ? AND rule_type = 'OVERDUE' AND biz_type = 'BILL' AND status = 'PENDING' AND biz_no IN (?)`,
      [tenantId, billNos]
    );
    const existingSet = new Set(existingRows.map((r: any) => String(r.biz_no)));

    let count = 0;
    for (const r of records) {
      if (existingSet.has(r.billNo)) continue;
      const alertNo = makeBizNo("YJ");
      const overdueDays = Number(r.overdueDays);
      const level = overdueDays >= 30 ? "CRITICAL" : overdueDays >= 7 ? "WARNING" : "INFO";
      await conn.execute(
        `INSERT INTO t_alert_record (tenant_id, alert_no, rule_id, rule_type, alert_level, title, description,
          biz_type, biz_id, biz_no, current_value, threshold_value, status)
         VALUES (?, ?, ?, 'OVERDUE', ?, ?, ?, 'BILL', NULL, ?, ?, ?, 'PENDING')`,
        [
          tenantId, alertNo, rule.id, level,
          `回款逾期预警：${r.customerName}`,
          `客户 ${r.customerName} 销售单 ${r.billNo} 逾期 ${overdueDays} 天，未回款 ${r.unreceivedAmount} 元`,
          r.billNo,
          overdueDays, 0
        ]
      );
      count++;
    }
    return count;
  });
}

async function checkOverstockAlerts(tenantId: string): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM t_alert_rule WHERE tenant_id = ? AND rule_code = 'STOCK_OVERSTOCK' AND enabled = 1",
    [tenantId]
  );
  if (!rule) return 0;

  const thresholdDays = Number(rule.threshold_value);

  const records = await query<any>(
    `SELECT psi.sku_id AS skuId, ps.sku_name AS skuName,
            psi.batch_no AS batchNo, psi.total_bottle_qty AS qty,
            psi.created_at AS inStockDate,
            DATEDIFF(CURDATE(), psi.created_at) AS ageDays
     FROM t_purchase_in_stock_item psi
     JOIN t_purchase_in_stock pis ON pis.stock_no = psi.stock_no
     JOIN t_product_sku ps ON ps.id = psi.sku_id
     WHERE psi.tenant_id = ?
       AND pis.tenant_id = ?
       AND ps.tenant_id = ?
       AND pis.stock_status NOT IN ('VOIDED')
       AND DATEDIFF(CURDATE(), psi.created_at) > ?
       AND psi.total_bottle_qty > 0`,
    [tenantId, tenantId, tenantId, thresholdDays]
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    const skuIds = records.map((r: any) => r.skuId);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_id, biz_no FROM t_alert_record
       WHERE tenant_id = ? AND rule_type = 'STOCK_OVERSTOCK' AND biz_type = 'SKU' AND status = 'PENDING' AND biz_id IN (?)`,
      [tenantId, skuIds]
    );
    const existingSet = new Set(existingRows.map((r: any) => `${r.biz_id}:${r.biz_no}`));

    let count = 0;
    for (const r of records) {
      const bizNo = r.batchNo ?? `SKU-${r.skuId}`;
      if (existingSet.has(`${r.skuId}:${bizNo}`)) continue;
      const alertNo = makeBizNo("YJ");
      await conn.execute(
        `INSERT INTO t_alert_record (tenant_id, alert_no, rule_id, rule_type, alert_level, title, description,
          biz_type, biz_id, biz_no, current_value, threshold_value, status)
         VALUES (?, ?, ?, 'STOCK_OVERSTOCK', 'WARNING', ?, ?, 'SKU', ?, ?, ?, ?, 'PENDING')`,
        [
          tenantId, alertNo, rule.id,
          `库存积压预警：${r.skuName}`,
          `商品 ${r.skuName}（批次 ${r.batchNo ?? "无"}）库龄 ${r.ageDays} 天，超过 ${thresholdDays} 天预警线，数量 ${r.qty}`,
          r.skuId, bizNo,
          r.ageDays, thresholdDays
        ]
      );
      count++;
    }
    return count;
  });
}

export async function runAllAlertChecks(tenantId?: string): Promise<{
  stockLow: number;
  expiry: number;
  credit: number;
  overdue: number;
  overstock: number;
  total: number;
}> {
  let tenantIds: string[] = [];
  if (tenantId) {
    tenantIds = [tenantId];
  } else {
    tenantIds = await getAllActiveTenants();
  }

  let totalStockLow = 0;
  let totalExpiry = 0;
  let totalCredit = 0;
  let totalOverdue = 0;
  let totalOverstock = 0;

  for (const tid of tenantIds) {
    const [stockLow, expiry, credit, overdue, overstock] = await Promise.all([
      checkStockLowAlerts(tid),
      checkExpiryAlerts(tid),
      checkCreditAlerts(tid),
      checkOverdueAlerts(tid),
      checkOverstockAlerts(tid)
    ]);
    totalStockLow += stockLow;
    totalExpiry += expiry;
    totalCredit += credit;
    totalOverdue += overdue;
    totalOverstock += overstock;
  }

  return {
    stockLow: totalStockLow,
    expiry: totalExpiry,
    credit: totalCredit,
    overdue: totalOverdue,
    overstock: totalOverstock,
    total: totalStockLow + totalExpiry + totalCredit + totalOverdue + totalOverstock
  };
}

export async function listAlerts(params: {
  page: number; pageSize: number; tenantId: string;
  ruleType?: string; alertLevel?: string; status?: string;
}) {
  const { page, pageSize, tenantId, ruleType, alertLevel, status } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["ar.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (ruleType) {
    conditions.push("ar.rule_type = ?");
    queryParams.push(ruleType);
  }
  if (alertLevel) {
    conditions.push("ar.alert_level = ?");
    queryParams.push(alertLevel);
  }
  if (status) {
    conditions.push("ar.status = ?");
    queryParams.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT ar.id, ar.alert_no AS alertNo, ar.rule_id AS ruleId,
            ar.rule_type AS ruleType, ar.alert_level AS alertLevel,
            ar.title, ar.description,
            ar.biz_type AS bizType, ar.biz_id AS bizId, ar.biz_no AS bizNo,
            ar.current_value AS currentValue, ar.threshold_value AS thresholdValue,
            ar.status, ar.handler_id AS handlerId, ar.handler_name AS handlerName,
            ar.handle_time AS handleTime, ar.handle_remark AS handleRemark,
            ar.created_at AS createdAt, ar.updated_at AS updatedAt
     FROM t_alert_record ar
     ${where}
     ORDER BY ar.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM t_alert_record ar ${where}`,
    queryParams
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getAlertCounts(tenantId: string) {
  const pendingCounts = await query<any>(
    `SELECT rule_type AS ruleType, COUNT(*) AS count
     FROM t_alert_record
     WHERE tenant_id = ? AND status = 'PENDING'
     GROUP BY rule_type`,
    [tenantId]
  );

  const totalPending = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM t_alert_record WHERE tenant_id = ? AND status = 'PENDING'",
    [tenantId]
  );

  const totalHandled = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM t_alert_record WHERE tenant_id = ? AND status = 'HANDLED'",
    [tenantId]
  );

  const totalIgnored = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM t_alert_record WHERE tenant_id = ? AND status = 'IGNORED'",
    [tenantId]
  );

  const levelCounts = await query<any>(
    `SELECT alert_level AS alertLevel, COUNT(*) AS count
     FROM t_alert_record
     WHERE tenant_id = ? AND status = 'PENDING'
     GROUP BY alert_level`,
    [tenantId]
  );

  const byType: Record<string, number> = {};
  for (const row of pendingCounts) {
    byType[row.ruleType] = Number(row.count);
  }

  const byLevel: Record<string, number> = {};
  for (const row of levelCounts) {
    byLevel[row.alertLevel] = Number(row.count);
  }

  return {
    totalPending: Number(totalPending?.count ?? 0),
    totalHandled: Number(totalHandled?.count ?? 0),
    totalIgnored: Number(totalIgnored?.count ?? 0),
    byType,
    byLevel
  };
}

export async function handleAlert(
  alertId: number, tenantId: string, action: string, remark: string | undefined,
  userId: number, username: string
) {
  const existing = await queryOne<any>(
    "SELECT id, status FROM t_alert_record WHERE id = ? AND tenant_id = ?",
    [alertId, tenantId]
  );
  if (!existing) throw Object.assign(new Error("预警记录不存在"), { statusCode: 404 });
  if (existing.status !== "PENDING") throw Object.assign(new Error("该预警已处理，无法重复操作"), { statusCode: 400 });

  const newStatus = action === "HANDLE" ? "HANDLED" : "IGNORED";
  const handlerName = username ?? "system";

  await query(
    `UPDATE t_alert_record
     SET status = ?,
         handler_id = ?,
         handler_name = ?,
         handle_time = NOW(),
         handle_remark = ?,
         updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [newStatus, userId ?? 0, handlerName, remark ?? null, alertId, tenantId]
  );

  return {
    alertId,
    status: newStatus,
    handlerId: userId,
    handlerName,
    handleTime: new Date().toISOString()
  };
}

export async function listAlertRules(tenantId: string) {
  const records = await query<any>(
    `SELECT id, rule_code AS ruleCode, rule_name AS ruleName,
            rule_type AS ruleType, enabled,
            threshold_value AS thresholdValue, threshold_unit AS thresholdUnit,
            extra_config AS extraConfig, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_alert_rule
     WHERE tenant_id = ?
     ORDER BY rule_type, id ASC`,
    [tenantId]
  );

  return { records };
}

export async function updateAlertRule(
  ruleId: number, tenantId: string,
  body: { enabled?: boolean; thresholdValue?: number; description?: string }
) {
  const existing = await queryOne<any>(
    "SELECT id FROM t_alert_rule WHERE id = ? AND tenant_id = ?",
    [ruleId, tenantId]
  );
  if (!existing) throw Object.assign(new Error("预警规则不存在"), { statusCode: 404 });

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.enabled !== undefined) {
    updates.push("enabled = ?");
    params.push(body.enabled ? 1 : 0);
  }
  if (body.thresholdValue !== undefined) {
    updates.push("threshold_value = ?");
    params.push(body.thresholdValue);
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    params.push(body.description);
  }

  if (updates.length > 0) {
    await query(
      `UPDATE t_alert_rule SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...params, ruleId, tenantId]
    );
  }

  const rule = await queryOne<any>(
    `SELECT id, rule_code AS ruleCode, rule_name AS ruleName,
            rule_type AS ruleType, enabled,
            threshold_value AS thresholdValue, threshold_unit AS thresholdUnit,
            extra_config AS extraConfig, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_alert_rule WHERE id = ? AND tenant_id = ?`,
    [ruleId, tenantId]
  );

  return rule;
}

export async function runCheck(tenantId: string) {
  const result = await runAllAlertChecks(tenantId);
  return {
    message: `预警检查完成，新增 ${result.total} 条预警`,
    ...result
  };
}

export function startAlertScheduler() {
  const intervalMs = 60 * 60 * 1000;
  logger.info(`[预警引擎] 定时检查已启动，间隔 ${intervalMs / 1000} 秒`);

  setTimeout(async () => {
    try {
      const result = await runAllAlertChecks();
      logger.info(`[预警引擎] 首次检查完成，新增预警 ${result.total} 条`);
    } catch (error) {
      logger.error("[预警引擎] 首次检查失败:", error);
    }
  }, 30 * 1000);

  setInterval(async () => {
    try {
      const result = await runAllAlertChecks();
      if (result.total > 0) {
        logger.info(`[预警引擎] 定时检查完成，新增预警 ${result.total} 条`);
      }
    } catch (error) {
      logger.error("[预警引擎] 定时检查失败:", error);
    }
  }, intervalMs);
}
