import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const supplierRouter = Router();

supplierRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { keyword, supplyType, status, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId!;

  let countSql = "SELECT COUNT(*) as total FROM supplier WHERE tenant_id = ?";
  let countParams: any[] = [tenantId];

  let sql = `SELECT 
    s.id,
    s.supplier_code AS supplierCode,
    s.name,
    s.short_name AS shortName,
    s.category AS supplyType,
    s.province,
    s.city,
    s.district,
    s.address,
    s.credit_level AS creditLevel,
    s.settlement_type AS settlementType,
    s.settlement_day AS settlementDay,
    s.tax_rate AS taxRate,
    s.bank_name AS bankName,
    s.bank_account AS bankAccount,
    s.bank_account_name AS bankAccountName,
    s.status,
    s.remark,
    s.created_at AS createdAt,
    s.updated_at AS updatedAt,
    sc.name AS contactPerson,
    sc.mobile AS phone
  FROM supplier s
  LEFT JOIN supplier_contact sc ON sc.supplier_id = s.id AND sc.is_primary = 1
  WHERE s.tenant_id = ?`;
  const params: any[] = [tenantId];

  if (keyword) {
    sql += " AND (s.name LIKE ? OR s.short_name LIKE ? OR s.supplier_code LIKE ?)";
    countSql += " AND (name LIKE ? OR short_name LIKE ? OR supplier_code LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (supplyType) {
    sql += " AND s.category = ?";
    countSql += " AND category = ?";
    params.push(supplyType);
    countParams.push(supplyType);
  }

  if (status !== undefined) {
    sql += " AND s.status = ?";
    countSql += " AND status = ?";
    params.push(Number(status));
    countParams.push(Number(status));
  }

  const countResult = await queryOne<any>(countSql, countParams);
  const total = countResult?.total || 0;

  sql += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const records = await query<any>(sql, params);
  res.json(ok({ records, total, page: Number(page), pageSize: Number(pageSize) }));
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
      category AS supplyType,
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
    supplyType: z.string().max(32).optional(),
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
    contactPerson: z.string().max(64).optional(),
    contactMobile: z.string().max(20).optional(),
    contactPhone: z.string().max(32).optional(),
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const supplierCode = makeBizNo("GYS");

  let supplierId = 0;
  await transaction(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO supplier (
        supplier_code, name, short_name, category, province, city, district, address,
        credit_level, settlement_type, settlement_day, tax_rate, bank_name, bank_account,
        bank_account_name, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplierCode, body.name, body.shortName || null, body.supplyType || null,
        body.province || null, body.city || null, body.district || null, body.address || null,
        body.creditLevel, body.settlementType, body.settlementDay || null, body.taxRate,
        body.bankName || null, body.bankAccount || null, body.bankAccountName || null,
        body.remark || null, tenantId
      ]
    );

    supplierId = (result as any).insertId;

    if (body.contactPerson) {
      await conn.execute(
        `INSERT INTO supplier_contact (
          supplier_id, name, mobile, phone, is_primary, position
        ) VALUES (?, ?, ?, ?, 1, '联系人')`,
        [supplierId, body.contactPerson, body.contactMobile || null, body.contactPhone || null]
      );
    }

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["supplier", "CREATE", String(supplierId), "supplier", req.user!.id, req.user!.username, `创建供应商: ${body.name}`, tenantId]
    );
  });

  res.json(ok({ id: supplierId, supplierCode }));
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
    supplyType: z.string().max(32).optional(),
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
    supplyType: "category",
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

