/**
 * 追溯码公共工具（R9-2）
 * 集中管理追溯码验证、入库绑定、出库更新逻辑，供采购入库、销售出库、订单履约复用。
 */
import { makeBizNo } from "./id.js";
import { queryOneWithTenant } from "./db.js";

/** 追溯码验证结果 */
export interface VerifyResult {
  valid: boolean;
  message: string;
  code?: Record<string, unknown>;
}

/** 验证追溯码是否存在且未出库/已销毁 */
export async function verifyTraceCode(
  conn: any,
  tenantId: string,
  traceCode: string
): Promise<VerifyResult> {
  const [rows]: any[] = await conn.query(
    `SELECT id, trace_code AS traceCode, sku_id AS skuId, sku_name AS skuName,
            batch_no AS batchNo, current_status AS currentStatus,
            fraud_alert AS fraudAlert, expiry_date AS expiryDate
     FROM t_trace_code WHERE trace_code = ? AND tenant_id = ?`,
    [traceCode, tenantId]
  );
  return validateTraceCodeResult(rows[0]);
}

/** 无连接版本：供 trace-records 等服务使用 */
export async function verifyTraceCodeSimple(
  traceCode: string,
  tenantId: string
): Promise<VerifyResult> {
  const code = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, trace_code AS traceCode, sku_id AS skuId, sku_name AS skuName,
            batch_no AS batchNo, current_status AS currentStatus,
            fraud_alert AS fraudAlert, expiry_date AS expiryDate
     FROM t_trace_code WHERE trace_code = ? AND tenant_id = ?`,
    [traceCode, tenantId],
    tenantId
  );
  return validateTraceCodeResult(code);
}

/** 内部验证逻辑 */
function validateTraceCodeResult(code: Record<string, unknown> | null): VerifyResult {
  if (!code) {
    return { valid: false, message: "追溯码不存在" };
  }
  if (code.fraudAlert === 1) {
    return { valid: false, message: "追溯码已被标记为疑似仿冒" };
  }
  if (code.currentStatus === "DESTROYED" || code.currentStatus === "EXPIRED") {
    return { valid: false, message: `追溯码已${code.currentStatus === "DESTROYED" ? "销毁" : "过期"}` };
  }
  return { valid: true, message: "验证通过", code };
}

/** 入库时自动生成并绑定追溯码（按批次或逐件） */
export async function bindTraceCodeOnInStock(
  conn: any,
  tenantId: string,
  params: {
    skuId: number;
    skuName: string;
    batchNo: string;
    quantity: number;
    codeMode: "ONE_PER_ITEM" | "ONE_PER_BATCH";
    productionDate?: string | null;
    shelfLifeDays?: number;
    storeId?: number;
    warehouseId?: number;
    supplierId?: number;
    categoryId?: number;
  }
): Promise<string[]> {
  const { skuId, skuName, batchNo, quantity, codeMode, productionDate, shelfLifeDays, storeId, warehouseId, supplierId, categoryId } = params;

  // 查询编码前缀配置
  const [configRows]: any[] = await conn.query(
    `SELECT code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM t_trace_config WHERE config_level = 'SKU' AND target_id = ? AND status = 1 AND tenant_id = ?`,
    [skuId, tenantId]
  );
  let config = configRows[0];
  if (!config) {
    const [globalRows]: any[] = await conn.query(
      `SELECT code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
       FROM t_trace_config WHERE config_level = 'GLOBAL' AND status = 1 AND tenant_id = ? LIMIT 1`,
      [tenantId]
    );
    config = globalRows[0];
  }

  const codePrefix = config?.codePrefix || "TR";
  const effectiveShelfLife = shelfLifeDays ?? config?.shelfLifeDays ?? 365;
  const expiryDate = productionDate
    ? new Date(new Date(productionDate).getTime() + effectiveShelfLife * 86400000).toISOString().slice(0, 10)
    : null;

  const generateCount = codeMode === "ONE_PER_BATCH" ? 1 : quantity;
  const generatedCodes: string[] = [];

  for (let i = 0; i < generateCount; i++) {
    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const seq = String(i + 1).padStart(4, "0");
    const traceCode = `${codePrefix}${datePart}${seq}`;

    await conn.execute(
      `INSERT INTO t_trace_code (trace_code, sku_id, sku_name, batch_no, production_date, expiry_date,
         shelf_life_days, code_mode, category_id, current_status, current_location,
         store_id, warehouse_id, supplier_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRODUCED', '生产入库', ?, ?, ?, ?)`,
      [traceCode, skuId, skuName, batchNo, productionDate, expiryDate,
       effectiveShelfLife, codeMode, categoryId ?? null,
       storeId ?? null, warehouseId ?? null, supplierId ?? null, tenantId]
    );

    // 记录生成事件
    await conn.execute(
      `INSERT INTO t_trace_event_log (trace_code, event_type, from_status, to_status,
         operator_type, operator_id, location, remark, tenant_id)
       VALUES (?, 'GENERATE', NULL, 'PRODUCED', 'SYSTEM', 0, '生产入库', '入库自动生成', ?)`,
      [traceCode, tenantId]
    );

    generatedCodes.push(traceCode);
  }

  return generatedCodes;
}

