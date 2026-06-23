import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";

// ==================== 管理端路由器（admin） ====================

export const adminStoreControlRouter = Router();

adminStoreControlRouter.use(requireAuthWithTenant);

// GET /configs - 所有门店管控配置
adminStoreControlRouter.get("/configs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    `SELECT scc.*, s.name AS store_name, s.status AS store_status
     FROM store_control_config scc
     LEFT JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
     WHERE scc.tenant_id = ?
     ORDER BY scc.id ASC`,
    [tenantId]
  );
  res.json(ok(records));
}));

// GET /configs/:storeId - 单门店配置
adminStoreControlRouter.get("/configs/:storeId", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = z.coerce.number().parse(req.params.storeId);
  const config = await queryOne<any>(
    `SELECT scc.*, s.name AS store_name, s.status AS store_status
     FROM store_control_config scc
     LEFT JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
     WHERE scc.store_id = ? AND scc.tenant_id = ?`,
    [storeId, tenantId]
  );
  if (!config) {
    res.json(ok(null));
    return;
  }
  res.json(ok(config));
}));

// PUT /configs/:storeId - 更新配置
adminStoreControlRouter.put("/configs/:storeId", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = z.coerce.number().parse(req.params.storeId);
  const body = z.object({
    autoOpenTime: z.string().nullable().optional(),
    autoCloseTime: z.string().nullable().optional(),
    maxDailyOrders: z.number().nullable().optional(),
    maxOrderAmount: z.number().nullable().optional()
  }).parse(req.body);

  await transaction(async (conn) => {
    // 检查配置是否存在
    const [existing] = await conn.execute<any[]>(
      "SELECT id FROM store_control_config WHERE store_id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );

    if ((existing as any[]).length > 0) {
      // 更新
      const sets: string[] = [];
      const values: unknown[] = [];
      if (body.autoOpenTime !== undefined) { sets.push("auto_open_time = ?"); values.push(body.autoOpenTime); }
      if (body.autoCloseTime !== undefined) { sets.push("auto_close_time = ?"); values.push(body.autoCloseTime); }
      if (body.maxDailyOrders !== undefined) { sets.push("max_daily_orders = ?"); values.push(body.maxDailyOrders); }
      if (body.maxOrderAmount !== undefined) { sets.push("max_order_amount = ?"); values.push(body.maxOrderAmount); }
      if (sets.length > 0) {
        values.push(storeId, tenantId);
        await conn.execute(`UPDATE store_control_config SET ${sets.join(", ")} WHERE store_id = ? AND tenant_id = ?`, values as any[]);
      }
    } else {
      // 创建
      await conn.execute(
        `INSERT INTO store_control_config (store_id, auto_open_time, auto_close_time, max_daily_orders, max_order_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [storeId, body.autoOpenTime ?? null, body.autoCloseTime ?? null, body.maxDailyOrders ?? null, body.maxOrderAmount ?? null, tenantId] as any[]
      );
    }
  });

  res.json(ok({ storeId }));
}));

// POST /:storeId/open - 手动开门
adminStoreControlRouter.post("/:storeId/open", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = z.coerce.number().parse(req.params.storeId);
  const userId = req.user!.id;

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "CLOSED";
    await conn.execute(
      "UPDATE store SET status = 'OPEN' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'OPEN', 'MANUAL', ?, '手动开门', ?)`,
      [storeId, fromStatus, userId, tenantId] as any[]
    );
  });

  res.json(ok({ storeId, status: "OPEN" }));
}));

// POST /:storeId/close - 手动关门
adminStoreControlRouter.post("/:storeId/close", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = z.coerce.number().parse(req.params.storeId);
  const userId = req.user!.id;

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "OPEN";
    await conn.execute(
      "UPDATE store SET status = 'CLOSED' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'CLOSED', 'MANUAL', ?, '手动关门', ?)`,
      [storeId, fromStatus, userId, tenantId] as any[]
    );
  });

  res.json(ok({ storeId, status: "CLOSED" }));
}));

