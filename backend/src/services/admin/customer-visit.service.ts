﻿﻿﻿import { z } from "zod";
import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// ===== 类型定义 =====
/** COUNT(*) AS total 查询行 */
interface CountTotalRow {
  total: number | string;
}

/** 拜访列表查询行 */
interface CustomerVisitListRow {
  id: number | string;
  visitNo: string;
  customerId: number | string;
  customerName: string;
  customerMobile: string | null;
  storeId: number | string;
  visitorId: number | string | null;
  visitorName: string | null;
  visitType: string;
  visitPurpose: string;
  visitDate: string | Date;
  startTime: string | Date | null;
  endTime: string | Date | null;
  durationMinutes: number | string | null;
  address: string | null;
  contactPerson: string | null;
  contactPosition: string | null;
  contactMobile: string | null;
  visitSummary: string | null;
  followUpRequired: number | string;
  followUpDate: string | Date | null;
  followUpContent: string | null;
  nextAction: string | null;
  status: string;
  relatedOrderNo: string | null;
  images: string | null;
  remark: string | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

/** 拜访详情查询行 */
interface CustomerVisitDetailRow extends CustomerVisitListRow {
  latitude: number | string | null;
  longitude: number | string | null;
  tenantId: string;
}

/** 会员 id/name 查询行 */
interface MemberIdNameRow {
  id: number | string;
  name: string;
}

/** 拜访 id/status 查询行 */
interface VisitIdStatusRow {
  id: number | string;
  status: string;
}

/** 拜访 id/status/start_time 查询行 */
interface VisitIdStatusStartRow {
  id: number | string;
  status: string;
  start_time: string | Date | null;
}

/** 拜访更新结果查询行 */
interface VisitUpdateResultRow {
  visitNo: string;
  customerId: number | string;
  customerName: string;
  visitType: string;
  visitPurpose: string;
  visitDate: string | Date;
  status: string;
  visitSummary: string | null;
  followUpRequired: number | string;
  followUpDate: string | Date | null;
  nextAction: string | null;
  updatedAt: string | Date;
}

/** 待跟进列表查询行 */
interface PendingFollowUpRow {
  id: number | string;
  visitNo: string;
  customerId: number | string;
  customerName: string;
  customerMobile: string | null;
  visitPurpose: string;
  visitDate: string | Date;
  followUpDate: string | Date;
  followUpContent: string | null;
  nextAction: string | null;
  status: string;
  visitorName: string | null;
  overdueDays: number | string | null;
}

/** 拜访类型统计行 */
interface VisitTypeCountRow {
  visitType: string;
  count: number | string;
}

/** 拜访目的统计行 */
interface VisitPurposeCountRow {
  visitPurpose: string;
  count: number | string;
}

/** 拜访状态统计行 */
interface VisitStatusCountRow {
  status: string;
  count: number | string;
}

/** 拜访平均时长查询行 */
interface VisitAvgDurationRow {
  avgMinutes: number | string | null;
}

// ============ Zod Schemas ============

export const createVisitSchema = z.object({
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
  images: z.unknown().optional(),
  remark: z.string().max(255).optional(),
});

export const updateVisitSchema = z.object({
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
  images: z.unknown().optional(),
  remark: z.string().max(255).optional(),
});

export const checkinSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().max(255).optional(),
});

