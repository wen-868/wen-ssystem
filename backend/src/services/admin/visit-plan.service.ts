import { z } from "zod";
import { queryOneWithTenant, queryWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export const createVisitPlanSchema = z.object({
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
});

export const updateVisitPlanSchema = z.object({
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
});

export type CreateVisitPlanInput = z.infer<typeof createVisitPlanSchema>;
export type UpdateVisitPlanInput = z.infer<typeof updateVisitPlanSchema>;

export async function createVisitPlan(
  tenantId: string,
  userId: number,
  username: string,
  realName: string | undefined,
  body: CreateVisitPlanInput
) {
  const visitNo = makeBizNo("BF");

  const customer = await queryOneWithTenant<any>(
    "SELECT id, name FROM member WHERE id = ?",
    [body.customer_id],
    tenantId
  );
  if (!customer) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
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

export async function updateVisitPlan(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string,
  body: UpdateVisitPlanInput
) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM customer_visit WHERE visit_no = ?",
    [visitNo],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("拜访记录不存在"), { statusCode: 404 });
  }

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
      `UPDATE customer_visit SET ${updates.join(", ")} WHERE visit_no = ?`,
      params,
      tenantId
    );

    await queryWithTenant(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_visit", "UPDATE", visitNo, "customer_visit", userId, username, `更新拜访记录: ${visitNo}`],
      tenantId
    );
  }

  const record = await queryOneWithTenant<any>(
    `SELECT visit_no AS visitNo, customer_id AS customerId, customer_name AS customerName,
            visit_type AS visitType, visit_purpose AS visitPurpose, visit_date AS visitDate,
            status, visit_summary AS visitSummary, follow_up_required AS followUpRequired,
            follow_up_date AS followUpDate, next_action AS nextAction,
            updated_at AS updatedAt
     FROM customer_visit WHERE visit_no = ?`,
    [visitNo],
    tenantId
  );

  return record;
}

export async function cancelVisitPlan(
  tenantId: string,
  userId: number,
  username: string,
  visitNo: string
) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM customer_visit WHERE visit_no = ?",
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
    "UPDATE customer_visit SET status = 'CANCELLED', updated_at = NOW() WHERE visit_no = ?",
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
