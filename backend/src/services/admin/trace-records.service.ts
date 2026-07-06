import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";
import { verifyTraceCodeSimple } from "../../shared/trace-code.js";

export async function generateTraceCodes(
  body: {
    skuId: number;
    skuName: string;
    batchNo: string;
    quantity: number;
    productionDate?: string | null;
    codeMode: "ONE_PER_ITEM" | "ONE_PER_BATCH";
    categoryId?: number;
    storeId?: number;
    warehouseId?: number;
    supplierId?: number;
    shelfLifeDays?: number;
  },
  userId: number,
  username: string,
  tenantId: string
) {
  const skuConfig = await queryOneWithTenant<any>(
    `SELECT code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM t_trace_config WHERE config_level = 'SKU' AND target_id = ? AND status = 1 AND tenant_id = ?`,
    [body.skuId, tenantId],
    tenantId
  );
  const globalConfig = !skuConfig ? await queryOneWithTenant<any>(
    `SELECT code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM t_trace_config WHERE config_level = 'GLOBAL' AND status = 1 AND tenant_id = ? LIMIT 1`,
    [tenantId],
    tenantId
  ) : null;
  const config = skuConfig || globalConfig;

  const codePrefix = config?.codePrefix || "TR";
  const shelfLifeDays = body.shelfLifeDays ?? config?.shelfLifeDays ?? 365;
  const productionDate = body.productionDate ?? null;
  const expiryDate = productionDate
    ? new Date(new Date(productionDate).getTime() + shelfLifeDays * 86400000).toISOString().slice(0, 10)
    : null;

  const generateCount = body.codeMode === "ONE_PER_BATCH" ? 1 : body.quantity;
  const generatedCodes: string[] = [];

  for (let i = 0; i < generateCount; i++) {
    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const seq = String(i + 1).padStart(4, "0");
    const traceCode = `${codePrefix}${datePart}${seq}`;

    await queryWithTenant(
      `INSERT INTO t_trace_code (trace_code, sku_id, sku_name, batch_no, production_date, expiry_date,
         shelf_life_days, code_mode, category_id, current_status, current_location,
         store_id, warehouse_id, supplier_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRODUCED', '生产入库', ?, ?, ?, ?)`,
      [traceCode, body.skuId, body.skuName, body.batchNo, productionDate, expiryDate,
       shelfLifeDays, body.codeMode, body.categoryId ?? null,
       body.storeId ?? null, body.warehouseId ?? null, body.supplierId ?? null, tenantId],
      tenantId
    );

    await queryWithTenant(
      `INSERT INTO t_trace_event_log (trace_code, event_type, from_status, to_status,
         operator_type, operator_id, operator_name, location, remark, tenant_id)
       VALUES (?, 'GENERATE', NULL, 'PRODUCED', 'ADMIN', ?, ?, '生产入库', '系统生成追溯码', ?)`,
      [traceCode, userId, username, tenantId],
      tenantId
    );

    generatedCodes.push(traceCode);
  }

  return {
    generatedCount: generatedCodes.length,
    codeMode: body.codeMode,
    traceCodes: generatedCodes
  };
}

