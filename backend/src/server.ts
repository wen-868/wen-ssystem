import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./shared/env.js";
import { initDatabase } from "./shared/db.js";
import { errorHandler } from "./shared/error-handler.js";
import { adminRouter } from "./routes/admin.routes.js";
import { storeRouter } from "./routes/store.routes.js";
import { miniappRouter } from "./routes/miniapp.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";
import { shareRouter } from "./routes/share.routes.js";
import { instantRetailRouter } from "./routes/instant-retail.routes.js";
import { reportRouter } from "./routes/report.routes.js";
import { alertRouter } from "./routes/alert.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { startAlertScheduler } from "./services/alert.service.js";

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

app.use(errorHandler);

async function start() {
  if (!env.USE_MOCK_DB) {
    await initDatabase();
  }

  app.listen(env.PORT, () => {
    console.log(`zhixiang-backend listening on http://localhost:${env.PORT}`);
    // 启动预警定时检查
    startAlertScheduler();
  });
}

start().catch((error) => {
  console.error("❌ 后端启动失败:", error);
  process.exit(1);
});