// POST /:storeId/suspend - 暂停营业
adminStoreControlRouter.post("/:storeId/suspend", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = z.coerce.number().parse(req.params.storeId);
  const userId = req.user!.id;
  const body = z.object({
    reason: z.string().optional()
  }).parse(req.body);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "OPEN";
    await conn.execute(
      "UPDATE store SET status = 'SUSPENDED' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'SUSPENDED', 'MANUAL', ?, ?, ?)`,
      [storeId, fromStatus, userId, body.reason || "手动暂停营业", tenantId] as any[]
    );
    // 记录暂停原因到管控配置
    await conn.execute(
      `INSERT INTO store_control_config (store_id, suspended_reason, tenant_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE suspended_reason = ?`,
      [storeId, body.reason || "手动暂停营业", tenantId, body.reason || "手动暂停营业"] as any[]
    );
  });

  res.json(ok({ storeId, status: "SUSPENDED" }));
}));

// POST /:storeId/resume - 恢复营业
adminStoreControlRouter.post("/:storeId/resume", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = z.coerce.number().parse(req.params.storeId);
  const userId = req.user!.id;

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "SUSPENDED";
    await conn.execute(
      "UPDATE store SET status = 'OPEN' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'OPEN', 'MANUAL', ?, '恢复营业', ?)`,
      [storeId, fromStatus, userId, tenantId] as any[]
    );
    // 清除暂停原因
    await conn.execute(
      "UPDATE store_control_config SET suspended_reason = NULL WHERE store_id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
  });

  res.json(ok({ storeId, status: "OPEN" }));
}));

// GET /logs - 状态变更日志
adminStoreControlRouter.get("/logs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    storeId: z.coerce.number().optional(),
    changeType: z.enum(["MANUAL", "SCHEDULED", "AUTO"]).optional()
  }).parse(req.query);

  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ssl.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (params.storeId) {
    conditions.push("ssl.store_id = ?");
    values.push(params.storeId);
  }
  if (params.changeType) {
    conditions.push("ssl.change_type = ?");
    values.push(params.changeType);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT ssl.*, s.name AS store_name
     FROM store_status_log ssl
     LEFT JOIN store s ON s.id = ssl.store_id AND s.tenant_id = ssl.tenant_id
     WHERE ${where}
     ORDER BY ssl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(`SELECT COUNT(*) AS total FROM store_status_log ssl WHERE ${where}`, values);

  res.json(ok({ total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records }));
}));

// ==================== 门店终端侧路由器（store，只读接口） ====================

export const storeStoreControlRouter = Router();

// GET /status - 获取当前门店状态和配置
storeStoreControlRouter.get("/status", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId ?? 1;

  const store = await queryOne<any>(
    "SELECT id, name, status FROM store WHERE id = ? AND tenant_id = ?",
    [storeId, tenantId]
  );

  const config = await queryOne<any>(
    "SELECT * FROM store_control_config WHERE store_id = ? AND tenant_id = ?",
    [storeId, tenantId]
  );

  res.json(ok({
    storeId,
    storeName: store?.name || "",
    status: store?.status || "OPEN",
    config: config || null
  }));
}));

// GET /my-logs - 当前门店的状态日志
storeStoreControlRouter.get("/my-logs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId ?? 1;
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20)
  }).parse(req.query);

  const offset = (params.page - 1) * params.pageSize;

  const records = await query<any>(
    `SELECT ssl.*, s.name AS store_name
     FROM store_status_log ssl
     LEFT JOIN store s ON s.id = ssl.store_id AND s.tenant_id = ssl.tenant_id
     WHERE ssl.store_id = ? AND ssl.tenant_id = ?
     ORDER BY ssl.created_at DESC
     LIMIT ? OFFSET ?`,
    [storeId, tenantId, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM store_status_log WHERE store_id = ? AND tenant_id = ?",
    [storeId, tenantId]
  );

  res.json(ok({ total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records }));
}));

// ==================== 定时检查器 ====================

let storeControlRunning = false;

export function startStoreControlScheduler() {
  console.log("[门店管控] 定时检查器已启动，每60秒检查一次");

  const timer = setInterval(async () => {
    if (storeControlRunning) return;
    storeControlRunning = true;
    try {
      await runStoreControlCheck();
    } catch (error) {
      console.error("[门店管控] 定时检查失败:", error);
    } finally {
      storeControlRunning = false;
    }
  }, 60 * 1000);
  timer.unref();
}

