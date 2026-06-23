import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok, fail } from "../shared/response.js";

export const orderTimeoutRouter = Router();

// ==================== 配置管理接口 ====================

/** GET /configs - 获取所有超时配置 */
orderTimeoutRouter.get("/configs", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const configs = await query<any>(
    "SELECT id, order_type AS orderType, timeout_type AS timeoutType, timeout_minutes AS timeoutMinutes, action, enabled, description, created_at AS createdAt, updated_at AS updatedAt FROM order_timeout_config WHERE tenant_id = ? ORDER BY id ASC",
    [tenantId]
  );
  res.json(ok(configs));
}));

/** POST /configs - 新增配置 */
orderTimeoutRouter.post("/configs", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    orderType: z.enum(["SALE", "PURCHASE", "TRANSFER"]),
    timeoutType: z.string().max(32),
    timeoutMinutes: z.number().int().positive(),
    action: z.string().max(32),
    enabled: z.boolean().optional().default(true),
    description: z.string().max(255).optional(),
  }).parse(req.body);

  const result = await query<{ insertId: number }>(
    "INSERT INTO order_timeout_config (order_type, timeout_type, timeout_minutes, action, enabled, description, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [body.orderType, body.timeoutType, body.timeoutMinutes, body.action, body.enabled ? 1 : 0, body.description || null, tenantId]
  );

  res.json(ok({ id: (result as any).insertId }));
}));

