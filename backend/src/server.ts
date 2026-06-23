import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./shared/env.js";
import { initDatabase } from "./shared/db.js";
import { errorHandler } from "./shared/error-handler.js";
import { requireAuth } from "./shared/auth.js";
import { adminRouter } from "./routes/admin.routes.js";
import { storeRouter } from "./routes/store.routes.js";
import { miniappRouter } from "./routes/miniapp.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";
import { shareRouter } from "./routes/share.routes.js";
import { instantRetailRouter } from "./routes/instant-retail.routes.js";
import { reportRouter } from "./routes/report.routes.js";
import { alertRouter } from "./routes/alert.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { miniappCartRouter } from "./routes/cart.routes.js";
import { miniappAftersaleRouter, adminAftersaleRouter } from "./routes/aftersale.routes.js";
import { startAlertScheduler } from "./services/alert.service.js";
import { inventoryBatchRouter, startExpiryScanner } from "./routes/inventory-batch.routes.js";
import { adminStoreControlRouter, storeStoreControlRouter, startStoreControlScheduler } from "./routes/store-control.routes.js";
import { priceRouter } from "./routes/price.routes.js";
import { creditRouter } from "./routes/credit.routes.js";
import { adminTraceRouter, miniappTraceRouter } from "./routes/trace.routes.js";
import { adminMarketingRouter, miniappMarketingRouter } from "./routes/marketing.routes.js";
import { wechatRouter } from "./routes/wechat.routes.js";
import { orderTimeoutRouter, startOrderTimeoutScanner } from "./routes/order-timeout.routes.js";
import { purchasePaymentRouter } from "./routes/purchase-payment.routes.js";
import { rbacRouter } from "./routes/rbac.routes.js";
import { adminNotificationRouter, miniappNotificationRouter } from "./routes/notification.routes.js";
import { adminTransferRouter, storeTransferRouter } from "./routes/transfer.routes.js";
import { adminStockCheckRouter, storeStockCheckRouter } from "./routes/stock-check.routes.js";
import { auditRouter } from "./routes/audit.routes.js";
import { exportRouter } from "./routes/export.routes.js";
import { sysConfigRouter } from "./routes/sys-config.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ code: "0", message: "ok", data: { service: "zhixiang-backend" } });
});

app.use("/api/admin", adminRouter);
app.use("/api/admin/reports", reportRouter);
app.use("/api/admin/alerts", alertRouter);
app.use("/api/admin/dashboard", dashboardRouter);
app.use("/api/store", storeRouter);
app.use("/api/miniapp", miniappRouter);
app.use("/api/pay", paymentRouter);
app.use("/api/share", shareRouter);
app.use("/api/instant-retail", instantRetailRouter);
app.use("/api/miniapp/cart", requireAuth, miniappCartRouter);
app.use("/api/miniapp/aftersales", miniappAftersaleRouter);
app.use("/api/admin/aftersales", adminAftersaleRouter);
app.use("/api/admin/prices", priceRouter);
app.use("/api/admin/credits", creditRouter);
app.use("/api/admin/trace", requireAuth, adminTraceRouter);
app.use("/api/admin/inventory-batch", requireAuth, inventoryBatchRouter);
app.use("/api/admin/store-control", requireAuth, adminStoreControlRouter);
app.use("/api/store/control", storeStoreControlRouter);
app.use("/api/miniapp/trace", miniappTraceRouter);
app.use("/api/admin/marketing", adminMarketingRouter);
app.use("/api/miniapp/marketing", miniappMarketingRouter);
app.use("/api/miniapp/wechat", wechatRouter);
app.use("/api/admin/order-timeout", requireAuth, orderTimeoutRouter);
app.use("/api/admin/purchase-payments", requireAuth, purchasePaymentRouter);
app.use("/api/admin/roles", requireAuth, rbacRouter);
app.use("/api/admin/notifications", requireAuth, adminNotificationRouter);
app.use("/api/miniapp/notifications", miniappNotificationRouter);
app.use("/api/admin/transfers", requireAuth, adminTransferRouter);
app.use("/api/store/transfers", storeTransferRouter);
app.use("/api/admin/stock-checks", requireAuth, adminStockCheckRouter);
app.use("/api/store/stock-checks", storeStockCheckRouter);
app.use("/api/admin/audit-logs", requireAuth, auditRouter);
app.use("/api/admin/export", requireAuth, exportRouter);
app.use("/api/admin/sys-config", requireAuth, sysConfigRouter);

app.use(errorHandler);

export { app };

async function start() {
  if (!env.USE_MOCK_DB) {
    await initDatabase();
  }

  app.listen(env.PORT, () => {
    console.log(`zhixiang-backend listening on http://localhost:${env.PORT}`);
    // 启动预警定时检查
    startAlertScheduler();
    // 启动效期扫描器
    startExpiryScanner();
    // 启动门店管控定时检查器
    startStoreControlScheduler();
    // 启动订单超时扫描器
    startOrderTimeoutScanner();
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch((error) => {
    console.error("❌ 后端启动失败:", error);
    process.exit(1);
  });
}

export { start };
