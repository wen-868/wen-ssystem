import { z } from "zod";
import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

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
  images: z.any().optional(),
  remark: z.string().max(255).optional(),
});

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

export async function listVisitRecords(tenantId: string, query: VisitListQuery) {
  const {
    customer_id, visitor_id, visit_type, visit_purpose, status,
    start_date, end_date, follow_up_required,
    page = 1, pageSize = 20
  } = query;

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

  const records = await queryWithTenant<any>(
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

  const totalRow = await queryOneWithTenant<any>(
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

export async function getVisitRecordDetail(tenantId: string, visitNo: string) {
  const record = await queryOneWithTenant<any>(
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

export async function checkin(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string,
  body: CheckinInput
) {
  const existing = await queryOneWithTenant<any>(
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
  const params: any[] = [now];

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

export async function checkout(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string,
  body: CheckoutInput
) {
  const existing = await queryOneWithTenant<any>(
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
  const params: any[] = [endTimeStr];

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

export async function listPendingFollowUps(
  tenantId: string,
  visitorId: number | null,
  page: number,
  pageSize: number
) {
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<any>(
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

  const totalRow = await queryOneWithTenant<any>(
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

export async function getVisitStatistics(
  tenantId: string,
  visitorId: number | null,
  startDate: string,
  endDate: string
) {
  const visitorCondition = visitorId ? "AND cv.visitor_id = ?" : "";
  const visitorParams = visitorId ? [visitorId] : [];

  const totalVisits = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const byType = await queryWithTenant<any>(
    `SELECT cv.visit_type AS visitType, COUNT(*) AS count
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.visit_type`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const byPurpose = await queryWithTenant<any>(
    `SELECT cv.visit_purpose AS visitPurpose, COUNT(*) AS count
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.visit_purpose`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const byStatus = await queryWithTenant<any>(
    `SELECT cv.status, COUNT(*) AS count
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ? ${visitorCondition}
     GROUP BY cv.status`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const avgDuration = await queryOneWithTenant<any>(
    `SELECT AVG(cv.duration_minutes) AS avgMinutes
     FROM t_customer_visit cv
     WHERE cv.visit_date BETWEEN ? AND ?
       AND cv.duration_minutes IS NOT NULL ${visitorCondition}`,
    [startDate, endDate, ...visitorParams],
    tenantId
  );

  const pendingFollowUp = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_customer_visit cv
     WHERE cv.follow_up_required = 1
       AND cv.follow_up_date <= CURDATE()
       AND cv.status IN ('COMPLETED', 'VISITED')
       ${visitorCondition.replace("cv.visitor_id", "cv.visitor_id")}`,
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
