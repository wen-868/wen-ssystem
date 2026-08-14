/**
 * 轻量压测脚本（验收基线用）
 *
 * 用法：
 *   node scripts/load-test.mjs [--base http://127.0.0.1:8080] [--concurrency 20] [--duration 15] [--scenario api]
 *
 * 场景：
 *   health   GET  /health                                   （健康检查，无鉴权）
 *   login    POST /api/store/auth/login store_manager       （登录，限流接口，注意并发不宜过高）
 *   api      POST 登录后带 token 调 /api/store/dashboard     （核心业务链路）
 *
 * 输出：控制台摘要 + docs/reports/load-test-{时间戳}.json / .md
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

const BASE = arg("--base", "http://127.0.0.1:8080");
const CONCURRENCY = Number(arg("--concurrency", "20"));
const DURATION_MS = Number(arg("--duration", "15")) * 1000;
const TARGET_QPS = Number(arg("--qps", "0"));
const SCENARIO = arg("--scenario", "api");

// 请求间隔节流（毫秒）：达到目标 QPS 时每个 worker 的发送间隔
const WORKER_INTERVAL_MS = TARGET_QPS > 0 ? Math.max(1, (CONCURRENCY / TARGET_QPS) * 1000) : 0;

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    const elapsed = Math.round((performance.now() - start) * 100) / 100;
    const rawBody = await res.text();
    return { ok: res.ok, status: res.status, elapsed, rawBody, error: null };
  } catch (err) {
    return { ok: false, status: 0, elapsed: 0, error: String(err?.message || err) };
  }
}

async function scenarioRequest(token = "") {
  if (SCENARIO === "health") {
    return timedFetch(`${BASE}/health`);
  }
  if (SCENARIO === "login") {
    return timedFetch(`${BASE}/api/store/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "store_manager", password: "admin123" }),
    });
  }
  // api 场景：预热登录已取得 token，压测核心业务接口
  if (!token) return { ok: false, status: 0, elapsed: 0, error: "缺少 token" };
  return timedFetch(`${BASE}/api/store/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function run() {
  // api/login 场景预热登录一次拿 token（登录限流 100 次/15 分钟，压测阶段只允许 1 次）
  let token = "";
  if (SCENARIO === "api") {
    const login = await timedFetch(`${BASE}/api/store/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "store_manager", password: "admin123" }),
    });
    try {
      const data = JSON.parse(login.rawBody || "{}");
      token = data?.data?.token || "";
    } catch { /* 忽略 */ }
    if (!token) {
      console.error("预热登录失败，无法压测 api 场景:", login.status, login.error);
      process.exit(1);
    }
  }

  const results = [];
  const startAt = Date.now();

  async function worker() {
    while (Date.now() - startAt < DURATION_MS) {
      results.push(await scenarioRequest(token));
      if (WORKER_INTERVAL_MS > 0) {
        await new Promise((r) => setTimeout(r, WORKER_INTERVAL_MS));
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const okCount = results.filter((r) => r.ok).length;
  const errs = results.filter((r) => !r.ok);
  const latencies = results.filter((r) => r.elapsed > 0).map((r) => r.elapsed).sort((a, b) => a - b);
  const p = (q) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] : 0);
  const totalSec = (Date.now() - startAt) / 1000;

  const summary = {
    scenario: SCENARIO,
    base: BASE,
    concurrency: CONCURRENCY,
    durationSec: DURATION_MS / 1000,
    totalRequests: results.length,
    success: okCount,
    failed: errs.length,
    successRate: results.length ? `${((okCount / results.length) * 100).toFixed(2)}%` : "0%",
    qps: results.length ? (results.length / totalSec).toFixed(1) : "0",
    targetQps: TARGET_QPS || "max",
    p50Ms: p(0.5).toFixed(1),
    p95Ms: p(0.95).toFixed(1),
    p99Ms: p(0.99).toFixed(1),
    maxMs: latencies.length ? Math.max(...latencies).toFixed(1) : "0",
    errorSamples: errs.slice(0, 5).map((e) => ({ status: e.status, error: e.error })),
  };

  console.log("======= 压测摘要 =======");
  console.log(JSON.stringify(summary, null, 2));

  const dir = join(ROOT, "docs", "reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonPath = join(dir, `load-test-${stamp}.json`);
  const mdPath = join(dir, `load-test-${stamp}.md`);
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  writeFileSync(mdPath, [
    `# 压测报告 ${stamp}`,
    "",
    `| 项目 | 值 |`,
    `|---|---|`,
    `| 场景 | ${summary.scenario} |`,
    `| 目标 | ${summary.base} |`,
    `| 并发 | ${summary.concurrency} |`,
    `| 时长 | ${summary.durationSec}s |`,
    `| 总请求 | ${summary.totalRequests} |`,
    `| 成功率 | ${summary.successRate} |`,
    `| QPS | ${summary.qps} |`,
    `| P50 | ${summary.p50Ms}ms |`,
    `| P95 | ${summary.p95Ms}ms |`,
    `| P99 | ${summary.p99Ms}ms |`,
    `| Max | ${summary.maxMs}ms |`,
    "",
    "> 由 `node scripts/load-test.mjs` 生成（验收基线，非生产环境数据）",
  ].join("\n"), "utf8");
  console.log(`报告已保存: ${mdPath}`);
}

run().catch((err) => {
  console.error("压测执行失败:", err);
  process.exit(1);
});
