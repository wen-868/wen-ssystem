import { z } from "zod";
import { ok, fail } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import { saleReturnService } from "../../services/sale-return.service";
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

/** 退货单列表（分页） */
export async function listSaleReturns(req: any, res: any) {
  const { storeId, customerId, status, startDate, endDate, keyword, page = 1, pageSize = 20 } = req.query;
  const ctx = getServiceContext(req);
  const result = await saleReturnService.getPageList(
    keyword as string | undefined,
    storeId ? Number(storeId) : undefined,
    customerId ? Number(customerId) : undefined,
    status as string | undefined,
    startDate as string | undefined,
    endDate as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );
  res.json(ok(result));
}

/** 退货单详情 */
export async function getSaleReturnDetail(req: any, res: any) {
  const { returnNo } = req.params;
  const ctx = getServiceContext(req);
  const returnOrder = await saleReturnService.getDetail(returnNo, ctx);
  if (!returnOrder) {
    res.status(404).json(fail("退货单不存在", "404"));
    return;
  }
  res.json(ok(returnOrder));
}

/** 创建退货单 */
export async function createSaleReturn(req: any, res: any) {
  const body = z.object({
    sourceBillNo: z.string().max(64).optional(),
    storeId: z.number().int().positive(),
    customerId: z.number().int().positive().optional(),
    customerName: z.string().max(64).optional(),
    customerMobile: z.string().max(20).optional(),
    discountAmount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      reason: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);
  const ctx = getServiceContext(req);
  const result = await saleReturnService.createReturn(body, ctx);
  res.json(ok(result));
}

/** 审核退货单 */
export async function approveSaleReturn(req: any, res: any) {
  const { returnNo } = req.params;
  const ctx = getServiceContext(req);
  const result = await saleReturnService.approve(returnNo, ctx);
  if (!result) {
    throw new AppError("退货单不存在", 404);
  }
  res.json(ok(result));
}

export async function rejectSaleReturn(req: any, res: any) {
  const { returnNo } = req.params;
  const ctx = getServiceContext(req);
  const result = await saleReturnService.reject(returnNo, ctx);
  if (!result) {
    throw new AppError("退货单不存在", 404);
  }
  res.json(ok(result));
}

/** 退货退款 */
export async function refundSaleReturn(req: any, res: any) {
  const { returnNo } = req.params;
  const ctx = getServiceContext(req);
  const body = z.object({
    refundMethod: z.enum(["CASH", "WECHAT", "BANK"]),
  }).parse(req.body);
  const result = await saleReturnService.refund(returnNo, body, ctx);
  if (!result) {
    throw new AppError("退货单不存在", 404);
  }
  res.json(ok(result));
}

/** 获取销售单（退货关联） */
export async function getSaleBillForReturn(req: any, res: any) {
  const { billNo } = req.params;
  const ctx = getServiceContext(req);
  const bill = await saleReturnService.getSaleBill(billNo, ctx);
  if (!bill) {
    res.status(404).json(fail("销售单不存在", "404"));
    return;
  }
  res.json(ok(bill));
}