/** PUT /configs/:id - 更新配置 */
orderTimeoutRouter.put("/configs/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = z.object({
    orderType: z.enum(["SALE", "PURCHASE", "TRANSFER"]).optional(),
    timeoutType: z.string().max(32).optional(),
    timeoutMinutes: z.number().int().positive().optional(),
    action: z.string().max(32).optional(),
    enabled: z.boolean().optional(),
    description: z.string().max(255).optional(),
  }).parse(req.body);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.orderType !== undefined) { fields.push("order_type = ?"); values.push(body.orderType); }
  if (body.timeoutType !== undefined) { fields.push("timeout_type = ?"); values.push(body.timeoutType); }
  if (body.timeoutMinutes !== undefined) { fields.push("timeout_minutes = ?"); values.push(body.timeoutMinutes); }
  if (body.action !== undefined) { fields.push("action = ?"); values.push(body.action); }
  if (body.enabled !== undefined) { fields.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
  if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }

  if (fields.length === 0) {
    res.status(400).json(fail("没有需要更新的字段", "400"));
    return;
  }

  values.push(id, tenantId);
  await query(`UPDATE order_timeout_config SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values);

  res.json(ok({ message: "更新成功" }));
}));

/** DELETE /configs/:id - 删除配置 */
orderTimeoutRouter.delete("/configs/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  await query("DELETE FROM order_timeout_config WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  res.json(ok({ message: "删除成功" }));
}));

// ==================== 处理日志接口 ====================

/** GET /logs - 处理日志(分页+日期筛选+结果筛选) */
orderTimeoutRouter.get("/logs", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const result = String(req.query.result || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");

  const whereClauses: string[] = ["otl.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (result) {
    whereClauses.push("otl.result = ?");
    params.push(result);
  }
  if (dateStart) {
    whereClauses.push("otl.triggered_at >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    whereClauses.push("otl.triggered_at <= ?");
    params.push(dateEnd + " 23:59:59");
  }

  const whereSql = "WHERE " + whereClauses.join(" AND ");

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM order_timeout_log otl ${whereSql}`,
    params
  );

  const records = await query<any>(
    `SELECT otl.id, otl.order_id AS orderId, otl.order_type AS orderType, otl.timeout_type AS timeoutType,
            otl.action_taken AS actionTaken, otl.triggered_at AS triggeredAt, otl.handled_at AS handledAt,
            otl.result, otl.remark, otl.created_at AS createdAt
     FROM order_timeout_log otl
     ${whereSql}
     ORDER BY otl.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  res.json(ok({
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    records,
  }));
}));

/** GET /statistics - 统计(今日/本周/本月处理数量) */
orderTimeoutRouter.get("/statistics", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const todayStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND DATE(triggered_at) = CURDATE()",
    [tenantId]
  );
  const weekStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND YEARWEEK(triggered_at, 1) = YEARWEEK(CURDATE(), 1)",
    [tenantId]
  );
  const monthStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND DATE_FORMAT(triggered_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')",
    [tenantId]
  );
  const successStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND result = 'SUCCESS' AND DATE(triggered_at) = CURDATE()",
    [tenantId]
  );
  const failedStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND result = 'FAILED' AND DATE(triggered_at) = CURDATE()",
    [tenantId]
  );

  res.json(ok({
    today: todayStats?.count ?? 0,
    thisWeek: weekStats?.count ?? 0,
    thisMonth: monthStats?.count ?? 0,
    todaySuccess: successStats?.count ?? 0,
    todayFailed: failedStats?.count ?? 0,
  }));
}));

// ==================== 定时扫描器 ====================

let scannerRunning = false;

/** 执行单个超时配置的扫描和处理 */
async function processTimeoutConfig(config: {
  id: number;
  order_type: string;
  timeout_type: string;
  timeout_minutes: number;
  action: string;
  tenant_id: number;
}) {
  const tenantId = config.tenant_id;
  // 根据订单类型和超时类型查找对应的表和状态字段
  let tableName = "";
  let statusField = "";
  let statusValue = "";
  let extraWhere = "";

  if (config.order_type === "SALE") {
    tableName = "miniapp_order";
    if (config.timeout_type === "WAIT_PAY") {
      statusField = "pay_status";
      statusValue = "UNPAID";
      // WAIT_PAY 场景需要同时匹配 pay_status 和 order_status
      extraWhere = "AND order_status = 'PENDING'";
    } else if (config.timeout_type === "WAIT_ACCEPT") {
      statusField = "order_status";
      statusValue = "PENDING";
    } else if (config.timeout_type === "WAIT_SIGN") {
      statusField = "delivery_status";
      statusValue = "PENDING_DELIVERY";
    }
  } else if (config.order_type === "PURCHASE") {
    tableName = "purchase_order";
    if (config.timeout_type === "WAIT_CONFIRM") {
      statusField = "status";
      statusValue = "PENDING";
    }
  }

  if (!tableName || !statusField) {
    return; // 无法识别的配置，跳过
  }

  // 查找超时未处理的订单（排除已成功处理的）
  const orders = await query<{ id: number; order_no: string }>(
    `SELECT id, order_no
     FROM ${tableName}
     WHERE ${statusField} = ?
       ${extraWhere}
       AND tenant_id = ?
       AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       AND id NOT IN (
         SELECT order_id FROM order_timeout_log
         WHERE timeout_type = ? AND result = 'SUCCESS' AND tenant_id = ?
       )
     LIMIT 100`,
    [statusValue, tenantId, config.timeout_minutes, config.timeout_type, tenantId]
  );

  for (const order of orders) {
    try {
      await transaction(async (conn) => {
        // 执行对应动作
        if (config.action === "CANCEL") {
          if (config.timeout_type === "WAIT_PAY") {
            // WAIT_PAY 取消：同时更新 order_status 和 pay_status
            await conn.execute(
              `UPDATE ${tableName} SET order_status = 'CANCELLED', pay_status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
              [order.id, tenantId]
            );
          } else if (config.timeout_type === "WAIT_SIGN") {
            // WAIT_SIGN 超时：自动签收（标记完成）
            await conn.execute(
              `UPDATE ${tableName} SET order_status = 'COMPLETED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
              [order.id, tenantId]
            );
          } else {
            // WAIT_ACCEPT 等其他场景：只更新 order_status
            await conn.execute(
              `UPDATE ${tableName} SET order_status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
              [order.id, tenantId]
            );
          }
        } else if (config.action === "AUTO_ACCEPT") {
          await conn.execute(
            `UPDATE ${tableName} SET order_status = 'ACCEPTED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
            [order.id, tenantId]
          );
        } else if (config.action === "AUTO_SIGN") {
          await conn.execute(
            `UPDATE ${tableName} SET delivery_status = 'DELIVERED', order_status = 'COMPLETED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
            [order.id, tenantId]
          );
        }
        // REMIND 类型只记录日志，不改变订单状态

        // 记录处理日志
        await conn.execute(
          `INSERT INTO order_timeout_log (order_id, order_type, timeout_type, action_taken, triggered_at, handled_at, result, remark, tenant_id)
           VALUES (?, ?, ?, ?, NOW(), NOW(), 'SUCCESS', ?, ?)`,
          [order.id, config.order_type, config.timeout_type, config.action, `订单${order.order_no}超时自动${config.action}`, tenantId]
        );
      });
    } catch (err) {
      // 记录失败日志
      try {
        await query(
          `INSERT INTO order_timeout_log (order_id, order_type, timeout_type, action_taken, triggered_at, handled_at, result, remark, tenant_id)
           VALUES (?, ?, ?, ?, NOW(), NOW(), 'FAILED', ?, ?)`,
          [order.id, config.order_type, config.timeout_type, config.action, String(err), tenantId]
        );
      } catch {
        // 日志记录也失败，仅打印
        console.error(`订单超时处理失败 [订单ID=${order.id} 租户ID=${tenantId}]:`, err);
      }
    }
  }
}

/** 启动订单超时定时扫描器 */
export function startOrderTimeoutScanner() {
  if (scannerRunning) return;
  scannerRunning = true;

  const SCAN_INTERVAL = 60_000; // 60秒

  const timer = setInterval(async () => {
    try {
      // 查询所有启用的超时配置（按租户）
      const configs = await query<{
        id: number;
        order_type: string;
        timeout_type: string;
        timeout_minutes: number;
        action: string;
        tenant_id: number;
      }>(
        "SELECT id, order_type, timeout_type, timeout_minutes, action, tenant_id FROM order_timeout_config WHERE enabled = 1"
      );

      for (const config of configs) {
        await processTimeoutConfig(config);
      }
    } catch (err) {
      console.error("[OrderTimeoutScanner] 扫描出错:", err);
    }
  }, SCAN_INTERVAL);

  // 防止定时器阻止进程退出
  if (timer.unref) {
    timer.unref();
  }

  console.log("[OrderTimeoutScanner] 订单超时扫描器已启动，每60秒扫描一次");
}
