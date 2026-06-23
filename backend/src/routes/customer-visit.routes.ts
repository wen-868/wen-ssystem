import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const customerVisitRouter = Router();

// 列表查询（支持多条件筛选）
customerVisitRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const {
    customer_id, visitor_id, visit_type, visit_purpose, status,
    start_date, end_date, follow_up_required,
    page = 1, pageSize = 20
  } = req.query;
  const tenantId = req.tenantId;

  const conditions: string[] = ["cv.tenant_id = ?"];
  const params: any[] = [tenantId];

  if (customer_id) {
    conditions.push("cv.customer_id = ?");
    params.push(Number(customer_id));
  }
  if (visitor_id) {
    conditions.push("cv.visitor_id = ?");
    params.push(Number(visitor_id));
  }
  if (visit_type) {
    conditions.push("cv.visit_type = ?");
    params.push(visit_type);
  }
  if (visit_purpose) {
    conditions.push("cv.visit_purpose = ?");
    params.push(visit_purpose);
  }
  if (status) {
    conditions.push("cv.status = ?");
    params.push(status);
  }
  if (start_date) {
    conditions.push("cv.visit_date >= ?");
    params.push(start_date);
  }
  if (end_date) {
    conditions.push("cv.visit_date <= ?");
    params.push(end_date);
  }
  if (follow_up_required !== undefined) {
    conditions.push("cv.follow_up_required = ?");
    params.push(Number(follow_up_required));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT cv.id, cv.visit_no AS visitNo, cv.customer_id AS customerId,
            cv.customer_name AS customerName, cv.customer_mobile AS customerMobile,
            cv.store_id AS storeId, cv.visitor_id AS visitorId, cv.visitor_name AS visitorName,
            cv.visit_type AS visitType, cv.visit_purpose AS visitPurpose,
            cv.visit_date AS visitDate, cv.start_time AS startTime, cv.end_time AS endTime,
            cv.duration_minutes AS durationMinutes,
            cv.address, cv.contact_person AS contactPerson, cv.contact_position AS contactPosition,
            cv.contact_mobile AS contactMobile,
            cv.visit_summary AS visitSummary,
            cv.follow_up_required AS followUpRequired,
            cv.follow_up_date AS followUpDate, cv.follow_up_content AS followUpContent,
            cv.next_action AS nextAction,
            cv.status, cv.related_order_no AS relatedOrderNo,
            cv.images, cv.remark,
            cv.created_at AS createdAt, cv.updated_at AS updatedAt
     FROM customer_visit cv
     ${where}
     ORDER BY cv.visit_date DESC, cv.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_visit cv ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// 详情查询
customerVisitRouter.get("/:visitNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { visitNo } = req.params;
  const tenantId = req.tenantId;

  const record = await queryOne<any>(
    `SELECT cv.id, cv.visit_no AS visitNo, cv.customer_id AS customerId,
            cv.customer_name AS customerName, cv.customer_mobile AS customerMobile,
            cv.store_id AS storeId, cv.visitor_id AS visitorId, cv.visitor_name AS visitorName,
            cv.visit_type AS visitType, cv.visit_purpose AS visitPurpose,
            cv.visit_date AS visitDate, cv.start_time AS startTime, cv.end_time AS endTime,
            cv.duration_minutes AS durationMinutes,
            cv.address, cv.latitude, cv.longitude,
            cv.contact_person AS contactPerson, cv.contact_position AS contactPosition,
            cv.contact_mobile AS contactMobile,
            cv.visit_summary AS visitSummary,
            cv.follow_up_required AS followUpRequired,
            cv.follow_up_date AS followUpDate, cv.follow_up_content AS followUpContent,
            cv.next_action AS nextAction,
            cv.status, cv.related_order_no AS relatedOrderNo,
            cv.images, cv.remark, cv.tenant_id AS tenantId,
            cv.created_at AS createdAt, cv.updated_at AS updatedAt
     FROM customer_visit cv
     WHERE cv.visit_no = ? AND cv.tenant_id = ?`,
    [visitNo, tenantId]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "拜访记录不存在" });
    return;
  }

  res.json(ok(record));
}));

