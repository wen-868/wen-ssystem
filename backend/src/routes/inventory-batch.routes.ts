import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";

export const inventoryBatchRouter = Router();

inventoryBatchRouter.use(requireAuthWithTenant);

// ==================== 批次管理 ====================

// GET /batches - 批次列表(分页+门店筛选+SKU筛选+效期状态筛选)
inventoryBatchRouter.get("/batches", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    storeId: z.coerce.number().optional(),
    skuId: z.coerce.number().optional(),
    expiryStatus: z.enum(["normal", "warning", "danger", "expired"]).optional()
  }).parse(req.query);

  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ib.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (params.storeId) {
    conditions.push("ib.store_id = ?");
    values.push(params.storeId);
  }
  if (params.skuId) {
    conditions.push("ib.sku_id = ?");
    values.push(params.skuId);
  }
  if (params.expiryStatus === "expired") {
    conditions.push("ib.expiry_date IS NOT NULL AND ib.expiry_date < CURDATE()");
  } else if (params.expiryStatus === "danger") {
    conditions.push("ib.expiry_date IS NOT NULL AND DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 0 AND 7");
  } else if (params.expiryStatus === "warning") {
    conditions.push("ib.expiry_date IS NOT NULL AND DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 8 AND 30");
  } else if (params.expiryStatus === "normal") {
    conditions.push("(ib.expiry_date IS NULL OR DATEDIFF(ib.expiry_date, CURDATE()) > 30)");
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT ib.*, ps.sku_name, s.name AS store_name
     FROM inventory_batch ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN store s ON s.id = ib.store_id AND s.tenant_id = ib.tenant_id
     WHERE ${where}
     ORDER BY ib.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(`SELECT COUNT(*) AS total FROM inventory_batch ib WHERE ${where}`, values);

  // 为每条记录计算效期状态
  const enriched = records.map((r: any) => {
    let expiryStatusText = "正常";
    let expiryColor = "#10B981";
    if (r.expiry_date) {
      const remaining = r.days_remaining ?? Math.floor((new Date(r.expiry_date).getTime() - Date.now()) / 86400000);
      if (remaining < 0) { expiryStatusText = "已过期"; expiryColor = "#EF4444"; }
      else if (remaining <= 7) { expiryStatusText = "即将过期"; expiryColor = "#EF4444"; }
      else if (remaining <= 15) { expiryStatusText = "临期"; expiryColor = "#F59E0B"; }
      else if (remaining <= 30) { expiryStatusText = "临近效期"; expiryColor = "#F59E0B"; }
    }
    return { ...r, expiryStatusText, expiryColor };
  });

  res.json(ok({ total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records: enriched }));
}));

// GET /batches/:id - 批次详情
inventoryBatchRouter.get("/batches/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const batch = await queryOne<any>(
    `SELECT ib.*, ps.sku_name, s.name AS store_name
     FROM inventory_batch ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN store s ON s.id = ib.store_id AND s.tenant_id = ib.tenant_id
     WHERE ib.id = ? AND ib.tenant_id = ?`,
    [id, tenantId]
  );
  if (!batch) {
    res.status(404).json({ code: "1", message: "批次不存在" });
    return;
  }
  res.json(ok(batch));
}));

