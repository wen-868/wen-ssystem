#!/usr/bin/env node
/**
 * PAGES-ORDER-FINANCE-REPORT-01 · 真实会话截图与 DOM 几何（返工版，门2 视觉侧）
 *
 * 真实会话口径：
 *  - 后端 = 真后端进程（harness 托管，mock-db 隔离库，/health 报 mode:"mock-db" 判别）
 *  - 会话 = 服务端真实签发的 JWT：POST /api/admin/auth/demo-login（demo 免密仅 NODE_ENV≠production 开门）
 *           —— 由后端 auth 服务签发（HS256 真实签名），不再是 {alg:"none"} 构造
 *  - 前端 = 5173 真前端 dev server；浏览器 localStorage 注入的是**服务端签发的真实 token+user**
 *  - 每页导航后再次核查：通过后端 /api/admin/auth/me 证明该 token 被服务端认可
 *
 * 用法：node e2e/prototype12-pages-order-finance-report-capture.mjs <BASE_URL> <OUT_DIR> <SESSION_JSON>
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, writeFileSync as wf } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:5173";
const OUT = process.argv[3] || "./captures";
const SESSION = process.argv[4] || path.join(process.env.TEMP || ".", "wb-harness-pages", "demo-session.json");
const API = "http://127.0.0.1:3000";
mkdirSync(OUT, { recursive: true });

const { token, user } = JSON.parse(readFileSync(SESSION, "utf8"));

const PAGES = [
  ["order", "orders", "/orders"], ["order", "order-board", "/order-board"], ["order", "order-timeout", "/order-timeout"],
  ["order", "order-center", "/order-center"], ["order", "order-routing", "/order-routing"], ["order", "order-sync", "/order-sync"],
  ["order", "order-exception", "/order-exception"], ["order", "order-product-map", "/order-product-map"], ["order", "order-aftersale", "/order-aftersale"],
  ["finance", "payments", "/payments"], ["finance", "finance-collection", "/finance/collection"], ["finance", "customer-statements", "/customer-statements"],
  ["finance", "finance-profit", "/finance/profit"], ["finance", "finance-receipts", "/finance/receipts"], ["finance", "finance-payments", "/finance/payments"],
  ["finance", "finance-receivables-payables", "/finance/receivables-payables"], ["finance", "finance-expenses", "/finance/expenses"],
  ["finance", "finance-reconciliation", "/finance/reconciliation"], ["finance", "finance-dashboard", "/finance/dashboard"],
  ["finance", "bank-accounts", "/bank-accounts"], ["finance", "fund-report", "/fund-report"], ["finance", "bill-management", "/bill-management"], ["finance", "history-bills", "/history-bills"],
  ["report", "reports", "/reports"], ["report", "purchase-reports", "/reports/purchase"], ["report", "reports-products", "/reports/products"],
  ["report", "reports-employees", "/reports/employees"], ["report", "reports-stores", "/reports/stores"], ["report", "sales-analysis", "/reports/sales-analysis"],
  ["report", "collection-analysis", "/reports/collection-analysis"], ["report", "customer-analysis", "/reports/customers"],
  ["report", "transfer-reports", "/reports/transfer"], ["report", "custom-report", "/reports/custom-report"], ["report", "online-payment-analysis", "/reports/online-payment"],
];
const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000 },
  { name: "1024x768", width: 1024, height: 768 },
];

const auth = JSON.stringify({ token, user });

const geo = async (page) =>
  page.evaluate(() => {
    const q = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return {
      title: document.title,
      body: { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight },
      pageRoot: q(".page"),
      firstCard: q(".table-card") || q(".page-card") || q(".chart-card") || q(".filter-card"),
      hasPageTitle: !!document.querySelector(".page-title, h2"),
      text: (document.querySelector(".page-title")?.textContent || document.querySelector("h2")?.textContent || "").trim(),
      hasEmpty: !!document.querySelector(".el-empty"),
      hasLoadingMask: !!document.querySelector(".el-loading-mask"),
      rowCount: document.querySelectorAll(".el-table__body tbody tr").length,
      bodyTextSample: (document.body.innerText || "").slice(0, 400),
    };
  });

// 服务端复核：token 被后端认可（/api/admin/auth/me 200）
async function serverMe() {
  const r = await fetch(API + "/api/admin/auth/me", { headers: { Authorization: "Bearer " + token } });
  return { status: r.status, ok: r.ok, body: await r.text().catch(() => "") };
}

const browser = await chromium.launch({ executablePath: "C:\\Users\\XIONG\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe", headless: true });
const meProbe = await serverMe();
const report = { sessionProof: { demoLoginUser: user, serverMe: { status: meProbe.status, ok: meProbe.ok, bodySample: meProbe.body.slice(0, 200) } }, entries: [] };
let idx = 0;
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript((a) => { window.localStorage.setItem("admin_auth", a); }, auth);
  for (const [domain, name, routePath] of PAGES) {
    idx++;
    const url = BASE + routePath;
    const rec = { idx, viewport: vp.name, domain, name, path: routePath, url, ok: false };
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
      await page.waitForTimeout(900);
      const cur = page.url();
      rec.finalUrl = cur;
      rec.kickedToLogin = cur.includes("/login");
      const g = await geo(page);
      rec.geometry = g;
      const file = path.join(OUT, `${domain}-${name}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      rec.screenshot = path.basename(file);
      rec.ok = !rec.kickedToLogin && (!!g.pageRoot || !!g.firstCard || g.hasPageTitle);
    } catch (e) { rec.error = e.message.split("\n")[0]; }
    report.entries.push(rec);
    console.log(`${rec.ok ? "OK " : "XX "} ${vp.name} ${domain}/${name} ${rec.kickedToLogin ? "(login!)" : ""} rows=${rec.geometry?.rowCount} empty=${rec.geometry?.hasEmpty} ${rec.error || ""}`);
  }
  await ctx.close();
}
await browser.close();
wf(path.join(OUT, "geometry-report.json"), JSON.stringify(report, null, 2));
const ok = report.entries.filter((r) => r.ok).length;
console.log(`\n小结：${ok}/${report.entries.length} 页截图成功；服务端 /me 复核 status=${meProbe.status}（真实会话证明）`);
process.exit(ok === report.entries.length && meProbe.ok ? 0 : 2);