// 创建拜访记录
customerVisitRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    customer_id: z.number().int().positive(),
    customer_name: z.string().min(1).max(64),
    customer_mobile: z.string().max(20).optional(),
    store_id: z.number().int().positive(),
    visit_type: z.enum(["ONSITE", "PHONE", "ONLINE"]).default("ONSITE"),
    visit_purpose: z.enum(["ROUTINE", "ORDER", "COLLECTION", "COMPLAINT", "PROMOTION", "AFTER_SALE"]).default("ROUTINE"),
    visit_date: z.string(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    duration_minutes: z.number().int().min(0).optional(),
    address: z.string().max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    contact_person: z.string().max(64).optional(),
    contact_position: z.string().max(64).optional(),
    contact_mobile: z.string().max(20).optional(),
    visit_summary: z.string().optional(),
    follow_up_required: z.number().int().min(0).max(1).default(0),
    follow_up_date: z.string().optional(),
    follow_up_content: z.string().max(255).optional(),
    next_action: z.string().max(255).optional(),
    related_order_no: z.string().max(64).optional(),
    images: z.any().optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const tenantId = req.tenantId;
  const visitNo = makeBizNo("BF");

  // 校验客户是否存在
  const customer = await queryOne<any>(
    "SELECT id, name FROM member WHERE id = ?",
    [body.customer_id]
  );
  if (!customer) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO customer_visit (
        visit_no, customer_id, customer_name, customer_mobile,
        store_id, visitor_id, visitor_name,
        visit_type, visit_purpose, visit_date,
        start_time, end_time, duration_minutes,
        address, latitude, longitude,
        contact_person, contact_position, contact_mobile,
        visit_summary, follow_up_required, follow_up_date, follow_up_content, next_action,
        status, related_order_no, images, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?, ?, ?, ?)`,
      [
        visitNo, body.customer_id, body.customer_name, body.customer_mobile || null,
        body.store_id, req.user!.id, req.user!.realName || req.user!.username,
        body.visit_type, body.visit_purpose, body.visit_date,
        body.start_time || null, body.end_time || null, body.duration_minutes || null,
        body.address || null, body.latitude || null, body.longitude || null,
        body.contact_person || null, body.contact_position || null, body.contact_mobile || null,
        body.visit_summary || null, body.follow_up_required, body.follow_up_date || null,
        body.follow_up_content || null, body.next_action || null,
        body.related_order_no || null,
        body.images ? JSON.stringify(body.images) : null,
        body.remark || null, tenantId
      ]
    );

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_visit", "CREATE", visitNo, "customer_visit", req.user!.id, req.user!.username, `创建拜访记录: ${visitNo}, 客户: ${body.customer_name}`, tenantId]
    );
  });

  res.json(ok({ visit_no: visitNo }));
}));

// 更新拜访记录（签到/完成拜访）
customerVisitRouter.put("/:visitNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { visitNo } = req.params;
  const tenantId = req.tenantId;

  const existing = await queryOne<any>(
    "SELECT id, status FROM customer_visit WHERE visit_no = ? AND tenant_id = ?",
    [visitNo, tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "拜访记录不存在" });
    return;
  }

  const body = z.object({
    visit_type: z.enum(["ONSITE", "PHONE", "ONLINE"]).optional(),
    visit_purpose: z.enum(["ROUTINE", "ORDER", "COLLECTION", "COMPLAINT", "PROMOTION", "AFTER_SALE"]).optional(),
    visit_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    duration_minutes: z.number().int().min(0).optional(),
    address: z.string().max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    contact_person: z.string().max(64).optional(),
    contact_position: z.string().max(64).optional(),
    contact_mobile: z.string().max(20).optional(),
    visit_summary: z.string().optional(),
    follow_up_required: z.number().int().min(0).max(1).optional(),
    follow_up_date: z.string().optional(),
    follow_up_content: z.string().max(255).optional(),
    next_action: z.string().max(255).optional(),
    status: z.enum(["PLANNED", "VISITED", "COMPLETED", "CANCELLED"]).optional(),
    related_order_no: z.string().max(64).optional(),
    images: z.any().optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const updates: string[] = [];
  const params: any[] = [];

  const fieldMap: Record<string, string> = {
    visit_type: "visit_type",
    visit_purpose: "visit_purpose",
    visit_date: "visit_date",
    start_time: "start_time",
    end_time: "end_time",
    duration_minutes: "duration_minutes",
    address: "address",
    latitude: "latitude",
    longitude: "longitude",
    contact_person: "contact_person",
    contact_position: "contact_position",
    contact_mobile: "contact_mobile",
    visit_summary: "visit_summary",
    follow_up_required: "follow_up_required",
    follow_up_date: "follow_up_date",
    follow_up_content: "follow_up_content",
    next_action: "next_action",
    status: "status",
    related_order_no: "related_order_no",
    remark: "remark",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = (body as any)[key];
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (body.images !== undefined) {
    updates.push("images = ?");
    params.push(JSON.stringify(body.images));
  }

  if (updates.length > 0) {
    params.push(visitNo, tenantId);
    await query(
      `UPDATE customer_visit SET ${updates.join(", ")}, updated_at = NOW() WHERE visit_no = ? AND tenant_id = ?`,
      params
    );

    await query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_visit", "UPDATE", visitNo, "customer_visit", req.user!.id, req.user!.username, `更新拜访记录: ${visitNo}`, tenantId]
    );
  }

  const record = await queryOne<any>(
    `SELECT visit_no AS visitNo, customer_id AS customerId, customer_name AS customerName,
            visit_type AS visitType, visit_purpose AS visitPurpose, visit_date AS visitDate,
            status, visit_summary AS visitSummary, follow_up_required AS followUpRequired,
            follow_up_date AS followUpDate, next_action AS nextAction,
            updated_at AS updatedAt
     FROM customer_visit WHERE visit_no = ?`,
    [visitNo]
  );

  res.json(ok(record));
}));

// 签到（PLANNED -> VISITED）
customerVisitRouter.post("/:visitNo/checkin", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { visitNo } = req.params;
  const tenantId = req.tenantId;

  const body = z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    address: z.string().max(255).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, status FROM customer_visit WHERE visit_no = ? AND tenant_id = ?",
    [visitNo, tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "拜访记录不存在" });
    return;
  }
  if (existing.status !== "PLANNED") {
    res.status(400).json({ code: "400", message: "只有计划中的拜访可以签到" });
    return;
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const updates: string[] = ["status = 'VISITED'", "start_time = ?"];
  const params: any[] = [now];

  if (body.latitude !== undefined) { updates.push("latitude = ?"); params.push(body.latitude); }
  if (body.longitude !== undefined) { updates.push("longitude = ?"); params.push(body.longitude); }
  if (body.address) { updates.push("address = ?"); params.push(body.address); }

  params.push(visitNo, tenantId);
  await query(
    `UPDATE customer_visit SET ${updates.join(", ")}, updated_at = NOW() WHERE visit_no = ? AND tenant_id = ?`,
    params
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_visit", "CHECKIN", visitNo, "customer_visit", req.user!.id, req.user!.username, `签到: ${visitNo}`, tenantId]
  );

  res.json(ok({ visit_no: visitNo, status: "VISITED", start_time: now }));
}));

// 签退（VISITED -> COMPLETED）
customerVisitRouter.post("/:visitNo/checkout", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { visitNo } = req.params;
  const tenantId = req.tenantId;

  const body = z.object({
    visit_summary: z.string().optional(),
    follow_up_required: z.number().int().min(0).max(1).optional(),
    follow_up_date: z.string().optional(),
    follow_up_content: z.string().max(255).optional(),
    next_action: z.string().max(255).optional(),
    images: z.any().optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, status, start_time FROM customer_visit WHERE visit_no = ? AND tenant_id = ?",
    [visitNo, tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "拜访记录不存在" });
    return;
  }
  if (existing.status !== "VISITED") {
    res.status(400).json({ code: "400", message: "只有已签到的拜访可以签退" });
    return;
  }

  const now = new Date();
  const endTimeStr = now.toISOString().slice(0, 19).replace("T", " ");

  // 计算拜访时长（分钟）
  let durationMinutes: number | null = null;
  if (existing.start_time) {
    const startTime = new Date(existing.start_time);
    durationMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);
  }

  const updates: string[] = ["status = 'COMPLETED'", "end_time = ?"];
  const params: any[] = [endTimeStr];

  if (durationMinutes !== null) { updates.push("duration_minutes = ?"); params.push(durationMinutes); }
  if (body.visit_summary !== undefined) { updates.push("visit_summary = ?"); params.push(body.visit_summary); }
  if (body.follow_up_required !== undefined) { updates.push("follow_up_required = ?"); params.push(body.follow_up_required); }
  if (body.follow_up_date !== undefined) { updates.push("follow_up_date = ?"); params.push(body.follow_up_date); }
  if (body.follow_up_content !== undefined) { updates.push("follow_up_content = ?"); params.push(body.follow_up_content); }
  if (body.next_action !== undefined) { updates.push("next_action = ?"); params.push(body.next_action); }
  if (body.images !== undefined) { updates.push("images = ?"); params.push(JSON.stringify(body.images)); }
  if (body.remark !== undefined) { updates.push("remark = ?"); params.push(body.remark); }

  params.push(visitNo, tenantId);
  await query(
    `UPDATE customer_visit SET ${updates.join(", ")}, updated_at = NOW() WHERE visit_no = ? AND tenant_id = ?`,
    params
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_visit", "CHECKOUT", visitNo, "customer_visit", req.user!.id, req.user!.username, `签退: ${visitNo}, 时长: ${durationMinutes}分钟`, tenantId]
  );

  res.json(ok({ visit_no: visitNo, status: "COMPLETED", end_time: endTimeStr, duration_minutes: durationMinutes }));
}));

// 取消拜访（PLANNED -> CANCELLED）
customerVisitRouter.post("/:visitNo/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { visitNo } = req.params;
  const tenantId = req.tenantId;

  const existing = await queryOne<any>(
    "SELECT id, status FROM customer_visit WHERE visit_no = ? AND tenant_id = ?",
    [visitNo, tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "拜访记录不存在" });
    return;
  }
  if (existing.status !== "PLANNED") {
    res.status(400).json({ code: "400", message: "只有计划中的拜访可以取消" });
    return;
  }

  await query(
    "UPDATE customer_visit SET status = 'CANCELLED', updated_at = NOW() WHERE visit_no = ? AND tenant_id = ?",
    [visitNo, tenantId]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_visit", "CANCEL", visitNo, "customer_visit", req.user!.id, req.user!.username, `取消拜访: ${visitNo}`, tenantId]
  );

  res.json(ok({ visit_no: visitNo, status: "CANCELLED" }));
}));

// 待跟进拜访列表（follow_up_date <= 今天且未完成）
customerVisitRouter.get("/follow-up/pending", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const visitorId = req.query.visitor_id ? Number(req.query.visitor_id) : req.user?.id;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;

  const records = await query<any>(
    `SELECT cv.id, cv.visit_no AS visitNo, cv.customer_id AS customerId,
            cv.customer_name AS customerName, cv.customer_mobile AS customerMobile,
            cv.visit_purpose AS visitPurpose, cv.visit_date AS visitDate,
            cv.follow_up_date AS followUpDate, cv.follow_up_content AS followUpContent,
            cv.next_action AS nextAction, cv.status,
            cv.visitor_name AS visitorName,
            DATEDIFF(CURDATE(), cv.follow_up_date) AS overdueDays
     FROM customer_visit cv
     WHERE cv.tenant_id = ?
       AND cv.follow_up_required = 1
       AND cv.follow_up_date <= CURDATE()
       AND cv.status IN ('COMPLETED', 'VISITED')
       AND (? IS NULL OR cv.visitor_id = ?)
     ORDER BY cv.follow_up_date ASC
     LIMIT ? OFFSET ?`,
    [tenantId, visitorId, visitorId, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_visit cv
     WHERE cv.tenant_id = ?
       AND cv.follow_up_required = 1
       AND cv.follow_up_date <= CURDATE()
       AND cv.status IN ('COMPLETED', 'VISITED')
       AND (? IS NULL OR cv.visitor_id = ?)`,
    [tenantId, visitorId, visitorId]
  );

  res.json(ok({ total: Number(totalRow?.total ?? 0), page, pageSize, records }));
}));

