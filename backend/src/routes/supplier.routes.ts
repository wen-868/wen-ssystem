import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuth } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const supplierRouter = Router();

supplierRouter.use(requireAuth);

// 供应商编码生成：GYS{YYMMDD}{3位序号}
async function generateSupplierCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;
  
  // 查询今天已有的最大序号
  const maxCode = await queryOne<any>(
    `SELECT supplier_code FROM supplier 
     WHERE supplier_code LIKE ? 
     ORDER BY supplier_code DESC LIMIT 1`,
    [`GYS${datePart}%`]
  );
  
  let seq = 1;
  if (maxCode) {
    const lastSeq = parseInt(maxCode.supplier_code.slice(-3));
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }
  
  return `GYS${datePart}${String(seq).padStart(3, "0")}`;
}

// GET /api/admin/suppliers - 列表（支持 keyword、status 筛选）
supplierRouter.get("/", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = String(req.query.keyword || "");
  const status = req.query.status ? Number(req.query.status) : null;
  
  let sql = `SELECT id, supplier_code AS supplierCode, name, short_name AS shortName, 
                    category, province, city, district, address, credit_level AS creditLevel,
                    settlement_type AS settlementType, settlement_day AS settlementDay,
                    tax_rate AS taxRate, bank_name AS bankName, bank_account AS bankAccount,
                    bank_account_name AS bankAccountName, status, remark, 
                    created_at AS createdAt, updated_at AS updatedAt
             FROM supplier
             WHERE 1=1`;
  const params: unknown[] = [];
  
  if (keyword) {
    sql += ` AND (name LIKE ? OR short_name LIKE ? OR supplier_code LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  if (status !== null) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  
  sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);
  
  const records = await query<any>(sql, params);
  
  let countSql = `SELECT COUNT(*) AS total FROM supplier WHERE 1=1`;
  const countParams: unknown[] = [];
  
  if (keyword) {
    countSql += ` AND (name LIKE ? OR short_name LIKE ? OR supplier_code LIKE ?)`;
    countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  if (status !== null) {
    countSql += ` AND status = ?`;
    countParams.push(status);
  }
  
  const totalRow = await queryOne<any>(countSql, countParams);
  
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// POST /api/admin/suppliers - 新增
supplierRouter.post("/", asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1, "供应商名称不能为空"),
    shortName: z.string().optional(),
    category: z.enum(["酒厂", "经销商", "批发商"]).optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    creditLevel: z.enum(["A", "B", "C", "D"]).default("B"),
    settlementType: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).default("CASH"),
    settlementDay: z.number().min(1).max(31).optional(),
    taxRate: z.number().min(0).max(1).default(0),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    bankAccountName: z.string().optional(),
    remark: z.string().optional()
  }).parse(req.body);
  
  const supplierCode = generateSupplierCode();
  
  await query(
    `INSERT INTO supplier (supplier_code, name, short_name, category, province, city, district, address,
                           credit_level, settlement_type, settlement_day, tax_rate, bank_name, bank_account,
                           bank_account_name, status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      supplierCode, body.name, body.shortName ?? null, body.category ?? null,
      body.province ?? null, body.city ?? null, body.district ?? null, body.address ?? null,
      body.creditLevel, body.settlementType, body.settlementDay ?? null, body.taxRate,
      body.bankName ?? null, body.bankAccount ?? null, body.bankAccountName ?? null, body.remark ?? null
    ]
  );
  
  // 写操作日志
  await query(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
     VALUES (?, ?, 'SUPPLIER', 'CREATE', ?, ?)`,
    [req.user?.id ?? null, req.user?.username ?? "系统用户", supplierCode, JSON.stringify({ supplierCode, name: body.name })]
  );
  
  const newSupplier = await queryOne<any>(
    `SELECT id, supplier_code AS supplierCode, name FROM supplier WHERE supplier_code = ?`,
    [supplierCode]
  );
  
  res.json(ok(newSupplier));
}));

// GET /api/admin/suppliers/:id - 详情（含 contacts 列表）
supplierRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  
  const supplier = await queryOne<any>(
    `SELECT id, supplier_code AS supplierCode, name, short_name AS shortName, 
            category, province, city, district, address, credit_level AS creditLevel,
            settlement_type AS settlementType, settlement_day AS settlementDay,
            tax_rate AS taxRate, bank_name AS bankName, bank_account AS bankAccount,
            bank_account_name AS bankAccountName, status, remark, 
            created_at AS createdAt, updated_at AS updatedAt
     FROM supplier WHERE id = ?`,
    [id]
  );
  
  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }
  
  const contacts = await query<any>(
    `SELECT id, name, mobile, phone, email, wechat, is_primary AS isPrimary, position, remark
     FROM supplier_contact WHERE supplier_id = ? ORDER BY is_primary DESC, id ASC`,
    [id]
  );
  
  res.json(ok({ ...supplier, contacts }));
}));

// PUT /api/admin/suppliers/:id - 修改
supplierRouter.put("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  
  const body = z.object({
    name: z.string().min(1, "供应商名称不能为空").optional(),
    shortName: z.string().optional(),
    category: z.enum(["酒厂", "经销商", "批发商"]).optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    creditLevel: z.enum(["A", "B", "C", "D"]).optional(),
    settlementType: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).optional(),
    settlementDay: z.number().min(1).max(31).optional(),
    taxRate: z.number().min(0).max(1).optional(),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    bankAccountName: z.string().optional(),
    status: z.number().optional(),
    remark: z.string().optional()
  }).parse(req.body);
  
  const existing = await queryOne<any>("SELECT id FROM supplier WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }
  
  const updates: string[] = [];
  const params: unknown[] = [];
  
  if (body.name !== undefined) {
    updates.push("name = ?");
    params.push(body.name);
  }
  if (body.shortName !== undefined) {
    updates.push("short_name = ?");
    params.push(body.shortName);
  }
  if (body.category !== undefined) {
    updates.push("category = ?");
    params.push(body.category);
  }
  if (body.province !== undefined) {
    updates.push("province = ?");
    params.push(body.province);
  }
  if (body.city !== undefined) {
    updates.push("city = ?");
    params.push(body.city);
  }
  if (body.district !== undefined) {
    updates.push("district = ?");
    params.push(body.district);
  }
  if (body.address !== undefined) {
    updates.push("address = ?");
    params.push(body.address);
  }
  if (body.creditLevel !== undefined) {
    updates.push("credit_level = ?");
    params.push(body.creditLevel);
  }
  if (body.settlementType !== undefined) {
    updates.push("settlement_type = ?");
    params.push(body.settlementType);
  }
  if (body.settlementDay !== undefined) {
    updates.push("settlement_day = ?");
    params.push(body.settlementDay);
  }
  if (body.taxRate !== undefined) {
    updates.push("tax_rate = ?");
    params.push(body.taxRate);
  }
  if (body.bankName !== undefined) {
    updates.push("bank_name = ?");
    params.push(body.bankName);
  }
  if (body.bankAccount !== undefined) {
    updates.push("bank_account = ?");
    params.push(body.bankAccount);
  }
  if (body.bankAccountName !== undefined) {
    updates.push("bank_account_name = ?");
    params.push(body.bankAccountName);
  }
  if (body.status !== undefined) {
    updates.push("status = ?");
    params.push(body.status);
  }
  if (body.remark !== undefined) {
    updates.push("remark = ?");
    params.push(body.remark);
  }
  
  if (updates.length > 0) {
    params.push(id);
    await query(`UPDATE supplier SET ${updates.join(", ")} WHERE id = ?`, params);
  }
  
  // 写操作日志
  await query(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
     VALUES (?, ?, 'SUPPLIER', 'UPDATE', ?, ?)`,
    [req.user?.id ?? null, req.user?.username ?? "系统用户", id, JSON.stringify(body)]
  );
  
  res.json(ok({ id, ...body }));
}));

