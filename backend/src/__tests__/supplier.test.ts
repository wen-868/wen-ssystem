import { beforeEach, describe, expect, it } from "vitest";
import { mockQuery, mockExecute, resetMockDb } from "../shared/mock-db.js";
import { makeBizNo } from "../shared/id.js";

async function createSupplier(input: {
  supplierName: string; contactPhone?: string; address?: string;
  taxNo?: string; bankName?: string; bankAccount?: string;
  creditLimit?: number; creditDays?: number; settlementCycle?: string;
  supplierType?: string; levelCode?: string | null; remark?: string;
}) {
  if (!input.supplierName) throw new Error("供应商名称不能为空");
  if (input.creditLimit != null && input.creditLimit < 0) throw new Error("信用额度不能为负");
  if (input.creditDays != null && input.creditDays < 0) throw new Error("账期不能为负");
  const supplierCode = makeBizNo("SUP");
  await mockExecute(
    `INSERT INTO supplier (supplier_code, supplier_name, contact_name, contact_phone, address, tax_no, bank_name, bank_account, credit_limit, credit_days, settlement_cycle, supplier_type, level_code, remark, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      supplierCode, input.supplierName, null, input.contactPhone ?? null, input.address ?? null,
      input.taxNo ?? null, input.bankName ?? null, input.bankAccount ?? null,
      Number(input.creditLimit ?? 0), Number(input.creditDays ?? 30),
      input.settlementCycle ?? "MONTHLY", input.supplierType ?? "BRAND",
      input.levelCode ?? null, input.remark ?? null, "ACTIVE"
    ]
  );
  const rows = await mockQuery<any>(
    `SELECT id, supplier_code AS supplierCode, supplier_name AS supplierName, contact_phone AS contactPhone, credit_limit AS creditLimit, credit_days AS creditDays, supplier_type AS supplierType, status FROM supplier WHERE supplier_code = ?`,
    [supplierCode]
  );
  return rows[0];
}

async function updateSupplier(id: number, patch: { contactPhone?: string; creditLimit?: number; supplierType?: string; status?: string }) {
  const original = await mockQuery<any>(`SELECT id, contact_phone AS contactPhone, credit_limit AS creditLimit, supplier_type AS supplierType, status FROM supplier WHERE id = ?`, [id]);
  if (original.length === 0) throw new Error("供应商不存在");
  if (patch.creditLimit != null && patch.creditLimit < 0) throw new Error("信用额度不能为负");
  await mockExecute(
    `UPDATE supplier SET contact_phone = ?, credit_limit = ?, supplier_type = ?, status = ? WHERE id = ?`,
    [patch.contactPhone ?? original[0].contactPhone, patch.creditLimit ?? original[0].creditLimit, patch.supplierType ?? original[0].supplierType, patch.status ?? original[0].status, id]
  );
  const rows = await mockQuery<any>(`SELECT id, supplier_code AS supplierCode, contact_phone AS contactPhone, credit_limit AS creditLimit, supplier_type AS supplierType, status FROM supplier WHERE id = ?`, [id]);
  return rows[0];
}

async function addSupplierContact(supplierId: number, contact: { contactName: string; contactPhone?: string; contactRole?: string; contactEmail?: string; isPrimary?: number }) {
  if (!contact.contactName) throw new Error("联系人姓名不能为空");
  const suppliers = await mockQuery<any>(`SELECT id FROM supplier WHERE id = ?`, [supplierId]);
  if (suppliers.length === 0) throw new Error("供应商不存在");
  await mockExecute(
    `INSERT INTO supplier_contact (supplier_id, contact_name, contact_role, contact_phone, contact_email, is_primary) VALUES (?,?,?,?,?,?)`,
    [supplierId, contact.contactName, contact.contactRole ?? null, contact.contactPhone ?? null, contact.contactEmail ?? null, Number(contact.isPrimary ?? 0)]
  );
  return mockQuery<any>(`SELECT id, supplier_id AS supplierId, contact_name AS contactName, is_primary AS isPrimary FROM supplier_contact WHERE supplier_id = ?`, [supplierId]);
}

describe("供应商管理", () => {
  beforeEach(() => resetMockDb());

  it("创建供应商 - 正常流程：生成唯一编码 + 保存基本信息", async () => {
    const supplier = await createSupplier({
      supplierName: "测试白酒供应商A",
      contactPhone: "13800000001",
      address: "成都市高新区",
      creditLimit: 50000,
      creditDays: 30,
      supplierType: "BRAND",
      remark: "新增测试"
    });
    expect(supplier).toBeDefined();
    expect(supplier.supplierCode).toMatch(/^SUP\d{14}[A-F0-9]{6}$/);
    expect(supplier.supplierType).toBe("BRAND");
    expect(Number(supplier.creditLimit)).toBe(50000);
    expect(String(supplier.status)).toBe("ACTIVE");
  });

  it("创建供应商 - 边界值：信用额度为 0 应允许", async () => {
    const supplier = await createSupplier({ supplierName: "零额度供应商", creditLimit: 0 });
    expect(Number(supplier.creditLimit)).toBe(0);
  });

  it("创建供应商 - 异常：供应商名称为空应拒绝", async () => {
    await expect(createSupplier({ supplierName: "" })).rejects.toThrow(/不能为空/);
  });

  it("创建供应商 - 异常：信用额度为负应拒绝", async () => {
    await expect(createSupplier({ supplierName: "异常", creditLimit: -100 })).rejects.toThrow(/信用额度/);
  });

  it("创建供应商 - 多次创建：编码不重复且均以 SUP 开头", async () => {
    const a = await createSupplier({ supplierName: "编码校验供应商1" });
    const b = await createSupplier({ supplierName: "编码校验供应商2" });
    expect(a.supplierCode).not.toBe(b.supplierCode);
    expect(a.supplierCode.slice(0, 3)).toBe("SUP");
    expect(b.supplierCode.slice(0, 3)).toBe("SUP");
  });

  it("更新供应商 - 正常：可修改联系电话与额度", async () => {
    const created = await createSupplier({ supplierName: "待更新供应商", contactPhone: "000-0000" });
    const updated = await updateSupplier(created.id, { contactPhone: "13900000001", creditLimit: 80000 });
    expect(updated.contactPhone).toBe("13900000001");
    expect(Number(updated.creditLimit)).toBe(80000);
  });

  it("更新供应商 - 异常：额度为负应拒绝", async () => {
    const created = await createSupplier({ supplierName: "异常测试供应商" });
    await expect(updateSupplier(created.id, { creditLimit: -500 })).rejects.toThrow();
  });

  it("供应商状态切换：INACTIVE 状态应持久化", async () => {
    const created = await createSupplier({ supplierName: "状态切换供应商" });
    const updated = await updateSupplier(created.id, { status: "INACTIVE" });
    expect(updated.status).toBe("INACTIVE");
  });

  it("供应商联系人 - 正常：可新增多个联系人并查询", async () => {
    const created = await createSupplier({ supplierName: "联系人测试供应商" });
    await addSupplierContact(created.id, { contactName: "张经理", contactPhone: "13700000001", isPrimary: 1 });
    const all = await addSupplierContact(created.id, { contactName: "李助理", contactEmail: "li@example.com" });
    expect(all.length).toBe(2);
    expect(all.find((c: any) => Number(c.isPrimary) === 1)).toBeDefined();
  });

  it("供应商联系人 - 异常：供应商不存在时拒绝", async () => {
    await expect(addSupplierContact(9999999, { contactName: "幽灵" })).rejects.toThrow();
  });

  it("供应商联系人 - 异常：联系人姓名不能为空", async () => {
    const created = await createSupplier({ supplierName: "联系人异常测试" });
    await expect(addSupplierContact(created.id, { contactName: "" })).rejects.toThrow();
  });
});