// 拜访统计
customerVisitRouter.get("/statistics", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const visitorId = req.query.visitor_id ? Number(req.query.visitor_id) : null;
  const startDate = req.query.start_date as string || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDate = req.query.end_date as string || new Date().toISOString().slice(0, 10);

  const visitorCondition = visitorId ? "AND cv.visitor_id = ?" : "";
  const visitorParams = visitorId ? [visitorId] : [];

  // 总拜访次数
  const totalVisits = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_visit cv
     WHERE cv.tenant_id = ? AND cv.visit_date BETWEEN ? AND ? ${visitorCondition}`,
    [tenantId, startDate, endDate, ...visitorParams]
  );

  // 按类型统计
  const byType = await query<any>(
    `SELECT cv.visit_type AS visitType, COUNT(*) AS count
     FROM customer_visit cv
     WHERE cv.tenant_id = ? AND cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.visit_type`,
    [tenantId, startDate, endDate, ...visitorParams]
  );

  // 按目的统计
  const byPurpose = await query<any>(
    `SELECT cv.visit_purpose AS visitPurpose, COUNT(*) AS count
     FROM customer_visit cv
     WHERE cv.tenant_id = ? AND cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.visit_purpose`,
    [tenantId, startDate, endDate, ...visitorParams]
  );

  // 按状态统计
  const byStatus = await query<any>(
    `SELECT cv.status, COUNT(*) AS count
     FROM customer_visit cv
     WHERE cv.tenant_id = ? AND cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.status`,
    [tenantId, startDate, endDate, ...visitorParams]
  );

  // 平均拜访时长
  const avgDuration = await queryOne<any>(
    `SELECT AVG(cv.duration_minutes) AS avgMinutes
     FROM customer_visit cv
     WHERE cv.tenant_id = ? AND cv.visit_date BETWEEN ? AND ?
       AND cv.duration_minutes IS NOT NULL ${visitorCondition}`,
    [tenantId, startDate, endDate, ...visitorParams]
  );

  // 待跟进数量
  const pendingFollowUp = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_visit cv
     WHERE cv.tenant_id = ?
       AND cv.follow_up_required = 1
       AND cv.follow_up_date <= CURDATE()
       AND cv.status IN ('COMPLETED', 'VISITED')
       ${visitorCondition.replace("cv.visitor_id", "cv.visitor_id")}`,
    [tenantId, ...visitorParams]
  );

  const typeMap: Record<string, number> = {};
  for (const row of byType) typeMap[row.visitType] = Number(row.count);

  const purposeMap: Record<string, number> = {};
  for (const row of byPurpose) purposeMap[row.visitPurpose] = Number(row.count);

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) statusMap[row.status] = Number(row.count);

  res.json(ok({
    totalVisits: Number(totalVisits?.total ?? 0),
    avgDurationMinutes: Math.round(Number(avgDuration?.avgMinutes ?? 0)),
    pendingFollowUps: Number(pendingFollowUp?.total ?? 0),
    byType: typeMap,
    byPurpose: purposeMap,
    byStatus: statusMap,
    startDate,
    endDate
  }));
}));