supplierRouter.get("/:id/purchase-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;
  const { page = 1, pageSize = 20, status } = req.query;

  const supplier = await queryOne<any>(
    "SELECT id FROM supplier WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  let sql = `SELECT
    id,
    order_no AS purchaseNo,
    supplier_id AS supplierId,
    supplier_name AS supplierName,
    store_id AS storeId,
    order_status AS status,
    warehouse_status AS warehouseStatus,
    goods_amount AS goodsAmount,
    tax_amount AS taxAmount,
    discount_amount AS discountAmount,
    payable_amount AS totalAmount,
    paid_amount AS paidAmount,
    unpaid_amount AS unpaidAmount,
    expected_date AS expectedDate,
    actual_date AS actualDate,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM purchase_order WHERE tenant_id = ? AND supplier_id = ?`;
  const params: unknown[] = [tenantId, id];
  if (status) {
    sql += " AND order_status = ?";
    params.push(status);
  }
  sql += " ORDER BY created_at DESC";

  const offset = (Number(page) - 1) * Number(pageSize);
  const countSql = `SELECT COUNT(*) as total FROM (${sql}) t`;
  const countResult = await queryOne<any>(countSql, params);
  const total = countResult?.total || 0;

  sql += " LIMIT ? OFFSET ?";
  params.push(Number(pageSize), offset);
  const records = await query<any>(sql, params);

  res.json(ok({ records, total, page: Number(page), pageSize: Number(pageSize) }));
}));

supplierRouter.get("/:id/payments", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;
  const { page = 1, pageSize = 20 } = req.query;

  const supplier = await queryOne<any>(
    "SELECT id FROM supplier WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  const countSql = `SELECT COUNT(*) as total FROM supplier_payment WHERE tenant_id = ? AND supplier_id = ?`;
  const countResult = await queryOne<any>(countSql, [tenantId, id]);
  const total = countResult?.total || 0;

  const sql = `SELECT
    id,
    payment_no AS paymentNo,
    supplier_id AS supplierId,
    supplier_name AS supplierName,
    payment_amount AS paymentAmount,
    payment_method AS paymentMethod,
    payment_date AS paymentDate,
    operator_id AS operatorId,
    remark,
    created_at AS createdAt
  FROM supplier_payment WHERE tenant_id = ? AND supplier_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const offset = (Number(page) - 1) * Number(pageSize);
  const records = await query<any>(sql, [tenantId, id, Number(pageSize), offset]);

  res.json(ok({ records, total, page: Number(page), pageSize: Number(pageSize) }));
}));

supplierRouter.get("/:id/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;
  const { page = 1, pageSize = 20, keyword } = req.query;

  const supplier = await queryOne<any>(
    "SELECT id FROM supplier WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  let sql = `SELECT
    sp.id,
    sp.supplier_id AS supplierId,
    sp.product_id AS productId,
    sp.sku_id AS skuId,
    sp.sku_name AS skuName,
    sp.supply_price AS supplyPrice,
    sp.tax_rate AS taxRate,
    sp.min_order_qty AS minOrderQty,
    sp.status,
    sp.created_at AS createdAt
  FROM supplier_product sp
  WHERE sp.tenant_id = ? AND sp.supplier_id = ?`;
  const params: unknown[] = [tenantId, id];

  if (keyword) {
    sql += " AND (sp.sku_name LIKE ?";
    params.push(`%${keyword}%`);
  }
  sql += " ORDER BY sp.created_at DESC";

  const countSql = `SELECT COUNT(*) as total FROM (${sql}) t`;
  const countResult = await queryOne<any>(countSql, params);
  const total = countResult?.total || 0;

  const offset = (Number(page) - 1) * Number(pageSize);
  sql += " LIMIT ? OFFSET ?";
  params.push(Number(pageSize), offset);
  const records = await query<any>(sql, params);

  res.json(ok({ records, total, page: Number(page), pageSize: Number(pageSize) }));
}));

supplierRouter.get("/:id/stats", requireAuthWithTenant, asyncHandler(async (req, res) => {
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

  const orderStats = await queryOne<any>(
    `SELECT
      COUNT(*) as totalOrders,
      COALESCE(SUM(CASE WHEN order_status = 'PENDING' THEN 1 ELSE 0 END), 0) as pendingOrders,
      COALESCE(SUM(CASE WHEN order_status = 'APPROVED' THEN 1 ELSE 0 END), 0) as approvedOrders,
      COALESCE(SUM(payable_amount), 0) as totalAmount,
      COALESCE(SUM(paid_amount), 0) as paidAmount,
      COALESCE(SUM(unpaid_amount), 0) as unpaidAmount
    FROM purchase_order WHERE tenant_id = ? AND supplier_id = ?`,
    [tenantId, id]
  );

  const productCount = await queryOne<any>(
    "SELECT COUNT(*) as productCount FROM supplier_product WHERE tenant_id = ? AND supplier_id = ? AND status = 1",
    [tenantId, id]
  );

  res.json(ok({
    totalOrders: orderStats?.totalOrders || 0,
    pendingOrders: orderStats?.pendingOrders || 0,
    approvedOrders: orderStats?.approvedOrders || 0,
    totalAmount: Number(orderStats?.totalAmount || 0),
    paidAmount: Number(orderStats?.paidAmount || 0),
    unpaidAmount: Number(orderStats?.unpaidAmount || 0),
    productCount: productCount?.productCount || 0,
  }));
}));
