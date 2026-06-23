import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const supplierRouter = Router();

// 列表查询
supplierRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { keyword, status, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId;

  let sql = "SELECT * FROM supplier WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (keyword) {
    sql += " AND (name LIKE ? OR short_name LIKE ? OR supplier_code LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (status !== undefined) {
    sql += " AND status = ?";
    params.push(Number(status));
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const suppliers = await query<any>(sql, params);
  res.json(ok(suppliers));
}));

// 详情查询（含联系人）
supplierRouter.get("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  const supplier = await queryOne<any>(
    "SELECT * FROM supplier WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  const contacts = await query<any>(
    "SELECT * FROM supplier_contact WHERE supplier_id = ? ORDER BY is_primary DESC, created_at DESC",
    [id]
  );

  res.json(ok({ ...supplier, contacts }));
}));

// 新增供应商
supplierRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    short_name: z.string().max(64).optional(),
    category: z.string().max(32).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    credit_level: z.string().max(16).default("B"),
    settlement_type: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).default("CASH"),
    settlement_day: z.number().int().min(1).max(31).optional(),
    tax_rate: z.number().min(0).max(1).default(0),
    bank_name: z.string().max(128).optional(),
    bank_account: z.string().max(64).optional(),
    bank_account_name: z.string().max(64).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const tenantId = req.tenantId;
  const supplierCode = makeBizNo("GYS");

  const result = await query(
    `INSERT INTO supplier (
      supplier_code, name, short_name, category, province, city, district, address,
      credit_level, settlement_type, settlement_day, tax_rate, bank_name, bank_account,
      bank_account_name, remark, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      supplierCode, body.name, body.short_name || null, body.category || null,
      body.province || null, body.city || null, body.district || null, body.address || null,
      body.credit_level, body.settlement_type, body.settlement_day || null, body.tax_rate,
      body.bank_name || null, body.bank_account || null, body.bank_account_name || null,
      body.remark || null, tenantId
    ]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["supplier", "CREATE", String(result.insertId), "supplier", req.user?.id, req.user?.username, `创建供应商: ${body.name}`, tenantId]
  );

  res.json(ok({ id: result.insertId, supplier_code: supplierCode }));
}));

// 修改供应商
supplierRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  const existing = await queryOne<any>(
    "SELECT id FROM supplier WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  if (!existing) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  const body = z.object({
    name: z.string().min(1).max(128).optional(),
    short_name: z.string().max(64).optional(),
    category: z.string().max(32).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    credit_level: z.string().max(16).optional(),
    settlement_type: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).optional(),
    settlement_day: z.number().int().min(1).max(31).optional(),
    tax_rate: z.number().min(0).max(1).optional(),
    bank_name: z.string().max(128).optional(),
    bank_account: z.string().max(64).optional(),
    bank_account_name: z.string().max(64).optional(),
    status: z.number().int().min(0).max(1).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const updates: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (updates.length > 0) {
    params.push(id, tenantId);
    await query(
      `UPDATE supplier SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      params
    );

    await query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["supplier", "UPDATE", id, "supplier", req.user?.id, req.user?.username, `修改供应商: ${body.name || id}`, tenantId]
    );
  }

  res.json(ok({ id: Number(id) }));
}));

// 添加联系人
supplierRouter.post("/:id/contacts", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  const supplier = await queryOne<any>(
    "SELECT id FROM supplier WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  const body = z.object({
    name: z.string().min(1).max(64),
    mobile: z.string().max(20).optional(),
    phone: z.string().max(32).optional(),
    email: z.string().email().max(128).optional(),
    wechat: z.string().max(64).optional(),
    is_primary: z.number().int().min(0).max(1).default(0),
    position: z.string().max(64).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  if (body.is_primary === 1) {
    await query(
      "UPDATE supplier_contact SET is_primary = 0 WHERE supplier_id = ?",
      [id]
    );
  }

  const result = await query(
    `INSERT INTO supplier_contact (
      supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, body.name, body.mobile || null, body.phone || null,
      body.email || null, body.wechat || null, body.is_primary,
      body.position || null, body.remark || null
    ]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["supplier", "ADD_CONTACT", String(result.insertId), "supplier_contact", req.user?.id, req.user?.username, `添加联系人: ${body.name}`, tenantId]
  );

  res.json(ok({ id: result.insertId }));
}));

// 删除联系人
supplierRouter.delete("/:id/contacts/:contactId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id, contactId } = req.params;
  const tenantId = req.tenantId;

  const supplier = await queryOne<any>(
    "SELECT id FROM supplier WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  const contact = await queryOne<any>(
    "SELECT id, name FROM supplier_contact WHERE id = ? AND supplier_id = ?",
    [contactId, id]
  );

  if (!contact) {
    res.status(404).json({ code: "404", message: "联系人不存在" });
    return;
  }

  await query("DELETE FROM supplier_contact WHERE id = ?", [contactId]);

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["supplier", "DELETE_CONTACT", contactId, "supplier_contact", req.user?.id, req.user?.username, `删除联系人: ${contact.name}`, tenantId]
  );

  res.json(ok({ id: Number(contactId) }));
}));