export const checkoutSchema = z.object({
  visit_summary: z.string().optional(),
  follow_up_required: z.number().int().min(0).max(1).optional(),
  follow_up_date: z.string().optional(),
  follow_up_content: z.string().max(255).optional(),
  next_action: z.string().max(255).optional(),
  images: z.unknown().optional(),
  remark: z.string().max(255).optional(),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export interface VisitListQuery {
  customer_id?: string;
  visitor_id?: string;
  visit_type?: string;
  visit_purpose?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  follow_up_required?: string;
  page: number;
  pageSize: number;
}

// ============ 列表查询 ============

export async function listVisits(tenantId: string, query: VisitListQuery) {
  const {
    customer_id, visitor_id, visit_type, visit_purpose, status,
    start_date, end_date, follow_up_required,
    page = 1, pageSize = 20
  } = query;

  const conditions: string[] = [];
  const params: unknown[] = [];

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

  const records = await queryWithTenant<CustomerVisitListRow>(
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
     FROM t_customer_visit cv
     ${where}
     ORDER BY cv.visit_date DESC, cv.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_customer_visit cv ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  };
}

// ============ 详情查询 ============

export async function getVisitDetail(tenantId: string, visitNo: string) {
  const record = await queryOneWithTenant<CustomerVisitDetailRow>(
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
     FROM t_customer_visit cv
     WHERE cv.visit_no = ?`,
    [visitNo],
    tenantId
  );

  if (!record) {
    throw Object.assign(new Error("拜访记录不存在"), { statusCode: 404 });
  }

  return record;
}

// ============ 创建拜访 ============

export async function createVisit(
  tenantId: string,
  userId: number,
  username: string,
  realName: string | undefined,
  body: CreateVisitInput
) {
  const visitNo = makeBizNo("BF");

  const customer = await queryOneWithTenant<MemberIdNameRow>(
    "SELECT id, name FROM t_member WHERE id = ?",
    [body.customer_id],
    tenantId
  );
  if (!customer) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO t_customer_visit (
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
        body.store_id, userId, realName || username,
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
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_visit", "CREATE", visitNo, "customer_visit", userId, username, `创建拜访记录: ${visitNo}, 客户: ${body.customer_name}`, tenantId]
    );
  });

  return { visit_no: visitNo };
}

// ============ 更新拜访 ============

export async function updateVisit(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string,
  body: UpdateVisitInput
) {
  const existing = await queryOneWithTenant<VisitIdStatusRow>(
    "SELECT id, status FROM t_customer_visit WHERE visit_no = ?",
    [visitNo],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("拜访记录不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

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
    const value = (body as Record<string, unknown>)[key];
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
    updates.push("updated_at = NOW()");
    params.push(visitNo);
    await queryWithTenant(
      `UPDATE t_customer_visit SET ${updates.join(", ")} WHERE visit_no = ?`,
      params,
      tenantId
    );

    await queryWithTenant(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_visit", "UPDATE", visitNo, "customer_visit", userId, username, `更新拜访记录: ${visitNo}`],
      tenantId
    );
  }

  const record = await queryOneWithTenant<VisitUpdateResultRow>(
    `SELECT visit_no AS visitNo, customer_id AS customerId, customer_name AS customerName,
            visit_type AS visitType, visit_purpose AS visitPurpose, visit_date AS visitDate,
            status, visit_summary AS visitSummary, follow_up_required AS followUpRequired,
            follow_up_date AS followUpDate, next_action AS nextAction,
            updated_at AS updatedAt
     FROM t_customer_visit WHERE visit_no = ?`,
    [visitNo],
    tenantId
  );

  return record;
}

// ============ 签到 ============

export async function checkin(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string,
  body: CheckinInput
) {
  const existing = await queryOneWithTenant<VisitIdStatusRow>(
    "SELECT id, status FROM t_customer_visit WHERE visit_no = ?",
    [visitNo],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("拜访记录不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PLANNED") {
    throw Object.assign(new Error("只有计划中的拜访可以签到"), { statusCode: 400 });
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const updates: string[] = ["status = 'VISITED'", "start_time = ?"];
  const params: unknown[] = [now];

  if (body.latitude !== undefined) { updates.push("latitude = ?"); params.push(body.latitude); }
  if (body.longitude !== undefined) { updates.push("longitude = ?"); params.push(body.longitude); }
  if (body.address) { updates.push("address = ?"); params.push(body.address); }

  updates.push("updated_at = NOW()");
  params.push(visitNo);
  await queryWithTenant(
    `UPDATE t_customer_visit SET ${updates.join(", ")} WHERE visit_no = ?`,
    params,
    tenantId
  );

  await queryWithTenant(
    "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_visit", "CHECKIN", visitNo, "customer_visit", userId, username, `签到: ${visitNo}`],
    tenantId
  );

  return { visit_no: visitNo, status: "VISITED", start_time: now };
}

// ============ 签退 ============

export async function checkout(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string,
  body: CheckoutInput
) {
  const existing = await queryOneWithTenant<VisitIdStatusStartRow>(
    "SELECT id, status, start_time FROM t_customer_visit WHERE visit_no = ?",
    [visitNo],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("拜访记录不存在"), { statusCode: 404 });
  }
  if (existing.status !== "VISITED") {
    throw Object.assign(new Error("只有已签到的拜访可以签退"), { statusCode: 400 });
  }

  const now = new Date();
  const endTimeStr = now.toISOString().slice(0, 19).replace("T", " ");

  let durationMinutes: number | null = null;
  if (existing.start_time) {
    const startTime = new Date(existing.start_time);
    durationMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);
  }

  const updates: string[] = ["status = 'COMPLETED'", "end_time = ?"];
  const params: unknown[] = [endTimeStr];

  if (durationMinutes !== null) { updates.push("duration_minutes = ?"); params.push(durationMinutes); }
  if (body.visit_summary !== undefined) { updates.push("visit_summary = ?"); params.push(body.visit_summary); }
  if (body.follow_up_required !== undefined) { updates.push("follow_up_required = ?"); params.push(body.follow_up_required); }
  if (body.follow_up_date !== undefined) { updates.push("follow_up_date = ?"); params.push(body.follow_up_date); }
  if (body.follow_up_content !== undefined) { updates.push("follow_up_content = ?"); params.push(body.follow_up_content); }
  if (body.next_action !== undefined) { updates.push("next_action = ?"); params.push(body.next_action); }
  if (body.images !== undefined) { updates.push("images = ?"); params.push(JSON.stringify(body.images)); }
  if (body.remark !== undefined) { updates.push("remark = ?"); params.push(body.remark); }

  updates.push("updated_at = NOW()");
  params.push(visitNo);
  await queryWithTenant(
    `UPDATE t_customer_visit SET ${updates.join(", ")} WHERE visit_no = ?`,
    params,
    tenantId
  );

  await queryWithTenant(
    "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_visit", "CHECKOUT", visitNo, "customer_visit", userId, username, `签退: ${visitNo}, 时长: ${durationMinutes}分钟`],
    tenantId
  );

  return { visit_no: visitNo, status: "COMPLETED", end_time: endTimeStr, duration_minutes: durationMinutes };
}

// ============ 取消拜访 ============

export async function cancelVisit(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string
) {
  const existing = await queryOneWithTenant<VisitIdStatusRow>(
    "SELECT id, status FROM t_customer_visit WHERE visit_no = ?",
    [visitNo],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("拜访记录不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PLANNED") {
    throw Object.assign(new Error("只有计划中的拜访可以取消"), { statusCode: 400 });
  }

  await queryWithTenant(
    "UPDATE t_customer_visit SET status = 'CANCELLED', updated_at = NOW() WHERE visit_no = ?",
    [visitNo],
    tenantId
  );

  await queryWithTenant(
    "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_visit", "CANCEL", visitNo, "customer_visit", userId, username, `取消拜访: ${visitNo}`],
    tenantId
  );

  return { visit_no: visitNo, status: "CANCELLED" };
}

// ============ 待跟进列表 ============

export async function listPendingFollowUps(
  tenantId: string,
  visitorId: number | null,
  page: number,
  pageSize: number
) {
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<PendingFollowUpRow>(
    `SELECT cv.id, cv.visit_no AS visitNo, cv.customer_id AS customerId,
            cv.customer_name AS customerName, cv.customer_mobile AS customerMobile,
            cv.visit_purpose AS visitPurpose, cv.visit_date AS visitDate,
            cv.follow_up_date AS followUpDate, cv.follow_up_content AS followUpContent,
            cv.next_action AS nextAction, cv.status,
            cv.visitor_name AS visitorName,
            DATEDIFF(CURDATE(), cv.follow_up_date) AS overdueDays
     FROM t_customer_visit cv
     WHERE cv.follow_up_required = 1
       AND cv.follow_up_date <= CURDATE()
       AND cv.status IN ('COMPLETED', 'VISITED')
       AND (? IS NULL OR cv.visitor_id = ?)
     ORDER BY cv.follow_up_date ASC
     LIMIT ? OFFSET ?`,
    [visitorId, visitorId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_customer_visit cv
     WHERE cv.follow_up_required = 1
       AND cv.follow_up_date <= CURDATE()
       AND cv.status IN ('COMPLETED', 'VISITED')
       AND (? IS NULL OR cv.visitor_id = ?)`,
    [visitorId, visitorId],
    tenantId
  );

  return { total: Number(totalRow?.total ?? 0), page, pageSize, records };
}

// ============ 拜访统计 ============

export async function getVisitStatistics(
  tenantId: string,
  visitorId: number | null,
  startDate: string,
  endDate: string
) {
  const visitorCondition = visitorId ? "AND cv.visitor_id = ?" : "";
  const visitorParams = visitorId ? [visitorId] : [];

  const totalVisits = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const byType = await queryWithTenant<VisitTypeCountRow>(
    `SELECT cv.visit_type AS visitType, COUNT(*) AS count
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.visit_type`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const byPurpose = await queryWithTenant<VisitPurposeCountRow>(
    `SELECT cv.visit_purpose AS visitPurpose, COUNT(*) AS count
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.visit_purpose`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const byStatus = await queryWithTenant<VisitStatusCountRow>(
    `SELECT cv.status, COUNT(*) AS count
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.status`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const avgDuration = await queryOneWithTenant<VisitAvgDurationRow>(
    `SELECT AVG(cv.duration_minutes) AS avgMinutes
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ?
       AND cv.duration_minutes IS NOT NULL ${visitorCondition}`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const pendingFollowUp = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_customer_visit cv
     WHERE cv.follow_up_required = 1
       AND cv.follow_up_date <= CURDATE()
       AND cv.status IN ('COMPLETED', 'VISITED')
       ${visitorCondition}`,
    [...visitorParams],
    tenantId
  );

  const typeMap: Record<string, number> = {};
  for (const row of byType) typeMap[row.visitType] = Number(row.count);

  const purposeMap: Record<string, number> = {};
  for (const row of byPurpose) purposeMap[row.visitPurpose] = Number(row.count);

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) statusMap[row.status] = Number(row.count);

  return {
    totalVisits: Number(totalVisits?.total ?? 0),
    avgDurationMinutes: Math.round(Number(avgDuration?.avgMinutes ?? 0)),
    pendingFollowUps: Number(pendingFollowUp?.total ?? 0),
    byType: typeMap,
    byPurpose: purposeMap,
    byStatus: statusMap,
    startDate,
    endDate
  };
}