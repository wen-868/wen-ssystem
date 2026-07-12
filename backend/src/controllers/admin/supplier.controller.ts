import { z } from "zod";
import { ok, fail } from "../../shared/response";
import { supplierService } from "../../services/supplier.service";
import type { ServiceContext } from "../../types/index";

/** 从请求中获取服务上下文 */
function getServiceContext(req: any): ServiceContext {
  return {
    tenantId: req.tenantId!,
    userId: req.user!.id,
    username: req.user!.username,
    storeId: req.user!.storeId,
  };
}

/** 供应商列表（分页） */
export async function listSuppliers(req: any, res: any) {
  const { keyword, supplyType, status, page = 1, pageSize = 20 } = req.query;
  const ctx = getServiceContext(req);
  const result = await supplierService.getPageList(
    keyword as string | undefined,
    supplyType as string | undefined,
    status as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );
  res.json(ok(result));
}

/** 供应商详情 */
export async function getSupplierDetail(req: any, res: any) {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const supplier = await supplierService.getDetail(Number(id), ctx);
  if (!supplier) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  res.json(ok(supplier));
}

/** 创建供应商 */
export async function createSupplier(req: any, res: any) {
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
  const ctx = getServiceContext(req);
  const result = await supplierService.create(body, ctx);
  res.json(ok(result));
}

/** 更新供应商 */
export async function updateSupplier(req: any, res: any) {
  const { id } = req.params;
  const ctx = getServiceContext(req);
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
  const success = await supplierService.update(Number(id), body, ctx);
  if (!success) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  res.json(ok({ id: Number(id) }));
}

/** 新增供应商联系人 */
export async function addSupplierContact(req: any, res: any) {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const body = z.object({
    name: z.string().min(1).max(64),
    mobile: z.string().max(20).optional(),
    phone: z.string().max(32).optional(),
    email: z.string().email().max(128).optional(),
    wechat: z.string().max(64).optional(),
    isPrimary: z.boolean().default(false),
    position: z.string().max(64).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);
  const result = await supplierService.addContact(Number(id), body, ctx);
  if (!result) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  res.json(ok(result));
}

/** 删除供应商联系人 */
export async function deleteSupplierContact(req: any, res: any) {
  const { id, contactId } = req.params;
  const ctx = getServiceContext(req);
  const result = await supplierService.deleteContact(Number(id), Number(contactId), ctx);
  if (result === null) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  if (!result) {
    res.status(404).json(fail("联系人不存在", "404"));
    return;
  }
  res.json(ok({ id: Number(contactId) }));
}

/** 供应商采购订单列表 */
export async function getSupplierPurchaseOrders(req: any, res: any) {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const { page = 1, pageSize = 20, status } = req.query;
  const result = await supplierService.getPurchaseOrders(
    Number(id),
    status as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );
  if (!result) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  res.json(ok(result));
}

/** 供应商付款记录 */
export async function getSupplierPayments(req: any, res: any) {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const { page = 1, pageSize = 20 } = req.query;
  const result = await supplierService.getPayments(
    Number(id),
    Number(page),
    Number(pageSize),
    ctx
  );
  if (!result) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  res.json(ok(result));
}

/** 供应商商品列表 */
export async function getSupplierProducts(req: any, res: any) {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const { page = 1, pageSize = 20, keyword } = req.query;
  const result = await supplierService.getProducts(
    Number(id),
    keyword as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );
  if (!result) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  res.json(ok(result));
}

/** 供应商统计 */
export async function getSupplierStats(req: any, res: any) {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const stats = await supplierService.getStats(Number(id), ctx);
  if (!stats) {
    res.status(404).json(fail("供应商不存在", "404"));
    return;
  }
  res.json(ok(stats));
}
