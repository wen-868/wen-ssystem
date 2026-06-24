import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const supplierRouter = Router();

supplierRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { keyword, status, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId!;

  let sql = `SELECT 
    id,
    supplier_code AS supplierCode,
    name,
    short_name AS shortName,
    category,
    province,
    city,
    district,
    address,
    credit_level AS creditLevel,
    settlement_type AS settlementType,
    settlement_day AS settlementDay,
    tax_rate AS taxRate,
    bank_name AS bankName,
    bank_account AS bankAccount,
    bank_account_name AS bankAccountName,
    status,
    remark,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM supplier WHERE tenant_id = ?`;
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

supplierRouter.get("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;

  const supplier = await queryOne<any>(
    `SELECT 
      id,
      supplier_code AS supplierCode,
      name,
      short_name AS shortName,
      category,
      province,
      city,
      district,
      address,
      credit_level AS creditLevel,
      settlement_type AS settlementType,
      settlement_day AS settlementDay,
      tax_rate AS taxRate,
      bank_name AS bankName,
      bank_account AS bankAccount,
      bank_account_name AS bankAccountName,
      status,
      remark,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM supplier WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  const contacts = await query<any>(
    `SELECT 
      id,
      supplier_id AS supplierId,
      name,
      mobile,
      phone,
      email,
      wechat,
      is_primary AS isPrimary,
      position,
      remark,
      created_at AS createdAt
    FROM supplier_contact WHERE supplier_id = ? ORDER BY is_primary DESC, created_at DESC`,
    [id]
  );

  res.json(ok({ ...supplier, contacts }));
}));

supplierRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    shortName: z.string().max(64).optional(),
    category: z.string().max(32).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    creditLevel: z.string().max(16).default("B"),
    settlementType: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).default("CASH"),
    settlementDay: z.number().int().min(1).max(31).optional(),
    taxRate: z.number().min(0).max(1).default(0),
    bankName: z.string().max(128).optional(),
    bankAccount: z.string().max(64).optional(),
    bankAccountName: z.string().max(64).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const supplierCode = makeBizNo("GYS");

  const result = await query(
    `INSERT INTO supplier (
      supplier_code, name, short_name, category, province, city, district, address,
      credit_level, settlement_type, settlement_day, tax_rate, bank_name, bank_account,
      bank_account_name, remark, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      supplierCode, body.name, body.shortName || null, body.category || null,
      body.province || null, body.city || null, body.district || null, body.address || null,
      body.creditLevel, body.settlementType, body.settlementDay || null, body.taxRate,
      body.bankName || null, body.bankAccount || null, body.bankAccountName || null,
      body.remark || null, tenantId
    ]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["supplier", "CREATE", String(result.insertId), "supplier", req.user!.id, req.user!.username, `创建供应商: ${body.name}`, tenantId]
  );

  res.json(ok({ id: result.insertId, supplierCode }));
}));

supplierRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;

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
    shortName: z.string().max(64).optional(),
    category: z.string().max(32).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    creditLevel: z.string().max(16).optional(),
    settlementType: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).optional(),
    settlementDay: z.number().int().min(1).max(31).optional(),
    taxRate: z.number().min(0).max(1).optional(),
    bankName: z.string().max(128).optional(),
    bankAccount: z.string().max(64).optional(),
    bankAccountName: z.string().max(64).optional(),
    status: z.number().int().min(0).max(1).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const fieldMap: Record<string, string> = {
    name: "name",
    shortName: "short_name",
    category: "category",
    province: "province",
    city: "city",
    district: "district",
    address: "address",
    creditLevel: "credit_level",
    settlementType: "settlement_type",
    settlementDay: "settlement_day",
    taxRate: "tax_rate",
    bankName: "bank_name",
    bankAccount: "bank_account",
    bankAccountName: "bank_account_name",
    status: "status",
    remark: "remark",
  };

  const updates: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && fieldMap[key]) {
      updates.push(`${fieldMap[key]} = ?`);
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
      ["supplier", "UPDATE", id, "supplier", req.user!.id, req.user!.username, `修改供应商: ${body.name || id}`, tenantId]
    );
  }

  res.json(ok({ id: Number(id) }));
}));

supplierRouter.post("/:id/contacts", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;

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
    isPrimary: z.number().int().min(0).max(1).default(0),
    position: z.string().max(64).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  if (body.isPrimary === 1) {
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
      body.email || null, body.wechat || null, body.isPrimary,
      body.position || null, body.remark || null
    ]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["supplier", "ADD_CONTACT", String(result.insertId), "supplier_contact", req.user!.id, req.user!.username, `添加联系人: ${body.name}`, tenantId]
  );

  res.json(ok({ id: result.insertId }));
}));

supplierRouter.delete("/:id/contacts/:contactId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id, contactId } = req.params;
  const tenantId = req.tenantId!;

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
    ["supplier", "DELETE_CONTACT", contactId, "supplier_contact", req.user!.id, req.user!.username, `删除联系人: ${contact.name}`, tenantId]
  );

  res.json(ok({ id: Number(contactId) }));
}));
