import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as platformIntegrationController from "../controllers/instant-retail/platform-integration.controller.js";
import * as orderReceivingController from "../controllers/instant-retail/order-receiving.controller.js";
import * as fulfillmentController from "../controllers/instant-retail/fulfillment.controller.js";

export const instantRetailRouter = Router();

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

instantRetailRouter.post("/webhook/jd", platformIntegrationController.handleJdWebhook);
instantRetailRouter.post("/webhook/meituan", platformIntegrationController.handleMeituanWebhook);
instantRetailRouter.post("/webhook/eleme", platformIntegrationController.handleElemeWebhook);

/* ────────────────────────────────────────────────────────────────────────────
 * 2. 管理后台配置端点（需要 requireAuthWithTenant）
 * ──────────────────────────────────────────────────────────────────────────── */

const adminRouter = Router();
instantRetailRouter.use("/admin/instant-retail", requireAuthWithTenant, adminRouter);

adminRouter.get("/platforms", platformIntegrationController.getPlatforms);
adminRouter.get("/configs", platformIntegrationController.getConfigs);
adminRouter.get("/configs/:platform", platformIntegrationController.getConfigByPlatform);
adminRouter.post("/configs", platformIntegrationController.upsertConfig);
adminRouter.post("/configs/:platform/test", platformIntegrationController.testConnection);
adminRouter.post("/configs/:platform/sync-orders", platformIntegrationController.syncOrders);
adminRouter.post("/configs/:platform/sync-products", platformIntegrationController.syncProducts);
adminRouter.delete("/configs/:platform", platformIntegrationController.deleteConfig);

/* ────────────────────────────────────────────────────────────────────────────
 * 3. 门店端端点（需要 storeAuth）
 * ──────────────────────────────────────────────────────────────────────────── */

const storeRouter = Router();
instantRetailRouter.use("/store/instant-retail", storeAuth, storeRouter);

storeRouter.get("/orders", orderReceivingController.listOrders);
storeRouter.get("/orders/:platformOrderId", orderReceivingController.getOrderDetail);
storeRouter.post("/orders/:platformOrderId/confirm", orderReceivingController.confirmOrder);
storeRouter.post("/orders/:platformOrderId/cancel", orderReceivingController.cancelOrder);
storeRouter.post("/orders/:platformOrderId/start-delivery", fulfillmentController.startDelivery);
storeRouter.post("/orders/:platformOrderId/complete-delivery", fulfillmentController.completeDelivery);