/** 出库时更新追溯码状态（逐码更新） */
export async function updateTraceCodeOnOutStock(
  conn: any,
  tenantId: string,
  codes: string[],
  bizNo: string,
  bizType: string
): Promise<void> {
  for (const code of codes) {
    await conn.execute(
      `UPDATE t_trace_code
       SET current_status = 'SOLD', current_location = ?,
           order_id = (SELECT id FROM t_miniapp_order WHERE order_no = ? LIMIT 1),
           version = version + 1, updated_at = NOW()
       WHERE trace_code = ? AND tenant_id = ?`,
      [bizType, bizNo, code, tenantId]
    );

    await conn.execute(
      `INSERT INTO t_trace_event_log (trace_code, event_type, from_status, to_status,
         operator_type, location, remark, tenant_id)
       VALUES (?, 'SOLD', NULL, 'SOLD', 'SYSTEM', ?, ?, ?)`,
      [code, bizNo, `出库关联: ${bizNo}`, tenantId]
    );
  }
}

/** 按 SKU 列表 FIFO 批量更新追溯码（用于订单完成时消费） */
export async function updateTraceCodesBySkuList(
  conn: any,
  tenantId: string,
  orderNo: string,
  skuIdList: number[]
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};

  for (const skuId of skuIdList) {
    // 查询该 SKU 在订单中的数量
    const [items]: any[] = await conn.query(
      `SELECT qty, reserved_qty FROM t_miniapp_order_item WHERE order_no = ? AND sku_id = ?`,
      [orderNo, skuId]
    );
    const item = items[0];
    const neededQty = Number(item?.qty ?? item?.reserved_qty ?? 0);
    if (neededQty <= 0) continue;

    // FIFO 取最早入库的追溯码
    const [codes]: any[] = await conn.query(
      `SELECT trace_code FROM t_trace_code
       WHERE sku_id = ? AND tenant_id = ? AND current_status = 'PRODUCED'
       ORDER BY created_at ASC LIMIT ?`,
      [skuId, tenantId, neededQty]
    );

    const codeList: string[] = codes.map((c: any) => c.trace_code);
    result[String(skuId)] = codeList;

    // 批量更新为 SOLD
    for (const code of codeList) {
      await conn.execute(
        `UPDATE t_trace_code
         SET current_status = 'SOLD', current_location = ?,
             order_id = (SELECT id FROM t_miniapp_order WHERE order_no = ? LIMIT 1),
             version = version + 1, updated_at = NOW()
         WHERE trace_code = ? AND tenant_id = ?`,
        [orderNo, orderNo, code, tenantId]
      );

      await conn.execute(
        `INSERT INTO t_trace_event_log (trace_code, event_type, from_status, to_status,
           operator_type, location, remark, tenant_id)
         VALUES (?, 'SOLD', NULL, 'SOLD', 'SYSTEM', ?, ?, ?)`,
        [code, orderNo, `订单完成消费: ${orderNo}`, tenantId]
      );
    }
  }

  return result;
}