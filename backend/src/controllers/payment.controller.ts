import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import type { WechatPay } from "../shared/wechat-pay.js";
import * as service from "../services/admin/payment.service.js";

export function createPaymentController(wechatPay: WechatPay) {
  const createPaymentOrder = asyncHandler(async (req, res) => {
    const body = z.object({
      sourceType: z.enum(["MINIAPP_ORDER", "SALE_BILL", "COLLECTION_LINK"]),
      sourceNo: z.string(),
      amount: z.number().positive(),
      openid: z.string().optional(),
      description: z.string().optional()
    }).parse(req.body);

    try {
      const result = await service.createPaymentOrder(body, req.tenantId!, wechatPay);
      res.json(ok(result));
    } catch (error) {
      res.status(500).json({ code: "500", message: (error as Error).message });
    }
  });

  const handleWxCallback = asyncHandler(async (req, res) => {
    const headers = req.headers as Record<string, string>;
    const result = await service.handleWxCallback(headers, req.body, wechatPay);

    if (!result.success) {
      res.status(400).json({ code: result.code, message: result.message });
      return;
    }

    res.json({ code: result.code, message: result.message });
  });

  const createRefund = asyncHandler(async (req, res) => {
    const body = z.object({
      payNo: z.string(),
      amount: z.number().positive(),
      reason: z.string()
    }).parse(req.body);

    try {
      const result = await service.createRefund(body, req.tenantId!, wechatPay);

      if (!result.success) {
        res.status(Number(result.code) || 400).json({ code: result.code, message: result.message });
        return;
      }

      res.json(ok(result.data));
    } catch (error) {
      res.status(500).json({ code: "500", message: (error as Error).message });
    }
  });

  const getPaymentOrder = asyncHandler(async (req, res) => {
    const { payNo } = req.params;
    const order = await service.getPaymentOrder(payNo, req.tenantId!);

    if (!order) {
      res.status(404).json({ code: "404", message: "支付订单不存在" });
      return;
    }

    res.json(ok(order));
  });

  const listPaymentOrders = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 20, status } = req.query;
    const orders = await service.listPaymentOrders(
      req.tenantId!,
      Number(page),
      Number(pageSize),
      status as string | undefined
    );
    res.json(ok(orders));
  });

  return {
    createPaymentOrder,
    handleWxCallback,
    createRefund,
    getPaymentOrder,
    listPaymentOrders
  };
}