import { Router } from "express";
import { requirePlatformAuth } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";

export const platformMonitorRouter = Router();

let lastError: string | null = null;
let requestCount = 0;
let lastQpsTime = Date.now();
let currentQps = 0;

// Track requests for QPS calculation
setInterval(() => {
  const now = Date.now();
  const elapsed = (now - lastQpsTime) / 1000;
  currentQps = Math.round(requestCount / elapsed);
  requestCount = 0;
  lastQpsTime = now;
}, 5000);

// Middleware to count requests
platformMonitorRouter.use((_req, _res, next) => {
  requestCount++;
  next();
});

platformMonitorRouter.get("/", requirePlatformAuth, asyncHandler(async (_req, res) => {
  const mem = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = Math.floor(process.uptime());

  // Store last error for monitoring
  const originalHandler = (process as any)._lastUncaughtError;
  if (originalHandler) {
    lastError = String(originalHandler);
  }

  res.json(ok({
    uptime,
    connections: currentQps > 0 ? currentQps : 0,
    qps: currentQps,
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
      external: `${(mem.external / 1024 / 1024).toFixed(1)} MB`,
    },
    cpu: {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000),
    },
    nodeVersion: process.version,
    platform: process.platform,
    lastError,
  }));
}));