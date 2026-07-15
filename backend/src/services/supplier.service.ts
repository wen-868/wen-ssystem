import { query, queryOne, transaction, queryWithTenant, queryOneWithTenant } from "../shared/db";
import { makeBizNo } from "../shared/id";
import type { ServiceContext, PageResult, PageParams } from "../types/index";

// ========== Type Definitions (replacing deleted models/supplier.model.ts) ==========

export interface Supplier {
  id: number;
  supplier_code: string;
  name: string;
  short_name: string | null;
  category: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  credit_level: string;
  settlement_type: string;
  settlement_day: number | null;
  tax_rate: number;
  bank_name: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
  status: number;
  remark: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierContact {
  id: number;
  supplier_id: number;
  name: string;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  wechat: string | null;
  is_primary: number;
  isPrimary?: boolean;
  position: string | null;
  remark: string | null;
  created_at: string;
}

export interface SupplierListVO {
  id: number;
  supplierCode: string;
  name: string;
  shortName: string | null;
  supplyType: string | null;
  contactPerson: string | null;
  contactMobile: string | null;
  status: number;
  creditLevel: string;
  province: string | null;
  city: string | null;
  district: string | null;
  createdAt: string;
}

export interface SupplierDetailVO {
  id: number;
  supplierCode: string;
  name: string;
  shortName: string | null;
  supplyType: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  creditLevel: string;
  settlementType: string;
  settlementDay: number | null;
  taxRate: number;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  status: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: SupplierContact[];
}

export interface SupplierStatsVO {
  orderCount: number;
  totalAmount: number;
}

export interface CreateSupplierDTO {
  name: string;
  shortName?: string;
  supplyType?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  creditLevel?: string;
  settlementType?: "CASH" | "MONTHLY" | "QUARTERLY";
  settlementDay?: number;
  taxRate?: number;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  remark?: string;
  contactPerson?: string;
  contactMobile?: string;
  contactPhone?: string;
}

export interface UpdateSupplierDTO {
  name?: string;
  shortName?: string;
  supplyType?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  creditLevel?: string;
  settlementType?: "CASH" | "MONTHLY" | "QUARTERLY";
  settlementDay?: number;
  taxRate?: number;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  status?: number;
  remark?: string;
}

export interface CreateContactDTO {
  name: string;
  mobile?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  isPrimary?: boolean;
  position?: string;
  remark?: string;
}

// ========== Helper functions ==========

interface FieldMapping {
  [key: string]: string;
}

const SUPPLIER_FIELD_MAP: FieldMapping = {
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

function mapSupplierRow(row: any): SupplierListVO {
  return {
    id: row.id,
    supplierCode: row.supplier_code,
    name: row.name,
    shortName: row.short_name,
    supplyType: row.category,
    contactPerson: row.contact_person ?? null,
    contactMobile: row.contact_mobile ?? null,
    status: row.status,
    creditLevel: row.credit_level,
    province: row.province,
    city: row.city,
    district: row.district,
    createdAt: row.created_at,
  };
}

function mapSupplierDetailRow(row: any): SupplierDetailVO {
  return {
    id: row.id,
    supplierCode: row.supplier_code,
    name: row.name,
    shortName: row.short_name,
    supplyType: row.category,
    province: row.province,
    city: row.city,
    district: row.district,
    address: row.address,
    creditLevel: row.credit_level,
    settlementType: row.settlement_type,
    settlementDay: row.settlement_day,
    taxRate: row.tax_rate,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    bankAccountName: row.bank_account_name,
    status: row.status,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contacts: [],
  };
}

function mapContactRow(row: any): SupplierContact {
  return {
    id: row.id,
    supplier_id: row.supplier_id,
    name: row.name,
    mobile: row.mobile,
    phone: row.phone,
    email: row.email,
    wechat: row.wechat,
    is_primary: row.is_primary,
    isPrimary: !!row.is_primary,
    position: row.position,
    remark: row.remark,
    created_at: row.created_at,
  };
}

// ========== Service ==========

class SupplierService {
  // ---- 供应商查询 ----

  async getPageList(
    keyword: string | undefined,
    supplyType: string | undefined,
    status: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<SupplierListVO>> {
    const conditions: string[] = ["s.tenant_id = ?"];
    const params: unknown[] = [ctx.tenantId];

    if (keyword) {
      conditions.push("(s.name LIKE ? OR s.supplier_code LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (supplyType) {
      conditions.push("s.category = ?");
      params.push(supplyType);
    }
    if (status !== undefined) {
      conditions.push("s.status = ?");
      params.push(Number(status));
    }

    const whereClause = conditions.join(" AND ");
    const offset = (page - 1) * pageSize;

    const [countRows, dataRows] = await Promise.all([
      queryWithTenant<{ total: number }>(
        `SELECT COUNT(*) AS total FROM supplier s WHERE ${whereClause}`,
        params,
        ctx.tenantId
      ),
      queryWithTenant<any>(
        `SELECT s.*, sc.name AS contact_person, sc.mobile AS contact_mobile
         FROM supplier s
         LEFT JOIN t_supplier_contact sc ON s.id = sc.supplier_id AND sc.is_primary = 1
         WHERE ${whereClause}
         ORDER BY s.id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
        ctx.tenantId
      ),
    ]);

    return {
      records: dataRows.map(mapSupplierRow),
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    };
  }

  async getDetail(id: number, ctx: ServiceContext): Promise<SupplierDetailVO | null> {
    const supplier = await queryOneWithTenant<any>(
      "SELECT * FROM supplier WHERE id = ? AND tenant_id = ?",
      [id, ctx.tenantId],
      ctx.tenantId
    );
    if (!supplier) return null;

    const contacts = await query<any>(
      "SELECT * FROM t_supplier_contact WHERE supplier_id = ? AND tenant_id = ? ORDER BY is_primary DESC, id ASC",
      [id, ctx.tenantId]
    );

    const result = mapSupplierDetailRow(supplier);
    result.contacts = contacts.map(mapContactRow);
    return result;
  }

  async findById(id: number, tenantId: string): Promise<Supplier | null> {
    return queryOneWithTenant<Supplier>(
      "SELECT * FROM supplier WHERE id = ? AND tenant_id = ?",
      [id, tenantId],
      tenantId
    );
  }

  // ---- 供应商增删改 ----

  async create(dto: CreateSupplierDTO, ctx: ServiceContext): Promise<{ id: number; supplierCode: string }> {
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
          supplierCode, dto.name, dto.shortName || null, dto.supplyType || null,
          dto.province || null, dto.city || null, dto.district || null, dto.address || null,
          dto.creditLevel || "B", dto.settlementType || "CASH", dto.settlementDay || null,
          dto.taxRate ?? 0, dto.bankName || null, dto.bankAccount || null,
          dto.bankAccountName || null, dto.remark || null, ctx.tenantId
        ]
      );
      supplierId = (result as unknown as unknown as { insertId: number }).insertId;

      if (dto.contactPerson) {
        await conn.execute(
          "INSERT INTO t_supplier_contact (supplier_id, name, mobile, phone, is_primary, position) VALUES (?, ?, ?, ?, 1, '联系人')",
          [supplierId, dto.contactPerson, dto.contactMobile || null, dto.contactPhone || null]
        );
      }

      await conn.execute(
        "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["supplier", "CREATE", String(supplierId), "supplier", ctx.userId, ctx.username, `创建供应商: ${dto.name}`, ctx.tenantId]
      );
    });

    return { id: supplierId, supplierCode };
  }

  async update(id: number, dto: UpdateSupplierDTO, ctx: ServiceContext): Promise<boolean> {
    const existing = await this.findById(id, ctx.tenantId);
    if (!existing) return false;

    const updates: string[] = [];
    const params: unknown[] = [];

    for (const [dtoKey, dbCol] of Object.entries(SUPPLIER_FIELD_MAP)) {
      if (dtoKey in dto && (dto as Record<string, unknown>)[dtoKey] !== undefined) {
        updates.push(`${dbCol} = ?`);
        params.push((dto as Record<string, unknown>)[dtoKey]);
      }
    }

    if (updates.length === 0) return true;

    updates.push("updated_at = NOW()");
    params.push(id, ctx.tenantId);

    const [result] = await queryWithTenant<any>(
      `UPDATE supplier SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      params,
      ctx.tenantId
    );

    const affected = result?.affectedRows ?? 0;

    if (affected > 0) {
      await queryWithTenant(
        "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["supplier", "UPDATE", String(id), "supplier", ctx.userId, ctx.username, `修改供应商: ${dto.name || id}`, ctx.tenantId],
        ctx.tenantId
      );
    }

    return affected > 0;
  }

  // ---- 联系人管理 ----

  async addContact(supplierId: number, dto: CreateContactDTO, ctx: ServiceContext): Promise<{ id: number } | null> {
    const supplier = await this.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    if (dto.isPrimary) {
      await query(
        "UPDATE t_supplier_contact SET is_primary = 0 WHERE supplier_id = ? AND tenant_id = ?",
        [supplierId, ctx.tenantId]
      );
    }

    const [result] = await query<any>(
      `INSERT INTO t_supplier_contact (supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplierId,
        dto.name,
        dto.mobile || null,
        dto.phone || null,
        dto.email || null,
        dto.wechat || null,
        dto.isPrimary ? 1 : 0,
        dto.position || null,
        dto.remark || null,
        ctx.tenantId,
      ]
    );

    const contactId = result?.insertId ?? 0;

    await queryWithTenant(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["supplier", "ADD_CONTACT", String(contactId), "supplier_contact", ctx.userId, ctx.username, `添加联系人: ${dto.name}`, ctx.tenantId],
      ctx.tenantId
    );

    return { id: contactId };
  }

  async deleteContact(supplierId: number, contactId: number, ctx: ServiceContext): Promise<boolean | null> {
    const supplier = await this.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    const contact = await queryOne<SupplierContact>(
      "SELECT * FROM t_supplier_contact WHERE id = ? AND supplier_id = ? AND tenant_id = ?",
      [contactId, supplierId, ctx.tenantId]
    );
    if (!contact) return false;

    await query(
      "DELETE FROM t_supplier_contact WHERE id = ? AND tenant_id = ?",
      [contactId, ctx.tenantId]
    );

    await queryWithTenant(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["supplier", "DELETE_CONTACT", String(contactId), "supplier_contact", ctx.userId, ctx.username, `删除联系人: ${contact.name}`, ctx.tenantId],
      ctx.tenantId
    );

    return true;
  }

  // ---- 供应商统计 ----

  async getStats(supplierId: number, ctx: ServiceContext): Promise<SupplierStatsVO | null> {
    const supplier = await this.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    const rows = await queryWithTenant<{ orderCount: number; totalAmount: number }>(
      `SELECT COUNT(*) AS orderCount, COALESCE(SUM(payable_amount), 0) AS totalAmount
       FROM t_purchase_order
       WHERE supplier_id = ? AND tenant_id = ?`,
      [supplierId, ctx.tenantId],
      ctx.tenantId
    );

    return {
      orderCount: Number(rows[0]?.orderCount ?? 0),
      totalAmount: Number(rows[0]?.totalAmount ?? 0),
    };
  }

  // ---- 采购订单 ----

  async getPurchaseOrders(
    supplierId: number,
    status: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any> | null> {
    const supplier = await this.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    const conditions: string[] = ["supplier_id = ?", "tenant_id = ?"];
    const params: unknown[] = [supplierId, ctx.tenantId];

    if (status) {
      conditions.push("order_status = ?");
      params.push(status);
    }

    const whereClause = conditions.join(" AND ");
    const offset = (page - 1) * pageSize;

    const [countRows, dataRows] = await Promise.all([
      queryWithTenant<{ total: number }>(
        `SELECT COUNT(*) AS total FROM t_purchase_order WHERE ${whereClause}`,
        params,
        ctx.tenantId
      ),
      queryWithTenant<any>(
        `SELECT * FROM t_purchase_order WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
        ctx.tenantId
      ),
    ]);

    return {
      records: dataRows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    };
  }

  // ---- 付款记录 ----

  async getPayments(
    supplierId: number,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any> | null> {
    const supplier = await this.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    const offset = (page - 1) * pageSize;

    const [countRows, dataRows] = await Promise.all([
      queryWithTenant<{ total: number }>(
        "SELECT COUNT(*) AS total FROM t_purchase_payment WHERE supplier_id = ? AND tenant_id = ?",
        [supplierId, ctx.tenantId],
        ctx.tenantId
      ),
      queryWithTenant<any>(
        `SELECT * FROM t_purchase_payment WHERE supplier_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [supplierId, ctx.tenantId, pageSize, offset],
        ctx.tenantId
      ),
    ]);

    return {
      records: dataRows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    };
  }

  // ---- 供应产品 ----

  async getProducts(
    supplierId: number,
    keyword: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any> | null> {
    const supplier = await this.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    const conditions: string[] = ["po.supplier_id = ?", "po.tenant_id = ?"];
    const params: unknown[] = [supplierId, ctx.tenantId];

    if (keyword) {
      conditions.push("(poi.sku_name LIKE ? OR poi.barcode LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = conditions.join(" AND ");
    const offset = (page - 1) * pageSize;

    const [countRows, dataRows] = await Promise.all([
      queryWithTenant<{ total: number }>(
        `SELECT COUNT(DISTINCT poi.sku_id) AS total
         FROM t_purchase_order po
         JOIN t_purchase_order_item poi ON po.order_no = poi.order_no
         WHERE ${whereClause}`,
        params,
        ctx.tenantId
      ),
      queryWithTenant<any>(
        `SELECT DISTINCT poi.sku_id, poi.sku_name, poi.barcode
         FROM t_purchase_order po
         JOIN t_purchase_order_item poi ON po.order_no = poi.order_no
         WHERE ${whereClause}
         ORDER BY poi.sku_name ASC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
        ctx.tenantId
      ),
    ]);

    return {
      records: dataRows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    };
  }
}

export const supplierService = new SupplierService();