// POST /batches - 入库创建批次(事务)
inventoryBatchRouter.post("/batches", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    storeId: z.number(),
    skuId: z.number(),
    batchNo: z.string().min(1),
    quantity: z.number().int().positive(),
    productionDate: z.string().optional(),
    expiryDate: z.string().optional(),
    costPrice: z.number().optional(),
    supplierId: z.number().optional(),
    inboundOrderId: z.number().optional()
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    // 检查批次号是否重复
    const existing = await conn.execute<any[]>(
      "SELECT id FROM inventory_batch WHERE batch_no = ? AND store_id = ? AND tenant_id = ?",
      [body.batchNo, body.storeId, tenantId]
    );
    if ((existing[0] as any[]).length > 0) {
      throw new Error("批次号已存在");
    }

    const [insertResult] = await conn.execute(
      `INSERT INTO inventory_batch (store_id, sku_id, batch_no, quantity, production_date, expiry_date, cost_price, supplier_id, inbound_order_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.storeId, body.skuId, body.batchNo, body.quantity, body.productionDate ?? null, body.expiryDate ?? null, body.costPrice ?? null, body.supplierId ?? null, body.inboundOrderId ?? null, tenantId]
    );
    return (insertResult as any).insertId;
  });

  res.json(ok({ batchId: result }));
}));

// PUT /batches/:id - 更新批次信息
inventoryBatchRouter.put("/batches/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    quantity: z.number().int().positive().optional(),
    productionDate: z.string().optional(),
    expiryDate: z.string().optional(),
    costPrice: z.number().optional()
  }).parse(req.body);

  await transaction(async (conn) => {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.quantity !== undefined) { sets.push("quantity = ?"); values.push(body.quantity); }
    if (body.productionDate !== undefined) { sets.push("production_date = ?"); values.push(body.productionDate); }
    if (body.expiryDate !== undefined) { sets.push("expiry_date = ?"); values.push(body.expiryDate); }
    if (body.costPrice !== undefined) { sets.push("cost_price = ?"); values.push(body.costPrice); }

    if (sets.length === 0) return;
    values.push(id, tenantId);
    await conn.execute(`UPDATE inventory_batch SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values as any[]);
  });

  res.json(ok({ batchId: id }));
}));

// POST /batches/:id/split - 批次拆分
inventoryBatchRouter.post("/batches/:id/split", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    splitQuantity: z.number().int().positive(),
    newBatchNo: z.string().min(1)
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    // 获取原批次并加锁
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM inventory_batch WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const batch = (rows as any[])[0];
    if (!batch) throw new Error("批次不存在");
    if (batch.quantity < body.splitQuantity) throw new Error("拆分数量不能大于批次数量");

    // 减少原批次数量
    await conn.execute(
      "UPDATE inventory_batch SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?",
      [body.splitQuantity, id, tenantId]
    );

    // 创建新批次
    const [insertResult] = await conn.execute(
      `INSERT INTO inventory_batch (store_id, sku_id, batch_no, quantity, locked_quantity, production_date, expiry_date, cost_price, supplier_id, inbound_order_id, tenant_id)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [batch.store_id, batch.sku_id, body.newBatchNo, body.splitQuantity, batch.production_date, batch.expiry_date, batch.cost_price, batch.supplier_id, batch.inbound_order_id, tenantId]
    );
    return (insertResult as any).insertId;
  });

  res.json(ok({ newBatchId: result }));
}));

// GET /batches/fifo-suggestion/:storeId/:skuId - FIFO出库建议
inventoryBatchRouter.get("/batches/fifo-suggestion/:storeId/:skuId", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = z.coerce.number().parse(req.params.storeId);
  const skuId = z.coerce.number().parse(req.params.skuId);

  const records = await query<any>(
    `SELECT ib.*, ps.sku_name,
            DATEDIFF(ib.expiry_date, CURDATE()) AS days_remaining
     FROM inventory_batch ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     WHERE ib.store_id = ? AND ib.sku_id = ? AND ib.quantity > ib.locked_quantity AND ib.tenant_id = ?
     ORDER BY ib.expiry_date ASC, ib.production_date ASC
     FOR UPDATE`,
    [storeId, skuId, tenantId]
  );

  res.json(ok(records));
}));

// ==================== 效期预警配置 ====================

// GET /expiry-configs - 预警配置列表
inventoryBatchRouter.get("/expiry-configs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    "SELECT * FROM expiry_alert_config WHERE tenant_id = ? ORDER BY alert_level ASC",
    [tenantId]
  );
  res.json(ok(records));
}));

// POST /expiry-configs - 新增配置
inventoryBatchRouter.post("/expiry-configs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    alertLevel: z.number().int(),
    levelName: z.string().min(1),
    daysBeforeExpiry: z.number().int().positive(),
    action: z.enum(["REMIND", "RESTRICT", "BLOCK"]),
    color: z.string(),
    enabled: z.boolean().default(true),
    description: z.string().default("")
  }).parse(req.body);

  const result = await query<any>(
    `INSERT INTO expiry_alert_config (alert_level, level_name, days_before_expiry, action, color, enabled, description, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.alertLevel, body.levelName, body.daysBeforeExpiry, body.action, body.color, body.enabled ? 1 : 0, body.description, tenantId]
  );
  res.json(ok({ configId: (result as any).insertId }));
}));

