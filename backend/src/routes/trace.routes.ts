import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

// ========== Admin 追溯路由 ==========
export const adminTraceRouter = Router();

// ========== 追溯配置 ==========

// 配置列表
adminTraceRouter.get("/configs", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.configLevel) {
    conditions.push("tc.config_level = ?");
    params.push(req.query.configLevel);
  }
  if (req.query.traceEnabled !== undefined) {
    conditions.push("tc.trace_enabled = ?");
    params.push(Number(req.query.traceEnabled));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT tc.id, tc.config_no AS configNo, tc.config_level AS configLevel,
            tc.target_id AS targetId, tc.target_name AS targetName,
            tc.trace_enabled AS traceEnabled, tc.force_enabled AS forceEnabled,
            tc.code_mode AS codeMode, tc.code_prefix AS codePrefix,
            tc.auto_generate AS autoGenerate, tc.shelf_life_days AS shelfLifeDays,
            tc.remark, tc.status,
            tc.created_at AS createdAt, tc.updated_at AS updatedAt
     FROM trace_config tc
     ${where}
     ORDER BY tc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM trace_config tc ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 创建配置
adminTraceRouter.post("/configs", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    configLevel: z.enum(["CATEGORY", "SKU", "GLOBAL"]),
    targetId: z.number().int().positive(),
    targetName: z.string().max(128).default(""),
    traceEnabled: z.number().int().min(0).max(1).default(0),
    forceEnabled: z.number().int().min(0).max(1).default(0),
    codeMode: z.enum(["ONE_PER_ITEM", "ONE_PER_BATCH", "BATCH_ONLY"]).default("ONE_PER_BATCH"),
    codePrefix: z.string().max(16).default("TR"),
    autoGenerate: z.number().int().min(0).max(1).default(1),
    shelfLifeDays: z.number().int().min(1).default(365),
    remark: z.string().max(255).default("")
  }).parse(req.body);

  const configNo = makeBizNo("TC");

  await query(
    `INSERT INTO trace_config (config_no, config_level, target_id, target_name,
       trace_enabled, force_enabled, code_mode, code_prefix, auto_generate,
       shelf_life_days, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [configNo, body.configLevel, body.targetId, body.targetName,
     body.traceEnabled, body.forceEnabled, body.codeMode, body.codePrefix,
     body.autoGenerate, body.shelfLifeDays, body.remark]
  );

  const record = await queryOne<any>(
    `SELECT id, config_no AS configNo, config_level AS configLevel,
            target_id AS targetId, target_name AS targetName,
            trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix,
            auto_generate AS autoGenerate, shelf_life_days AS shelfLifeDays,
            remark, status, created_at AS createdAt
     FROM trace_config WHERE config_no = ?`,
    [configNo]
  );

  res.json(ok(record));
}));

// 编辑配置
adminTraceRouter.put("/configs/:id", requireAuth, asyncHandler(async (req, res) => {
  const configId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id FROM trace_config WHERE id = ?",
    [configId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "配置不存在" });
    return;
  }

  const body = z.object({
    targetName: z.string().max(128).optional(),
    traceEnabled: z.number().int().min(0).max(1).optional(),
    forceEnabled: z.number().int().min(0).max(1).optional(),
    codeMode: z.enum(["ONE_PER_ITEM", "ONE_PER_BATCH", "BATCH_ONLY"]).optional(),
    codePrefix: z.string().max(16).optional(),
    autoGenerate: z.number().int().min(0).max(1).optional(),
    shelfLifeDays: z.number().int().min(1).optional(),
    remark: z.string().max(255).optional(),
    status: z.number().int().min(0).max(1).optional()
  }).parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.targetName !== undefined) { updates.push("target_name = ?"); params.push(body.targetName); }
  if (body.traceEnabled !== undefined) { updates.push("trace_enabled = ?"); params.push(body.traceEnabled); }
  if (body.forceEnabled !== undefined) { updates.push("force_enabled = ?"); params.push(body.forceEnabled); }
  if (body.codeMode !== undefined) { updates.push("code_mode = ?"); params.push(body.codeMode); }
  if (body.codePrefix !== undefined) { updates.push("code_prefix = ?"); params.push(body.codePrefix); }
  if (body.autoGenerate !== undefined) { updates.push("auto_generate = ?"); params.push(body.autoGenerate); }
  if (body.shelfLifeDays !== undefined) { updates.push("shelf_life_days = ?"); params.push(body.shelfLifeDays); }
  if (body.remark !== undefined) { updates.push("remark = ?"); params.push(body.remark); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    await query(
      `UPDATE trace_config SET ${updates.join(", ")} WHERE id = ?`,
      [...params, configId]
    );
  }

  const record = await queryOne<any>(
    `SELECT id, config_no AS configNo, config_level AS configLevel,
            target_id AS targetId, target_name AS targetName,
            trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix,
            auto_generate AS autoGenerate, shelf_life_days AS shelfLifeDays,
            remark, status, updated_at AS updatedAt
     FROM trace_config WHERE id = ?`,
    [configId]
  );

  res.json(ok(record));
}));

// 删除配置
adminTraceRouter.delete("/configs/:id", requireAuth, asyncHandler(async (req, res) => {
  const configId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id FROM trace_config WHERE id = ?",
    [configId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "配置不存在" });
    return;
  }

  await query("DELETE FROM trace_config WHERE id = ?", [configId]);

  res.json(ok({ deleted: true }));
}));

// 检查SKU是否需要追溯
adminTraceRouter.post("/configs/check", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    skuId: z.number().int().positive(),
    categoryId: z.number().int().optional()
  }).parse(req.body);

  // 检查SKU级别配置
  const skuConfig = await queryOne<any>(
    `SELECT id, config_no AS configNo, trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM trace_config WHERE config_level = 'SKU' AND target_id = ? AND status = 1`,
    [body.skuId]
  );

  if (skuConfig) {
    res.json(ok({
      required: skuConfig.traceEnabled === 1 || skuConfig.forceEnabled === 1,
      config: skuConfig
    }));
    return;
  }

  // 检查品类级别配置
  if (body.categoryId) {
    const categoryConfig = await queryOne<any>(
      `SELECT id, config_no AS configNo, trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
              code_mode AS codeMode, code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
       FROM trace_config WHERE config_level = 'CATEGORY' AND target_id = ? AND status = 1`,
      [body.categoryId]
    );

    if (categoryConfig) {
      res.json(ok({
        required: categoryConfig.traceEnabled === 1 || categoryConfig.forceEnabled === 1,
        config: categoryConfig
      }));
      return;
    }
  }

  // 检查全局配置
  const globalConfig = await queryOne<any>(
    `SELECT id, config_no AS configNo, trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM trace_config WHERE config_level = 'GLOBAL' AND status = 1 LIMIT 1`
  );

  if (globalConfig) {
    res.json(ok({
      required: globalConfig.traceEnabled === 1 || globalConfig.forceEnabled === 1,
      config: globalConfig
    }));
    return;
  }

  res.json(ok({ required: false, config: null }));
}));

// ========== 追溯码管理 ==========

// 生成追溯码
adminTraceRouter.post("/codes/generate", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    skuId: z.number().int().positive(),
    skuName: z.string().max(128).default(""),
    batchNo: z.string().max(64).default(""),
    quantity: z.number().int().min(1).default(1),
    productionDate: z.string().nullable().optional(),
    codeMode: z.enum(["ONE_PER_ITEM", "ONE_PER_BATCH"]).default("ONE_PER_BATCH"),
    categoryId: z.number().int().optional(),
    storeId: z.number().int().optional(),
    warehouseId: z.number().int().optional(),
    supplierId: z.number().int().optional(),
    shelfLifeDays: z.number().int().optional()
  }).parse(req.body);

  // 查找追溯配置获取codePrefix和shelfLifeDays
  const skuConfig = await queryOne<any>(
    `SELECT code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM trace_config WHERE config_level = 'SKU' AND target_id = ? AND status = 1`,
    [body.skuId]
  );
  const globalConfig = !skuConfig ? await queryOne<any>(
    `SELECT code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM trace_config WHERE config_level = 'GLOBAL' AND status = 1 LIMIT 1`
  ) : null;
  const config = skuConfig || globalConfig;

  const codePrefix = config?.codePrefix || "TR";
  const shelfLifeDays = body.shelfLifeDays ?? config?.shelfLifeDays ?? 365;
  const productionDate = body.productionDate ?? null;
  const expiryDate = productionDate
    ? new Date(new Date(productionDate).getTime() + shelfLifeDays * 86400000).toISOString().slice(0, 10)
    : null;

  // 根据codeMode决定生成数量
  const generateCount = body.codeMode === "ONE_PER_BATCH" ? 1 : body.quantity;
  const generatedCodes: string[] = [];

  for (let i = 0; i < generateCount; i++) {
    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const seq = String(i + 1).padStart(4, "0");
    const traceCode = `${codePrefix}${datePart}${seq}`;

    await query(
      `INSERT INTO trace_code (trace_code, sku_id, sku_name, batch_no, production_date, expiry_date,
         shelf_life_days, code_mode, category_id, current_status, current_location,
         store_id, warehouse_id, supplier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRODUCED', '生产入库', ?, ?, ?, ?)`,
      [traceCode, body.skuId, body.skuName, body.batchNo, productionDate, expiryDate,
       shelfLifeDays, body.codeMode, body.categoryId ?? null,
       body.storeId ?? null, body.warehouseId ?? null, body.supplierId ?? null]
    );

    // 记录事件日志
    await query(
      `INSERT INTO trace_event_log (trace_code, event_type, from_status, to_status,
         operator_type, operator_id, operator_name, location, remark)
       VALUES (?, 'GENERATE', NULL, 'PRODUCED', 'ADMIN', ?, ?, '生产入库', '系统生成追溯码')`,
      [traceCode, req.user?.id ?? 0, req.user?.username ?? "system"]
    );

    generatedCodes.push(traceCode);
  }

  res.json(ok({
    generatedCount: generatedCodes.length,
    codeMode: body.codeMode,
    traceCodes: generatedCodes
  }));
}));

