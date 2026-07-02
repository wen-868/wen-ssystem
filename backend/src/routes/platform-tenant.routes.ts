import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import { query, queryOne } from "../shared/db.js";
import bcrypt from "bcryptjs";

export const platformTenantRouter = Router();

// GET /api/platform/tenants - 租户列表
platformTenantRouter.get("/", asyncHandler(async (req: any, res: any) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword as string;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];

  if (keyword) {
    conditions.push("tenant_name LIKE ?");
    params.push(`%${keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [totalResult, records] = await Promise.all([
    queryOne<any>(`SELECT COUNT(*) AS total FROM tenant ${where}`, params),
    query<any>(
      `SELECT id, tenant_name AS tenantName, contact_name AS contactName,
              contact_mobile AS contactMobile, contact_email AS contactEmail,
              status, expire_at AS expireAt, created_at AS createdAt
       FROM tenant ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
  ]);

  res.json(ok({ total: totalResult?.total || 0, page, pageSize, records }));
}));

// GET /api/platform/tenants/:id - 租户详情
platformTenantRouter.get("/:id", asyncHandler(async (req: any, res: any) => {
  const tenant = await queryOne<any>(
    `SELECT id, tenant_name AS tenantName, contact_name AS contactName,
            contact_mobile AS contactMobile, contact_email AS contactEmail,
            status, expire_at AS expireAt, created_at AS createdAt
     FROM tenant WHERE id = ?`,
    [Number(req.params.id)]
  );
  if (!tenant) {
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
  }
  res.json(ok(tenant));
}));

// POST /api/platform/tenants - 创建租户
platformTenantRouter.post("/", asyncHandler(async (req: any, res: any) => {
  const { tenantName, contactName, contactMobile, contactEmail, adminUsername, adminPassword, expireAt } = req.body;

  if (!tenantName || !contactName || !contactMobile || !adminUsername || !adminPassword) {
    res.status(400).json({ code: "400", message: "缺少必填字段" });
    return;
  }

  const existing = await queryOne<any>("SELECT id FROM tenant WHERE tenant_name = ?", [tenantName]);
  if (existing) {
    res.status(400).json({ code: "400", message: "租户名称已存在" });
    return;
  }

  const result = await query<any>(
    `INSERT INTO tenant (tenant_name, contact_name, contact_mobile, contact_email, status, expire_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
    [tenantName, contactName, contactMobile, contactEmail || "", expireAt || null]
  );

  const tenantId = (result as any).insertId;
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await query(
    `INSERT INTO sys_user (tenant_id, username, password_hash, real_name, mobile, status, role)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'ADMIN')`,
    [tenantId, adminUsername, hashedPassword, contactName, contactMobile]
  );

  res.json(ok({ id: tenantId }));
}));

// PUT /api/platform/tenants/:id - 更新租户
platformTenantRouter.put("/:id", asyncHandler(async (req: any, res: any) => {
  const id = Number(req.params.id);
  const { tenantName, contactName, contactMobile, contactEmail, expireAt } = req.body;

  const existing = await queryOne<any>("SELECT id FROM tenant WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (tenantName !== undefined) { sets.push("tenant_name = ?"); params.push(tenantName); }
  if (contactName !== undefined) { sets.push("contact_name = ?"); params.push(contactName); }
  if (contactMobile !== undefined) { sets.push("contact_mobile = ?"); params.push(contactMobile); }
  if (contactEmail !== undefined) { sets.push("contact_email = ?"); params.push(contactEmail); }
  if (expireAt !== undefined) { sets.push("expire_at = ?"); params.push(expireAt); }

  if (sets.length > 0) {
    params.push(id);
    await query(`UPDATE tenant SET ${sets.join(", ")} WHERE id = ?`, params);
  }

  res.json(ok({ success: true }));
}));

// POST /api/platform/tenants/:id/toggle - 启用/禁用租户
platformTenantRouter.post("/:id/toggle", asyncHandler(async (req: any, res: any) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!["ACTIVE", "DISABLED"].includes(status)) {
    res.status(400).json({ code: "400", message: "无效的状态值" });
    return;
  }

  await query("UPDATE tenant SET status = ? WHERE id = ?", [status, id]);
  res.json(ok({ success: true }));
}));