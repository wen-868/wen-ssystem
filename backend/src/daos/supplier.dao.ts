import { BaseDAO } from "./base.dao.js";
import { query, queryOne } from "../shared/db.js";
import type { Supplier, SupplierContact, SupplierListVO, SupplierStatsVO } from "../models/supplier.model.js";
import type { PageParams, PageResult } from "../types/index.js";

const SUPPLIER_FIELDS = `
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
  s.updated_at AS updatedAt
`;

const CONTACT_FIELDS = `
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
`;

export class SupplierDAO extends BaseDAO<Supplier> {
  constructor() {
    super({ tableName: "supplier", primaryKey: "id" });
  }

  async findPageWithContact(
    keyword: string | undefined,
    supplyType: string | undefined,
    status: number | undefined,
    pageParams: PageParams,
    tenantId: string
  ): Promise<PageResult<SupplierListVO>> {
    const where: string[] = ["s.tenant_id = ?"];
    const params: any[] = [tenantId];

    if (keyword) {
      where.push("(s.name LIKE ? OR s.short_name LIKE ? OR s.supplier_code LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (supplyType) {
      where.push("s.category = ?");
      params.push(supplyType);
    }
    if (status !== undefined) {
      where.push("s.status = ?");
      params.push(status);
    }

    const whereSql = where.join(" AND ");

    const countSql = `SELECT COUNT(*) as total FROM supplier s WHERE ${whereSql}`;
    const countResult = await queryOne<{ total: number }>(countSql, params);
    const total = Number(countResult?.total || 0);

    const offset = (pageParams.page - 1) * pageParams.pageSize;
    const dataSql = `SELECT
      ${SUPPLIER_FIELDS},
      sc.name AS contactPerson,
      sc.mobile AS phone
    FROM supplier s
    LEFT JOIN supplier_contact sc ON sc.supplier_id = s.id AND sc.is_primary = 1
    WHERE ${whereSql}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?`;

    const records = await query<SupplierListVO>(dataSql, [...params, pageParams.pageSize, offset]);

    return {
      records,
      total,
      page: pageParams.page,
      pageSize: pageParams.pageSize,
    };
  }

  async findDetail(id: number, tenantId: string): Promise<Supplier | null> {
    const sql = `SELECT ${SUPPLIER_FIELDS} FROM supplier s WHERE s.id = ? AND s.tenant_id = ?`;
    return queryOne<Supplier>(sql, [id, tenantId]);
  }

  async findContacts(supplierId: number): Promise<SupplierContact[]> {
    const sql = `SELECT ${CONTACT_FIELDS} FROM supplier_contact 
                 WHERE supplier_id = ? 
                 ORDER BY is_primary DESC, created_at DESC`;
    return query<SupplierContact>(sql, [supplierId]);
  }

  async insertSupplier(data: Record<string, any>, tenantId: string): Promise<number> {
    const fields: string[] = ["supplier_code", "tenant_id"];
    const values: any[] = [data.supplierCode, tenantId];
    const placeholders: string[] = ["?", "?"];

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
      remark: "remark",
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(dbField);
        values.push(data[key]);
        placeholders.push("?");
      }
    }

    const sql = `INSERT INTO supplier (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
    const result = await query(sql, values);
    return (result as any).insertId;
  }

  async updateSupplier(id: number, data: Record<string, any>, tenantId: string): Promise<number> {
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

    const sets: string[] = [];
    const params: any[] = [];

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        sets.push(`${dbField} = ?`);
        params.push(data[key]);
      }
    }

    if (sets.length === 0) return 0;

    sets.push("updated_at = NOW()");
    params.push(id, tenantId);

    const sql = `UPDATE supplier SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`;
    const result = await query(sql, params);
    return (result as any).affectedRows || 0;
  }

  async insertContact(data: Record<string, any>, supplierId: number): Promise<number> {
    const fields: string[] = ["supplier_id"];
    const values: any[] = [supplierId];
    const placeholders: string[] = ["?"];

    const fieldMap: Record<string, string> = {
      name: "name",
      mobile: "mobile",
      phone: "phone",
      email: "email",
      wechat: "wechat",
      isPrimary: "is_primary",
      position: "position",
      remark: "remark",
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(dbField);
        const val = key === "isPrimary" ? (data[key] ? 1 : 0) : data[key];
        values.push(val);
        placeholders.push("?");
      }
    }

    const sql = `INSERT INTO supplier_contact (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
    const result = await query(sql, values);
    return (result as any).insertId;
  }

  async clearPrimaryContact(supplierId: number): Promise<void> {
    await query("UPDATE supplier_contact SET is_primary = 0 WHERE supplier_id = ?", [supplierId]);
  }

  async findContact(contactId: number, supplierId: number): Promise<SupplierContact | null> {
    const sql = `SELECT ${CONTACT_FIELDS} FROM supplier_contact WHERE id = ? AND supplier_id = ?`;
    return queryOne<SupplierContact>(sql, [contactId, supplierId]);
  }

  async deleteContact(contactId: number): Promise<number> {
    const result = await query("DELETE FROM supplier_contact WHERE id = ?", [contactId]);
    return (result as any).affectedRows || 0;
  }

  async getStats(supplierId: number, tenantId: string): Promise<SupplierStatsVO> {
    const orderSql = `SELECT
      COUNT(*) as totalOrders,
      COALESCE(SUM(CASE WHEN order_status = 'PENDING' THEN 1 ELSE 0 END), 0) as pendingOrders,
      COALESCE(SUM(CASE WHEN order_status = 'APPROVED' THEN 1 ELSE 0 END), 0) as approvedOrders,
      COALESCE(SUM(payable_amount), 0) as totalAmount,
      COALESCE(SUM(paid_amount), 0) as paidAmount,
      COALESCE(SUM(unpaid_amount), 0) as unpaidAmount
    FROM purchase_order WHERE tenant_id = ? AND supplier_id = ?`;

    const orderStats = await queryOne<any>(orderSql, [tenantId, supplierId]);

    const productSql = `SELECT COUNT(*) as productCount FROM supplier_product 
                        WHERE tenant_id = ? AND supplier_id = ? AND status = 1`;
    const productStats = await queryOne<any>(productSql, [tenantId, supplierId]);

    return {
      totalOrders: Number(orderStats?.totalOrders || 0),
      pendingOrders: Number(orderStats?.pendingOrders || 0),
      approvedOrders: Number(orderStats?.approvedOrders || 0),
      totalAmount: Number(orderStats?.totalAmount || 0),
      paidAmount: Number(orderStats?.paidAmount || 0),
      unpaidAmount: Number(orderStats?.unpaidAmount || 0),
      productCount: Number(productStats?.productCount || 0),
    };
  }
}

export const supplierDAO = new SupplierDAO();