// 追溯码列表
adminTraceRouter.get("/codes", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.skuId) {
    conditions.push("tc.sku_id = ?");
    params.push(Number(req.query.skuId));
  }
  if (req.query.batchNo) {
    conditions.push("tc.batch_no = ?");
    params.push(req.query.batchNo);
  }
  if (req.query.currentStatus) {
    conditions.push("tc.current_status = ?");
    params.push(req.query.currentStatus);
  }
  if (req.query.storeId) {
    conditions.push("tc.store_id = ?");
    params.push(Number(req.query.storeId));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
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
     FROM trace_code tc
     ${where}
     ORDER BY tc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM trace_code tc ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 追溯码详情
adminTraceRouter.get("/codes/:traceCode", requireAuth, asyncHandler(async (req, res) => {
  const traceCode = req.params.traceCode;
  const code = await queryOne<any>(
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
     FROM trace_code tc
     WHERE tc.trace_code = ?`,
    [traceCode]
  );

  if (!code) {
    res.status(404).json({ code: "404", message: "追溯码不存在" });
    return;
  }

  // 查询事件时间线
  const events = await query<any>(
    `SELECT id, trace_code AS traceCode, event_type AS eventType,
            from_status AS fromStatus, to_status AS toStatus,
            operator_type AS operatorType, operator_id AS operatorId,
            operator_name AS operatorName, store_id AS storeId,
            order_id AS orderId, location, remark,
            extra, ip, created_at AS createdAt
     FROM trace_event_log
     WHERE trace_code = ?
     ORDER BY created_at ASC`,
    [traceCode]
  );

  res.json(ok({ ...code, events }));
}));

// 更新追溯码状态
adminTraceRouter.post("/codes/:traceCode/status", requireAuth, asyncHandler(async (req, res) => {
  const traceCode = req.params.traceCode;

  const body = z.object({
    status: z.enum(["PRODUCED", "PURCHASED", "TRANSFERRED", "ALLOCATED", "ON_SHELF",
      "SOLD", "WHOLESALE_SOLD", "DELIVERING", "DELIVERED", "RETURNED",
      "DESTROYED", "EXPIRED", "RECALLED"]),
    location: z.string().max(128).optional(),
    storeId: z.number().int().optional(),
    warehouseId: z.number().int().optional(),
    orderId: z.number().int().optional(),
    remark: z.string().max(255).optional(),
    qualityCheckResult: z.enum(["PASS", "FAIL", "PENDING"]).optional()
  }).parse(req.body);

  const existing = await queryOne<any>(
    `SELECT id, current_status AS currentStatus, current_location AS currentLocation,
            store_id AS storeId, warehouse_id AS warehouseId, order_id AS orderId,
            quality_check_result AS qualityCheckResult
     FROM trace_code WHERE trace_code = ?`,
    [traceCode]
  );

  if (!existing) {
    res.status(404).json({ code: "404", message: "追溯码不存在" });
    return;
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

  await query(
    `UPDATE trace_code SET ${updates.join(", ")} WHERE trace_code = ?`,
    [...params, traceCode]
  );

  // 记录事件日志
  await query(
    `INSERT INTO trace_event_log (trace_code, event_type, from_status, to_status,
       operator_type, operator_id, operator_name, store_id, order_id, location, remark, ip)
     VALUES (?, 'STATUS_CHANGE', ?, ?, 'ADMIN', ?, ?, ?, ?, ?, ?, ?)`,
    [traceCode, existing.currentStatus, body.status,
     req.user?.id ?? 0, req.user?.username ?? "system",
     body.storeId ?? existing.storeId, body.orderId ?? existing.orderId,
     body.location ?? existing.currentLocation, body.remark ?? "",
     req.ip || ""]
  );

  const code = await queryOne<any>(
    `SELECT id, trace_code AS traceCode, current_status AS currentStatus,
            current_location AS currentLocation, version, updated_at AS updatedAt
     FROM trace_code WHERE trace_code = ?`,
    [traceCode]
  );

  res.json(ok(code));
}));

// 追溯码统计
adminTraceRouter.get("/codes/statistics", requireAuth, asyncHandler(async (_req, res) => {
  // 按状态统计
  const statusStats = await query<any>(
    `SELECT current_status AS currentStatus, COUNT(*) AS count
     FROM trace_code
     GROUP BY current_status`
  );

  // 总数
  const totalCount = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM trace_code"
  );

  // 今日生成
  const todayCount = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM trace_code
     WHERE DATE(created_at) = CURDATE()`
  );

  // 仿冒预警数
  const fraudCount = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM trace_code WHERE fraud_alert = 1"
  );

  // 总扫码次数
  const totalScans = await queryOne<any>(
    "SELECT COALESCE(SUM(scan_count), 0) AS count FROM trace_code"
  );

  // 今日扫码
  const todayScans = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM trace_scan_log
     WHERE DATE(created_at) = CURDATE()`
  );

  const byStatus: Record<string, number> = {};
  for (const row of statusStats) {
    byStatus[row.currentStatus] = Number(row.count);
  }

  res.json(ok({
    totalCodes: Number(totalCount?.count ?? 0),
    todayGenerated: Number(todayCount?.count ?? 0),
    totalScans: Number(totalScans?.count ?? 0),
    todayScans: Number(todayScans?.count ?? 0),
    fraudAlerts: Number(fraudCount?.count ?? 0),
    byStatus
  }));
}));

// ========== 追溯查询（公开） ==========

// 查询追溯链路
adminTraceRouter.get("/query/:traceCode", asyncHandler(async (req, res) => {
  const traceCode = req.params.traceCode;
  const code = await queryOne<any>(
    `SELECT id, trace_code AS traceCode, sku_id AS skuId, sku_name AS skuName,
            batch_no AS batchNo, production_date AS productionDate,
            expiry_date AS expiryDate, shelf_life_days AS shelfLifeDays,
            code_mode AS codeMode, category_id AS categoryId,
            current_status AS currentStatus, current_location AS currentLocation,
            store_id AS storeId, warehouse_id AS warehouseId,
            quality_check_result AS qualityCheckResult,
            scan_count AS scanCount, fraud_alert AS fraudAlert,
            produced_at AS producedAt, created_at AS createdAt
     FROM trace_code WHERE trace_code = ?`,
    [traceCode]
  );

  if (!code) {
    res.status(404).json({ code: "404", message: "追溯码不存在" });
    return;
  }

  // 查询事件时间线
  const events = await query<any>(
    `SELECT id, trace_code AS traceCode, event_type AS eventType,
            from_status AS fromStatus, to_status AS toStatus,
            operator_type AS operatorType, operator_name AS operatorName,
            location, remark, created_at AS createdAt
     FROM trace_event_log
     WHERE trace_code = ?
     ORDER BY created_at ASC`,
    [traceCode]
  );

  res.json(ok({ ...code, events }));
}));

// 真伪验证
adminTraceRouter.post("/verify", asyncHandler(async (req, res) => {
  const body = z.object({
    traceCode: z.string().min(1),
    scanType: z.enum(["CONSUMER", "BUSINESS", "PDA", "ADMIN"]).default("CONSUMER"),
    userId: z.number().int().optional()
  }).parse(req.body);

  const code = await queryOne<any>(
    `SELECT id, trace_code AS traceCode, sku_name AS skuName, batch_no AS batchNo,
            current_status AS currentStatus, quality_check_result AS qualityCheckResult,
            fraud_alert AS fraudAlert, expiry_date AS expiryDate,
            scan_count AS scanCount, first_scan_at AS firstScanAt
     FROM trace_code WHERE trace_code = ?`,
    [body.traceCode]
  );

  let result: "SUCCESS" | "INVALID" | "NOT_FOUND" | "FRAUD_ALERT" | "EXPIRED" = "NOT_FOUND";
  let message = "追溯码不存在";

  if (!code) {
    result = "NOT_FOUND";
    message = "追溯码不存在，请核实后重试";
  } else if (code.fraudAlert === 1) {
    result = "FRAUD_ALERT";
    message = "该追溯码已被标记为疑似仿冒，请谨慎购买";
  } else if (code.expiryDate && new Date(code.expiryDate) < new Date()) {
    result = "EXPIRED";
    message = "该商品已过期";
  } else {
    result = "SUCCESS";
    message = "验证通过，该商品为正品";

    // 更新扫码信息
    const isFirstScan = code.scan_count === 0;
    await query(
      `UPDATE trace_code
       SET scan_count = scan_count + 1,
           first_scan_at = CASE WHEN scan_count = 0 THEN NOW() ELSE first_scan_at END,
           first_scan_ip = CASE WHEN scan_count = 0 THEN ? ELSE first_scan_ip END
       WHERE trace_code = ?`,
      [req.ip || "", body.traceCode]
    );
  }

  // 记录扫码日志
  await query(
    `INSERT INTO trace_scan_log (trace_code, scan_type, user_id, ip, result)
     VALUES (?, ?, ?, ?, ?)`,
    [body.traceCode, body.scanType, body.userId ?? null, req.ip || "", result]
  );

  res.json(ok({
    result,
    message,
    traceCode: body.traceCode,
    skuName: code?.skuName ?? null,
    batchNo: code?.batchNo ?? null,
    currentStatus: code?.currentStatus ?? null,
    qualityCheckResult: code?.qualityCheckResult ?? null,
    scanCount: code ? Number(code.scanCount) + 1 : 0
  }));
}));

// ========== 召回管理 ==========

// 创建召回
adminTraceRouter.post("/recalls", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    recallType: z.enum(["BATCH", "CATEGORY", "SKU", "SUPPLIER", "GLOBAL"]),
    targetValue: z.string().max(128),
    targetName: z.string().max(128).default(""),
    reason: z.string().min(1).max(255),
    notifyContent: z.string().optional()
  }).parse(req.body);

  const recallNo = makeBizNo("RC");

  // 计算受影响数量
  let affectedCondition = "";
  const affectedParams: unknown[] = [];
  switch (body.recallType) {
    case "BATCH":
      affectedCondition = "batch_no = ?";
      affectedParams.push(body.targetValue);
      break;
    case "CATEGORY":
      affectedCondition = "category_id = ?";
      affectedParams.push(Number(body.targetValue));
      break;
    case "SKU":
      affectedCondition = "sku_id = ?";
      affectedParams.push(Number(body.targetValue));
      break;
    case "SUPPLIER":
      affectedCondition = "supplier_id = ?";
      affectedParams.push(Number(body.targetValue));
      break;
    case "GLOBAL":
      affectedCondition = "1 = 1";
      break;
  }

  const totalAffected = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM trace_code WHERE ${affectedCondition}
     AND current_status NOT IN ('DESTROYED', 'EXPIRED')`,
    affectedParams
  );

  await query(
    `INSERT INTO recall_record (recall_no, recall_type, target_value, target_name,
       reason, total_affected, status, notify_content, operator_id)
     VALUES (?, ?, ?, ?, ?, ?, 'CREATED', ?, ?)`,
    [recallNo, body.recallType, body.targetValue, body.targetName,
     body.reason, totalAffected?.count ?? 0,
     body.notifyContent ?? null, req.user!.id]
  );

  const record = await queryOne<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType,
            target_value AS targetValue, target_name AS targetName,
            reason, total_affected AS totalAffected,
            total_notified AS totalNotified, total_returned AS totalReturned,
            status, notify_content AS notifyContent,
            operator_id AS operatorId, created_at AS createdAt
     FROM recall_record WHERE recall_no = ?`,
    [recallNo]
  );

  res.json(ok(record));
}));

// 召回列表
adminTraceRouter.get("/recalls", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.status) {
    conditions.push("rr.status = ?");
    params.push(req.query.status);
  }
  if (req.query.recallType) {
    conditions.push("rr.recall_type = ?");
    params.push(req.query.recallType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT rr.id, rr.recall_no AS recallNo, rr.recall_type AS recallType,
            rr.target_value AS targetValue, rr.target_name AS targetName,
            rr.reason, rr.total_affected AS totalAffected,
            rr.total_notified AS totalNotified, rr.total_returned AS totalReturned,
            rr.status, rr.notify_content AS notifyContent,
            rr.started_at AS startedAt, rr.completed_at AS completedAt,
            rr.operator_id AS operatorId, rr.created_at AS createdAt, rr.updated_at AS updatedAt
     FROM recall_record rr
     ${where}
     ORDER BY rr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM recall_record rr ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 召回详情
adminTraceRouter.get("/recalls/:recallNo", requireAuth, asyncHandler(async (req, res) => {
  const recallNo = req.params.recallNo;
  const record = await queryOne<any>(
    `SELECT rr.id, rr.recall_no AS recallNo, rr.recall_type AS recallType,
            rr.target_value AS targetValue, rr.target_name AS targetName,
            rr.reason, rr.total_affected AS totalAffected,
            rr.total_notified AS totalNotified, rr.total_returned AS totalReturned,
            rr.status, rr.notify_content AS notifyContent,
            rr.started_at AS startedAt, rr.completed_at AS completedAt,
            rr.operator_id AS operatorId, rr.created_at AS createdAt, rr.updated_at AS updatedAt
     FROM recall_record rr
     WHERE rr.recall_no = ?`,
    [recallNo]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "召回记录不存在" });
    return;
  }

  res.json(ok(record));
}));

// 执行召回
adminTraceRouter.post("/recalls/:recallNo/execute", requireAuth, asyncHandler(async (req, res) => {
  const recallNo = req.params.recallNo;

  const existing = await queryOne<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType, target_value AS targetValue,
            status, total_affected AS totalAffected
     FROM recall_record WHERE recall_no = ?`,
    [recallNo]
  );

  if (!existing) {
    res.status(404).json({ code: "404", message: "召回记录不存在" });
    return;
  }
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    res.status(400).json({ code: "400", message: "该召回已结束，无法执行" });
    return;
  }

  // 构建受影响追溯码的查询条件
  let affectedCondition = "";
  const affectedParams: unknown[] = [];
  switch (existing.recallType) {
    case "BATCH":
      affectedCondition = "batch_no = ?";
      affectedParams.push(existing.targetValue);
      break;
    case "CATEGORY":
      affectedCondition = "category_id = ?";
      affectedParams.push(Number(existing.targetValue));
      break;
    case "SKU":
      affectedCondition = "sku_id = ?";
      affectedParams.push(Number(existing.targetValue));
      break;
    case "SUPPLIER":
      affectedCondition = "supplier_id = ?";
      affectedParams.push(Number(existing.targetValue));
      break;
    case "GLOBAL":
      affectedCondition = "1 = 1";
      break;
  }

  // 更新受影响追溯码状态为RECALLED
  await query(
    `UPDATE trace_code
     SET current_status = 'RECALLED', version = version + 1, updated_at = NOW()
     WHERE ${affectedCondition}
       AND current_status NOT IN ('DESTROYED', 'EXPIRED', 'RECALLED')`,
    affectedParams
  );

  // 为每个受影响的追溯码记录事件
  const affectedCodes = await query<any>(
    `SELECT trace_code AS traceCode FROM trace_code
     WHERE ${affectedCondition} AND current_status = 'RECALLED'`,
    affectedParams
  );

  for (const row of affectedCodes) {
    await query(
      `INSERT INTO trace_event_log (trace_code, event_type, from_status, to_status,
         operator_type, operator_id, operator_name, remark)
       VALUES (?, 'RECALL', NULL, 'RECALLED', 'ADMIN', ?, ?, '执行召回')`,
      [row.traceCode, req.user?.id ?? 0, req.user?.username ?? "system"]
    );
  }

  // 更新召回记录状态
  await query(
    `UPDATE recall_record
     SET status = 'IN_PROGRESS', started_at = NOW(),
         total_affected = ?, updated_at = NOW()
     WHERE recall_no = ?`,
    [affectedCodes.length, recallNo]
  );

  const record = await queryOne<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType,
            target_value AS targetValue, target_name AS targetName,
            reason, total_affected AS totalAffected,
            total_notified AS totalNotified, total_returned AS totalReturned,
            status, started_at AS startedAt, updated_at AS updatedAt
     FROM recall_record WHERE recall_no = ?`,
    [recallNo]
  );

  res.json(ok({ ...record, affectedCount: affectedCodes.length }));
}));

// 完成召回
adminTraceRouter.put("/recalls/:recallNo/complete", requireAuth, asyncHandler(async (req, res) => {
  const recallNo = req.params.recallNo;

  const body = z.object({
    totalNotified: z.number().int().min(0).default(0),
    totalReturned: z.number().int().min(0).default(0)
  }).parse(req.body);

  const existing = await queryOne<any>(
    `SELECT id, status FROM recall_record WHERE recall_no = ?`,
    [recallNo]
  );

  if (!existing) {
    res.status(404).json({ code: "404", message: "召回记录不存在" });
    return;
  }
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    res.status(400).json({ code: "400", message: "该召回已结束" });
    return;
  }

  await query(
    `UPDATE recall_record
     SET status = 'COMPLETED', total_notified = ?, total_returned = ?,
         completed_at = NOW(), updated_at = NOW()
     WHERE recall_no = ?`,
    [body.totalNotified, body.totalReturned, recallNo]
  );

  const record = await queryOne<any>(
    `SELECT id, recall_no AS recallNo, recall_type AS recallType,
            target_value AS targetValue, target_name AS targetName,
            reason, total_affected AS totalAffected,
            total_notified AS totalNotified, total_returned AS totalReturned,
            status, completed_at AS completedAt, updated_at AS updatedAt
     FROM recall_record WHERE recall_no = ?`,
    [recallNo]
  );

  res.json(ok(record));
}));

// ========== 小程序端追溯路由 ==========
export const miniappTraceRouter = Router();

// 消费者查询（脱敏）
miniappTraceRouter.get("/c/query/:traceCode", asyncHandler(async (req, res) => {
  const traceCode = req.params.traceCode;
  const code = await queryOne<any>(
    `SELECT id, trace_code AS traceCode, sku_name AS skuName,
            batch_no AS batchNo, production_date AS productionDate,
            expiry_date AS expiryDate, shelf_life_days AS shelfLifeDays,
            current_status AS currentStatus, quality_check_result AS qualityCheckResult
     FROM trace_code WHERE trace_code = ?`,
    [traceCode]
  );

  if (!code) {
    res.status(404).json({ code: "404", message: "追溯码不存在" });
    return;
  }

  // 查询事件时间线（脱敏：隐藏操作人ID等敏感信息）
  const events = await query<any>(
    `SELECT id, trace_code AS traceCode, event_type AS eventType,
            from_status AS fromStatus, to_status AS toStatus,
            operator_type AS operatorType, location, remark,
            created_at AS createdAt
     FROM trace_event_log
     WHERE trace_code = ?
     ORDER BY created_at ASC`,
    [traceCode]
  );

  res.json(ok({
    traceCode: code.traceCode,
    skuName: code.skuName,
    batchNo: code.batchNo,
    productionDate: code.productionDate,
    expiryDate: code.expiryDate,
    shelfLifeDays: code.shelfLifeDays,
    currentStatus: code.currentStatus,
    qualityCheckResult: code.qualityCheckResult,
    events
  }));
}));

// 消费者验证
miniappTraceRouter.post("/c/verify", asyncHandler(async (req, res) => {
  const body = z.object({
    traceCode: z.string().min(1),
    userId: z.number().int().optional()
  }).parse(req.body);

  const code = await queryOne<any>(
    `SELECT id, trace_code AS traceCode, sku_name AS skuName, batch_no AS batchNo,
            current_status AS currentStatus, quality_check_result AS qualityCheckResult,
            fraud_alert AS fraudAlert, expiry_date AS expiryDate,
            scan_count AS scanCount
     FROM trace_code WHERE trace_code = ?`,
    [body.traceCode]
  );

  let result: "SUCCESS" | "INVALID" | "NOT_FOUND" | "FRAUD_ALERT" | "EXPIRED" = "NOT_FOUND";
  let message = "追溯码不存在";

  if (!code) {
    result = "NOT_FOUND";
    message = "追溯码不存在，请核实后重试";
  } else if (code.fraudAlert === 1) {
    result = "FRAUD_ALERT";
    message = "该追溯码已被标记为疑似仿冒，请谨慎购买";
  } else if (code.expiryDate && new Date(code.expiryDate) < new Date()) {
    result = "EXPIRED";
    message = "该商品已过期";
  } else {
    result = "SUCCESS";
    message = "验证通过，该商品为正品";

    // 更新扫码信息
    await query(
      `UPDATE trace_code
       SET scan_count = scan_count + 1,
           first_scan_at = CASE WHEN scan_count = 0 THEN NOW() ELSE first_scan_at END,
           first_scan_ip = CASE WHEN scan_count = 0 THEN ? ELSE first_scan_ip END
       WHERE trace_code = ?`,
      [req.ip || "", body.traceCode]
    );
  }

  // 记录扫码日志
  await query(
    `INSERT INTO trace_scan_log (trace_code, scan_type, user_id, ip, result)
     VALUES (?, 'CONSUMER', ?, ?, ?)`,
    [body.traceCode, body.userId ?? null, req.ip || "", result]
  );

  res.json(ok({
    result,
    message,
    traceCode: body.traceCode,
    skuName: code?.skuName ?? null,
    batchNo: code?.batchNo ?? null,
    currentStatus: code?.currentStatus ?? null,
    qualityCheckResult: code?.qualityCheckResult ?? null
  }));
}));