// PUT /expiry-configs/:id - 更新配置
inventoryBatchRouter.put("/expiry-configs/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    levelName: z.string().optional(),
    daysBeforeExpiry: z.number().int().positive().optional(),
    action: z.enum(["REMIND", "RESTRICT", "BLOCK"]).optional(),
    color: z.string().optional(),
    enabled: z.boolean().optional(),
    description: z.string().optional()
  }).parse(req.body);

  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.levelName !== undefined) { sets.push("level_name = ?"); values.push(body.levelName); }
  if (body.daysBeforeExpiry !== undefined) { sets.push("days_before_expiry = ?"); values.push(body.daysBeforeExpiry); }
  if (body.action !== undefined) { sets.push("action = ?"); values.push(body.action); }
  if (body.color !== undefined) { sets.push("color = ?"); values.push(body.color); }
  if (body.enabled !== undefined) { sets.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
  if (body.description !== undefined) { sets.push("description = ?"); values.push(body.description); }

  if (sets.length === 0) {
    res.json(ok({ configId: id }));
    return;
  }
  values.push(id, tenantId);
  await query(`UPDATE expiry_alert_config SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values);
  res.json(ok({ configId: id }));
}));

// DELETE /expiry-configs/:id - 删除配置
inventoryBatchRouter.delete("/expiry-configs/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  await query("DELETE FROM expiry_alert_config WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  res.json(ok({ configId: id }));
}));

// ==================== 效期预警记录 ====================

// GET /expiry-alerts - 预警记录列表
inventoryBatchRouter.get("/expiry-alerts", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    alertLevel: z.coerce.number().optional(),
    status: z.enum(["PENDING", "HANDLED", "EXPIRED"]).optional(),
    storeId: z.coerce.number().optional()
  }).parse(req.query);

  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ear.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (params.alertLevel !== undefined) {
    conditions.push("ear.alert_level = ?");
    values.push(params.alertLevel);
  }
  if (params.status) {
    conditions.push("ear.status = ?");
    values.push(params.status);
  }
  if (params.storeId) {
    conditions.push("ear.store_id = ?");
    values.push(params.storeId);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT ear.*, s.name AS store_name
     FROM expiry_alert_record ear
     LEFT JOIN store s ON s.id = ear.store_id AND s.tenant_id = ear.tenant_id
     WHERE ${where}
     ORDER BY ear.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(`SELECT COUNT(*) AS total FROM expiry_alert_record ear WHERE ${where}`, values);

  res.json(ok({ total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records }));
}));

// PUT /expiry-alerts/:id/handle - 处理预警
inventoryBatchRouter.put("/expiry-alerts/:id/handle", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    remark: z.string().optional()
  }).parse(req.body);

  const userId = req.user!.id;

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE expiry_alert_record SET status = 'HANDLED', handled_by = ?, handled_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [userId ?? null, id, tenantId] as any[]
    );
  });

  res.json(ok({ alertId: id }));
}));

// GET /expiry-alerts/statistics - 统计
inventoryBatchRouter.get("/expiry-alerts/statistics", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const stats = await query<any>(
    `SELECT alert_level, COUNT(*) AS count, SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count
     FROM expiry_alert_record
     WHERE tenant_id = ?
     GROUP BY alert_level
     ORDER BY alert_level ASC`,
    [tenantId]
  );

  const totalPending = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM expiry_alert_record WHERE status = 'PENDING' AND tenant_id = ?",
    [tenantId]
  );

  // 最近7天趋势
  const trend = await query<any>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM expiry_alert_record
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND tenant_id = ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [tenantId]
  );

  res.json(ok({
    byLevel: stats,
    totalPending: totalPending?.total ?? 0,
    trend
  }));
}));

// ==================== 效期扫描器 ====================

let expiryScannerRunning = false;

export function startExpiryScanner() {
  console.log("[效期扫描器] 已启动，每60秒检查一次（凌晨2点执行全量扫描）");

  const timer = setInterval(async () => {
    if (expiryScannerRunning) return;
    const now = new Date();
    const hour = now.getHours();
    // 每天凌晨2点执行全量扫描
    if (hour !== 2) return;

    expiryScannerRunning = true;
    try {
      await runExpiryScan();
      console.log("[效期扫描器] 扫描完成");
    } catch (error) {
      console.error("[效期扫描器] 扫描失败:", error);
    } finally {
      expiryScannerRunning = false;
    }
  }, 60 * 1000);
  timer.unref();
}

async function runExpiryScan() {
  // 获取启用的预警配置
  const configs = await query<any>(
    "SELECT * FROM expiry_alert_config WHERE enabled = 1 ORDER BY days_before_expiry DESC"
  );
  if (configs.length === 0) return;

  // 获取所有未过期且有有效期的批次
  const batches = await query<any>(
    `SELECT ib.*, ps.sku_name
     FROM inventory_batch ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     WHERE ib.expiry_date IS NOT NULL AND ib.quantity > 0`
  );

  if (batches.length === 0) return;

  await transaction(async (conn) => {
    for (const batch of batches) {
      const [rows] = await conn.execute<any[]>(
        "SELECT DATEDIFF(?, CURDATE()) AS days_remaining",
        [batch.expiry_date]
      );
      const daysRemaining = (rows as any[])[0]?.days_remaining ?? 0;

      // 匹配预警级别（取最高级别）
      let matchedConfig: any = null;
      for (const config of configs) {
        if (daysRemaining <= config.days_before_expiry && daysRemaining >= 0) {
          matchedConfig = config;
          break; // configs已按days_before_expiry DESC排序，第一个匹配的就是最高级别
        }
      }

      // 处理已过期
      if (daysRemaining < 0) {
        // 更新已过期的预警记录状态
        await conn.execute(
          "UPDATE expiry_alert_record SET status = 'EXPIRED' WHERE batch_id = ? AND status = 'PENDING'",
          [batch.id]
        );
        continue;
      }

      if (!matchedConfig) continue;

      // 检查是否已存在该批次的该级别预警（去重）
      const [existing] = await conn.execute<any[]>(
        "SELECT id FROM expiry_alert_record WHERE batch_id = ? AND alert_level = ? AND status = 'PENDING'",
        [batch.id, matchedConfig.alert_level]
      );

      if ((existing as any[]).length > 0) {
        // 更新剩余天数
        await conn.execute(
          "UPDATE expiry_alert_record SET days_remaining = ? WHERE batch_id = ? AND alert_level = ? AND status = 'PENDING'",
          [daysRemaining, batch.id, matchedConfig.alert_level]
        );
        continue;
      }

      // 创建预警记录
      await conn.execute(
        `INSERT INTO expiry_alert_record (batch_id, store_id, sku_id, sku_name, batch_no, production_date, expiry_date, days_remaining, alert_level, action_taken, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [batch.id, batch.store_id, batch.sku_id, batch.sku_name || "", batch.batch_no, batch.production_date, batch.expiry_date, daysRemaining, matchedConfig.alert_level, matchedConfig.action]
      );

      // BLOCK级别自动锁定库存
      if (matchedConfig.action === "BLOCK") {
        await conn.execute(
          "UPDATE inventory_batch SET locked_quantity = quantity WHERE id = ? AND locked_quantity < quantity",
          [batch.id]
        );
      }
    }
  });
}
