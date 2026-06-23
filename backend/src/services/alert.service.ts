import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";

// 预警检查函数集合

/**
 * 检查安全库存预警：商品可用库存 < 安全库存值
 */
async function checkStockLowAlerts(): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM alert_rule WHERE rule_code = 'STOCK_LOW' AND enabled = 1"
  );
  if (!rule) return 0;

  const records = await query<any>(
    `SELECT ib.store_id AS storeId, ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.available_qty AS availableQty, ps.warning_threshold AS safetyStock
     FROM inventory_balance ib
     JOIN product_sku ps ON ps.id = ib.sku_id
     WHERE ib.available_qty < ps.warning_threshold
       AND ps.warning_threshold > 0`
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    // 批量查询已存在的预警
    const skuIds = records.map((r: any) => r.skuId);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_id FROM alert_record
       WHERE rule_type = 'STOCK_LOW' AND biz_type = 'SKU' AND status = 'PENDING' AND biz_id IN (?)`,
      [skuIds]
    );
    const existingSet = new Set(existingRows.map((r: any) => Number(r.biz_id)));

    let count = 0;
    for (const r of records) {
      if (existingSet.has(r.skuId)) continue;
      const alertNo = makeBizNo("YJ");
      const level = r.availableQty <= Math.max(r.safetyStock * 0.3, 1) ? "CRITICAL" : "WARNING";
      await conn.execute(
        `INSERT INTO alert_record (alert_no, rule_id, rule_type, alert_level, title, description,
          biz_type, biz_id, biz_no, current_value, threshold_value, status)
         VALUES (?, ?, 'STOCK_LOW', ?, ?, ?, 'SKU', ?, ?, ?, ?, 'PENDING')`,
        [
          alertNo, rule.id, level,
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

/**
 * 检查保质期预警：临期商品三级（90天/30天/7天）
 */
async function checkExpiryAlerts(): Promise<number> {
  const rules = await query<any>(
    "SELECT * FROM alert_rule WHERE rule_type = 'EXPIRY' AND enabled = 1"
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
       FROM purchase_in_stock_item psi
       JOIN purchase_in_stock pis ON pis.stock_no = psi.stock_no
       JOIN product_sku ps ON ps.id = psi.sku_id
       WHERE psi.expiry_date IS NOT NULL
         AND DATEDIFF(psi.expiry_date, CURDATE()) BETWEEN 0 AND ?
         AND pis.stock_status NOT IN ('VOIDED')`,
      [days]
    );

    if (records.length === 0) continue;

    const count = await transaction(async (conn) => {
      // 批量查询已存在的预警
      const bizKeys = records.map((r: any) => [r.skuId, r.batchNo ?? `SKU-${r.skuId}`]);
      // 构造 IN 条件：用 skuId + biz_no 组合判断
      const skuIds = records.map((r: any) => r.skuId);
      const [existingRows] = await conn.query<any[]>(
        `SELECT biz_id, biz_no FROM alert_record
         WHERE rule_type = 'EXPIRY' AND biz_type = 'SKU' AND status = 'PENDING' AND biz_id IN (?)`,
        [skuIds]
      );
      const existingSet = new Set(existingRows.map((r: any) => `${r.biz_id}:${r.biz_no}`));

      let cnt = 0;
      for (const r of records) {
        const bizNo = r.batchNo ?? `SKU-${r.skuId}`;
        if (existingSet.has(`${r.skuId}:${bizNo}`)) continue;
        const alertNo = makeBizNo("YJ");
        await conn.execute(
          `INSERT INTO alert_record (alert_no, rule_id, rule_type, alert_level, title, description,
            biz_type, biz_id, biz_no, current_value, threshold_value, status)
           VALUES (?, ?, 'EXPIRY', ?, ?, ?, 'SKU', ?, ?, ?, ?, 'PENDING')`,
          [
            alertNo, rule.id, level,
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

/**
 * 检查信用额度预警：客户欠款 >= 信用额度90%
 */
async function checkCreditAlerts(): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM alert_rule WHERE rule_code = 'CREDIT_LIMIT' AND enabled = 1"
  );
  if (!rule) return 0;

  const threshold = Number(rule.threshold_value); // 90 表示 90%

  // 查询有欠款的客户
  const records = await query<any>(
    `SELECT sb.customer_id AS customerId, sb.customer_name AS customerName,
            COALESCE(SUM(sb.unreceived_amount), 0) AS totalDebt
     FROM sale_bill sb
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.customer_id IS NOT NULL
       AND sb.unreceived_amount > 0
     GROUP BY sb.customer_id, sb.customer_name`
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    // 批量查询已存在的预警
    const customerIds = records.map((r: any) => r.customerId);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_id FROM alert_record
       WHERE rule_type = 'CREDIT' AND biz_type = 'CUSTOMER' AND status = 'PENDING' AND biz_id IN (?)`,
      [customerIds]
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
          `INSERT INTO alert_record (alert_no, rule_id, rule_type, alert_level, title, description,
            biz_type, biz_id, biz_no, current_value, threshold_value, status)
           VALUES (?, ?, 'CREDIT', ?, ?, ?, 'CUSTOMER', ?, ?, ?, ?, 'PENDING')`,
          [
            alertNo, rule.id, level,
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

/**
 * 检查回款逾期预警：超过账期未回款
 */
async function checkOverdueAlerts(): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM alert_rule WHERE rule_code = 'PAYMENT_OVERDUE' AND enabled = 1"
  );
  if (!rule) return 0;

  const records = await query<any>(
    `SELECT bill_no AS billNo, customer_id AS customerId, customer_name AS customerName,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount,
            unreceived_amount AS unreceivedAmount, due_date AS dueDate,
            DATEDIFF(CURDATE(), due_date) AS overdueDays
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND collection_status NOT IN ('PAID', 'CLOSED')
       AND due_date IS NOT NULL
       AND due_date < CURDATE()
       AND unreceived_amount > 0`
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    // 批量查询已存在的预警
    const billNos = records.map((r: any) => r.billNo);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_no FROM alert_record
       WHERE rule_type = 'OVERDUE' AND biz_type = 'BILL' AND status = 'PENDING' AND biz_no IN (?)`,
      [billNos]
    );
    const existingSet = new Set(existingRows.map((r: any) => String(r.biz_no)));

    let count = 0;
    for (const r of records) {
      if (existingSet.has(r.billNo)) continue;
      const alertNo = makeBizNo("YJ");
      const overdueDays = Number(r.overdueDays);
      const level = overdueDays >= 30 ? "CRITICAL" : overdueDays >= 7 ? "WARNING" : "INFO";
      await conn.execute(
        `INSERT INTO alert_record (alert_no, rule_id, rule_type, alert_level, title, description,
          biz_type, biz_id, biz_no, current_value, threshold_value, status)
         VALUES (?, ?, 'OVERDUE', ?, ?, ?, 'BILL', NULL, ?, ?, ?, 'PENDING')`,
        [
          alertNo, rule.id, level,
          `回款逾期预警：${r.customerName}`,
          `客户 ${r.customerName} 销售单 ${r.billNo} 逾期 ${overdueDays} 天，未回款 ${r.unreceivedAmount} 元`,
          "BILL", r.billNo,
          overdueDays, 0
        ]
      );
      count++;
    }
    return count;
  });
}

/**
 * 检查库存积压预警：库龄超过180天
 */
async function checkOverstockAlerts(): Promise<number> {
  const rule = await queryOne<any>(
    "SELECT * FROM alert_rule WHERE rule_code = 'STOCK_OVERSTOCK' AND enabled = 1"
  );
  if (!rule) return 0;

  const thresholdDays = Number(rule.threshold_value); // 180天

  const records = await query<any>(
    `SELECT psi.sku_id AS skuId, ps.sku_name AS skuName,
            psi.batch_no AS batchNo, psi.total_bottle_qty AS qty,
            psi.created_at AS inStockDate,
            DATEDIFF(CURDATE(), psi.created_at) AS ageDays
     FROM purchase_in_stock_item psi
     JOIN purchase_in_stock pis ON pis.stock_no = psi.stock_no
     JOIN product_sku ps ON ps.id = psi.sku_id
     WHERE pis.stock_status NOT IN ('VOIDED')
       AND DATEDIFF(CURDATE(), psi.created_at) > ?
       AND psi.total_bottle_qty > 0`,
    [thresholdDays]
  );

  if (records.length === 0) return 0;

  return transaction(async (conn) => {
    // 批量查询已存在的预警
    const skuIds = records.map((r: any) => r.skuId);
    const [existingRows] = await conn.query<any[]>(
      `SELECT biz_id, biz_no FROM alert_record
       WHERE rule_type = 'STOCK_OVERSTOCK' AND biz_type = 'SKU' AND status = 'PENDING' AND biz_id IN (?)`,
      [skuIds]
    );
    const existingSet = new Set(existingRows.map((r: any) => `${r.biz_id}:${r.biz_no}`));

    let count = 0;
    for (const r of records) {
      const bizNo = r.batchNo ?? `SKU-${r.skuId}`;
      if (existingSet.has(`${r.skuId}:${bizNo}`)) continue;
      const alertNo = makeBizNo("YJ");
      await conn.execute(
        `INSERT INTO alert_record (alert_no, rule_id, rule_type, alert_level, title, description,
          biz_type, biz_id, biz_no, current_value, threshold_value, status)
         VALUES (?, ?, 'STOCK_OVERSTOCK', 'WARNING', ?, ?, 'SKU', ?, ?, ?, ?, 'PENDING')`,
        [
          alertNo, rule.id,
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

/**
 * 执行所有预警检查
 */
export async function runAllAlertChecks(): Promise<{
  stockLow: number;
  expiry: number;
  credit: number;
  overdue: number;
  overstock: number;
  total: number;
}> {
  const [stockLow, expiry, credit, overdue, overstock] = await Promise.all([
    checkStockLowAlerts(),
    checkExpiryAlerts(),
    checkCreditAlerts(),
    checkOverdueAlerts(),
    checkOverstockAlerts()
  ]);

  return {
    stockLow,
    expiry,
    credit,
    overdue,
    overstock,
    total: stockLow + expiry + credit + overdue + overstock
  };
}

/**
 * 启动定时预警检查（每小时执行一次）
 */
export function startAlertScheduler() {
  // 每小时检查一次
  const intervalMs = 60 * 60 * 1000;
  console.log(`[预警引擎] 定时检查已启动，间隔 ${intervalMs / 1000} 秒`);

  // 首次延迟30秒执行
  setTimeout(async () => {
    try {
      const result = await runAllAlertChecks();
      console.log(`[预警引擎] 首次检查完成，新增预警 ${result.total} 条`);
    } catch (error) {
      console.error("[预警引擎] 首次检查失败:", error);
    }
  }, 30 * 1000);

  // 定时执行
  setInterval(async () => {
    try {
      const result = await runAllAlertChecks();
      if (result.total > 0) {
        console.log(`[预警引擎] 定时检查完成，新增预警 ${result.total} 条`);
      }
    } catch (error) {
      console.error("[预警引擎] 定时检查失败:", error);
    }
  }, intervalMs);
}
