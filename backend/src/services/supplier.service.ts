import { BaseService } from "./base.service.js";
import { supplierDAO } from "../daos/supplier.dao.js";
import type { ServiceContext, PageResult, PageParams } from "../types/index.js";
import type {
  Supplier,
  SupplierContact,
  SupplierListVO,
  SupplierDetailVO,
  SupplierStatsVO,
  CreateSupplierDTO,
  UpdateSupplierDTO,
  CreateContactDTO,
} from "../models/supplier.model.js";
import { makeBizNo } from "../shared/id.js";
import { transaction, query } from "../shared/db.js";

class SupplierService extends BaseService<Supplier> {
  constructor() {
    super(supplierDAO);
  }

  async getPageList(
    keyword: string | undefined,
    supplyType: string | undefined,
    status: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<SupplierListVO>> {
    const pageParams: PageParams = { page, pageSize };
    const statusNum = status !== undefined ? Number(status) : undefined;
    return supplierDAO.findPageWithContact(keyword, supplyType, statusNum, pageParams, ctx.tenantId);
  }

  async getDetail(id: number, ctx: ServiceContext): Promise<SupplierDetailVO | null> {
    const supplier = await supplierDAO.findDetail(id, ctx.tenantId);
    if (!supplier) return null;

    const contacts = await supplierDAO.findContacts(id);
    return { ...supplier, contacts: contacts.map(c => ({ ...c, isPrimary: !!c.isPrimary })) };
  }

  async create(dto: CreateSupplierDTO, ctx: ServiceContext): Promise<{ id: number; supplierCode: string }> {
    const supplierCode = makeBizNo("GYS");
    let supplierId = 0;

    await transaction(async (conn) => {
      const insertData = { ...dto, supplierCode };
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
      supplierId = (result as any).insertId;

      if (dto.contactPerson) {
        await conn.execute(
          `INSERT INTO supplier_contact (supplier_id, name, mobile, phone, is_primary, position) VALUES (?, ?, ?, ?, 1, '联系人')`,
          [supplierId, dto.contactPerson, dto.contactMobile || null, dto.contactPhone || null]
        );
      }

      await conn.execute(
        `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["supplier", "CREATE", String(supplierId), "supplier", ctx.userId, ctx.username, `创建供应商: ${dto.name}`, ctx.tenantId]
      );
    });

    return { id: supplierId, supplierCode };
  }

  async update(id: number, dto: UpdateSupplierDTO, ctx: ServiceContext): Promise<boolean> {
    const existing = await supplierDAO.findById(id, ctx.tenantId);
    if (!existing) return false;

    const affected = await supplierDAO.updateSupplier(id, dto, ctx.tenantId);

    if (affected > 0) {
      await query(
        `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["supplier", "UPDATE", String(id), "supplier", ctx.userId, ctx.username, `修改供应商: ${dto.name || id}`, ctx.tenantId]
      );
    }

    return affected > 0;
  }

  async addContact(supplierId: number, dto: CreateContactDTO, ctx: ServiceContext): Promise<{ id: number } | null> {
    const supplier = await supplierDAO.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    if (dto.isPrimary) {
      await supplierDAO.clearPrimaryContact(supplierId);
    }

    const contactId = await supplierDAO.insertContact(dto, supplierId);

    await query(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["supplier", "ADD_CONTACT", String(contactId), "supplier_contact", ctx.userId, ctx.username, `添加联系人: ${dto.name}`, ctx.tenantId]
    );

    return { id: contactId };
  }

  async deleteContact(supplierId: number, contactId: number, ctx: ServiceContext): Promise<boolean | null> {
    const supplier = await supplierDAO.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    const contact = await supplierDAO.findContact(contactId, supplierId);
    if (!contact) return false;

    await supplierDAO.deleteContact(contactId);

    await query(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["supplier", "DELETE_CONTACT", String(contactId), "supplier_contact", ctx.userId, ctx.username, `删除联系人: ${contact.name}`, ctx.tenantId]
    );

    return true;
  }

  async getStats(supplierId: number, ctx: ServiceContext): Promise<SupplierStatsVO | null> {
    const supplier = await supplierDAO.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    return supplierDAO.getStats(supplierId, ctx.tenantId);
  }

  async getPurchaseOrders(
    supplierId: number,
    status: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any> | null> {
    const supplier = await supplierDAO.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    return supplierDAO.getPurchaseOrders(supplierId, status, { page, pageSize }, ctx.tenantId);
  }

  async getPayments(
    supplierId: number,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any> | null> {
    const supplier = await supplierDAO.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    return supplierDAO.getPayments(supplierId, { page, pageSize }, ctx.tenantId);
  }

  async getProducts(
    supplierId: number,
    keyword: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any> | null> {
    const supplier = await supplierDAO.findById(supplierId, ctx.tenantId);
    if (!supplier) return null;

    return supplierDAO.getProducts(supplierId, keyword, { page, pageSize }, ctx.tenantId);
  }
}

export const supplierService = new SupplierService();
