import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./shared/env.js";
import { errorHandler } from "./shared/error-handler.js";
import { adminRouter } from "./routes/admin.routes.js";
import { storeRouter } from "./routes/store.routes.js";
import { miniappRouter } from "./routes/miniapp.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";
import { shareRouter } from "./routes/share.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ code: "0", message: "ok", data: { service: "zhixiang-backend" } });
});

app.use("/api/admin", adminRouter);
app.use("/api/store", storeRouter);
app.use("/api/miniapp", miniappRouter);
app.use("/api/pay", paymentRouter);
app.use("/api/share", shareRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`zhixiang-backend listening on http://localhost:${env.PORT}`);
});