export async function listTraceCodes(
  page: number,
  pageSize: number,
  skuId: number | undefined,
  batchNo: string | undefined,
  currentStatus: string | undefined,
  storeId: number | undefined,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tc.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (skuId) {
    conditions.push("tc.sku_id = ?");
    params.push(skuId);
  }
  if (batchNo) {
    conditions.push("tc.batch_no = ?");
    params.push(batchNo);
  }
  if (currentStatus) {
    conditions.push("tc.current_status = ?");
    params.push(currentStatus);
  }
  if (storeId) {
    conditions.push("tc.store_id = ?");
    params.push(storeId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT tc.id, tc.trace_code AS traceCode, tc.sku_id AS skuId, tc.sku_name AS skuName,
            tc.batch_no AS batchNo, tc.production_date AS productionDate,
            tc.expiry_date AS expiryDate, tc.shelf_life_days AS shelfLifeDays,
            tc.code_mode AS codeMode, tc.category_id AS categoryId,
            tc.current_status AS currentStatus, tc.current_location AS currentLocation,
            tc.store_id AS storeId, tc.warehouse_id AS warehouseId,
            tc.order_id AS orderId, tc.supplier_id AS supplierId,
            tc.quality_check_result AS qualityCheckResult,
            tc.first_scan_at AS firstScanAt, tc.scan_count AS scanCount,
            tc.fraud_alert AS fraudAlert, tc.produced_at AS producedAt,
            tc.version, tc.created_at AS createdAt, tc.updated_at AS updatedAt
     FROM t_trace_code tc
     ${where}
     ORDER BY tc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_trace_code tc ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getTraceCodeDetail(traceCode: string, tenantId: string) {
  const code = await queryOneWithTenant<any>(
    `SELECT tc.id, tc.trace_code AS traceCode, tc.sku_id AS skuId, tc.sku_name AS skuName,
            tc.batch_no AS batchNo, tc.production_date AS productionDate,
            tc.expiry_date AS expiryDate, tc.shelf_life_days AS shelfLifeDays,
            tc.code_mode AS codeMode, tc.category_id AS categoryId,
            tc.current_status AS currentStatus, tc.current_location AS currentLocation,
            tc.store_id AS storeId, tc.warehouse_id AS warehouseId,
            tc.order_id AS orderId, tc.supplier_id AS supplierId,
            tc.quality_check_result AS qualityCheckResult,
            tc.first_scan_at AS firstScanAt, tc.first_scan_ip AS firstScanIp,
            tc.scan_count AS scanCount, tc.fraud_alert AS fraudAlert,
            tc.produced_at AS producedAt, tc.version,
            tc.created_at AS createdAt, tc.updated_at AS updatedAt
     FROM t_trace_code tc
     WHERE tc.trace_code = ? AND tc.tenant_id = ?`,
    [traceCode, tenantId],
    tenantId
  );

  if (!code) {
    return null;
  }

  const events = await queryWithTenant<any>(
    `SELECT id, trace_code AS traceCode, event_type AS eventType,
            from_status AS fromStatus, to_status AS toStatus,
            operator_type AS operatorType, operator_id AS operatorId,
            operator_name AS operatorName, store_id AS storeId,
            order_id AS orderId, location, remark,
            extra, ip, created_at AS createdAt
     FROM t_trace_event_log
     WHERE trace_code = ? AND tenant_id = ?
     ORDER BY created_at ASC`,
    [traceCode, tenantId],
    tenantId
  );

  return { ...code, events };
}

export async function updateTraceCodeStatus(
  traceCode: string,
  body: {
    status: string;
    location?: string;
    storeId?: number;
    warehouseId?: number;
    orderId?: number;
    remark?: string;
    qualityCheckResult?: "PASS" | "FAIL" | "PENDING";
  },
  userId: number,
  username: string,
  ip: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<any>(
    `SELECT id, current_status AS currentStatus, current_location AS currentLocation,
            store_id AS storeId, warehouse_id AS warehouseId, order_id AS orderId,
            quality_check_result AS qualityCheckResult
     FROM t_trace_code WHERE trace_code = ? AND tenant_id = ?`,
    [traceCode, tenantId],
    tenantId
  );

  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  updates.push("current_status = ?");
  params.push(body.status);
  if (body.location !== undefined) { updates.push("current_location = ?"); params.push(body.location); }
  if (body.storeId !== undefined) { updates.push("store_id = ?"); params.push(body.storeId); }
  if (body.warehouseId !== undefined) { updates.push("warehouse_id = ?"); params.push(body.warehouseId); }
  if (body.orderId !== undefined) { updates.push("order_id = ?"); params.push(body.orderId); }
  if (body.qualityCheckResult !== undefined) { updates.push("quality_check_result = ?"); params.push(body.qualityCheckResult); }
  updates.push("version = version + 1");

  await queryWithTenant(
    `UPDATE t_trace_code SET ${updates.join(", ")} WHERE trace_code = ? AND tenant_id = ?`,
    [...params, traceCode, tenantId],
    tenantId
  );

  await queryWithTenant(
    `INSERT INTO t_trace_event_log (trace_code, event_type, from_status, to_status,
       operator_type, operator_id, operator_name, store_id, order_id, location, remark, ip, tenant_id)
     VALUES (?, 'STATUS_CHANGE', ?, ?, 'ADMIN', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [traceCode, existing.currentStatus, body.status,
     userId, username,
     body.storeId ?? existing.storeId, body.orderId ?? existing.orderId,
     body.location ?? existing.currentLocation, body.remark ?? "",
     ip, tenantId],
    tenantId
  );

  const code = await queryOneWithTenant<any>(
    `SELECT id, trace_code AS traceCode, current_status AS currentStatus,
            current_location AS currentLocation, version, updated_at AS updatedAt
     FROM t_trace_code WHERE trace_code = ? AND tenant_id = ?`,
    [traceCode, tenantId],
    tenantId
  );

  return code;
}

export async function getTraceCodeStatistics(tenantId: string) {
  const statusStats = await queryWithTenant<any>(
    `SELECT current_status AS currentStatus, COUNT(*) AS count
     FROM t_trace_code
     WHERE tenant_id = ?
     GROUP BY current_status`,
    [tenantId],
    tenantId
  );

  const totalCount = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS count FROM t_trace_code WHERE tenant_id = ?",
    [tenantId],
    tenantId
  );

  const todayCount = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS count FROM t_trace_code
     WHERE tenant_id = ? AND DATE(created_at) = CURDATE()`,
    [tenantId],
    tenantId
  );

  const fraudCount = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS count FROM t_trace_code WHERE fraud_alert = 1 AND tenant_id = ?",
    [tenantId],
    tenantId
  );

  const totalScans = await queryOneWithTenant<any>(
    "SELECT COALESCE(SUM(scan_count), 0) AS count FROM t_trace_code WHERE tenant_id = ?",
    [tenantId],
    tenantId
  );

  const todayScans = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS count FROM t_trace_scan_log
     WHERE tenant_id = ? AND DATE(created_at) = CURDATE()`,
    [tenantId],
    tenantId
  );

  const byStatus: Record<string, number> = {};
  for (const row of statusStats) {
    byStatus[row.currentStatus] = Number(row.count);
  }

  return {
    totalCodes: Number(totalCount?.count ?? 0),
    todayGenerated: Number(todayCount?.count ?? 0),
    totalScans: Number(totalScans?.count ?? 0),
    todayScans: Number(todayScans?.count ?? 0),
    fraudAlerts: Number(fraudCount?.count ?? 0),
    byStatus
  };
}

export async function queryTraceChain(traceCode: string, tenantId: string) {
  const code = await queryOneWithTenant<any>(
    `SELECT id, trace_code AS traceCode, sku_id AS skuId, sku_name AS skuName,
            batch_no AS batchNo, production_date AS productionDate,
            expiry_date AS expiryDate, shelf_life_days AS shelfLifeDays,
            code_mode AS codeMode, category_id AS categoryId,
            current_status AS currentStatus, current_location AS currentLocation,
            store_id AS storeId, warehouse_id AS warehouseId,
            quality_check_result AS qualityCheckResult,
            scan_count AS scanCount, fraud_alert AS fraudAlert,
            produced_at AS producedAt, created_at AS createdAt
     FROM t_trace_code WHERE trace_code = ? AND tenant_id = ?`,
    [traceCode, tenantId],
    tenantId
  );

  if (!code) {
    return null;
  }

  const events = await queryWithTenant<any>(
    `SELECT id, trace_code AS traceCode, event_type AS eventType,
            from_status AS fromStatus, to_status AS toStatus,
            operator_type AS operatorType, operator_name AS operatorName,
            location, remark, created_at AS createdAt
     FROM t_trace_event_log
     WHERE trace_code = ? AND tenant_id = ?
     ORDER BY created_at ASC`,
    [traceCode, tenantId],
    tenantId
  );

  return { ...code, events };
}

export async function verifyTraceCode(
  traceCode: string,
  scanType: "CONSUMER" | "BUSINESS" | "PDA" | "ADMIN",
  userId: number | undefined,
  ip: string,
  tenantId: string
) {
  // R9-2: 委托到共享验证逻辑
  const verifyResult = await verifyTraceCodeSimple(traceCode, tenantId);

  let result: "SUCCESS" | "INVALID" | "NOT_FOUND" | "FRAUD_ALERT" | "EXPIRED" = "NOT_FOUND";
  let message = "追溯码不存在";

  if (!verifyResult.valid) {
    if (verifyResult.message.includes("不存在")) {
      result = "NOT_FOUND";
      message = "追溯码不存在，请核实后重试";
    } else if (verifyResult.message.includes("仿冒")) {
      result = "FRAUD_ALERT";
      message = "该追溯码已被标记为疑似仿冒，请谨慎购买";
    } else if (verifyResult.message.includes("过期")) {
      result = "EXPIRED";
      message = "该商品已过期";
    }
  } else {
    result = "SUCCESS";
    message = "验证通过，该商品为正品";

    await queryWithTenant(
      `UPDATE t_trace_code
       SET scan_count = scan_count + 1,
           first_scan_at = CASE WHEN scan_count = 0 THEN NOW() ELSE first_scan_at END,
           first_scan_ip = CASE WHEN scan_count = 0 THEN ? ELSE first_scan_ip END
       WHERE trace_code = ? AND tenant_id = ?`,
      [ip, traceCode, tenantId],
      tenantId
    );
  }

  await queryWithTenant(
    `INSERT INTO t_trace_scan_log (trace_code, scan_type, user_id, ip, result, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [traceCode, scanType, userId ?? null, ip, result, tenantId],
    tenantId
  );

  return {
    result,
    message,
    traceCode,
    skuName: verifyResult.code?.skuName ?? null,
    batchNo: verifyResult.code?.batchNo ?? null,
    currentStatus: verifyResult.code?.currentStatus ?? null,
    qualityCheckResult: (verifyResult.code as any)?.qualityCheckResult ?? null,
    scanCount: verifyResult.code ? Number((verifyResult.code as any).scanCount ?? 0) + 1 : 0
  };
}

export async function createRecall(
  body: {
    recallType: "BATCH" | "CATEGORY" | "SKU" | "SUPPLIER" | "GLOBAL";
    targetValue: string;
    targetName: string;
    reason: string;
    notifyContent?: string;
  },
  operatorId: number,
  tenantId: string
) {
  const recallNo = makeBizNo("RC");

  let affectedCondition = "";
  const affectedParams: unknown[] = [tenantId];
  switch (body.recallType) {
    case "BATCH":
      affectedCondition = "batch_no = ? AND tenant_id = ?";
      affectedParams.push(body.targetValue);
      break;
    case "CATEGORY":
      affectedCondition = "category_id = ? AND tenant_id = ?";
      affectedParams.push(Number(body.targetValue));
      break;
    case "SKU":
      affectedCondition = "sku_id = ? AND tenant_id = ?";
      affectedParams.push(Number(body.targetValue));
      break;
    case "SUPPLIER":
      affectedCondition = "supplier_id = ? AND tenant_id = ?";
      affectedParams.push(Number(body.targetValue));
      break;
    case "GLOBAL":
      affectedCondition = "tenant_id = ?";
      break;
  }

  const totalAffected = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS count FROM t_trace_code WHERE ${affectedCondition}
     AND current_status NOT IN ('DESTROYED', 'EXPIRED')`,
    affectedParams,
    tenantId
  );

  await queryWithTenant(
    `INSERT INTO t_recall_record (recall_no, recall_type, target_value, target_name,
       reason, total_affected, status, notify_content, operator_id, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?)`,
    [recallNo, body.recallType, body.targetValue, body.targetName,
     body.reason, totalAffected?.count ?? 0,
     body.notifyContent ?? null, operatorId, tenantId],
    tenantId
  );

  const record = await queryOneWithTenant<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType,
            target_value AS targetValue, target_name AS targetName,
            reason, total_affected AS totalAffected,
            total_notified AS totalNotified, total_returned AS totalReturned,
            status, notify_content AS notifyContent,
            operator_id AS operatorId, created_at AS createdAt
     FROM t_recall_record WHERE recall_no = ? AND tenant_id = ?`,
    [recallNo, tenantId],
    tenantId
  );

  return record;
}

export async function listRecalls(
  page: number,
  pageSize: number,
  status: string | undefined,
  recallType: string | undefined,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["rr.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (status) {
    conditions.push("rr.status = ?");
    params.push(status);
  }
  if (recallType) {
    conditions.push("rr.recall_type = ?");
    params.push(recallType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT rr.id, rr.recall_no AS recallNo, rr.recall_type AS recallType,
            rr.target_value AS targetValue, rr.target_name AS targetName,
            rr.reason, rr.total_affected AS totalAffected,
            rr.total_notified AS totalNotified, rr.total_returned AS totalReturned,
            rr.status, rr.notify_content AS notifyContent,
            rr.started_at AS startedAt, rr.completed_at AS completedAt,
            rr.operator_id AS operatorId, rr.created_at AS createdAt, rr.updated_at AS updatedAt
     FROM t_recall_record rr
     ${where}
     ORDER BY rr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_recall_record rr ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getRecallDetail(recallNo: string, tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT rr.id, rr.recall_no AS recallNo, rr.recall_type AS recallType,
            rr.target_value AS targetValue, rr.target_name AS targetName,
            rr.reason, rr.total_affected AS totalAffected,
            rr.total_notified AS totalNotified, rr.total_returned AS totalReturned,
            rr.status, rr.notify_content AS notifyContent,
            rr.started_at AS startedAt, rr.completed_at AS completedAt,
            rr.operator_id AS operatorId, rr.created_at AS createdAt, rr.updated_at AS updatedAt
     FROM t_recall_record rr
     WHERE rr.recall_no = ? AND rr.tenant_id = ?`,
    [recallNo, tenantId],
    tenantId
  );

  return record;
}

export async function executeRecall(
  recallNo: string,
  userId: number,
  username: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType, target_value AS targetValue,
            status, total_affected AS totalAffected
     FROM t_recall_record WHERE recall_no = ? AND tenant_id = ?`,
    [recallNo, tenantId],
    tenantId
  );

  if (!existing) {
    return { notFound: true };
  }
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return { alreadyEnded: true };
  }

  let affectedCondition = "";
  const affectedParams: unknown[] = [tenantId];
  switch (existing.recallType) {
    case "BATCH":
      affectedCondition = "batch_no = ? AND tenant_id = ?";
      affectedParams.push(existing.targetValue);
      break;
    case "CATEGORY":
      affectedCondition = "category_id = ? AND tenant_id = ?";
      affectedParams.push(Number(existing.targetValue));
      break;
    case "SKU":
      affectedCondition = "sku_id = ? AND tenant_id = ?";
      affectedParams.push(Number(existing.targetValue));
      break;
    case "SUPPLIER":
      affectedCondition = "supplier_id = ? AND tenant_id = ?";
      affectedParams.push(Number(existing.targetValue));
      break;
    case "GLOBAL":
      affectedCondition = "tenant_id = ?";
      break;
  }

  await queryWithTenant(
    `UPDATE t_trace_code
     SET current_status = 'RECALLED', version = version + 1, updated_at = NOW()
     WHERE ${affectedCondition}
       AND current_status NOT IN ('DESTROYED', 'EXPIRED', 'RECALLED')`,
    affectedParams,
    tenantId
  );

  const affectedCodes = await queryWithTenant<any>(
    `SELECT trace_code AS traceCode FROM t_trace_code
     WHERE ${affectedCondition} AND current_status = 'RECALLED'`,
    affectedParams,
    tenantId
  );

  for (const row of affectedCodes) {
    await queryWithTenant(
      `INSERT INTO t_trace_event_log (trace_code, event_type, from_status, to_status,
         operator_type, operator_id, operator_name, remark, tenant_id)
       VALUES (?, 'RECALL', NULL, 'RECALLED', 'ADMIN', ?, ?, '执行召回', ?)`,
      [row.traceCode, userId, username, tenantId],
      tenantId
    );
  }

  await queryWithTenant(
    `UPDATE t_recall_record
     SET status = 'IN_PROGRESS', started_at = NOW(),
         total_affected = ?, updated_at = NOW()
     WHERE recall_no = ? AND tenant_id = ?`,
    [affectedCodes.length, recallNo, tenantId],
    tenantId
  );

  const record = await queryOneWithTenant<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType,
            target_value AS targetValue, target_name AS targetName,
            reason, total_affected AS totalAffected,
            total_notified AS totalNotified, total_returned AS totalReturned,
            status, started_at AS startedAt, updated_at AS updatedAt
     FROM t_recall_record WHERE recall_no = ? AND tenant_id = ?`,
    [recallNo, tenantId],
    tenantId
  );

  return { ...record, affectedCount: affectedCodes.length };
}

export async function completeRecall(
  recallNo: string,
  body: {
    totalNotified: number;
    totalReturned: number;
  },
  tenantId: string
) {
  const existing = await queryOneWithTenant<any>(
    `SELECT id, status FROM t_recall_record WHERE recall_no = ? AND tenant_id = ?`,
    [recallNo, tenantId],
    tenantId
  );

  if (!existing) {
    return { notFound: true };
  }
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return { alreadyEnded: true };
  }

  await queryWithTenant(
    `UPDATE t_recall_record
     SET status = 'COMPLETED', total_notified = ?, total_returned = ?,
         completed_at = NOW(), updated_at = NOW()
     WHERE recall_no = ? AND tenant_id = ?`,
    [body.totalNotified, body.totalReturned, recallNo, tenantId],
    tenantId
  );

  const record = await queryOneWithTenant<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType,
            target_value AS targetValue, target_name AS targetName,
            reason, total_affected AS totalAffected,
            total_notified AS totalNotified, total_returned AS totalReturned,
            status, completed_at AS completedAt, updated_at AS updatedAt
     FROM t_recall_record WHERE recall_no = ? AND tenant_id = ?`,
    [recallNo, tenantId],
    tenantId
  );

  return record;
}

export async function consumerQueryTrace(traceCode: string, tenantId: string) {
  const code = await queryOneWithTenant<any>(
    `SELECT id, trace_code AS traceCode, sku_name AS skuName,
            batch_no AS batchNo, production_date AS productionDate,
            expiry_date AS expiryDate, shelf_life_days AS shelfLifeDays,
            current_status AS currentStatus, quality_check_result AS qualityCheckResult
     FROM t_trace_code WHERE trace_code = ? AND tenant_id = ?`,
    [traceCode, tenantId],
    tenantId
  );

  if (!code) {
    return null;
  }

  const events = await queryWithTenant<any>(
    `SELECT id, trace_code AS traceCode, event_type AS eventType,
            from_status AS fromStatus, to_status AS toStatus,
            operator_type AS operatorType, location, remark,
            created_at AS createdAt
     FROM t_trace_event_log
     WHERE trace_code = ? AND tenant_id = ?
     ORDER BY created_at ASC`,
    [traceCode, tenantId],
    tenantId
  );

  return {
    traceCode: code.traceCode,
    skuName: code.skuName,
    batchNo: code.batchNo,
    productionDate: code.productionDate,
    expiryDate: code.expiryDate,
    shelfLifeDays: code.shelfLifeDays,
    currentStatus: code.currentStatus,
    qualityCheckResult: code.qualityCheckResult,
    events
  };
}

export async function consumerVerifyTraceCode(
  traceCode: string,
  userId: number | undefined,
  ip: string,
  tenantId: string
) {
  // R9-2: 委托到共享验证逻辑
  const verifyResult = await verifyTraceCodeSimple(traceCode, tenantId);

  let result: "SUCCESS" | "INVALID" | "NOT_FOUND" | "FRAUD_ALERT" | "EXPIRED" = "NOT_FOUND";
  let message = "追溯码不存在";

  if (!verifyResult.valid) {
    if (verifyResult.message.includes("不存在")) {
      result = "NOT_FOUND";
      message = "追溯码不存在，请核实后重试";
    } else if (verifyResult.message.includes("仿冒")) {
      result = "FRAUD_ALERT";
      message = "该追溯码已被标记为疑似仿冒，请谨慎购买";
    } else if (verifyResult.message.includes("过期")) {
      result = "EXPIRED";
      message = "该商品已过期";
    }
  } else {
    result = "SUCCESS";
    message = "验证通过，该商品为正品";

    await queryWithTenant(
      `UPDATE t_trace_code
       SET scan_count = scan_count + 1,
           first_scan_at = CASE WHEN scan_count = 0 THEN NOW() ELSE first_scan_at END,
           first_scan_ip = CASE WHEN scan_count = 0 THEN ? ELSE first_scan_ip END
       WHERE trace_code = ? AND tenant_id = ?`,
      [ip, traceCode, tenantId],
      tenantId
    );
  }

  await queryWithTenant(
    `INSERT INTO t_trace_scan_log (trace_code, scan_type, user_id, ip, result, tenant_id)
     VALUES (?, 'CONSUMER', ?, ?, ?, ?)`,
    [traceCode, userId ?? null, ip, result, tenantId],
    tenantId
  );

  return {
    result,
    message,
    traceCode,
    skuName: verifyResult.code?.skuName ?? null,
    batchNo: verifyResult.code?.batchNo ?? null,
    currentStatus: verifyResult.code?.currentStatus ?? null,
    qualityCheckResult: (verifyResult.code as any)?.qualityCheckResult ?? null
  };
}
