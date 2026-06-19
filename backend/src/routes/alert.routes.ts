import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { ok } from "../shared/response.js";
import { runAllAlertChecks } from "../services/alert.service.js";

export const alertRouter = Router();

// 预警列表（支持按类型筛选：库存预警/保质期预警/信用预警/回款逾期）
alertRouter.get("/list", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.ruleType) {
    conditions.push("ar.rule_type = ?");
    params.push(req.query.ruleType);
  }
  if (req.query.alertLevel) {
    conditions.push("ar.alert_level = ?");
    params.push(req.query.alertLevel);
  }
  if (req.query.status) {
    conditions.push("ar.status = ?");
    params.push(req.query.status);
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
     FROM alert_record ar
     ${where}
     ORDER BY ar.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM alert_record ar ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 各类预警数量统计
alertRouter.get("/count", requireAuth, asyncHandler(async (_req, res) => {
  const pendingCounts = await query<any>(
    `SELECT rule_type AS ruleType, COUNT(*) AS count
     FROM alert_record
     WHERE status = 'PENDING'
     GROUP BY rule_type`
  );

  const totalPending = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM alert_record WHERE status = 'PENDING'"
  );

  const totalHandled = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM alert_record WHERE status = 'HANDLED'"
  );

  const totalIgnored = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM alert_record WHERE status = 'IGNORED'"
  );

  // 按级别统计
  const levelCounts = await query<any>(
    `SELECT alert_level AS alertLevel, COUNT(*) AS count
     FROM alert_record
     WHERE status = 'PENDING'
     GROUP BY alert_level`
  );

  const byType: Record<string, number> = {};
  for (const row of pendingCounts) {
    byType[row.ruleType] = Number(row.count);
  }

  const byLevel: Record<string, number> = {};
  for (const row of levelCounts) {
    byLevel[row.alertLevel] = Number(row.count);
  }

  res.json(ok({
    totalPending: Number(totalPending?.count ?? 0),
    totalHandled: Number(totalHandled?.count ?? 0),
    totalIgnored: Number(totalIgnored?.count ?? 0),
    byType,
    byLevel
  }));
}));

// 处理预警（标记已处理/忽略）
alertRouter.put("/:id/handle", requireAuth, asyncHandler(async (req, res) => {
  const alertId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id, status FROM alert_record WHERE id = ?",
    [alertId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "预警记录不存在" });
    return;
  }
  if (existing.status !== "PENDING") {
    res.status(400).json({ code: "400", message: "该预警已处理，无法重复操作" });
    return;
  }

  const body = z.object({
    action: z.enum(["HANDLE", "IGNORE"]),
    remark: z.string().optional()
  }).parse(req.body);

  const newStatus = body.action === "HANDLE" ? "HANDLED" : "IGNORED";
  const handlerName = req.user?.username ?? "system";

  await query(
    `UPDATE alert_record
     SET status = ?,
         handler_id = ?,
         handler_name = ?,
         handle_time = NOW(),
         handle_remark = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [newStatus, req.user?.id ?? 0, handlerName, body.remark ?? null, alertId]
  );

  res.json(ok({
    alertId,
    status: newStatus,
    handlerId: req.user?.id,
    handlerName,
    handleTime: new Date().toISOString()
  }));
}));

// 预警规则配置列表
alertRouter.get("/rules", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT id, rule_code AS ruleCode, rule_name AS ruleName,
            rule_type AS ruleType, enabled,
            threshold_value AS thresholdValue, threshold_unit AS thresholdUnit,
            extra_config AS extraConfig, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM alert_rule
     ORDER BY rule_type, id ASC`
  );

  res.json(ok({ records }));
}));

// 修改预警规则（阈值调整）
alertRouter.put("/rules/:id", requireAuth, asyncHandler(async (req, res) => {
  const ruleId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id FROM alert_rule WHERE id = ?",
    [ruleId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "预警规则不存在" });
    return;
  }

  const body = z.object({
    enabled: z.boolean().optional(),
    thresholdValue: z.number().optional(),
    description: z.string().optional()
  }).parse(req.body);

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
      `UPDATE alert_rule SET ${updates.join(", ")} WHERE id = ?`,
      [...params, ruleId]
    );
  }

  const rule = await queryOne<any>(
    `SELECT id, rule_code AS ruleCode, rule_name AS ruleName,
            rule_type AS ruleType, enabled,
            threshold_value AS thresholdValue, threshold_unit AS thresholdUnit,
            extra_config AS extraConfig, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM alert_rule WHERE id = ?`,
    [ruleId]
  );

  res.json(ok(rule));
}));

// 手动触发预警检查
alertRouter.post("/check", requireAuth, asyncHandler(async (_req, res) => {
  const result = await runAllAlertChecks();
  res.json(ok({
    message: `预警检查完成，新增 ${result.total} 条预警`,
    ...result
  }));
}));
