import { z } from "zod";
import { ok, fail } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import { purchaseService } from "../../services/purchase.service";
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

/** 采购订单列表（分页） */
export async function listPurchaseOrders(req: any, res: any) {
  const { supplierId, status, startDate, endDate, keyword, page = 1, pageSize = 20 } = req.query;
  const ctx = getServiceContext(req);
  const result = await purchaseService.getPageList(
    keyword as string | undefined,
    supplierId ? Number(supplierId) : undefined,
    status as string | undefined,
    startDate as string | undefined,
    endDate as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );
  res.json(ok(result));
}

/** 采购订单详情 */
export async function getPurchaseOrderDetail(req: any, res: any) {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);
  const order = await purchaseService.getDetail(orderNo, ctx);
  if (!order) {
    res.status(404).json(fail("采购订单不存在", "404"));
    return;
  }
  res.json(ok(order));
}

/** 创建采购订单 */
export async function createPurchaseOrder(req: any, res: any) {
  const body = z.object({
    supplierId: z.number().int().positive(),
    supplierName: z.string().min(1).max(128),
    storeId: z.number().int().positive(),
    expectedDate: z.string().optional(),
    discountAmount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      barcode: z.string().max(128).optional(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      taxRate: z.number().min(0).max(1).default(0),
      remark: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);
  const ctx = getServiceContext(req);
  const result = await purchaseService.createOrder(body, ctx);
  res.json(ok(result));
}

/** 提交采购订单 */
export async function submitPurchaseOrder(req: any, res: any) {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);
  const result = await purchaseService.submit(orderNo, ctx);
  if (!result) {
    throw new AppError("采购订单不存在", 404);
  }
  res.json(ok(result));
}

/** 审核采购订单 */
export async function approvePurchaseOrder(req: any, res: any) {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);
  const result = await purchaseService.approve(orderNo, ctx);
  if (!result) {
    throw new AppError("采购订单不存在", 404);
  }
  res.json(ok(result));
}

/** 取消采购订单 */
export async function cancelPurchaseOrder(req: any, res: any) {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);
  const result = await purchaseService.cancel(orderNo, ctx);
  if (!result) {
    throw new AppError("采购订单不存在", 404);
  }
  res.json(ok(result));
}

/** 更新采购订单 */
export async function updatePurchaseOrder(req: any, res: any) {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);
  const body = z.object({
    supplierId: z.number().int().positive().optional(),
    supplierName: z.string().min(1).max(128).optional(),
    expectedDate: z.string().optional(),
    discountAmount: z.number().min(0).optional(),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      barcode: z.string().max(128).optional(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      taxRate: z.number().min(0).max(1).default(0),
      remark: z.string().max(255).optional(),
    })).optional(),
  }).parse(req.body);
  const result = await purchaseService.updateOrder(orderNo, body, ctx);
  if (!result) {
    throw new AppError("采购订单不存在", 404);
  }
  res.json(ok(result));
}

/** 删除采购订单 */
export async function deletePurchaseOrder(req: any, res: any) {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);
  const result = await purchaseService.delete(orderNo, ctx);
  if (!result) {
    throw new AppError("采购订单不存在", 404);
  }
  res.json(ok(result));
}

/** 采购入库 */
export async function purchaseInStock(req: any, res: any) {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);
  const body = z.object({
    warehouseId: z.number().int().positive().optional(),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
    })).min(1),
  }).parse(req.body);
  const result = await purchaseService.inStock(orderNo, body, ctx);
  if (!result) {
    throw new AppError("采购订单不存在", 404);
  }
  res.json(ok(result));
}