// POST /api/admin/suppliers/:id/contacts - 添加联系人
supplierRouter.post("/:id/contacts", asyncHandler(async (req, res) => {
  const supplierId = Number(req.params.id);
  
  const body = z.object({
    name: z.string().min(1, "联系人姓名不能为空"),
    mobile: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    wechat: z.string().optional(),
    isPrimary: z.boolean().default(false),
    position: z.string().optional(),
    remark: z.string().optional()
  }).parse(req.body);
  
  const supplier = await queryOne<any>("SELECT id, name FROM supplier WHERE id = ?", [supplierId]);
  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }
  
  // 如果设置为主联系人，先取消其他主联系人
  if (body.isPrimary) {
    await query(
      `UPDATE supplier_contact SET is_primary = 0 WHERE supplier_id = ?`,
      [supplierId]
    );
  }
  
  await query(
    `INSERT INTO supplier_contact (supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      supplierId, body.name, body.mobile ?? null, body.phone ?? null,
      body.email ?? null, body.wechat ?? null, body.isPrimary ? 1 : 0,
      body.position ?? null, body.remark ?? null
    ]
  );
  
  // 写操作日志
  await query(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
     VALUES (?, ?, 'SUPPLIER_CONTACT', 'CREATE', ?, ?)`,
    [req.user?.id ?? null, req.user?.username ?? "系统用户", supplierId, JSON.stringify({ supplierId, contactName: body.name })]
  );
  
  const newContact = await queryOne<any>(
    `SELECT id, name, mobile, phone, email, wechat, is_primary AS isPrimary, position, remark
     FROM supplier_contact WHERE supplier_id = ? ORDER BY id DESC LIMIT 1`,
    [supplierId]
  );
  
  res.json(ok(newContact));
}));