async function runStoreControlCheck() {
  // 获取所有有管控配置的门店
  const configs = await query<any>(
    `SELECT scc.*, s.status AS current_status, s.name AS store_name
     FROM store_control_config scc
     JOIN store s ON s.id = scc.store_id
     WHERE s.status IN ('OPEN', 'CLOSED')`
  );

  if (configs.length === 0) return;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  await transaction(async (conn) => {
    for (const config of configs) {
      const currentStatus = config.current_status || "OPEN";

      // 检查自动开门
      if (config.auto_open_time && currentStatus === "CLOSED" && currentTime >= config.auto_open_time && currentTime < (config.auto_close_time || "23:59")) {
        await conn.execute(
          "UPDATE store SET status = 'OPEN' WHERE id = ? AND status = 'CLOSED'",
          [config.store_id]
        );
        await conn.execute(
          `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark)
           VALUES (?, 'CLOSED', 'OPEN', 'SCHEDULED', NULL, '定时自动开门')`,
          [config.store_id]
        );
        console.log(`[门店管控] 门店 ${config.store_name}(${config.store_id}) 自动开门`);
      }

      // 检查自动关门
      if (config.auto_close_time && currentStatus === "OPEN" && currentTime >= config.auto_close_time) {
        await conn.execute(
          "UPDATE store SET status = 'CLOSED' WHERE id = ? AND status = 'OPEN'",
          [config.store_id]
        );
        await conn.execute(
          `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark)
           VALUES (?, 'OPEN', 'CLOSED', 'SCHEDULED', NULL, '定时自动关门')`,
          [config.store_id]
        );
        console.log(`[门店管控] 门店 ${config.store_name}(${config.store_id}) 自动关门`);
      }

      // 检查每日订单限额
      if (config.max_daily_orders && currentStatus === "OPEN") {
        const [orderRows] = await conn.execute<any[]>(
          `SELECT COUNT(*) AS order_count FROM sale_bill
           WHERE store_id = ? AND DATE(created_at) = CURDATE() AND business_status NOT IN ('DRAFT', 'VOIDED')`,
          [config.store_id]
        );
        const orderCount = (orderRows as any[])[0]?.order_count ?? 0;
        if (orderCount >= config.max_daily_orders) {
          await conn.execute(
            "UPDATE store SET status = 'CLOSED' WHERE id = ? AND status = 'OPEN'",
            [config.store_id]
          );
          await conn.execute(
            `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark)
             VALUES (?, 'OPEN', 'CLOSED', 'AUTO', NULL, ?)`,
            [config.store_id, "当日订单数(" + orderCount + ")已达上限(" + config.max_daily_orders + ")，自动关门"]
          );
          console.log(`[门店管控] 门店 ${config.store_name}(${config.store_id}) 订单数达上限，自动关门`);
        }
      }

      // 检查每日金额限额
      if (config.max_order_amount && currentStatus === "OPEN") {
        const [amountRows] = await conn.execute<any[]>(
          `SELECT COALESCE(SUM(receivable_amount), 0) AS total_amount FROM sale_bill
           WHERE store_id = ? AND DATE(created_at) = CURDATE() AND business_status NOT IN ('DRAFT', 'VOIDED')`,
          [config.store_id]
        );
        const totalAmount = Number((amountRows as any[])[0]?.total_amount ?? 0);
        if (totalAmount >= config.max_order_amount) {
          await conn.execute(
            "UPDATE store SET status = 'CLOSED' WHERE id = ? AND status = 'OPEN'",
            [config.store_id]
          );
          await conn.execute(
            `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark)
             VALUES (?, 'OPEN', 'CLOSED', 'AUTO', NULL, ?)`,
            [config.store_id, "当日订单金额(" + totalAmount.toFixed(2) + ")已达上限(" + config.max_order_amount + ")，自动关门"]
          );
          console.log(`[门店管控] 门店 ${config.store_name}(${config.store_id}) 订单金额达上限，自动关门`);
        }
      }
    }
  });
}
