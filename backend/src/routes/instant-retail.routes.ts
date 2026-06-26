/**
 * ============================================================================
 * 即时零售接口预留模块
 * Instant Retail Interface Stub Module
 * ============================================================================
 *
 * 本模块为酒类库存管理系统的即时零售（O2O）平台接入提供统一的 HTTP 路由层，
 * 涵盖京东秒送、美团外卖、饿了么三大主流平台的订单推送、配置管理和门店操作。
 *
 * 路由分组：
 *   - /webhook/*      : 公开端点，供平台服务器推送调用，无需认证
 *   - /admin/*        : 管理后台端点，需要 requireAuthWithTenant（后台管理员 Token）
 *   - /store/*        : 门店操作端点，需要 storeAuth（门店员工 Token）
 *
 * 架构分层：
 *   - 路由层（本文件）  : 纯委托，只做路由注册和中间件绑定
 *   - Controller 层     : 参数提取、响应封装
 *   - Service 层        : 业务逻辑、数据库查询、Zod 校验
 * ============================================================================
 */

import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/admin/instant-retail.controller.js";

export const instantRetailRouter = Router();

/* ────────────────────────────────────────────────────────────────────────────
 * 门店认证中间件（复用 requireAuthWithTenant 并校验 storeId）
 * ──────────────────────────────────────────────────────────────────────────── */

const storeAuth = (req: any, res: any, next: any) => {
  const handlers = Array.isArray(requireAuthWithTenant) ? requireAuthWithTenant : [requireAuthWithTenant];
  let i = 0;
  const nextHandler = () => {
    if (i < handlers.length) {
      const handler = handlers[i++];
      handler(req, res, nextHandler);
    } else {
      if (!req.user) {
        res.status(401).json({ code: "401", message: "未登录" });
        return;
      }
      if (!req.user.storeId && !req.user.roles?.includes("SUPER_ADMIN")) {
        res.status(403).json({ code: "403", message: "无门店权限" });
        return;
      }
      next();
    }
  };
  nextHandler();
};

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Webhook 接收端点（无需认证）
 * ──────────────────────────────────────────────────────────────────────────── */

const webhookRouter = Router();
instantRetailRouter.use("/webhook", webhookRouter);

webhookRouter.post("/jd", ctrl.handleJdWebhook);
webhookRouter.post("/meituan", ctrl.handleMeituanWebhook);
webhookRouter.post("/eleme", ctrl.handleElemeWebhook);

/* ────────────────────────────────────────────────────────────────────────────
 * 2. 管理后台配置端点（需要 requireAuthWithTenant）
 * ──────────────────────────────────────────────────────────────────────────── */

const adminRouter = Router();
instantRetailRouter.use("/admin/instant-retail", requireAuthWithTenant, adminRouter);

adminRouter.get("/platforms", ctrl.getPlatforms);
adminRouter.get("/configs", ctrl.getConfigs);
adminRouter.get("/configs/:platform", ctrl.getConfigByPlatform);
adminRouter.post("/configs", ctrl.upsertConfig);
adminRouter.post("/configs/:platform/test", ctrl.testConnection);
adminRouter.post("/configs/:platform/sync-orders", ctrl.syncOrders);
adminRouter.post("/configs/:platform/sync-products", ctrl.syncProducts);
adminRouter.delete("/configs/:platform", ctrl.deleteConfig);

/* ────────────────────────────────────────────────────────────────────────────
 * 3. 门店端查询端点（需要 storeAuth）
 * ──────────────────────────────────────────────────────────────────────────── */

const storeRouter = Router();
instantRetailRouter.use("/store/instant-retail", storeAuth, storeRouter);

storeRouter.get("/orders", ctrl.listOrders);
storeRouter.get("/orders/:platformOrderId", ctrl.getOrderDetail);
storeRouter.post("/orders/:platformOrderId/confirm", ctrl.confirmOrder);
storeRouter.post("/orders/:platformOrderId/start-delivery", ctrl.startDelivery);
storeRouter.post("/orders/:platformOrderId/complete-delivery", ctrl.completeDelivery);
storeRouter.post("/orders/:platformOrderId/cancel", ctrl.cancelOrder);