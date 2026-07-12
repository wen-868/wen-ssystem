import { ok } from "../../shared/response";

let lastError: string | null = null;
let requestCount = 0;
let lastQpsTime = Date.now();
let currentQps = 0;

setInterval(() => {
  const now = Date.now();
  const elapsed = (now - lastQpsTime) / 1000;
  currentQps = Math.round(requestCount / elapsed);
  requestCount = 0;
  lastQpsTime = now;
}, 5000);

export function trackRequest() {
  requestCount++;
}

export async function getMonitorStats(_req: any, res: any) {
  const mem = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = Math.floor(process.uptime());

  const originalHandler = (process as { _lastUncaughtError?: unknown })._lastUncaughtError;
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
}
